import { getDatabase } from './database';
import { getCategories } from './queries';
import { toPaise } from '../utils/currency';
import { subDays, format } from 'date-fns';

const VENDORS_BY_CATEGORY: Record<string, string[]> = {
  Food: ['Blue Bottle Coffee', 'Sweetgreen', 'Chipotle', 'Starbucks', 'Subway', 'Local Bistro', 'Swiggy/Zomato', 'McDonalds'],
  Groceries: ['Whole Foods Market', 'Trader Joe’s', 'Supermart', 'Costco', 'Nature’s Basket', 'Local Market'],
  Rent: ['Monthly Apartment Rent', 'Property Management LLC', 'Housing Society'],
  Utilities: ['City Power & Electric', 'Water Supply Board', 'Highspeed Internet Fiber', 'Piped Gas Ltd', 'Mobile Postpaid'],
  Travel: ['Lyft', 'Uber Ride', 'Muni Transit Metro', 'Delta Air Lines', 'Shell Petrol Pump', 'Indian Railways'],
  Health: ['Walgreens Pharmacy', 'Apollo Pharmacy', 'Dental Care Clinic', 'Health Insurance Premium', 'Diagnostic Lab'],
  Shopping: ['Amazon.com', 'Apple Store', 'Zara', 'Uniqlo', 'Target', 'Nike Outlet'],
  Education: ['Coursera Specialization', 'Udemy Course', 'University Tuition', 'Book Depot', 'School Supplies'],
  Entertainment: ['Netflix Subscription', 'Figma Subscription', 'Spotify Premium', 'AMC Theaters Movie', 'Steam Games'],
  Other: ['Hardware Store', 'Dry Cleaning', 'Postal Courier', 'Bank Annual Fee', 'Miscellaneous Store'],
};

const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'] as const;

/**
 * Seeds realistic bill entries into the database for testing performance and UI rendering.
 * @param count Number of bills to generate (default 250)
 */
export function seedDemoData(count: number = 250): void {
  const db = getDatabase();
  const categories = getCategories();
  if (categories.length === 0) return;

  const now = new Date();

  // 1. Ensure accounts exist
  let accounts = db.getAllSync<{ id: number; name: string; type: string }>('SELECT id, name, type FROM accounts;');
  if (accounts.length === 0) {
    const nowIso = now.toISOString();
    db.runSync(`
      INSERT INTO accounts (name, type, account_number, initial_balance, color, icon, is_default, created_at, updated_at)
      VALUES 
        ('Cash in Hand', 'cash', NULL, 300000, '#10B981', 'cash-outline', 0, '${nowIso}', '${nowIso}'),
        ('HDFC Salary A/C', 'bank', 'XX9412', 4500000, '#004C8F', 'business-outline', 1, '${nowIso}', '${nowIso}'),
        ('SBI Savings', 'bank', 'XX3081', 2500000, '#224B8B', 'business-outline', 0, '${nowIso}', '${nowIso}'),
        ('Google Pay (UPI)', 'upi', 'user@okaxis', 500000, '#6366F1', 'phone-portrait-outline', 0, '${nowIso}', '${nowIso}');
    `);
    accounts = db.getAllSync<{ id: number; name: string; type: string }>('SELECT id, name, type FROM accounts;');
  }

  const cashAcc = accounts.find((a) => a.type === 'cash') || accounts[0];
  const bankAcc = accounts.find((a) => a.type === 'bank') || accounts[0];
  const upiAcc = accounts.find((a) => a.type === 'upi') || accounts[0];

  db.withTransactionSync(() => {
    // 2. Seed monthly salary incomes
    for (let m = 0; m < 6; m++) {
      const salaryDate = format(subDays(now, m * 30 + 5), 'yyyy-MM-01');
      db.runSync(`
        INSERT INTO incomes (date, source, amount, account_id, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?);
      `, [salaryDate, 'Monthly Salary Deposit', toPaise(75000), bankAcc.id, 'Direct Payroll Deposit', now.toISOString()]);
    }

    // 3. Seed ATM Cash withdrawals
    for (let w = 1; w <= 3; w++) {
      const atmDate = format(subDays(now, w * 18), 'yyyy-MM-dd');
      db.runSync(`
        INSERT INTO transfers (date, from_account_id, to_account_id, amount, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?);
      `, [atmDate, bankAcc.id, cashAcc.id, toPaise(5000), 'ATM Cash Withdrawal', now.toISOString()]);
    }

    // 4. Seed bills
    const insertBillStmt = db.prepareSync(`
      INSERT INTO bills (date, vendor, category_id, total_amount, payment_method, account_id, notes, created_at, updated_at)
      VALUES ($date, $vendor, $category_id, $total_amount, $payment_method, $account_id, $notes, $created_at, $updated_at);
    `);

    const insertItemStmt = db.prepareSync(`
      INSERT INTO bill_items (bill_id, name, quantity, unit_price, line_total, category_id)
      VALUES ($bill_id, $name, $quantity, $unit_price, $line_total, $category_id);
    `);

    try {
      for (let i = 0; i < count; i++) {
        // Distribute dates over past 365 days, with more entries recently
        const daysAgo = Math.floor(Math.pow(Math.random(), 1.5) * 365);
        const billDate = format(subDays(now, daysAgo), 'yyyy-MM-dd');
        
        // Pick random category
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const vendorList = VENDORS_BY_CATEGORY[cat.name] || ['General Merchant'];
        const vendor = vendorList[Math.floor(Math.random() * vendorList.length)];
        const paymentMethod = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];

        // Assign matching account
        let targetAccountId = bankAcc.id;
        if (paymentMethod === 'Cash') targetAccountId = cashAcc.id;
        else if (paymentMethod === 'UPI') targetAccountId = upiAcc.id;

        // Amount between 50 and 8,000
        let baseAmount = Math.floor(Math.random() * 450) + 15;
        if (cat.name === 'Rent') baseAmount = 25000 + Math.floor(Math.random() * 5000);
        else if (cat.name === 'Shopping') baseAmount = 800 + Math.floor(Math.random() * 4500);
        else if (cat.name === 'Groceries') baseAmount = 350 + Math.floor(Math.random() * 1800);

        const totalPaise = toPaise(baseAmount);
        const hasNotes = Math.random() > 0.6;
        const notes = hasNotes ? `Ref invoice #${Math.floor(1000 + Math.random() * 9000)}` : null;
        const createdIso = new Date().toISOString();

        const result = insertBillStmt.executeSync({
          $date: billDate,
          $vendor: vendor,
          $category_id: cat.id,
          $total_amount: totalPaise,
          $payment_method: paymentMethod,
          $account_id: targetAccountId,
          $notes: notes,
          $created_at: createdIso,
          $updated_at: createdIso,
        });

        const newBillId = result.lastInsertRowId;

        // Optionally add line items for 35% of bills
        if (Math.random() > 0.65) {
          const itemCount = Math.floor(Math.random() * 3) + 1;
          const unitPaise = Math.floor(totalPaise / itemCount);
          for (let k = 1; k <= itemCount; k++) {
            const itemCat = Math.random() > 0.5
              ? categories[Math.floor(Math.random() * categories.length)]
              : cat;

            insertItemStmt.executeSync({
              $bill_id: newBillId,
              $name: `${itemCat.name} Goods #${k}`,
              $quantity: 1,
              $unit_price: unitPaise,
              $line_total: unitPaise,
              $category_id: itemCat.id,
            });
          }
        }
      }
    } finally {
      insertBillStmt.finalizeSync();
      insertItemStmt.finalizeSync();
    }
  });
}

