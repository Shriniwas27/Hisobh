export interface DefaultCategoryDef {
  name: string;
  color: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: DefaultCategoryDef[] = [
  { name: 'Food', color: '#D97706', icon: 'restaurant-outline' },
  { name: 'Groceries', color: '#059669', icon: 'cart-outline' },
  { name: 'Rent', color: '#2563EB', icon: 'home-outline' },
  { name: 'Utilities', color: '#4F46E5', icon: 'flash-outline' },
  { name: 'Travel', color: '#DB2777', icon: 'airplane-outline' },
  { name: 'Health', color: '#E11D48', icon: 'medkit-outline' },
  { name: 'Shopping', color: '#7C3AED', icon: 'bag-handle-outline' },
  { name: 'Education', color: '#0284C7', icon: 'school-outline' },
  { name: 'Entertainment', color: '#EA580C', icon: 'film-outline' },
  { name: 'Other', color: '#64748B', icon: 'ellipsis-horizontal-outline' },
];

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Other',
] as const;

export const CATEGORY_PALETTE = [
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#0EA5E9', // Sky Blue
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#84CC16', // Lime
  '#6B7280', // Slate Grey
  '#D97706', // Ochre
  '#4F46E5', // Violet
  '#059669', // Dark Green
  '#DC2626', // Crimson
];

export const CATEGORY_ICONS = [
  'restaurant-outline',
  'cart-outline',
  'home-outline',
  'flash-outline',
  'airplane-outline',
  'medkit-outline',
  'bag-handle-outline',
  'school-outline',
  'film-outline',
  'car-outline',
  'cafe-outline',
  'fitness-outline',
  'gift-outline',
  'laptop-outline',
  'shield-checkmark-outline',
  'ellipsis-horizontal-outline',
];

