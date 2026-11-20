import * as SQLite from 'expo-sqlite';
import { DEFAULT_CATEGORIES } from '../constants/categories';

export const DB_NAME = 'expense_ledger.db';
const SCHEMA_VERSION = 5;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
    initDatabase(dbInstance);
  }
  return dbInstance;
}

export function initDatabase(db: SQLite.SQLiteDatabase): void {
  // 1. Enable WAL mode for high performance concurrent reads and atomic writes
  db.execSync('PRAGMA journal_mode = WAL;');
  // 2. Enable Foreign Key constraints
  db.execSync('PRAGMA foreign_keys = ON;');

  // 3. Check current schema version
  const versionRow = db.getFirstSync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    migrateToV1(db);
  }

  if (currentVersion < 2) {
    migrateToV2(db);
  }

  if (currentVersion < 3) {
    migrateToV3(db);
  }

  if (currentVersion < 4) {
    migrateToV4(db);
  }

  if (currentVersion < 5) {
    migrateToV5(db);
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }
}

function migrateToV1(db: SQLite.SQLiteDatabase): void {
  db.withTransactionSync(() => {
    // 1. Categories table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // 2. Bills table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        vendor TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        total_amount INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // 3. Bill items table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        quantity REAL DEFAULT 1,
        unit_price INTEGER NOT NULL,
        line_total INTEGER NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
      );
    `);

    // 4. Bill images table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS bill_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // 5. App settings table
    db.execSync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // 6. High-performance indexes
    db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date DESC);
      CREATE INDEX IF NOT EXISTS idx_bills_category_id ON bills(category_id);
      CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor);
      CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id);
      CREATE INDEX IF NOT EXISTS idx_bill_images_bill_id ON bill_images(bill_id);
    `);

    // 7. Seed default categories if empty
    const catCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM categories;');
    if (!catCount || catCount.count === 0) {
      const now = new Date().toISOString();
      const insertCatStmt = db.prepareSync(
        'INSERT INTO categories (name, color, icon, is_default, created_at) VALUES ($name, $color, $icon, 1, $now);'
      );
      try {
        for (const cat of DEFAULT_CATEGORIES) {
          insertCatStmt.executeSync({
            $name: cat.name,
            $color: cat.color,
            $icon: cat.icon,
            $now: now,
          });
        }
      } finally {
        insertCatStmt.finalizeSync();
      }
    }
  });
}

function migrateToV2(db: SQLite.SQLiteDatabase): void {
  try {
    // Check if category_id column already exists in bill_items
    const tableInfo = db.getAllSync<{ name: string }>('PRAGMA table_info(bill_items);');
    const hasCategoryCol = tableInfo.some((col) => col.name === 'category_id');

    if (!hasCategoryCol) {
      db.execSync(`
        ALTER TABLE bill_items ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
      `);
    }

    db.execSync(`
      CREATE INDEX IF NOT EXISTS idx_bill_items_category_id ON bill_items(category_id);
    `);
  } catch (err) {
    console.warn('Migration V2 notice:', err);
  }
}

function migrateToV3(db: SQLite.SQLiteDatabase): void {
  try {
    db.withTransactionSync(() => {
      // 1. Accounts table
      db.execSync(`
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          account_number TEXT,
          initial_balance INTEGER NOT NULL DEFAULT 0,
          color TEXT NOT NULL,
          icon TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
      `);

      // 2. Add account_id to bills table if missing
      const tableInfo = db.getAllSync<{ name: string }>('PRAGMA table_info(bills);');
      const hasAccountCol = tableInfo.some((col) => col.name === 'account_id');
      if (!hasAccountCol) {
        db.execSync(`
          ALTER TABLE bills ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
        `);
        db.execSync(`
          CREATE INDEX IF NOT EXISTS idx_bills_account_id ON bills(account_id);
        `);
      }

      // 3. Incomes table (Deposits, Salary, Payments received)
      db.execSync(`
        CREATE TABLE IF NOT EXISTS incomes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          source TEXT NOT NULL,
          amount INTEGER NOT NULL,
          account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date DESC);
        CREATE INDEX IF NOT EXISTS idx_incomes_account_id ON incomes(account_id);
      `);

      // 4. Transfers table (Cash withdrawal from bank, bank to bank, etc.)
      db.execSync(`
        CREATE TABLE IF NOT EXISTS transfers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          from_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
          to_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
          amount INTEGER NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date DESC);
        CREATE INDEX IF NOT EXISTS idx_transfers_from_account ON transfers(from_account_id);
        CREATE INDEX IF NOT EXISTS idx_transfers_to_account ON transfers(to_account_id);
      `);

      // 5. Seed default accounts if empty
      const accCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM accounts;');
      if (!accCount || accCount.count === 0) {
        const now = new Date().toISOString();
        db.runSync(`
          INSERT INTO accounts (name, type, account_number, initial_balance, color, icon, is_default, created_at, updated_at)
          VALUES 
            ('Cash in Hand', 'cash', NULL, 0, '#10B981', 'cash-outline', 0, '${now}', '${now}'),
            ('Primary Bank', 'bank', 'Main A/C', 0, '#2563EB', 'business-outline', 1, '${now}', '${now}'),
            ('Primary UPI', 'upi', 'UPI ID', 0, '#8B5CF6', 'phone-portrait-outline', 0, '${now}', '${now}');
        `);

        // Backfill existing bills with default accounts based on payment_method
        const cashAcc = db.getFirstSync<{ id: number }>("SELECT id FROM accounts WHERE type = 'cash' LIMIT 1;");
        const upiAcc = db.getFirstSync<{ id: number }>("SELECT id FROM accounts WHERE type = 'upi' LIMIT 1;");
        const bankAcc = db.getFirstSync<{ id: number }>("SELECT id FROM accounts WHERE type = 'bank' LIMIT 1;");

        if (cashAcc) {
          db.runSync("UPDATE bills SET account_id = ? WHERE payment_method = 'Cash' AND account_id IS NULL;", [cashAcc.id]);
        }
        if (upiAcc) {
          db.runSync("UPDATE bills SET account_id = ? WHERE payment_method = 'UPI' AND account_id IS NULL;", [upiAcc.id]);
        }
        if (bankAcc) {
          db.runSync("UPDATE bills SET account_id = ? WHERE account_id IS NULL;", [bankAcc.id]);
        }
      }
    });
  } catch (err) {
    console.error('Migration V3 failed:', err);
  }
}

function migrateToV4(db: SQLite.SQLiteDatabase): void {
  try {
    db.withTransactionSync(() => {
      // 1. Add linked_bank_id column to accounts table if not exists
      const tableInfo = db.getAllSync<{ name: string }>('PRAGMA table_info(accounts);');
      const hasLinkedBankCol = tableInfo.some((col) => col.name === 'linked_bank_id');
      if (!hasLinkedBankCol) {
        db.execSync(`
          ALTER TABLE accounts ADD COLUMN linked_bank_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
        `);
        db.execSync(`
          CREATE INDEX IF NOT EXISTS idx_accounts_linked_bank ON accounts(linked_bank_id);
        `);
      }

      // 2. Auto-link existing Primary UPI to Primary Bank if both exist and UPI is not linked yet
      const upiAcc = db.getFirstSync<{ id: number; linked_bank_id: number | null }>(
        "SELECT id, linked_bank_id FROM accounts WHERE type = 'upi' AND linked_bank_id IS NULL LIMIT 1;"
      );
      const bankAcc = db.getFirstSync<{ id: number }>(
        "SELECT id FROM accounts WHERE type = 'bank' ORDER BY is_default DESC, id ASC LIMIT 1;"
      );

      if (upiAcc && bankAcc) {
        db.runSync(
          'UPDATE accounts SET linked_bank_id = ? WHERE id = ?;',
          [bankAcc.id, upiAcc.id]
        );
      }
    });
  } catch (err) {
    console.error('Migration V4 failed:', err);
  }
}

function migrateToV5(db: SQLite.SQLiteDatabase): void {
  try {
    db.withTransactionSync(() => {
      // 1. Bill Reminders / Recurring Monthly Alarms table
      db.execSync(`
        CREATE TABLE IF NOT EXISTS bill_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          amount INTEGER NOT NULL DEFAULT 0,
          day_of_month INTEGER NOT NULL,
          time_str TEXT DEFAULT '09:00',
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          vendor TEXT,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          notification_id TEXT,
          last_notified_month TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bill_reminders_day ON bill_reminders(day_of_month);
        CREATE INDEX IF NOT EXISTS idx_bill_reminders_active ON bill_reminders(is_active);
      `);

      // 2. Seed a default milk reminder if no reminders exist
      const countRow = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM bill_reminders;');
      if (!countRow || countRow.count === 0) {
        const now = new Date().toISOString();
        const foodCat = db.getFirstSync<{ id: number }>("SELECT id FROM categories WHERE name = 'Food & Dining' OR name = 'Groceries' LIMIT 1;");
        db.runSync(`
          INSERT INTO bill_reminders (title, amount, day_of_month, time_str, category_id, vendor, notes, is_active, created_at, updated_at)
          VALUES ('Milk Bill', 150000, 5, '09:00', ?, 'Local Milk Vendor', 'Monthly milk payment', 1, ?, ?);
        `, [foodCat?.id ?? null, now, now]);
      }
    });
  } catch (err) {
    console.error('Migration V5 failed:', err);
  }
}
