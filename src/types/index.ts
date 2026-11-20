export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Other';

export type AccountType = 'bank' | 'cash' | 'upi' | 'wallet';

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  account_number?: string | null;
  initial_balance: number; // in paise
  color: string;
  icon: string;
  is_default: number;
  linked_bank_id?: number | null;
  created_at: string;
  updated_at: string;
  // Computed & Joined
  linked_bank_name?: string | null;
  linked_bank_color?: string | null;
  current_balance?: number; // in paise
  total_inflow?: number;
  total_outflow?: number;
  bill_count?: number;
}

export interface Income {
  id: number;
  date: string; // YYYY-MM-DD
  source: string; // e.g. "Monthly Salary", "Freelance", "Investment Return"
  amount: number; // in paise
  account_id: number;
  category_id?: number | null;
  notes?: string | null;
  created_at: string;
  // Joined
  account_name?: string;
  account_type?: AccountType;
  account_color?: string;
  account_icon?: string;
  category_name?: string;
}

export interface Transfer {
  id: number;
  date: string; // YYYY-MM-DD
  from_account_id: number;
  to_account_id: number;
  amount: number; // in paise
  notes?: string | null;
  created_at: string;
  // Joined
  from_account_name?: string;
  from_account_type?: AccountType;
  from_account_color?: string;
  to_account_name?: string;
  to_account_type?: AccountType;
  to_account_color?: string;
}

export interface AccountTransaction {
  id: string; // e.g. "bill-12", "income-3", "transfer-5"
  type: 'expense' | 'income' | 'transfer_out' | 'transfer_in';
  date: string;
  title: string;
  amount: number; // in paise
  account_id: number;
  account_name: string;
  account_color: string;
  account_type: AccountType;
  related_account_name?: string;
  notes?: string | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_default: number;
  created_at: string;
  // Computed fields when joining
  bill_count?: number;
  total_spent?: number;
}

export interface BillItem {
  id?: number;
  bill_id?: number;
  name: string;
  quantity: number;
  unit_price: number; // in paise/cents
  line_total: number; // in paise/cents
  category_id?: number | null; // Individual item / group category!
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

export interface BillImage {
  id?: number;
  bill_id?: number;
  file_path: string; // relative path in DocumentDirectory
  created_at?: string;
}

export interface Bill {
  id: number;
  date: string; // YYYY-MM-DD
  vendor: string;
  category_id: number; // primary category for transaction or multi-category fallback
  total_amount: number; // in paise/cents
  payment_method: PaymentMethod;
  account_id?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  account_name?: string;
  account_type?: AccountType;
  account_color?: string;
  account_icon?: string;
  image_count?: number;
  images?: BillImage[];
  items?: BillItem[];
  items_summary?: string;
  running_total?: number;

  // Multi-category breakdown for itemized bills
  matched_category_amount?: number; // When queried in category drilldown
  matched_items_summary?: string;   // When queried in category drilldown
  is_itemized?: boolean;
}

export interface BillFilter {
  searchQuery?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  categoryIds?: number[];
  accountIds?: number[];
  paymentMethods?: PaymentMethod[];
  minAmount?: number; // in paise
  maxAmount?: number; // in paise
  hasImagesOnly?: boolean;
}

export interface ActivityFilter {
  activityType?: 'all' | 'expense' | 'transfer' | 'deposit';
  searchQuery?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  categoryIds?: number[];
  accountIds?: number[];
}

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AED' | 'CAD' | 'AUD';

export interface AppSettings {
  currencySymbol: string;
  currencyCode: CurrencyCode;
  useIndianGrouping: boolean;
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  theme: 'light' | 'dark' | 'system';
  showRunningTotal: boolean;
  hideAmounts: boolean;
}

export interface CategorySpending {
  category_id: number;
  name: string;
  color: string;
  icon: string;
  total_amount: number;
  bill_count: number;
  percentage: number;
}

export interface MonthSpending {
  month_key: string; // YYYY-MM
  month_name: string; // e.g. "Jul 2026"
  total_amount: number;
  bill_count: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUri: string | null;
  joinedDate: string;
}

export interface SecuritySettings {
  isLockEnabled: boolean;
  isBiometricEnabled: boolean;
  pinCode: string | null;
}

export interface BillReminder {
  id: number;
  title: string;
  amount: number; // in paise
  day_of_month: number; // 1 to 31
  time_str?: string; // e.g. "09:00"
  category_id?: number | null;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  vendor?: string | null;
  notes?: string | null;
  is_active: number; // 1 or 0
  notification_id?: string | null;
  last_notified_month?: string | null;
  created_at: string;
  updated_at: string;
  // Computed helpers
  days_until_due?: number;
  is_due_today?: boolean;
}

export interface VendorSummary {
  vendor: string;
  count: number;
  total_amount: number;
  first_date: string | null;
  last_date: string | null;
  top_category?: string | null;
}

export type ActivityType = 'expense' | 'withdrawal' | 'bank_transfer' | 'transfer' | 'deposit';

export interface UnifiedActivityItem {
  id: string; // e.g. "bill-12" | "transfer-3" | "income-5"
  type: ActivityType;
  record_id: number;
  date: string;
  title: string;
  subtitle?: string | null;
  amount: number; // in paise
  account_id?: number | null;
  account_name?: string | null;
  account_type?: AccountType;
  account_color?: string | null;
  from_account_name?: string | null;
  to_account_name?: string | null;
  category_name?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
  image_count?: number;
  notes?: string | null;
  created_at: string;
}

export interface DestinationSpending {
  vendor: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  total_spent: number;
  bill_count: number;
  percentage: number;
}

export interface AccountOutflowMetrics {
  total_spent: number;
  bill_count: number;
  avg_bill: number;
  max_bill: number;
  max_bill_vendor: string | null;
  transfers_out_amount: number;
  transfers_out_count: number;
  total_outflow: number;
}
