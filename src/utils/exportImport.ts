import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import JSZip from 'jszip';
import { Bill, AppSettings } from '../types';
import { fromPaise } from './currency';
import { getBillsDirectory, ensureBillsDirectoryExists } from './fileStorage';

function escapeCSV(field: string | number | undefined | null): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports all bills to CSV and triggers native share dialog.
 */
export async function exportBillsToCSV(
  bills: Bill[],
  settings: AppSettings
): Promise<boolean> {
  const headers = [
    'Bill ID',
    'Date',
    'Vendor / Shop',
    'Category',
    'Amount',
    'Currency',
    'Payment Method',
    'Notes',
    'Image Count',
    'Line Items',
    'Created At',
  ];

  const rows = bills.map((bill) => {
    const itemsSummary = bill.items && bill.items.length > 0
      ? bill.items.map((i) => `${i.name} (x${i.quantity} @ ${fromPaise(i.unit_price)})`).join('; ')
      : '';

    return [
      bill.id,
      bill.date,
      escapeCSV(bill.vendor),
      escapeCSV(bill.category_name || 'Other'),
      fromPaise(bill.total_amount).toFixed(2),
      settings.currencySymbol,
      bill.payment_method,
      escapeCSV(bill.notes || ''),
      bill.image_count || (bill.images ? bill.images.length : 0),
      escapeCSV(itemsSummary),
      bill.created_at,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const filename = `ExpenseLedger_${new Date().toISOString().slice(0, 10)}.csv`;
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Expense Ledger CSV',
      UTI: 'public.comma-separated-values-text',
    });
    return true;
  }
  return false;
}

/**
 * Creates a complete zip backup containing the SQLite database and all bill photos.
 */
export async function createFullBackupZip(totalBills: number): Promise<boolean> {
  const zip = new JSZip();

  // 1. Add metadata
  const metadata = {
    appName: 'Expense Ledger',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    totalBills,
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // 2. Add SQLite Database file
  const dbDir = `${FileSystem.documentDirectory}SQLite/`;
  const dbPath = `${dbDir}expense_ledger.db`;
  const dbInfo = await FileSystem.getInfoAsync(dbPath);

  if (dbInfo.exists) {
    const dbBase64 = await FileSystem.readAsStringAsync(dbPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    zip.file('expense_ledger.db', dbBase64, { base64: true });
  }

  // 3. Add all bill images
  const billsDir = getBillsDirectory();
  const billsDirInfo = await FileSystem.getInfoAsync(billsDir);
  if (billsDirInfo.exists && billsDirInfo.isDirectory) {
    const imageFiles = await FileSystem.readDirectoryAsync(billsDir);
    const imagesFolder = zip.folder('bills');

    for (const imgName of imageFiles) {
      const imgPath = `${billsDir}${imgName}`;
      try {
        const imgBase64 = await FileSystem.readAsStringAsync(imgPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        imagesFolder?.file(imgName, imgBase64, { base64: true });
      } catch (err) {
        console.warn(`Could not read image file ${imgName}:`, err);
      }
    }
  }

  // 4. Generate zip file
  const zipBase64 = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const zipFilename = `ExpenseLedger_Backup_${new Date().toISOString().slice(0, 10)}.zip`;
  const zipUri = `${FileSystem.cacheDirectory}${zipFilename}`;

  await FileSystem.writeAsStringAsync(zipUri, zipBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(zipUri, {
      mimeType: 'application/zip',
      dialogTitle: 'Export Expense Ledger Full Backup',
      UTI: 'public.zip-archive',
    });
    return true;
  }
  return false;
}

/**
 * Restores database and bill images from a selected zip backup.
 */
export async function restoreFullBackupZip(): Promise<{ success: boolean; message: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/zip', 'application/x-zip-compressed', '*/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, message: 'Restore cancelled.' };
    }

    const pickedFile = result.assets[0];
    const zipBase64 = await FileSystem.readAsStringAsync(pickedFile.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const zip = await JSZip.loadAsync(zipBase64, { base64: true });

    // Verify zip contains database
    const dbFile = zip.file('expense_ledger.db');
    if (!dbFile) {
      return {
        success: false,
        message: 'Invalid backup file: expense_ledger.db not found in archive.',
      };
    }

    // 1. Restore Database file
    const dbDir = `${FileSystem.documentDirectory}SQLite/`;
    const dbDirInfo = await FileSystem.getInfoAsync(dbDir);
    if (!dbDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
    }
    const restoredDbBase64 = await dbFile.async('base64');
    await FileSystem.writeAsStringAsync(`${dbDir}expense_ledger.db`, restoredDbBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 2. Restore Images
    await ensureBillsDirectoryExists();
    const billsDir = getBillsDirectory();

    const imageFiles = Object.keys(zip.files).filter(
      (path) => path.startsWith('bills/') && !zip.files[path].dir
    );

    for (const imageRelPath of imageFiles) {
      const filename = imageRelPath.replace('bills/', '');
      if (filename) {
        const imgObj = zip.file(imageRelPath);
        if (imgObj) {
          const imgBase64 = await imgObj.async('base64');
          await FileSystem.writeAsStringAsync(`${billsDir}${filename}`, imgBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      }
    }

    return {
      success: true,
      message: `Successfully restored database and ${imageFiles.length} bill images. Please restart or refresh the app.`,
    };
  } catch (error: any) {
    console.error('Error during restore:', error);
    return {
      success: false,
      message: `Restore failed: ${error?.message || 'Unknown error'}`,
    };
  }
}
