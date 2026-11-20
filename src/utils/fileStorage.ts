import * as FileSystem from 'expo-file-system/legacy';

const BILLS_DIR_NAME = 'bills';

/**
 * Returns the full directory path for bill images.
 */
export function getBillsDirectory(): string {
  const docDir = FileSystem.documentDirectory || '';
  return `${docDir}${BILLS_DIR_NAME}/`;
}

/**
 * Ensures the bills directory exists in permanent storage.
 */
export async function ensureBillsDirectoryExists(): Promise<void> {
  const dir = getBillsDirectory();
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (error) {
    console.error('Error creating bills directory:', error);
  }
}

/**
 * Copies an image picked from camera or gallery to permanent app storage.
 * Returns the relative path (e.g. 'bills/bill_xxx.jpg') to be stored in the database.
 */
export async function saveImagePermanently(sourceUri: string): Promise<string> {
  await ensureBillsDirectoryExists();

  const extension = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const filename = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
  const targetUri = `${getBillsDirectory()}${filename}`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: targetUri,
  });

  return `${BILLS_DIR_NAME}/${filename}`;
}

/**
 * Resolves a stored relative path or URI to an absolute file URI usable by <Image>.
 */
export function resolveImagePath(storedPath: string): string {
  if (!storedPath) return '';
  if (storedPath.startsWith('file://') || storedPath.startsWith('content://')) {
    return storedPath;
  }
  const docDir = FileSystem.documentDirectory || '';
  if (storedPath.startsWith(`${BILLS_DIR_NAME}/`)) {
    return `${docDir}${storedPath}`;
  }
  return `${docDir}${BILLS_DIR_NAME}/${storedPath}`;
}

/**
 * Deletes an image file from the device storage.
 */
export async function deleteImageFile(storedPath: string): Promise<void> {
  try {
    const fullPath = resolveImagePath(storedPath);
    const info = await FileSystem.getInfoAsync(fullPath);
    if (info.exists) {
      await FileSystem.deleteAsync(fullPath, { idempotent: true });
    }
  } catch (error) {
    console.warn('Failed to delete image file:', storedPath, error);
  }
}
