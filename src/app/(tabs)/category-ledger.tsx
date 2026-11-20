import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
import { SearchBar } from '../../components/ui/SearchBar';
import { CategoryDropdown } from '../../components/ui/CategoryDropdown';
import { VendorDropdown } from '../../components/ui/VendorDropdown';
import { EmptyState } from '../../components/common/EmptyState';
import {
  getCategories,
  getCategoryById,
  getCategoryDrilldownSummary,
  getCategoryTransactions,
  getCategoryYearOverYear,
  getAllVendors,
  getVendorSummary,
  getVendorTransactions,
} from '../../db/queries';
import { Category, Bill, VendorSummary } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/dates';

export default function LedgerTabScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSettings, refreshTrigger } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{
    vendor?: string;
    categoryId?: string;
    mode?: 'category' | 'vendor';
  }>();

  // Mode: Category Ledger vs Vendor Ledger
  const [mode, setMode] = useState<'category' | 'vendor'>(
    params.mode || (params.vendor ? 'vendor' : 'category')
  );

  // ==========================================
  // CATEGORY STATE
  // ==========================================
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(
    params.categoryId ? parseInt(params.categoryId, 10) : null
  );
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categorySummary, setCategorySummary] = useState({ count: 0, total_amount: 0 });
  const [categoryTransactions, setCategoryTransactions] = useState<Bill[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'transactions' | 'yoy'>('transactions');

  // Year-over-Year Comparison
  const currentYearNum = new Date().getFullYear();
  const [year2, setYear2] = useState<string>(currentYearNum.toString());
  const [year1, setYear1] = useState<string>((currentYearNum - 1).toString());
  const [yoyData, setYoyData] = useState<{ month: string; year1_total: number; year2_total: number }[]>([]);

  // ==========================================
  // VENDOR STATE
  // ==========================================
  const [vendors, setVendors] = useState<
    { vendor: string; count: number; total_spent: number; last_date: string }[]
  >([]);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(params.vendor || null);
  const [vendorStats, setVendorStats] = useState<VendorSummary | null>(null);
  const [vendorTransactions, setVendorTransactions] = useState<Bill[]>([]);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');

  const [refreshing, setRefreshing] = useState(false);

  // Sync route params
  useEffect(() => {
    if (params.vendor) {
      setMode('vendor');
      setSelectedVendor(params.vendor);
    } else if (params.categoryId) {
      setMode('category');
      setSelectedCatId(parseInt(params.categoryId, 10));
    }
  }, [params.vendor, params.categoryId]);

  // Load Categories list
  const loadCategories = useCallback(() => {
    const cats = getCategories();
    setCategories(cats);

    if (cats.length > 0) {
      if (!selectedCatId || !cats.some((c) => c.id === selectedCatId)) {
        setSelectedCatId(cats[0].id);
      }
    }
  }, [selectedCatId]);

  // Load Data for Selected Category
  const loadCategoryDetails = useCallback(() => {
    if (!selectedCatId) return;

    const cat = getCategoryById(selectedCatId);
    setSelectedCategory(cat);

    const summ = getCategoryDrilldownSummary(selectedCatId);
    setCategorySummary(summ);

    const list = getCategoryTransactions(selectedCatId);
    setCategoryTransactions(list);

    const yoy = getCategoryYearOverYear(selectedCatId, year1, year2);
    setYoyData(yoy);
  }, [selectedCatId, year1, year2]);

  // Load Vendors list
  const loadVendors = useCallback(() => {
    const all = getAllVendors();
    setVendors(all);

    if (all.length > 0) {
      if (!selectedVendor || !all.some((v) => v.vendor.toLowerCase() === selectedVendor.toLowerCase())) {
        if (!selectedVendor) {
          setSelectedVendor(all[0].vendor);
        }
      }
    }
  }, [selectedVendor]);

  // Load Data for Selected Vendor
  const loadVendorDetails = useCallback(() => {
    if (!selectedVendor) {
      setVendorStats(null);
      setVendorTransactions([]);
      return;
    }

    const stats = getVendorSummary(selectedVendor);
    setVendorStats(stats);

    const list = getVendorTransactions(selectedVendor);
    setVendorTransactions(list);
  }, [selectedVendor]);

  useEffect(() => {
    loadCategories();
    loadVendors();
  }, [loadCategories, loadVendors, refreshTrigger]);

  useEffect(() => {
    if (mode === 'category') {
      loadCategoryDetails();
    } else {
      loadVendorDetails();
    }
  }, [mode, loadCategoryDetails, loadVendorDetails, refreshTrigger]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories();
    loadVendors();
    if (mode === 'category') {
      loadCategoryDetails();
    } else {
      loadVendorDetails();
    }
    setRefreshing(false);
  };

  // YoY calculations
  const year1Sum = yoyData.reduce((acc, r) => acc + (r.year1_total || 0), 0);
  const year2Sum = yoyData.reduce((acc, r) => acc + (r.year2_total || 0), 0);
  let yoyDiffPercent = 0;
  let isDiffPositive = false;
  if (year1Sum > 0) {
    yoyDiffPercent = Math.round(((year2Sum - year1Sum) / year1Sum) * 100);
    isDiffPositive = yoyDiffPercent >= 0;
  }

  // Filter Category transactions
  const filteredCategoryTransactions = useMemo(() => {
    if (!categorySearchQuery.trim()) return categoryTransactions;
    const q = categorySearchQuery.toLowerCase().trim();
    return categoryTransactions.filter((b) => {
      const vendorMatch = b.vendor.toLowerCase().includes(q);
      const notesMatch = b.notes ? b.notes.toLowerCase().includes(q) : false;
      const itemsMatch = b.items_summary ? b.items_summary.toLowerCase().includes(q) : false;
      const matchedItemsMatch = b.matched_items_summary ? b.matched_items_summary.toLowerCase().includes(q) : false;
      const accountMatch = b.account_name ? b.account_name.toLowerCase().includes(q) : false;
      return vendorMatch || notesMatch || itemsMatch || matchedItemsMatch || accountMatch;
    });
  }, [categoryTransactions, categorySearchQuery]);

  const filteredCategorySum = useMemo(() => {
    return filteredCategoryTransactions.reduce((acc, b) => {
      const amt = b.matched_category_amount || b.total_amount;
      return acc + amt;
    }, 0);
  }, [filteredCategoryTransactions]);

  // Filter Vendor transactions
  const filteredVendorTransactions = useMemo(() => {
    if (!vendorSearchQuery.trim()) return vendorTransactions;
    const q = vendorSearchQuery.toLowerCase().trim();
    return vendorTransactions.filter((b) => {
      const notesMatch = b.notes ? b.notes.toLowerCase().includes(q) : false;
      const itemsMatch = b.items_summary ? b.items_summary.toLowerCase().includes(q) : false;
      const catMatch = b.category_name ? b.category_name.toLowerCase().includes(q) : false;
      const dateMatch = b.date.includes(q);
      const accMatch = b.account_name ? b.account_name.toLowerCase().includes(q) : false;
      return notesMatch || itemsMatch || catMatch || dateMatch || accMatch;
    });
  }, [vendorTransactions, vendorSearchQuery]);

  const filteredVendorSum = useMemo(() => {
    return filteredVendorTransactions.reduce((acc, b) => acc + b.total_amount, 0);
  }, [filteredVendorTransactions]);

  const catColor = selectedCategory?.color || colors.accent;
  const catIcon = (selectedCategory?.icon || 'folder-outline') as any;

  const avgVendorSpend = vendorStats && vendorStats.count > 0
    ? Math.round(vendorStats.total_amount / vendorStats.count)
    : 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Ledger</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Comprehensive drilldown by Category or Vendor
          </Text>
        </View>

        {/* Mode Switcher: Categories vs Vendors */}
        <View style={[styles.modeSwitcherWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setMode('category')}
            activeOpacity={0.7}
            style={[
              styles.modeBtn,
              mode === 'category' && [
                styles.modeBtnActive,
                { backgroundColor: colors.card, borderColor: colors.border },
              ],
            ]}
          >
            <Ionicons
              name={mode === 'category' ? 'pricetag' : 'pricetag-outline'}
              size={15}
              color={mode === 'category' ? colors.accent : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeBtnText,
                {
                  color: mode === 'category' ? colors.text : colors.textSecondary,
                  fontWeight: mode === 'category' ? '700' : '600',
                },
              ]}
            >
              By Category
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode('vendor')}
            activeOpacity={0.7}
            style={[
              styles.modeBtn,
              mode === 'vendor' && [
                styles.modeBtnActive,
                { backgroundColor: colors.card, borderColor: colors.border },
              ],
            ]}
          >
            <Ionicons
              name={mode === 'vendor' ? 'storefront' : 'storefront-outline'}
              size={15}
              color={mode === 'vendor' ? colors.accent : colors.textSecondary}
            />
            <Text
              style={[
                styles.modeBtnText,
                {
                  color: mode === 'vendor' ? colors.text : colors.textSecondary,
                  fontWeight: mode === 'vendor' ? '700' : '600',
                },
              ]}
            >
              By Vendor
            </Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* 1. CATEGORY LEDGER MODE                                  */}
        {/* ======================================================== */}
        {mode === 'category' && (
          <>
            {/* Category Dropdown Box */}
            <View style={styles.dropdownSection}>
              <Text style={[styles.dropdownLabel, { color: colors.textSecondary }]}>
                SELECT CATEGORY
              </Text>
              <CategoryDropdown
                categories={categories}
                selectedCategoryId={selectedCatId}
                onSelectCategory={(id) => {
                  if (id) setSelectedCatId(id);
                }}
                placeholder="Choose Category..."
              />
            </View>

            {selectedCategory ? (
              <>
                {/* Category Total & Overview Card */}
                <Card style={styles.overviewCard}>
                  <View style={styles.overviewHeaderRow}>
                    <View style={styles.overviewHeaderLeft}>
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: `${catColor}18` },
                        ]}
                      >
                        <Ionicons name={catIcon} size={24} color={catColor} />
                      </View>
                      <View>
                        <Text style={[styles.catName, { color: colors.text }]}>
                          {selectedCategory.name}
                        </Text>
                        <Text style={[styles.catSubtext, { color: colors.textMuted }]}>
                          {categorySummary.count} {categorySummary.count === 1 ? 'transaction' : 'transactions'} recorded
                        </Text>
                      </View>
                    </View>

                    {/* Quick Add Button to this Category */}
                    <TouchableOpacity
                      onPress={() => router.push(`/add-bill?categoryId=${selectedCategory.id}`)}
                      activeOpacity={0.7}
                      style={[styles.quickAddBtn, { backgroundColor: colors.inputBg }]}
                    >
                      <Ionicons name="add" size={16} color={colors.accent} />
                      <Text style={[styles.quickAddText, { color: colors.accent }]}>Add Bill</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

                  {/* Metrics Row: Category Total + YoY Totals */}
                  <View style={styles.metricsWrapper}>
                    <View style={styles.metricItem}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>TOTAL SPENT</Text>
                      <Text style={[styles.totalAmountValue, { color: colors.text }]}>
                        {formatCurrency(categorySummary.total_amount, settings)}
                      </Text>
                    </View>

                    <View style={styles.metricDivider} />

                    <View style={styles.yoySummaryMetrics}>
                      <TouchableOpacity
                        onPress={() => setActiveSection('yoy')}
                        activeOpacity={0.7}
                        style={styles.metricItem}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{year2} Total</Text>
                          <Ionicons name="stats-chart" size={10} color={colors.accent} />
                        </View>
                        <Text style={[styles.metricValue, { color: colors.text }]}>
                          {formatCurrency(year2Sum, settings)}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.metricDivider} />

                      <TouchableOpacity
                        onPress={() => setActiveSection('yoy')}
                        activeOpacity={0.7}
                        style={styles.metricItem}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{year1} Total</Text>
                          <Ionicons name="stats-chart" size={10} color={colors.accent} />
                        </View>
                        <Text style={[styles.metricValue, { color: colors.text }]}>
                          {formatCurrency(year1Sum, settings)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>

                {/* Section Switcher Tabs: Transactions vs YoY Comparison */}
                <View style={styles.sectionTabsWrap}>
                  <TouchableOpacity
                    onPress={() => setActiveSection('transactions')}
                    activeOpacity={0.7}
                    style={[
                      styles.sectionTabBtn,
                      activeSection === 'transactions'
                        ? [styles.sectionTabBtnActive, { backgroundColor: colors.accent, borderColor: colors.accent }]
                        : [styles.sectionTabBtnInactive, { backgroundColor: colors.inputBg, borderColor: colors.border }],
                    ]}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={15}
                      color={activeSection === 'transactions' ? '#FFFFFF' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.sectionTabText,
                        {
                          color: activeSection === 'transactions' ? '#FFFFFF' : colors.text,
                          fontWeight: activeSection === 'transactions' ? '700' : '600',
                        },
                      ]}
                    >
                      Transactions ({filteredCategoryTransactions.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setActiveSection('yoy')}
                    activeOpacity={0.7}
                    style={[
                      styles.sectionTabBtn,
                      activeSection === 'yoy'
                        ? [styles.sectionTabBtnActive, { backgroundColor: colors.accent, borderColor: colors.accent }]
                        : [styles.sectionTabBtnInactive, { backgroundColor: colors.inputBg, borderColor: colors.border }],
                    ]}
                  >
                    <Ionicons
                      name="bar-chart-outline"
                      size={15}
                      color={activeSection === 'yoy' ? '#FFFFFF' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.sectionTabText,
                        {
                          color: activeSection === 'yoy' ? '#FFFFFF' : colors.text,
                          fontWeight: activeSection === 'yoy' ? '700' : '600',
                        },
                      ]}
                    >
                      YoY Comparison
                    </Text>

                    {year1Sum > 0 && (
                      <View
                        style={[
                          styles.tabBadge,
                          {
                            backgroundColor: activeSection === 'yoy'
                              ? 'rgba(255,255,255,0.25)'
                              : isDiffPositive ? `${colors.danger}18` : `${colors.success}18`,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabBadgeText,
                            {
                              color: activeSection === 'yoy'
                                ? '#FFFFFF'
                                : isDiffPositive ? colors.danger : colors.success,
                            },
                          ]}
                        >
                          {isDiffPositive ? `+${yoyDiffPercent}%` : `${yoyDiffPercent}%`}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* YoY Section */}
                {activeSection === 'yoy' && (
                  <Card style={styles.yoyCard}>
                    <View style={styles.yoyHeader}>
                      <View>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                          Month-by-Month Comparison
                        </Text>
                        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                          Comparing monthly spend between {year1} and {year2}
                        </Text>
                      </View>

                      {year1Sum > 0 && (
                        <View
                          style={[
                            styles.yoyBadge,
                            {
                              backgroundColor: isDiffPositive ? `${colors.danger}15` : `${colors.success}15`,
                              borderColor: isDiffPositive ? colors.danger : colors.success,
                            },
                          ]}
                        >
                          <Ionicons
                            name={isDiffPositive ? 'trending-up' : 'trending-down'}
                            size={14}
                            color={isDiffPositive ? colors.danger : colors.success}
                          />
                          <Text
                            style={[
                              styles.yoyBadgeText,
                              { color: isDiffPositive ? colors.danger : colors.success },
                            ]}
                          >
                            {isDiffPositive ? `+${yoyDiffPercent}%` : `${yoyDiffPercent}%`}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* YoY Table */}
                    <View style={styles.yoyTable}>
                      <View style={[styles.yoyTableHeader, { borderBottomColor: colors.borderLight }]}>
                        <Text style={[styles.colMonth, { color: colors.textMuted }]}>MONTH</Text>
                        <Text style={[styles.colAmount, { color: colors.textMuted }]}>{year1}</Text>
                        <Text style={[styles.colAmount, { color: colors.textMuted }]}>{year2}</Text>
                        <Text style={[styles.colDiff, { color: colors.textMuted }]}>CHANGE</Text>
                      </View>

                      {yoyData.map((row) => {
                        let monthDiffPercent = 0;
                        let isMonthDiffPos = false;
                        if (row.year1_total > 0) {
                          monthDiffPercent = Math.round(
                            ((row.year2_total - row.year1_total) / row.year1_total) * 100
                          );
                          isMonthDiffPos = monthDiffPercent >= 0;
                        }

                        return (
                          <View
                            key={row.month}
                            style={[
                              styles.yoyTableRow,
                              { borderBottomColor: colors.borderLight },
                            ]}
                          >
                            <Text style={[styles.colMonth, { color: colors.text, fontWeight: '600' }]}>
                              {row.month}
                            </Text>
                            <Text style={[styles.colAmount, { color: colors.textSecondary }]}>
                              {row.year1_total > 0 ? formatCurrency(row.year1_total, settings) : '-'}
                            </Text>
                            <Text style={[styles.colAmount, { color: colors.text, fontWeight: '600' }]}>
                              {row.year2_total > 0 ? formatCurrency(row.year2_total, settings) : '-'}
                            </Text>
                            <Text
                              style={[
                                styles.colDiff,
                                {
                                  color:
                                    row.year1_total === 0 && row.year2_total > 0
                                      ? colors.accent
                                      : row.year1_total > 0
                                      ? isMonthDiffPos
                                        ? colors.danger
                                        : colors.success
                                      : colors.textMuted,
                                  fontWeight: '600',
                                },
                              ]}
                            >
                              {row.year1_total === 0 && row.year2_total > 0
                                ? 'New'
                                : row.year1_total > 0
                                ? `${monthDiffPercent > 0 ? '+' : ''}${monthDiffPercent}%`
                                : '-'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </Card>
                )}

                {/* Transactions Section */}
                {activeSection === 'transactions' && (
                  <View style={styles.transactionsSection}>
                    <View style={{ marginBottom: 12 }}>
                      <SearchBar
                        value={categorySearchQuery}
                        onChangeText={setCategorySearchQuery}
                        placeholder={`Search person, vendor, item in ${selectedCategory.name}...`}
                      />
                    </View>

                    <View style={styles.transactionsHeaderRow}>
                      <View>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>
                          Previous Transactions ({filteredCategoryTransactions.length}
                          {categorySearchQuery ? ` of ${categoryTransactions.length}` : ''})
                        </Text>
                        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                          {categorySearchQuery
                            ? `Filtered Total: ${formatCurrency(filteredCategorySum, settings)}`
                            : `All entries mapped to ${selectedCategory.name}`}
                        </Text>
                      </View>
                    </View>

                    {categoryTransactions.length === 0 ? (
                      <EmptyState
                        icon="receipt-outline"
                        title={`No transactions in ${selectedCategory.name}`}
                        description="Add an expense or itemized bill under this category to see it here."
                        actionLabel={`Add ${selectedCategory.name} Bill`}
                        onAction={() => router.push(`/add-bill?categoryId=${selectedCategory.id}`)}
                      />
                    ) : filteredCategoryTransactions.length === 0 ? (
                      <EmptyState
                        icon="search-outline"
                        title="No matching transactions"
                        description={`No bills match "${categorySearchQuery}".`}
                        actionLabel="Clear Search"
                        onAction={() => setCategorySearchQuery('')}
                      />
                    ) : (
                      filteredCategoryTransactions.map((bill) => {
                        const isItemized = Boolean(bill.is_itemized);
                        const matchedAmt = bill.matched_category_amount || bill.total_amount;

                        return (
                          <TouchableOpacity
                            key={bill.id}
                            activeOpacity={0.7}
                            onPress={() => router.push(`/bill/${bill.id}`)}
                            style={[
                              styles.transactionCard,
                              {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <View style={styles.txTopRow}>
                              <View style={styles.txVendorBlock}>
                                <TouchableOpacity
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    // Open Vendor Ledger!
                                    setSelectedVendor(bill.vendor);
                                    setMode('vendor');
                                  }}
                                  style={styles.vendorClickableRow}
                                  activeOpacity={0.6}
                                >
                                  <Text style={[styles.txVendor, { color: colors.text }]} numberOfLines={1}>
                                    {bill.vendor}
                                  </Text>
                                  <View style={[styles.vendorLinkBadge, { backgroundColor: `${colors.accent}15` }]}>
                                    <Ionicons name="storefront" size={10} color={colors.accent} />
                                    <Text style={[styles.vendorLinkText, { color: colors.accent }]}>Vendor</Text>
                                  </View>
                                </TouchableOpacity>

                                <View style={styles.txSubRow}>
                                  <Text style={[styles.txDate, { color: colors.textSecondary }]}>
                                    {formatDisplayDate(bill.date, settings.dateFormat)}
                                  </Text>

                                  {bill.account_name && (
                                    <View style={[styles.accPill, { backgroundColor: colors.inputBg }]}>
                                      <Ionicons
                                        name={
                                          bill.account_type === 'cash'
                                            ? 'cash-outline'
                                            : bill.account_type === 'upi'
                                            ? 'phone-portrait-outline'
                                            : 'business-outline'
                                        }
                                        size={11}
                                        color={bill.account_color || colors.textSecondary}
                                      />
                                      <Text
                                        style={[styles.accPillText, { color: colors.textSecondary }]}
                                        numberOfLines={1}
                                      >
                                        {bill.account_name}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>

                              <View style={styles.txAmountBlock}>
                                <Text style={[styles.txAmount, { color: colors.text }]}>
                                  {formatCurrency(matchedAmt, settings)}
                                </Text>
                              </View>
                            </View>

                            {/* Line items if any */}
                            {bill.items_summary ? (
                              <View style={[styles.itemSummaryRow, { backgroundColor: colors.inputBg }]}>
                                <Ionicons name="cart-outline" size={12} color={colors.textMuted} />
                                <Text
                                  style={[styles.itemSummaryText, { color: colors.textSecondary }]}
                                  numberOfLines={2}
                                >
                                  {bill.items_summary}
                                </Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                )}
              </>
            ) : null}
          </>
        )}

        {/* ======================================================== */}
        {/* 2. VENDOR LEDGER MODE                                    */}
        {/* ======================================================== */}
        {mode === 'vendor' && (
          <>
            {/* Vendor Selector Dropdown */}
            <View style={styles.dropdownSection}>
              <Text style={[styles.dropdownLabel, { color: colors.textSecondary }]}>
                SELECT VENDOR / PAYEE
              </Text>
              <VendorDropdown
                vendors={vendors}
                selectedVendor={selectedVendor}
                onSelectVendor={(v) => setSelectedVendor(v)}
                placeholder="Choose Vendor..."
              />
            </View>

            {selectedVendor && vendorStats ? (
              <>
                {/* Vendor Overview Card */}
                <Card style={styles.overviewCard}>
                  <View style={styles.overviewHeaderRow}>
                    <View style={styles.overviewHeaderLeft}>
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: `${colors.accent}18` },
                        ]}
                      >
                        <Ionicons name="business" size={24} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.catName, { color: colors.text }]} numberOfLines={1}>
                          {vendorStats.vendor}
                        </Text>
                        <Text style={[styles.catSubtext, { color: colors.textMuted }]}>
                          {vendorStats.top_category
                            ? `Primary: ${vendorStats.top_category}`
                            : 'Vendor Ledger'}
                        </Text>
                      </View>
                    </View>

                    {/* Quick Add Bill for this Vendor */}
                    <TouchableOpacity
                      onPress={() =>
                        router.push({ pathname: '/add-bill', params: { vendor: selectedVendor } })
                      }
                      activeOpacity={0.7}
                      style={[styles.quickAddBtn, { backgroundColor: colors.inputBg }]}
                    >
                      <Ionicons name="add" size={16} color={colors.accent} />
                      <Text style={[styles.quickAddText, { color: colors.accent }]}>Add Bill</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

                  {/* Vendor Metrics Grid */}
                  <View style={styles.vendorStatsGrid}>
                    <View style={styles.vendorStatItem}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>TOTAL SPENT</Text>
                      <Text style={[styles.totalAmountValue, { color: colors.text }]}>
                        {formatCurrency(vendorStats.total_amount, settings)}
                      </Text>
                    </View>

                    <View style={styles.vendorStatItem}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>TRANSACTIONS</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>
                        {vendorStats.count} {vendorStats.count === 1 ? 'bill' : 'bills'}
                      </Text>
                    </View>

                    <View style={styles.vendorStatItem}>
                      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>AVG BILL</Text>
                      <Text style={[styles.metricValue, { color: colors.text }]}>
                        {formatCurrency(avgVendorSpend, settings)}
                      </Text>
                    </View>

                    {vendorStats.first_date && vendorStats.last_date && (
                      <View style={styles.vendorStatItem}>
                        <Text style={[styles.metricLabel, { color: colors.textMuted }]}>TIMELINE</Text>
                        <Text style={[styles.timelineText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {formatDisplayDate(vendorStats.first_date, settings.dateFormat)} - {formatDisplayDate(vendorStats.last_date, settings.dateFormat)}
                        </Text>
                      </View>
                    )}
                  </View>
                </Card>

                {/* Vendor Transactions List */}
                <View style={styles.transactionsSection}>
                  <View style={{ marginBottom: 12 }}>
                    <SearchBar
                      value={vendorSearchQuery}
                      onChangeText={setVendorSearchQuery}
                      placeholder={`Search items, dates, notes in ${selectedVendor}...`}
                    />
                  </View>

                  <View style={styles.transactionsHeaderRow}>
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        Previous Transactions ({filteredVendorTransactions.length}
                        {vendorSearchQuery ? ` of ${vendorTransactions.length}` : ''})
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                        {vendorSearchQuery
                          ? `Filtered Total: ${formatCurrency(filteredVendorSum, settings)}`
                          : `Complete ledger for ${selectedVendor}`}
                      </Text>
                    </View>
                  </View>

                  {vendorTransactions.length === 0 ? (
                    <EmptyState
                      icon="storefront-outline"
                      title={`No bills for ${selectedVendor}`}
                      description="Record your first bill from this vendor to track spending."
                      actionLabel={`Add ${selectedVendor} Bill`}
                      onAction={() =>
                        router.push({ pathname: '/add-bill', params: { vendor: selectedVendor } })
                      }
                    />
                  ) : filteredVendorTransactions.length === 0 ? (
                    <EmptyState
                      icon="search-outline"
                      title="No matching transactions"
                      description={`No bills match "${vendorSearchQuery}".`}
                      actionLabel="Clear Search"
                      onAction={() => setVendorSearchQuery('')}
                    />
                  ) : (
                    filteredVendorTransactions.map((bill) => (
                      <TouchableOpacity
                        key={bill.id}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/bill/${bill.id}`)}
                        style={[
                          styles.transactionCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.txTopRow}>
                          <View style={styles.txVendorBlock}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View
                                style={[
                                  styles.categoryDot,
                                  { backgroundColor: bill.category_color || colors.accent },
                                ]}
                              />
                              <Text style={[styles.txVendor, { color: colors.text }]} numberOfLines={1}>
                                {bill.category_name || 'Expense'}
                              </Text>
                            </View>

                            <View style={styles.txSubRow}>
                              <Text style={[styles.txDate, { color: colors.textSecondary }]}>
                                {formatDisplayDate(bill.date, settings.dateFormat)}
                              </Text>

                              {bill.account_name && (
                                <View style={[styles.accPill, { backgroundColor: colors.inputBg }]}>
                                  <Ionicons
                                    name={
                                      bill.account_type === 'cash'
                                        ? 'cash-outline'
                                        : bill.account_type === 'upi'
                                        ? 'phone-portrait-outline'
                                        : 'business-outline'
                                    }
                                    size={11}
                                    color={bill.account_color || colors.textSecondary}
                                  />
                                  <Text
                                    style={[styles.accPillText, { color: colors.textSecondary }]}
                                    numberOfLines={1}
                                  >
                                    {bill.account_name}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          <View style={styles.txAmountBlock}>
                            <Text style={[styles.txAmount, { color: colors.text }]}>
                              {formatCurrency(bill.total_amount, settings)}
                            </Text>
                            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                          </View>
                        </View>

                        {/* Items summary if available */}
                        {bill.items_summary ? (
                          <View style={[styles.itemSummaryRow, { backgroundColor: colors.inputBg }]}>
                            <Ionicons name="cart-outline" size={12} color={colors.textMuted} />
                            <Text
                              style={[styles.itemSummaryText, { color: colors.textSecondary }]}
                              numberOfLines={2}
                            >
                              {bill.items_summary}
                            </Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </>
            ) : (
              <EmptyState
                icon="storefront-outline"
                title="No Vendor Selected"
                description="Choose any vendor from the dropdown above to view its full transaction ledger."
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  modeSwitcherWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
    gap: 6,
  },
  modeBtnActive: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 13,
  },
  dropdownSection: {
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  overviewCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  overviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: 16,
    fontWeight: '700',
  },
  catSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 4,
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  metricsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalAmountValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(150,150,150,0.2)',
    marginHorizontal: 12,
  },
  yoySummaryMetrics: {
    flexDirection: 'row',
    flex: 1.5,
    alignItems: 'center',
  },
  vendorStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vendorStatItem: {
    width: '46%',
  },
  timelineText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTabsWrap: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  sectionTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  sectionTabBtnActive: {},
  sectionTabBtnInactive: {},
  sectionTabText: {
    fontSize: 13,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  yoyCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  yoyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  yoyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  yoyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  yoyTable: {
    gap: 4,
  },
  yoyTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  yoyTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  colMonth: {
    width: '24%',
    fontSize: 12,
  },
  colAmount: {
    width: '28%',
    fontSize: 12,
    textAlign: 'right',
  },
  colDiff: {
    width: '20%',
    fontSize: 12,
    textAlign: 'right',
  },
  transactionsSection: {
    marginBottom: 16,
  },
  transactionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transactionCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txVendorBlock: {
    flex: 1,
    marginRight: 10,
  },
  vendorClickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txVendor: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vendorLinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    gap: 3,
  },
  vendorLinkText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  txSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  txDate: {
    fontSize: 12,
  },
  accPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  accPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  txAmountBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
  },
  itemSummaryText: {
    fontSize: 12,
    flex: 1,
  },
});
