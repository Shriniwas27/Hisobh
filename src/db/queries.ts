import { getDatabase } from './database';
import {
  Bill,
  BillFilter,
  BillItem,
  BillImage,
  Category,
  CategorySpending,
  MonthSpending,
  Account,
  AccountType,
  Income,
  Transfer,
  AccountTransaction,
  BillReminder,
  VendorSummary,
  UnifiedActivityItem,
  ActivityFilter,
  DestinationSpending,
  AccountOutflowMetrics,
} from '../types';

// ==========================================
// CATEGORY QUERIES
// ==========================================

export function getCategories(): Category[] {
  const db = getDatabase();
  return db.getAllSync<Category>(`
    SELECT 
      c.id, c.name, c.color, c.icon, c.is_default, c.created_at,
      (
        SELECT COUNT(DISTINCT b.id)
        FROM bills b
        WHERE (b.category_id = c.id AND (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) = 0)
           OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id = c.id)
      ) as bill_count,
      (
        COALESCE((
          SELECT SUM(b.total_amount)
          FROM bills b
          WHERE b.category_id = c.id
            AND (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) = 0
        ), 0)
        +
        COALESCE((
          SELECT SUM(bi.line_total)
          FROM bill_items bi
          WHERE bi.category_id = c.id
        ), 0)
      ) as total_spent
    FROM categories c
    ORDER BY c.name ASC;
  `);
}

export function getCategoryById(id: number): Category | null {
  const db = getDatabase();
  return db.getFirstSync<Category>(
    'SELECT * FROM categories WHERE id = ?;',
    [id]
  );
}

export function addCategory(name: string, color: string, icon: string): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.runSync(
    'INSERT INTO categories (name, color, icon, is_default, created_at) VALUES (?, ?, ?, 0, ?);',
    [name.trim(), color, icon, now]
  );
  return result.lastInsertRowId;
}

export function updateCategory(id: number, name: string, color: string, icon: string): void {
  const db = getDatabase();
  db.runSync(
    'UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?;',
    [name.trim(), color, icon, id]
  );
}

export function checkCategoryUsage(id: number): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>(`
    SELECT COUNT(DISTINCT b.id) as count
    FROM bills b
    WHERE b.category_id = ?
       OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id = ?);
  `, [id, id]);
  return row?.count ?? 0;
}

export function reassignCategoryBills(oldCategoryId: number, newCategoryId: number): void {
  const db = getDatabase();
  db.withTransactionSync(() => {
    db.runSync('UPDATE bills SET category_id = ? WHERE category_id = ?;', [newCategoryId, oldCategoryId]);
    db.runSync('UPDATE bill_items SET category_id = ? WHERE category_id = ?;', [newCategoryId, oldCategoryId]);
  });
}

export function deleteCategory(id: number): void {
  const db = getDatabase();
  db.runSync('DELETE FROM categories WHERE id = ?;', [id]);
}

// ==========================================
// BILL CRUD QUERIES
// ==========================================

export function getVendorSuggestions(query: string = ''): string[] {
  const db = getDatabase();
  if (!query.trim()) {
    const rows = db.getAllSync<{ vendor: string }>(
      'SELECT DISTINCT vendor FROM bills ORDER BY date DESC, id DESC LIMIT 6;'
    );
    return rows.map((r) => r.vendor);
  }
  const rows = db.getAllSync<{ vendor: string }>(
    'SELECT DISTINCT vendor FROM bills WHERE vendor LIKE ? ORDER BY date DESC LIMIT 6;',
    [`%${query.trim()}%`]
  );
  return rows.map((r) => r.vendor);
}

export function getRecentBills(limit: number = 5): Bill[] {
  const db = getDatabase();
  return db.getAllSync<Bill>(`
    SELECT 
      b.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      a.name as account_name,
      a.type as account_type,
      a.color as account_color,
      a.icon as account_icon,
      (SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) as image_count,
      (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id) > 0 as is_itemized,
      (SELECT GROUP_CONCAT(bi.name, ', ') FROM bill_items bi WHERE bi.bill_id = b.id) as items_summary
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
    ORDER BY b.date DESC, b.id DESC
    LIMIT ?;
  `, [limit]);
}

export function getFilteredBills(
  filter: BillFilter = {},
  limit: number = 100,
  offset: number = 0
): Bill[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter.searchQuery && filter.searchQuery.trim()) {
    const term = `%${filter.searchQuery.trim()}%`;
    conditions.push('(b.vendor LIKE ? OR b.notes LIKE ? OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.name LIKE ?))');
    params.push(term, term, term);
  }

  if (filter.startDate) {
    conditions.push('b.date >= ?');
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    conditions.push('b.date <= ?');
    params.push(filter.endDate);
  }

  if (filter.categoryIds && filter.categoryIds.length > 0) {
    const placeholders = filter.categoryIds.map(() => '?').join(',');
    conditions.push(`(
      b.category_id IN (${placeholders})
      OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IN (${placeholders}))
    )`);
    params.push(...filter.categoryIds, ...filter.categoryIds);
  }

  if (filter.paymentMethods && filter.paymentMethods.length > 0) {
    const placeholders = filter.paymentMethods.map(() => '?').join(',');
    conditions.push(`b.payment_method IN (${placeholders})`);
    params.push(...filter.paymentMethods);
  }

  if (filter.accountIds && filter.accountIds.length > 0) {
    const placeholders = filter.accountIds.map(() => '?').join(',');
    conditions.push(`b.account_id IN (${placeholders})`);
    params.push(...filter.accountIds);
  }

  if (filter.minAmount !== undefined && filter.minAmount > 0) {
    conditions.push('b.total_amount >= ?');
    params.push(filter.minAmount);
  }

  if (filter.maxAmount !== undefined && filter.maxAmount > 0) {
    conditions.push('b.total_amount <= ?');
    params.push(filter.maxAmount);
  }

  if (filter.hasImagesOnly) {
    conditions.push('(SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) > 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      b.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      a.name as account_name,
      a.type as account_type,
      a.color as account_color,
      a.icon as account_icon,
      (SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) as image_count,
      (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id) > 0 as is_itemized,
      (SELECT GROUP_CONCAT(bi.name, ', ') FROM bill_items bi WHERE bi.bill_id = b.id) as items_summary
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
    ${whereClause}
    ORDER BY b.date DESC, b.id DESC
    LIMIT ? OFFSET ?;
  `;

  return db.getAllSync<Bill>(sql, [...params, limit, offset]);
}

export function getFilteredBillsSummary(filter: BillFilter = {}): { count: number; total_amount: number } {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter.searchQuery && filter.searchQuery.trim()) {
    const term = `%${filter.searchQuery.trim()}%`;
    conditions.push('(b.vendor LIKE ? OR b.notes LIKE ? OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.name LIKE ?))');
    params.push(term, term, term);
  }

  if (filter.startDate) {
    conditions.push('b.date >= ?');
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    conditions.push('b.date <= ?');
    params.push(filter.endDate);
  }

  if (filter.categoryIds && filter.categoryIds.length > 0) {
    const placeholders = filter.categoryIds.map(() => '?').join(',');
    conditions.push(`(
      b.category_id IN (${placeholders})
      OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IN (${placeholders}))
    )`);
    params.push(...filter.categoryIds, ...filter.categoryIds);
  }

  if (filter.paymentMethods && filter.paymentMethods.length > 0) {
    const placeholders = filter.paymentMethods.map(() => '?').join(',');
    conditions.push(`b.payment_method IN (${placeholders})`);
    params.push(...filter.paymentMethods);
  }

  if (filter.accountIds && filter.accountIds.length > 0) {
    const placeholders = filter.accountIds.map(() => '?').join(',');
    conditions.push(`b.account_id IN (${placeholders})`);
    params.push(...filter.accountIds);
  }

  if (filter.minAmount !== undefined && filter.minAmount > 0) {
    conditions.push('b.total_amount >= ?');
    params.push(filter.minAmount);
  }

  if (filter.maxAmount !== undefined && filter.maxAmount > 0) {
    conditions.push('b.total_amount <= ?');
    params.push(filter.maxAmount);
  }

  if (filter.hasImagesOnly) {
    conditions.push('(SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) > 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const row = db.getFirstSync<{ count: number; total_amount: number }>(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(b.total_amount), 0) as total_amount
    FROM bills b
    ${whereClause};
  `, params);

  return {
    count: row?.count ?? 0,
    total_amount: row?.total_amount ?? 0,
  };
}

export function getBillById(id: number): Bill | null {
  const db = getDatabase();
  const bill = db.getFirstSync<Bill>(`
    SELECT 
      b.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      a.name as account_name,
      a.type as account_type,
      a.color as account_color,
      a.icon as account_icon
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
    WHERE b.id = ?;
  `, [id]);

  if (!bill) return null;

  bill.items = db.getAllSync<BillItem>(`
    SELECT 
      bi.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon
    FROM bill_items bi
    LEFT JOIN categories c ON bi.category_id = c.id
    WHERE bi.bill_id = ?
    ORDER BY bi.id ASC;
  `, [id]);

  bill.images = db.getAllSync<BillImage>(
    'SELECT * FROM bill_images WHERE bill_id = ? ORDER BY id ASC;',
    [id]
  );

  bill.image_count = bill.images.length;
  bill.is_itemized = bill.items.length > 0;
  return bill;
}

export function addBill(
  bill: Omit<Bill, 'id' | 'created_at' | 'updated_at'>,
  items: Omit<BillItem, 'id' | 'bill_id'>[] = [],
  imagePaths: string[] = []
): number {
  const db = getDatabase();
  let newBillId = 0;

  db.withTransactionSync(() => {
    const now = new Date().toISOString();
    const result = db.runSync(`
      INSERT INTO bills (
        date, vendor, category_id, total_amount, payment_method, account_id, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [
      bill.date,
      bill.vendor.trim(),
      bill.category_id,
      bill.total_amount,
      bill.payment_method,
      bill.account_id ?? null,
      bill.notes ? bill.notes.trim() : null,
      now,
      now,
    ]);

    newBillId = result.lastInsertRowId;

    // Insert line items with their individual categories
    if (items.length > 0) {
      const itemStmt = db.prepareSync(`
        INSERT INTO bill_items (bill_id, name, quantity, unit_price, line_total, category_id)
        VALUES ($bill_id, $name, $quantity, $unit_price, $line_total, $category_id);
      `);
      try {
        for (const item of items) {
          itemStmt.executeSync({
            $bill_id: newBillId,
            $name: item.name.trim(),
            $quantity: item.quantity,
            $unit_price: item.unit_price,
            $line_total: item.line_total,
            $category_id: item.category_id ?? null,
          });
        }
      } finally {
        itemStmt.finalizeSync();
      }
    }

    // Insert bill images
    if (imagePaths.length > 0) {
      const imgStmt = db.prepareSync(`
        INSERT INTO bill_images (bill_id, file_path, created_at)
        VALUES ($bill_id, $file_path, $created_at);
      `);
      try {
        for (const path of imagePaths) {
          imgStmt.executeSync({
            $bill_id: newBillId,
            $file_path: path,
            $created_at: now,
          });
        }
      } finally {
        imgStmt.finalizeSync();
      }
    }
  });

  return newBillId;
}

export function updateBill(
  billId: number,
  bill: Partial<Bill>,
  items?: Omit<BillItem, 'id' | 'bill_id'>[],
  newImagePaths?: string[],
  deletedImageIds?: number[]
): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    // 1. Update bill row
    db.runSync(`
      UPDATE bills SET
        date = COALESCE(?, date),
        vendor = COALESCE(?, vendor),
        category_id = COALESCE(?, category_id),
        total_amount = COALESCE(?, total_amount),
        payment_method = COALESCE(?, payment_method),
        account_id = COALESCE(?, account_id),
        notes = ?,
        updated_at = ?
      WHERE id = ?;
    `, [
      bill.date ?? null,
      bill.vendor?.trim() ?? null,
      bill.category_id ?? null,
      bill.total_amount ?? null,
      bill.payment_method ?? null,
      bill.account_id !== undefined ? bill.account_id : null,
      bill.notes !== undefined ? (bill.notes ? bill.notes.trim() : null) : null,
      now,
      billId,
    ]);

    // 2. Update line items if provided
    if (items !== undefined) {
      db.runSync('DELETE FROM bill_items WHERE bill_id = ?;', [billId]);
      if (items.length > 0) {
        const itemStmt = db.prepareSync(`
          INSERT INTO bill_items (bill_id, name, quantity, unit_price, line_total, category_id)
          VALUES ($bill_id, $name, $quantity, $unit_price, $line_total, $category_id);
        `);
        try {
          for (const item of items) {
            itemStmt.executeSync({
              $bill_id: billId,
              $name: item.name.trim(),
              $quantity: item.quantity,
              $unit_price: item.unit_price,
              $line_total: item.line_total,
              $category_id: item.category_id ?? null,
            });
          }
        } finally {
          itemStmt.finalizeSync();
        }
      }
    }

    // 3. Delete requested images
    if (deletedImageIds && deletedImageIds.length > 0) {
      const placeholders = deletedImageIds.map(() => '?').join(',');
      db.runSync(`DELETE FROM bill_images WHERE id IN (${placeholders});`, deletedImageIds);
    }

    // 4. Add new images
    if (newImagePaths && newImagePaths.length > 0) {
      const imgStmt = db.prepareSync(`
        INSERT INTO bill_images (bill_id, file_path, created_at)
        VALUES ($bill_id, $file_path, $created_at);
      `);
      try {
        for (const path of newImagePaths) {
          imgStmt.executeSync({
            $bill_id: billId,
            $file_path: path,
            $created_at: now,
          });
        }
      } finally {
        imgStmt.finalizeSync();
      }
    }
  });
}

export function deleteBill(billId: number): string[] {
  const db = getDatabase();
  const images = db.getAllSync<{ file_path: string }>(
    'SELECT file_path FROM bill_images WHERE bill_id = ?;',
    [billId]
  );
  const paths = images.map((i) => i.file_path);
  db.runSync('DELETE FROM bills WHERE id = ?;', [billId]);
  return paths;
}

// ==========================================
// CATEGORY DRILLDOWN QUERIES (TRANSACTIONS FOR A CATEGORY)
// ==========================================

export function getCategoryTransactions(categoryId: number): Bill[] {
  const db = getDatabase();

  // Find bills that belong to this category either as a whole (quick transaction)
  // or via itemized lines in that category
  const bills = db.getAllSync<Bill>(`
    SELECT 
      b.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      a.name as account_name,
      a.type as account_type,
      a.color as account_color,
      a.icon as account_icon,
      (SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) as image_count,
      (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) > 0 as is_itemized,
      (SELECT GROUP_CONCAT(bi.name, ', ') FROM bill_items bi WHERE bi.bill_id = b.id) as items_summary,
      CASE 
        WHEN EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id = ?)
        THEN (SELECT SUM(bi.line_total) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id = ?)
        ELSE b.total_amount
      END as matched_category_amount,
      CASE 
        WHEN EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id = ?)
        THEN (SELECT GROUP_CONCAT(bi.name, ', ') FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id = ?)
        ELSE NULL
      END as matched_items_summary
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
    WHERE (b.category_id = ? AND (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) = 0)
       OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id = ?)
    ORDER BY b.date DESC, b.id DESC;
  `, [categoryId, categoryId, categoryId, categoryId, categoryId, categoryId]);

  return bills;
}

export function getCategoryDrilldownSummary(categoryId: number): { count: number; total_amount: number } {
  const db = getDatabase();

  const row = db.getFirstSync<{ count: number; total_amount: number }>(`
    SELECT 
      COUNT(DISTINCT b.id) as count,
      (
        COALESCE((
          SELECT SUM(b.total_amount)
          FROM bills b
          WHERE b.category_id = ?
            AND (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) = 0
        ), 0)
        +
        COALESCE((
          SELECT SUM(bi.line_total)
          FROM bill_items bi
          WHERE bi.category_id = ?
        ), 0)
      ) as total_amount
    FROM bills b
    WHERE (b.category_id = ? AND (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) = 0)
       OR EXISTS (SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id = ?);
  `, [categoryId, categoryId, categoryId, categoryId]);

  return {
    count: row?.count ?? 0,
    total_amount: row?.total_amount ?? 0,
  };
}

// ==========================================
// ANALYTICS & REPORTS QUERIES
// ==========================================

export function getMonthSummary(yearMonth: string): { total_amount: number; count: number } {
  const db = getDatabase();
  const row = db.getFirstSync<{ total_amount: number; count: number }>(`
    SELECT 
      COALESCE(SUM(total_amount), 0) as total_amount,
      COUNT(id) as count
    FROM bills
    WHERE strftime('%Y-%m', date) = ?;
  `, [yearMonth]);

  return {
    total_amount: row?.total_amount ?? 0,
    count: row?.count ?? 0,
  };
}

export function getCategorySpendingBreakdown(
  startDate?: string,
  endDate?: string,
  accountId?: number | null
): CategorySpending[] {
  const db = getDatabase();
  const conditionsBills: string[] = [];
  const conditionsItems: string[] = [];
  const params: any[] = [];

  if (startDate) {
    conditionsBills.push('b.date >= ?');
    conditionsItems.push('b.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditionsBills.push('b.date <= ?');
    conditionsItems.push('b.date <= ?');
    params.push(endDate);
  }
  if (accountId != null) {
    conditionsBills.push('(b.account_id = ? OR a.linked_bank_id = ? OR (a.type = \'upi\' AND (a.linked_bank_id = ? OR (a.linked_bank_id IS NULL AND (SELECT COUNT(*) FROM accounts WHERE type = \'bank\') = 1))))');
    conditionsItems.push('(b.account_id = ? OR a.linked_bank_id = ? OR (a.type = \'upi\' AND (a.linked_bank_id = ? OR (a.linked_bank_id IS NULL AND (SELECT COUNT(*) FROM accounts WHERE type = \'bank\') = 1))))');
    params.push(accountId, accountId, accountId);
  }

  const whereBills = conditionsBills.length > 0 ? `AND ${conditionsBills.join(' AND ')}` : '';
  const whereItems = conditionsItems.length > 0 ? `AND ${conditionsItems.join(' AND ')}` : '';

  const sql = `
    WITH combined_spending AS (
      -- 1. Bills without item categories
      SELECT 
        b.category_id,
        b.total_amount as amount,
        b.id as bill_id
      FROM bills b
      LEFT JOIN accounts a ON b.account_id = a.id
      WHERE (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) = 0
      ${whereBills}

      UNION ALL

      -- 2. Items with specific category
      SELECT 
        bi.category_id,
        bi.line_total as amount,
        b.id as bill_id
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      LEFT JOIN accounts a ON b.account_id = a.id
      WHERE bi.category_id IS NOT NULL
      ${whereItems}
    )
    SELECT 
      c.id as category_id,
      c.name,
      c.color,
      c.icon,
      COALESCE(SUM(cs.amount), 0) as total_amount,
      COUNT(DISTINCT cs.bill_id) as bill_count
    FROM categories c
    JOIN combined_spending cs ON c.id = cs.category_id
    GROUP BY c.id
    HAVING total_amount > 0
    ORDER BY total_amount DESC;
  `;

  // Parameters need to be passed for both queries in the union
  const unionParams = [...params, ...params];
  const rows = db.getAllSync<{
    category_id: number;
    name: string;
    color: string;
    icon: string;
    total_amount: number;
    bill_count: number;
  }>(sql, unionParams);

  const grandTotal = rows.reduce((sum, r) => sum + r.total_amount, 0);

  return rows.map((r) => ({
    ...r,
    percentage: grandTotal > 0 ? (r.total_amount / grandTotal) * 100 : 0,
  }));
}

export function getMonthlyHistory(limitMonths: number = 6, accountId?: number | null): MonthSpending[] {
  const db = getDatabase();
  const where = accountId != null
    ? 'WHERE (b.account_id = ? OR a.linked_bank_id = ? OR (a.type = \'upi\' AND (a.linked_bank_id = ? OR (a.linked_bank_id IS NULL AND (SELECT COUNT(*) FROM accounts WHERE type = \'bank\') = 1))))'
    : '';
  const params: any[] = accountId != null ? [accountId, accountId, accountId, limitMonths] : [limitMonths];
  const rows = db.getAllSync<{
    month_key: string;
    total_amount: number;
    bill_count: number;
  }>(`
    SELECT 
      strftime('%Y-%m', b.date) as month_key,
      COALESCE(SUM(b.total_amount), 0) as total_amount,
      COUNT(b.id) as bill_count
    FROM bills b
    LEFT JOIN accounts a ON b.account_id = a.id
    ${where}
    GROUP BY month_key
    ORDER BY month_key DESC
    LIMIT ?;
  `, params);

  return rows.reverse().map((r) => {
    const [year, month] = r.month_key.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
    return {
      ...r,
      month_name: monthName,
    };
  });
}

export function getTopSpendingDestinations(
  startDate?: string,
  endDate?: string,
  accountId?: number | null,
  limit: number = 6
): DestinationSpending[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (startDate) {
    conditions.push('b.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('b.date <= ?');
    params.push(endDate);
  }
  if (accountId != null) {
    conditions.push('(b.account_id = ? OR a.linked_bank_id = ? OR (a.type = \'upi\' AND (a.linked_bank_id = ? OR (a.linked_bank_id IS NULL AND (SELECT COUNT(*) FROM accounts WHERE type = \'bank\') = 1))))');
    params.push(accountId, accountId, accountId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      b.vendor,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      COALESCE(SUM(b.total_amount), 0) as total_spent,
      COUNT(b.id) as bill_count
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
    ${whereClause}
    GROUP BY b.vendor
    ORDER BY total_spent DESC
    LIMIT ?;
  `;

  const rows = db.getAllSync<{
    vendor: string;
    category_name: string;
    category_color: string;
    category_icon: string;
    total_spent: number;
    bill_count: number;
  }>(sql, [...params, limit]);

  const grandTotal = rows.reduce((sum, r) => sum + r.total_spent, 0);

  return rows.map((r) => ({
    ...r,
    percentage: grandTotal > 0 ? (r.total_spent / grandTotal) * 100 : 0,
  }));
}

export function getAccountOutflowMetrics(
  startDate?: string,
  endDate?: string,
  accountId?: number | null
): AccountOutflowMetrics {
  const db = getDatabase();
  const billConditions: string[] = [];
  const billParams: any[] = [];

  if (startDate) {
    billConditions.push('b.date >= ?');
    billParams.push(startDate);
  }
  if (endDate) {
    billConditions.push('b.date <= ?');
    billParams.push(endDate);
  }
  if (accountId != null) {
    billConditions.push('(b.account_id = ? OR a.linked_bank_id = ? OR (a.type = \'upi\' AND (a.linked_bank_id = ? OR (a.linked_bank_id IS NULL AND (SELECT COUNT(*) FROM accounts WHERE type = \'bank\') = 1))))');
    billParams.push(accountId, accountId, accountId);
  }

  const billWhere = billConditions.length > 0 ? `WHERE ${billConditions.join(' AND ')}` : '';

  const billRow = db.getFirstSync<{
    total_spent: number;
    bill_count: number;
    avg_bill: number;
    max_bill: number;
  }>(`
    SELECT 
      COALESCE(SUM(b.total_amount), 0) as total_spent,
      COUNT(b.id) as bill_count,
      COALESCE(AVG(b.total_amount), 0) as avg_bill,
      COALESCE(MAX(b.total_amount), 0) as max_bill
    FROM bills b
    LEFT JOIN accounts a ON b.account_id = a.id
    ${billWhere};
  `, billParams);

  let maxVendor: string | null = null;
  if (billRow && billRow.max_bill > 0) {
    const maxRow = db.getFirstSync<{ vendor: string }>(`
      SELECT b.vendor 
      FROM bills b 
      LEFT JOIN accounts a ON b.account_id = a.id
      ${billWhere ? `${billWhere} AND ` : 'WHERE '} b.total_amount = ?
      LIMIT 1;
    `, [...billParams, billRow.max_bill]);
    maxVendor = maxRow?.vendor ?? null;
  }

  // Transfers out
  let transfersOutAmount = 0;
  let transfersOutCount = 0;
  if (accountId != null) {
    const transferConditions: string[] = ['from_account_id = ?'];
    const transferParams: any[] = [accountId];
    if (startDate) {
      transferConditions.push('date >= ?');
      transferParams.push(startDate);
    }
    if (endDate) {
      transferConditions.push('date <= ?');
      transferParams.push(endDate);
    }
    const transferWhere = `WHERE ${transferConditions.join(' AND ')}`;
    const trRow = db.getFirstSync<{ total: number; count: number }>(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(id) as count
      FROM transfers
      ${transferWhere};
    `, transferParams);
    transfersOutAmount = trRow?.total ?? 0;
    transfersOutCount = trRow?.count ?? 0;
  }

  const totalSpent = billRow?.total_spent ?? 0;

  return {
    total_spent: totalSpent,
    bill_count: billRow?.bill_count ?? 0,
    avg_bill: Math.round(billRow?.avg_bill ?? 0),
    max_bill: billRow?.max_bill ?? 0,
    max_bill_vendor: maxVendor,
    transfers_out_amount: transfersOutAmount,
    transfers_out_count: transfersOutCount,
    total_outflow: totalSpent + transfersOutAmount,
  };
}

export function getRecentBillsForAccount(
  startDate?: string,
  endDate?: string,
  accountId?: number | null,
  limit: number = 5
): Bill[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (startDate) {
    conditions.push('b.date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('b.date <= ?');
    params.push(endDate);
  }
  if (accountId != null) {
    conditions.push('(b.account_id = ? OR a.linked_bank_id = ? OR (a.type = \'upi\' AND (a.linked_bank_id = ? OR (a.linked_bank_id IS NULL AND (SELECT COUNT(*) FROM accounts WHERE type = \'bank\') = 1))))');
    params.push(accountId, accountId, accountId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      b.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      a.name as account_name,
      a.type as account_type,
      a.color as account_color,
      a.icon as account_icon,
      (SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) as image_count,
      (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id) > 0 as is_itemized,
      (SELECT GROUP_CONCAT(bi.name, ', ') FROM bill_items bi WHERE bi.bill_id = b.id) as items_summary
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
    ${whereClause}
    ORDER BY b.date DESC, b.id DESC
    LIMIT ?;
  `;

  return db.getAllSync<Bill>(sql, [...params, limit]);
}

export function getDistinctMonths(): string[] {
  const db = getDatabase();
  const rows = db.getAllSync<{ month_key: string }>(`
    SELECT DISTINCT strftime('%Y-%m', date) as month_key
    FROM bills
    ORDER BY month_key DESC;
  `);
  return rows.map((r) => r.month_key);
}

export function getCategoryYearOverYear(
  categoryId: number,
  year1: string,
  year2: string
): { month: string; year1_total: number; year2_total: number }[] {
  const db = getDatabase();
  const result: { month: string; year1_total: number; year2_total: number }[] = [];

  for (let m = 1; m <= 12; m++) {
    const monthStr = m < 10 ? `0${m}` : `${m}`;
    const key1 = `${year1}-${monthStr}`;
    const key2 = `${year2}-${monthStr}`;

    const r1 = db.getFirstSync<{ total: number }>(`
      SELECT (
        COALESCE((
          SELECT SUM(b.total_amount)
          FROM bills b
          WHERE b.category_id = ? AND strftime('%Y-%m', b.date) = ?
            AND (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) = 0
        ), 0)
        +
        COALESCE((
          SELECT SUM(bi.line_total)
          FROM bill_items bi
          JOIN bills b ON bi.bill_id = b.id
          WHERE bi.category_id = ? AND strftime('%Y-%m', b.date) = ?
        ), 0)
      ) as total;
    `, [categoryId, key1, categoryId, key1]);

    const r2 = db.getFirstSync<{ total: number }>(`
      SELECT (
        COALESCE((
          SELECT SUM(b.total_amount)
          FROM bills b
          WHERE b.category_id = ? AND strftime('%Y-%m', b.date) = ?
            AND (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) = 0
        ), 0)
        +
        COALESCE((
          SELECT SUM(bi.line_total)
          FROM bill_items bi
          JOIN bills b ON bi.bill_id = b.id
          WHERE bi.category_id = ? AND strftime('%Y-%m', b.date) = ?
        ), 0)
      ) as total;
    `, [categoryId, key2, categoryId, key2]);

    const dateObj = new Date(2000, m - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

    result.push({
      month: monthName,
      year1_total: r1?.total ?? 0,
      year2_total: r2?.total ?? 0,
    });
  }

  return result;
}

export function getAllBillsForExport(): Bill[] {
  const db = getDatabase();
  const bills = db.getAllSync<Bill>(`
    SELECT 
      b.*,
      c.name as category_name
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    ORDER BY b.date DESC, b.id DESC;
  `);

  for (const bill of bills) {
    bill.items = db.getAllSync<BillItem>(`
      SELECT 
        bi.*,
        c.name as category_name
      FROM bill_items bi
      LEFT JOIN categories c ON bi.category_id = c.id
      WHERE bi.bill_id = ?
      ORDER BY bi.id ASC;
    `, [bill.id]);
  }

  return bills;
}

export function getTotalBillsCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM bills;');
  return row?.count ?? 0;
}

// ==========================================
// APP SETTINGS
// ==========================================

export function getAppSetting(key: string, defaultValue: string): string {
  const db = getDatabase();
  const row = db.getFirstSync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?;',
    [key]
  );
  return row?.value ?? defaultValue;
}

export function setAppSetting(key: string, value: string): void {
  const db = getDatabase();
  db.runSync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
    [key, value]
  );
}

export function clearAllBillsData(): void {
  const db = getDatabase();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM bill_images;');
    db.runSync('DELETE FROM bill_items;');
    db.runSync('DELETE FROM bills;');
  });
}

// ==========================================
// ACCOUNTS, INCOMES & TRANSFERS QUERIES
// ==========================================

export function getAccounts(): Account[] {
  const db = getDatabase();
  const sql = `
    SELECT 
      a.*,
      p.name as linked_bank_name,
      p.color as linked_bank_color,
      COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id = a.id), 0) as total_inflow,
      COALESCE((SELECT SUM(total_amount) FROM bills WHERE account_id = a.id), 0) as total_outflow,
      (SELECT COUNT(*) FROM bills WHERE account_id = a.id) as bill_count,
      CASE
        -- When account is a UPI/Wallet linked to a bank: it shares the bank's live balance
        WHEN a.linked_bank_id IS NOT NULL THEN (
          SELECT (
            p_acc.initial_balance
            + COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id = p_acc.id), 0)
            + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_account_id = p_acc.id), 0)
            + COALESCE((SELECT SUM(i.amount) FROM incomes i JOIN accounts ch ON i.account_id = ch.id WHERE ch.linked_bank_id = p_acc.id), 0)
            - COALESCE((SELECT SUM(total_amount) FROM bills WHERE account_id = p_acc.id), 0)
            - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_account_id = p_acc.id), 0)
            - COALESCE((SELECT SUM(b.total_amount) FROM bills b JOIN accounts ch ON b.account_id = ch.id WHERE ch.linked_bank_id = p_acc.id), 0)
          )
          FROM accounts p_acc WHERE p_acc.id = a.linked_bank_id
        )
        -- When account is a Bank (which may have linked UPI accounts debited from it):
        WHEN a.type = 'bank' THEN (
          a.initial_balance
          + COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id = a.id), 0)
          + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_account_id = a.id), 0)
          + COALESCE((SELECT SUM(i.amount) FROM incomes i JOIN accounts ch ON i.account_id = ch.id WHERE ch.linked_bank_id = a.id), 0)
          - COALESCE((SELECT SUM(total_amount) FROM bills WHERE account_id = a.id), 0)
          - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_account_id = a.id), 0)
          - COALESCE((SELECT SUM(b.total_amount) FROM bills b JOIN accounts ch ON b.account_id = ch.id WHERE ch.linked_bank_id = a.id), 0)
        )
        -- Otherwise (Cash or standalone unlinked account):
        ELSE (
          a.initial_balance
          + COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id = a.id), 0)
          + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_account_id = a.id), 0)
          - COALESCE((SELECT SUM(total_amount) FROM bills WHERE account_id = a.id), 0)
          - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_account_id = a.id), 0)
        )
      END as current_balance
    FROM accounts a
    LEFT JOIN accounts p ON a.linked_bank_id = p.id
    ORDER BY a.type = 'cash' DESC, a.type = 'bank' DESC, a.type = 'upi' DESC, a.id ASC;
  `;
  return db.getAllSync<Account>(sql);
}

export function getAccountById(id: number): Account | null {
  const db = getDatabase();
  const sql = `
    SELECT 
      a.*,
      p.name as linked_bank_name,
      p.color as linked_bank_color,
      COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id = a.id), 0) as total_inflow,
      COALESCE((SELECT SUM(total_amount) FROM bills WHERE account_id = a.id), 0) as total_outflow,
      (SELECT COUNT(*) FROM bills WHERE account_id = a.id) as bill_count,
      CASE
        WHEN a.linked_bank_id IS NOT NULL THEN (
          SELECT (
            p_acc.initial_balance
            + COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id = p_acc.id), 0)
            + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_account_id = p_acc.id), 0)
            + COALESCE((SELECT SUM(i.amount) FROM incomes i JOIN accounts ch ON i.account_id = ch.id WHERE ch.linked_bank_id = p_acc.id), 0)
            - COALESCE((SELECT SUM(total_amount) FROM bills WHERE account_id = p_acc.id), 0)
            - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_account_id = p_acc.id), 0)
            - COALESCE((SELECT SUM(b.total_amount) FROM bills b JOIN accounts ch ON b.account_id = ch.id WHERE ch.linked_bank_id = p_acc.id), 0)
          )
          FROM accounts p_acc WHERE p_acc.id = a.linked_bank_id
        )
        WHEN a.type = 'bank' THEN (
          a.initial_balance
          + COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id = a.id), 0)
          + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_account_id = a.id), 0)
          + COALESCE((SELECT SUM(i.amount) FROM incomes i JOIN accounts ch ON i.account_id = ch.id WHERE ch.linked_bank_id = a.id), 0)
          - COALESCE((SELECT SUM(total_amount) FROM bills WHERE account_id = a.id), 0)
          - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_account_id = a.id), 0)
          - COALESCE((SELECT SUM(b.total_amount) FROM bills b JOIN accounts ch ON b.account_id = ch.id WHERE ch.linked_bank_id = a.id), 0)
        )
        ELSE (
          a.initial_balance
          + COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id = a.id), 0)
          + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_account_id = a.id), 0)
          - COALESCE((SELECT SUM(total_amount) FROM bills WHERE account_id = a.id), 0)
          - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_account_id = a.id), 0)
        )
      END as current_balance
    FROM accounts a
    LEFT JOIN accounts p ON a.linked_bank_id = p.id
    WHERE a.id = ?;
  `;
  return db.getFirstSync<Account>(sql, [id]);
}

export function addAccount(account: {
  name: string;
  type: AccountType;
  account_number?: string | null;
  initial_balance: number;
  color: string;
  icon: string;
  is_default?: number;
  linked_bank_id?: number | null;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.runSync(`
    INSERT INTO accounts (name, type, account_number, initial_balance, color, icon, is_default, linked_bank_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `, [
    account.name.trim(),
    account.type,
    account.account_number ? account.account_number.trim() : null,
    account.initial_balance,
    account.color,
    account.icon,
    account.is_default ? 1 : 0,
    account.linked_bank_id ?? null,
    now,
    now,
  ]);
  return result.lastInsertRowId;
}

export function updateAccount(
  id: number,
  updates: Partial<Omit<Account, 'id' | 'created_at' | 'updated_at'>>
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const currentAcc = db.getFirstSync<{ linked_bank_id: number | null }>('SELECT linked_bank_id FROM accounts WHERE id = ?;', [id]);
  const newLinkedBankId = updates.linked_bank_id !== undefined ? updates.linked_bank_id : (currentAcc?.linked_bank_id ?? null);

  db.runSync(`
    UPDATE accounts SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      account_number = COALESCE(?, account_number),
      initial_balance = COALESCE(?, initial_balance),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon),
      is_default = COALESCE(?, is_default),
      linked_bank_id = ?,
      updated_at = ?
    WHERE id = ?;
  `, [
    updates.name?.trim() ?? null,
    updates.type ?? null,
    updates.account_number !== undefined ? (updates.account_number ? updates.account_number.trim() : null) : null,
    updates.initial_balance ?? null,
    updates.color ?? null,
    updates.icon ?? null,
    updates.is_default !== undefined ? (updates.is_default ? 1 : 0) : null,
    newLinkedBankId,
    now,
    id,
  ]);
}

export function deleteAccount(id: number): boolean {
  const db = getDatabase();
  // Check if account has bills or is default
  const billCount = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM bills WHERE account_id = ?;', [id]);
  if (billCount && billCount.count > 0) {
    return false; // Can't delete account with existing transactions
  }
  db.runSync('DELETE FROM incomes WHERE account_id = ?;', [id]);
  db.runSync('DELETE FROM transfers WHERE from_account_id = ? OR to_account_id = ?;', [id, id]);
  db.runSync('DELETE FROM accounts WHERE id = ?;', [id]);
  return true;
}

// INCOMES (Salary, deposits, incoming payments)
export function addIncome(income: {
  date: string;
  source: string;
  amount: number;
  account_id: number;
  category_id?: number | null;
  notes?: string | null;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.runSync(`
    INSERT INTO incomes (date, source, amount, account_id, category_id, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `, [
    income.date,
    income.source.trim(),
    income.amount,
    income.account_id,
    income.category_id ?? null,
    income.notes ? income.notes.trim() : null,
    now,
  ]);
  return result.lastInsertRowId;
}

export function getIncomes(limit: number = 50): Income[] {
  const db = getDatabase();
  return db.getAllSync<Income>(`
    SELECT 
      i.*,
      a.name as account_name,
      a.type as account_type,
      a.color as account_color,
      a.icon as account_icon,
      c.name as category_name
    FROM incomes i
    JOIN accounts a ON i.account_id = a.id
    LEFT JOIN categories c ON i.category_id = c.id
    ORDER BY i.date DESC, i.id DESC
    LIMIT ?;
  `, [limit]);
}

export function deleteIncome(id: number): void {
  const db = getDatabase();
  db.runSync('DELETE FROM incomes WHERE id = ?;', [id]);
}

// TRANSFERS (Cash withdrawals, bank-to-bank, bank-to-upi)
export function addTransfer(transfer: {
  date: string;
  from_account_id: number;
  to_account_id: number;
  amount: number;
  notes?: string | null;
}): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.runSync(`
    INSERT INTO transfers (date, from_account_id, to_account_id, amount, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?);
  `, [
    transfer.date,
    transfer.from_account_id,
    transfer.to_account_id,
    transfer.amount,
    transfer.notes ? transfer.notes.trim() : null,
    now,
  ]);
  return result.lastInsertRowId;
}

export function getTransfers(limit: number = 50): Transfer[] {
  const db = getDatabase();
  return db.getAllSync<Transfer>(`
    SELECT 
      t.*,
      from_a.name as from_account_name,
      from_a.type as from_account_type,
      from_a.color as from_account_color,
      to_a.name as to_account_name,
      to_a.type as to_account_type,
      to_a.color as to_account_color
    FROM transfers t
    JOIN accounts from_a ON t.from_account_id = from_a.id
    JOIN accounts to_a ON t.to_account_id = to_a.id
    ORDER BY t.date DESC, t.id DESC
    LIMIT ?;
  `, [limit]);
}

export function deleteTransfer(id: number): void {
  const db = getDatabase();
  db.runSync('DELETE FROM transfers WHERE id = ?;', [id]);
}

// ACCOUNT TRANSACTION TIMELINE (Bills, Incomes, Transfers for a specific account)
export function getAccountTransactions(accountId: number, limit: number = 50): AccountTransaction[] {
  const db = getDatabase();
  const sql = `
    SELECT * FROM (
      -- 1. Expenses from this account OR via linked UPI
      SELECT 
        'bill-' || b.id as id,
        'expense' as type,
        b.date,
        b.vendor as title,
        b.total_amount as amount,
        b.account_id,
        a.name as account_name,
        a.color as account_color,
        a.type as account_type,
        CASE WHEN a.id != ? THEN a.name ELSE NULL END as related_account_name,
        b.notes,
        b.created_at
      FROM bills b
      JOIN accounts a ON b.account_id = a.id
      WHERE b.account_id = ? OR a.linked_bank_id = ?

      UNION ALL

      -- 2. Incomes deposited into this account
      SELECT 
        'income-' || i.id as id,
        'income' as type,
        i.date,
        i.source as title,
        i.amount,
        i.account_id,
        a.name as account_name,
        a.color as account_color,
        a.type as account_type,
        NULL as related_account_name,
        i.notes,
        i.created_at
      FROM incomes i
      JOIN accounts a ON i.account_id = a.id
      WHERE i.account_id = ?

      UNION ALL

      -- 3. Transfers sent OUT from this account (e.g. ATM withdrawal)
      SELECT 
        'transfer-' || t.id as id,
        'transfer_out' as type,
        t.date,
        'Transfer to ' || to_a.name as title,
        t.amount,
        t.from_account_id as account_id,
        from_a.name as account_name,
        from_a.color as account_color,
        from_a.type as account_type,
        to_a.name as related_account_name,
        t.notes,
        t.created_at
      FROM transfers t
      JOIN accounts from_a ON t.from_account_id = from_a.id
      JOIN accounts to_a ON t.to_account_id = to_a.id
      WHERE t.from_account_id = ?

      UNION ALL

      -- 4. Transfers received INTO this account (e.g. Cash received from ATM)
      SELECT 
        'transfer-' || t.id as id,
        'transfer_in' as type,
        t.date,
        'Received from ' || from_a.name as title,
        t.amount,
        t.to_account_id as account_id,
        to_a.name as account_name,
        to_a.color as account_color,
        to_a.type as account_type,
        from_a.name as related_account_name,
        t.notes,
        t.created_at
      FROM transfers t
      JOIN accounts from_a ON t.from_account_id = from_a.id
      JOIN accounts to_a ON t.to_account_id = to_a.id
      WHERE t.to_account_id = ?
    )
    ORDER BY date DESC, created_at DESC
    LIMIT ?;
  `;
  return db.getAllSync<AccountTransaction>(sql, [accountId, accountId, accountId, accountId, accountId, accountId, limit]);
}

export function getTotalLiquiditySummary(): {
  total_balance: number;
  cash_balance: number;
  bank_balance: number;
  upi_balance: number;
  account_count: number;
} {
  const accounts = getAccounts();
  let total_balance = 0;
  let cash_balance = 0;
  let bank_balance = 0;
  let upi_balance = 0;

  for (const acc of accounts) {
    const bal = acc.current_balance ?? 0;
    if (acc.type === 'cash') {
      cash_balance += bal;
      total_balance += bal;
    } else if (acc.type === 'bank') {
      bank_balance += bal;
      total_balance += bal;
    } else if (acc.type === 'upi' || acc.type === 'wallet') {
      upi_balance += bal;
      // Only unlinked standalone UPI adds to total liquidity to avoid double counting bank funds
      if (!acc.linked_bank_id) {
        total_balance += bal;
      }
    }
  }

  return {
    total_balance,
    cash_balance,
    bank_balance,
    upi_balance,
    account_count: accounts.length,
  };
}

// ==========================================
// VENDOR DRILLDOWN & TRANSACTIONS QUERIES
// ==========================================

export function getVendorTransactions(vendor: string): Bill[] {
  const db = getDatabase();
  const trimmed = vendor.trim();

  return db.getAllSync<Bill>(`
    SELECT 
      b.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon,
      a.name as account_name,
      a.type as account_type,
      a.color as account_color,
      a.icon as account_icon,
      (SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) as image_count,
      (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.id AND bi.category_id IS NOT NULL) > 0 as is_itemized,
      (SELECT GROUP_CONCAT(bi.name, ', ') FROM bill_items bi WHERE bi.bill_id = b.id) as items_summary
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    LEFT JOIN accounts a ON b.account_id = a.id
    WHERE LOWER(TRIM(b.vendor)) = LOWER(?)
    ORDER BY b.date DESC, b.id DESC;
  `, [trimmed]);
}

export function getVendorSummary(vendor: string): VendorSummary {
  const db = getDatabase();
  const trimmed = vendor.trim();

  const stats = db.getFirstSync<{
    count: number;
    total_amount: number;
    first_date: string | null;
    last_date: string | null;
  }>(`
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as total_amount,
      MIN(date) as first_date,
      MAX(date) as last_date
    FROM bills
    WHERE LOWER(TRIM(vendor)) = LOWER(?);
  `, [trimmed]);

  // Find most frequent category for this vendor
  const topCat = db.getFirstSync<{ name: string }>(`
    SELECT c.name, COUNT(*) as cnt
    FROM bills b
    JOIN categories c ON b.category_id = c.id
    WHERE LOWER(TRIM(b.vendor)) = LOWER(?)
    GROUP BY c.name
    ORDER BY cnt DESC
    LIMIT 1;
  `, [trimmed]);

  return {
    vendor: trimmed,
    count: stats?.count ?? 0,
    total_amount: stats?.total_amount ?? 0,
    first_date: stats?.first_date ?? null,
    last_date: stats?.last_date ?? null,
    top_category: topCat?.name ?? null,
  };
}

export function getAllVendors(): { vendor: string; count: number; total_spent: number; last_date: string }[] {
  const db = getDatabase();
  return db.getAllSync<{ vendor: string; count: number; total_spent: number; last_date: string }>(`
    SELECT 
      vendor,
      COUNT(*) as count,
      SUM(total_amount) as total_spent,
      MAX(date) as last_date
    FROM bills
    WHERE TRIM(vendor) != ''
    GROUP BY LOWER(TRIM(vendor))
    ORDER BY count DESC, total_spent DESC;
  `);
}

// ==========================================
// BILL REMINDERS & ALARMS QUERIES
// ==========================================

export function getReminders(): BillReminder[] {
  const db = getDatabase();
  const rows = db.getAllSync<BillReminder>(`
    SELECT 
      r.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon
    FROM bill_reminders r
    LEFT JOIN categories c ON r.category_id = c.id
    ORDER BY r.is_active DESC, r.day_of_month ASC, r.title ASC;
  `);

  const today = new Date();
  const currentDay = today.getDate();
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  return rows.map((r) => {
    // Calculate days until due
    let diffDays = r.day_of_month - currentDay;
    if (diffDays < 0) {
      // Due next month
      diffDays = daysInCurrentMonth - currentDay + r.day_of_month;
    }

    return {
      ...r,
      days_until_due: diffDays,
      is_due_today: r.day_of_month === currentDay,
    };
  });
}

export function getReminderById(id: number): BillReminder | null {
  const db = getDatabase();
  return db.getFirstSync<BillReminder>(`
    SELECT 
      r.*,
      c.name as category_name,
      c.color as category_color,
      c.icon as category_icon
    FROM bill_reminders r
    LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.id = ?;
  `, [id]);
}

export function addReminder(
  reminder: Omit<BillReminder, 'id' | 'created_at' | 'updated_at' | 'days_until_due' | 'is_due_today'>
): number {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.runSync(`
    INSERT INTO bill_reminders (
      title, amount, day_of_month, time_str, category_id, vendor, notes, is_active, notification_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `, [
    reminder.title.trim(),
    reminder.amount || 0,
    reminder.day_of_month,
    reminder.time_str || '09:00',
    reminder.category_id || null,
    reminder.vendor ? reminder.vendor.trim() : null,
    reminder.notes ? reminder.notes.trim() : null,
    reminder.is_active !== undefined ? reminder.is_active : 1,
    reminder.notification_id || null,
    now,
    now,
  ]);

  return result.lastInsertRowId;
}

export function updateReminder(
  id: number,
  reminder: Partial<BillReminder>
): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.runSync(`
    UPDATE bill_reminders SET
      title = COALESCE(?, title),
      amount = COALESCE(?, amount),
      day_of_month = COALESCE(?, day_of_month),
      time_str = COALESCE(?, time_str),
      category_id = ?,
      vendor = ?,
      notes = ?,
      is_active = COALESCE(?, is_active),
      notification_id = COALESCE(?, notification_id),
      updated_at = ?
    WHERE id = ?;
  `, [
    reminder.title !== undefined ? reminder.title.trim() : null,
    reminder.amount !== undefined ? reminder.amount : null,
    reminder.day_of_month !== undefined ? reminder.day_of_month : null,
    reminder.time_str !== undefined ? reminder.time_str : null,
    reminder.category_id !== undefined ? reminder.category_id : null,
    reminder.vendor !== undefined ? (reminder.vendor ? reminder.vendor.trim() : null) : null,
    reminder.notes !== undefined ? (reminder.notes ? reminder.notes.trim() : null) : null,
    reminder.is_active !== undefined ? reminder.is_active : null,
    reminder.notification_id !== undefined ? reminder.notification_id : null,
    now,
    id,
  ]);
}

export function deleteReminder(id: number): void {
  const db = getDatabase();
  db.runSync('DELETE FROM bill_reminders WHERE id = ?;', [id]);
}

export function toggleReminder(id: number, isActive: boolean): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.runSync(`
    UPDATE bill_reminders SET is_active = ?, updated_at = ? WHERE id = ?;
  `, [isActive ? 1 : 0, now, id]);
}

export function updateReminderNotificationId(id: number, notificationId: string | null): void {
  const db = getDatabase();
  db.runSync('UPDATE bill_reminders SET notification_id = ? WHERE id = ?;', [notificationId, id]);
}

export function getDueReminders(windowDays: number = 3): BillReminder[] {
  const all = getReminders().filter((r) => r.is_active === 1);
  return all.filter((r) => (r.days_until_due !== undefined && r.days_until_due <= windowDays));
}

// ==========================================
// UNIFIED ACTIVITY QUERIES (BILLS, WITHDRAWALS, BANK TRANSFERS, DEPOSITS)
// ==========================================

export function getRecentActivity(limit: number = 10): UnifiedActivityItem[] {
  const db = getDatabase();

  const sql = `
    SELECT * FROM (
      -- 1. Bills / Expenses
      SELECT 
        'bill-' || b.id as id,
        'expense' as type,
        b.id as record_id,
        b.date,
        b.vendor as title,
        COALESCE(
          (SELECT GROUP_CONCAT(bi.name, ', ') FROM bill_items bi WHERE bi.bill_id = b.id),
          c.name
        ) as subtitle,
        b.total_amount as amount,
        b.account_id,
        a.name as account_name,
        a.type as account_type,
        a.color as account_color,
        NULL as from_account_name,
        NULL as to_account_name,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        (SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) as image_count,
        b.notes,
        b.created_at
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      LEFT JOIN accounts a ON b.account_id = a.id

      UNION ALL

      -- 2. Transfers & Cash Withdrawals
      SELECT 
        'transfer-' || t.id as id,
        CASE 
          WHEN to_a.type = 'cash' THEN 'withdrawal'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'bank_transfer'
          ELSE 'transfer'
        END as type,
        t.id as record_id,
        t.date,
        CASE 
          WHEN to_a.type = 'cash' THEN 'Cash Withdrawal'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'Bank to Bank Transfer'
          ELSE 'Account Transfer'
        END as title,
        from_a.name || ' ➔ ' || to_a.name as subtitle,
        t.amount,
        t.from_account_id as account_id,
        from_a.name as account_name,
        from_a.type as account_type,
        from_a.color as account_color,
        from_a.name as from_account_name,
        to_a.name as to_account_name,
        CASE 
          WHEN to_a.type = 'cash' THEN 'Cash Withdrawal'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'Bank Transfer'
          ELSE 'Transfer'
        END as category_name,
        CASE 
          WHEN to_a.type = 'cash' THEN '#10B981'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN '#2563EB'
          ELSE '#8B5CF6'
        END as category_color,
        CASE 
          WHEN to_a.type = 'cash' THEN 'cash-outline'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'business-outline'
          ELSE 'swap-horizontal-outline'
        END as category_icon,
        0 as image_count,
        t.notes,
        t.created_at
      FROM transfers t
      JOIN accounts from_a ON t.from_account_id = from_a.id
      JOIN accounts to_a ON t.to_account_id = to_a.id

      UNION ALL

      -- 3. Deposits / Incomes
      SELECT 
        'income-' || i.id as id,
        'deposit' as type,
        i.id as record_id,
        i.date,
        i.source as title,
        'Deposit ➔ ' || a.name as subtitle,
        i.amount,
        i.account_id,
        a.name as account_name,
        a.type as account_type,
        a.color as account_color,
        NULL as from_account_name,
        a.name as to_account_name,
        'Deposit' as category_name,
        '#10B981' as category_color,
        'arrow-down-circle-outline' as category_icon,
        0 as image_count,
        i.notes,
        i.created_at
      FROM incomes i
      JOIN accounts a ON i.account_id = a.id
    )
    ORDER BY date DESC, created_at DESC
    LIMIT ?;
  `;

  return db.getAllSync<UnifiedActivityItem>(sql, [limit]);
}

export function getFilteredUnifiedActivity(
  filter: ActivityFilter = {},
  limit: number = 60,
  offset: number = 0
): UnifiedActivityItem[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter.activityType && filter.activityType !== 'all') {
    if (filter.activityType === 'expense') {
      conditions.push("type = 'expense'");
    } else if (filter.activityType === 'transfer') {
      conditions.push("type IN ('transfer', 'withdrawal', 'bank_transfer')");
    } else if (filter.activityType === 'deposit') {
      conditions.push("type = 'deposit'");
    }
  }

  if (filter.searchQuery && filter.searchQuery.trim()) {
    const term = `%${filter.searchQuery.trim()}%`;
    conditions.push('(title LIKE ? OR subtitle LIKE ? OR notes LIKE ? OR from_account_name LIKE ? OR to_account_name LIKE ? OR account_name LIKE ?)');
    params.push(term, term, term, term, term, term);
  }

  if (filter.startDate) {
    conditions.push('date >= ?');
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    conditions.push('date <= ?');
    params.push(filter.endDate);
  }

  if (filter.categoryIds && filter.categoryIds.length > 0) {
    const placeholders = filter.categoryIds.map(() => '?').join(',');
    conditions.push(`category_id IN (${placeholders})`);
    params.push(...filter.categoryIds);
  }

  if (filter.accountIds && filter.accountIds.length > 0) {
    const placeholders = filter.accountIds.map(() => '?').join(',');
    conditions.push(`(account_id IN (${placeholders}) OR from_account_id IN (${placeholders}) OR to_account_id IN (${placeholders}))`);
    params.push(...filter.accountIds, ...filter.accountIds, ...filter.accountIds);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT * FROM (
      -- 1. Bills / Expenses
      SELECT 
        'bill-' || b.id as id,
        'expense' as type,
        b.id as record_id,
        b.date,
        b.vendor as title,
        COALESCE(
          (SELECT GROUP_CONCAT(bi.name, ', ') FROM bill_items bi WHERE bi.bill_id = b.id),
          c.name
        ) as subtitle,
        b.total_amount as amount,
        b.account_id,
        b.account_id as from_account_id,
        NULL as to_account_id,
        a.name as account_name,
        a.type as account_type,
        a.color as account_color,
        NULL as from_account_name,
        NULL as to_account_name,
        b.category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        (SELECT COUNT(*) FROM bill_images bi WHERE bi.bill_id = b.id) as image_count,
        b.notes,
        b.created_at
      FROM bills b
      JOIN categories c ON b.category_id = c.id
      LEFT JOIN accounts a ON b.account_id = a.id

      UNION ALL

      -- 2. Transfers & Cash Withdrawals
      SELECT 
        'transfer-' || t.id as id,
        CASE 
          WHEN to_a.type = 'cash' THEN 'withdrawal'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'bank_transfer'
          ELSE 'transfer'
        END as type,
        t.id as record_id,
        t.date,
        CASE 
          WHEN to_a.type = 'cash' THEN 'Cash Withdrawal'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'Bank to Bank Transfer'
          ELSE 'Account Transfer'
        END as title,
        from_a.name || ' ➔ ' || to_a.name as subtitle,
        t.amount,
        t.from_account_id as account_id,
        t.from_account_id as from_account_id,
        t.to_account_id as to_account_id,
        from_a.name as account_name,
        from_a.type as account_type,
        from_a.color as account_color,
        from_a.name as from_account_name,
        to_a.name as to_account_name,
        NULL as category_id,
        CASE 
          WHEN to_a.type = 'cash' THEN 'Cash Withdrawal'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'Bank Transfer'
          ELSE 'Transfer'
        END as category_name,
        CASE 
          WHEN to_a.type = 'cash' THEN '#10B981'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN '#2563EB'
          ELSE '#8B5CF6'
        END as category_color,
        CASE 
          WHEN to_a.type = 'cash' THEN 'cash-outline'
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'business-outline'
          ELSE 'swap-horizontal-outline'
        END as category_icon,
        0 as image_count,
        t.notes,
        t.created_at
      FROM transfers t
      JOIN accounts from_a ON t.from_account_id = from_a.id
      JOIN accounts to_a ON t.to_account_id = to_a.id

      UNION ALL

      -- 3. Deposits / Incomes
      SELECT 
        'income-' || i.id as id,
        'deposit' as type,
        i.id as record_id,
        i.date,
        i.source as title,
        'Deposit ➔ ' || a.name as subtitle,
        i.amount,
        i.account_id,
        NULL as from_account_id,
        i.account_id as to_account_id,
        a.name as account_name,
        a.type as account_type,
        a.color as account_color,
        NULL as from_account_name,
        a.name as to_account_name,
        i.category_id,
        'Deposit' as category_name,
        '#10B981' as category_color,
        'arrow-down-circle-outline' as category_icon,
        0 as image_count,
        i.notes,
        i.created_at
      FROM incomes i
      JOIN accounts a ON i.account_id = a.id
    )
    ${whereClause}
    ORDER BY date DESC, created_at DESC
    LIMIT ? OFFSET ?;
  `;

  return db.getAllSync<UnifiedActivityItem>(sql, [...params, limit, offset]);
}

export function getUnifiedActivitySummary(filter: ActivityFilter = {}): {
  count: number;
  total_expenses: number;
  total_transfers: number;
  total_deposits: number;
} {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: any[] = [];

  if (filter.activityType && filter.activityType !== 'all') {
    if (filter.activityType === 'expense') {
      conditions.push("type = 'expense'");
    } else if (filter.activityType === 'transfer') {
      conditions.push("type IN ('transfer', 'withdrawal', 'bank_transfer')");
    } else if (filter.activityType === 'deposit') {
      conditions.push("type = 'deposit'");
    }
  }

  if (filter.searchQuery && filter.searchQuery.trim()) {
    const term = `%${filter.searchQuery.trim()}%`;
    conditions.push('(title LIKE ? OR subtitle LIKE ? OR notes LIKE ? OR from_account_name LIKE ? OR to_account_name LIKE ? OR account_name LIKE ?)');
    params.push(term, term, term, term, term, term);
  }

  if (filter.startDate) {
    conditions.push('date >= ?');
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    conditions.push('date <= ?');
    params.push(filter.endDate);
  }

  if (filter.categoryIds && filter.categoryIds.length > 0) {
    const placeholders = filter.categoryIds.map(() => '?').join(',');
    conditions.push(`category_id IN (${placeholders})`);
    params.push(...filter.categoryIds);
  }

  if (filter.accountIds && filter.accountIds.length > 0) {
    const placeholders = filter.accountIds.map(() => '?').join(',');
    conditions.push(`(account_id IN (${placeholders}) OR from_account_id IN (${placeholders}) OR to_account_id IN (${placeholders}))`);
    params.push(...filter.accountIds, ...filter.accountIds, ...filter.accountIds);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      COUNT(*) as count,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
      COALESCE(SUM(CASE WHEN type IN ('transfer', 'withdrawal', 'bank_transfer') THEN amount ELSE 0 END), 0) as total_transfers,
      COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits
    FROM (
      SELECT 
        'expense' as type, 
        b.date, 
        b.vendor as title, 
        c.name as subtitle, 
        b.notes, 
        b.account_id as account_id,
        NULL as from_account_id, 
        NULL as to_account_id,
        NULL as from_account_name, 
        NULL as to_account_name, 
        a.name as account_name, 
        b.category_id, 
        b.total_amount as amount, 
        b.created_at 
      FROM bills b 
      JOIN categories c ON b.category_id = c.id 
      LEFT JOIN accounts a ON b.account_id = a.id
      
      UNION ALL
      
      SELECT 
        CASE 
          WHEN to_a.type = 'cash' THEN 'withdrawal' 
          WHEN from_a.type = 'bank' AND to_a.type = 'bank' THEN 'bank_transfer' 
          ELSE 'transfer' 
        END as type, 
        t.date, 
        'Transfer' as title, 
        from_a.name || ' ➔ ' || to_a.name as subtitle, 
        t.notes, 
        NULL as account_id,
        t.from_account_id as from_account_id, 
        t.to_account_id as to_account_id,
        from_a.name as from_account_name, 
        to_a.name as to_account_name, 
        from_a.name as account_name, 
        NULL as category_id, 
        t.amount as amount, 
        t.created_at 
      FROM transfers t 
      JOIN accounts from_a ON t.from_account_id = from_a.id 
      JOIN accounts to_a ON t.to_account_id = to_a.id
      
      UNION ALL
      
      SELECT 
        'deposit' as type, 
        i.date, 
        i.source as title, 
        'Deposit' as subtitle, 
        i.notes, 
        i.account_id as account_id,
        NULL as from_account_id, 
        i.account_id as to_account_id,
        NULL as from_account_name, 
        a.name as to_account_name, 
        a.name as account_name, 
        i.category_id, 
        i.amount as amount, 
        i.created_at 
      FROM incomes i 
      JOIN accounts a ON i.account_id = a.id
    )
    ${whereClause};
  `;

  const row = db.getFirstSync<{
    count: number;
    total_expenses: number;
    total_transfers: number;
    total_deposits: number;
  }>(sql, params);

  return {
    count: row?.count ?? 0,
    total_expenses: row?.total_expenses ?? 0,
    total_transfers: row?.total_transfers ?? 0,
    total_deposits: row?.total_deposits ?? 0,
  };
}

export function getDistinctActivityMonths(): string[] {
  const db = getDatabase();
  const rows = db.getAllSync<{ month_key: string }>(`
    SELECT DISTINCT SUBSTR(date, 1, 7) as month_key FROM (
      SELECT date FROM bills
      UNION
      SELECT date FROM transfers
      UNION
      SELECT date FROM incomes
    )
    WHERE month_key IS NOT NULL AND month_key != ''
    ORDER BY month_key DESC;
  `);
  return rows.map((r) => r.month_key);
}
