import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { SearchBar } from '../../components/ui/SearchBar';
import { ActivityCard } from '../../components/ledger/ActivityCard';
import { DaySectionHeader, MonthSectionHeader } from '../../components/ledger/LedgerSectionHeader';
import { MonthPickerModal } from '../../components/ledger/MonthPickerModal';
import { FilterModal } from '../../components/filter/FilterModal';
import { EmptyState } from '../../components/common/EmptyState';
import {
  getFilteredUnifiedActivity,
  getCategories,
  getDistinctActivityMonths,
  getUnifiedActivitySummary,
  getAccounts,
} from '../../db/queries';
import { ActivityFilter, BillFilter, Category, UnifiedActivityItem, Account } from '../../types';
import { formatDayGroupHeader, formatMonthGroupHeader } from '../../utils/dates';
import { formatCurrency } from '../../utils/currency';

interface DaySection {
  monthKey: string;
  monthTitle: string;
  monthTotal: number;
  monthCount: number;
  isFirstSectionInMonth: boolean;
  date: string;
  dayTitle: string;
  dayTotal: number;
  data: UnifiedActivityItem[];
}

const PAGE_SIZE = 60;

export default function LedgerScreen() {
  const { colors } = useTheme();
  const { settings, updateSettings, refreshTrigger } = useApp();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | 'expense' | 'transfer' | 'deposit'>('all');
  const [filter, setFilter] = useState<BillFilter>({});
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<number | null>(null);
  
  const [activityItems, setActivityItems] = useState<UnifiedActivityItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [summary, setSummary] = useState({
    count: 0,
    total_expenses: 0,
    total_transfers: 0,
    total_deposits: 0,
  });

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);

  // Compute combined filter
  const activeFilter: ActivityFilter = useMemo(() => {
    const f: ActivityFilter = {
      searchQuery,
      activityType: activityTypeFilter,
    };
    if (selectedMonth) {
      f.startDate = `${selectedMonth}-01`;
      f.endDate = `${selectedMonth}-31`;
    }
    if (selectedCategoryTab) {
      f.categoryIds = [selectedCategoryTab];
    }
    if (filter.categoryIds && filter.categoryIds.length > 0) {
      f.categoryIds = filter.categoryIds;
    }
    if (filter.accountIds && filter.accountIds.length > 0) {
      f.accountIds = filter.accountIds;
    }
    if (filter.startDate) {
      f.startDate = filter.startDate;
    }
    if (filter.endDate) {
      f.endDate = filter.endDate;
    }
    return f;
  }, [filter, searchQuery, selectedMonth, selectedCategoryTab, activityTypeFilter]);

  const hasAnyFilter = Boolean(
    searchQuery.trim() ||
    selectedMonth ||
    selectedCategoryTab ||
    activityTypeFilter !== 'all' ||
    Boolean(filter.categoryIds?.length) ||
    Boolean(filter.accountIds?.length) ||
    Boolean(filter.paymentMethods?.length) ||
    Boolean(filter.minAmount) ||
    Boolean(filter.maxAmount) ||
    Boolean(filter.hasImagesOnly)
  );

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedMonth(null);
    setSelectedCategoryTab(null);
    setActivityTypeFilter('all');
    setFilter({});
  };

  const loadData = useCallback(
    (pageNumber: number = 0, append: boolean = false) => {
      try {
        setLoading(true);
        const offset = pageNumber * PAGE_SIZE;
        const newItems = getFilteredUnifiedActivity(activeFilter, PAGE_SIZE, offset);

        if (append) {
          setActivityItems((prev) => [...prev, ...newItems]);
        } else {
          setActivityItems(newItems);
        }

        setHasMore(newItems.length === PAGE_SIZE);
        setPage(pageNumber);

        const summ = getUnifiedActivitySummary(activeFilter);
        setSummary(summ);

        const cats = getCategories();
        setCategories(cats);

        const accs = getAccounts();
        setAccounts(accs);

        const months = getDistinctActivityMonths();
        setAvailableMonths(months);
      } catch (err) {
        console.error('Error loading activity ledger:', err);
      } finally {
        setLoading(false);
      }
    },
    [activeFilter]
  );

  useEffect(() => {
    loadData(0, false);
  }, [loadData, refreshTrigger]);

  const onRefresh = async () => {
    setRefreshing(true);
    loadData(0, false);
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (!loading && hasMore) {
      loadData(page + 1, true);
    }
  };

  // Group items into Month & Day sections for SectionList
  const sections: DaySection[] = useMemo(() => {
    const mapByDate = new Map<string, UnifiedActivityItem[]>();
    for (const item of activityItems) {
      if (!mapByDate.has(item.date)) {
        mapByDate.set(item.date, []);
      }
      mapByDate.get(item.date)!.push(item);
    }

    const monthTotals = new Map<string, { total: number; count: number }>();
    for (const item of activityItems) {
      const mKey = item.date.substring(0, 7);
      const curr = monthTotals.get(mKey) || { total: 0, count: 0 };
      const amtToAdd = activityTypeFilter === 'all' 
        ? (item.type === 'expense' ? item.amount : 0)
        : item.amount;
      monthTotals.set(mKey, {
        total: curr.total + amtToAdd,
        count: curr.count + 1,
      });
    }

    const seenMonths = new Set<string>();
    const sectionList: DaySection[] = [];

    for (const [dateStr, dayItems] of mapByDate.entries()) {
      const mKey = dateStr.substring(0, 7);
      const isFirst = !seenMonths.has(mKey);
      if (isFirst) {
        seenMonths.add(mKey);
      }

      const dayTotal = dayItems.reduce((acc, curr) => {
        const amtToAdd = activityTypeFilter === 'all'
          ? (curr.type === 'expense' ? curr.amount : 0)
          : curr.amount;
        return acc + amtToAdd;
      }, 0);

      const mData = monthTotals.get(mKey) || { total: 0, count: 0 };

      sectionList.push({
        monthKey: mKey,
        monthTitle: formatMonthGroupHeader(mKey),
        monthTotal: mData.total,
        monthCount: mData.count,
        isFirstSectionInMonth: isFirst,
        date: dateStr,
        dayTitle: formatDayGroupHeader(dateStr),
        dayTotal,
        data: dayItems,
      });
    }

    return sectionList;
  }, [activityItems, activityTypeFilter]);

  const activeCategoryObj = categories.find((c) => c.id === selectedCategoryTab);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* 1. Top Header: Clean title & spend counters */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Activity</Text>
            {summary.count > 0 && (
              <View style={styles.headerStatsRow}>
                <Text style={[styles.summarySpend, { color: colors.textSecondary }]}>
                  Spend: <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(summary.total_expenses, settings)}</Text>
                </Text>
                {summary.total_transfers > 0 && (
                  <Text style={[styles.summarySpend, { color: colors.textSecondary }]}>
                    • Transfers: <Text style={{ color: '#2563EB', fontWeight: '700' }}>{formatCurrency(summary.total_transfers, settings)}</Text>
                  </Text>
                )}
                {summary.total_deposits > 0 && (
                  <Text style={[styles.summarySpend, { color: colors.textSecondary }]}>
                    • Inflow: <Text style={{ color: '#10B981', fontWeight: '700' }}>{formatCurrency(summary.total_deposits, settings)}</Text>
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Count Badge */}
          <View style={[styles.countBadge, { backgroundColor: colors.inputBg }]}>
            <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
              {activityItems.length} items
            </Text>
          </View>
        </View>

        {/* 2. Unified Search & Filter Bar */}
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search vendor, account, or note..."
            onFilterPress={() => setIsFilterModalVisible(true)}
            hasActiveFilters={hasAnyFilter}
          />
        </View>

        {/* 3. Combined Horizontal Filter Hub */}
        <View style={styles.unifiedFilterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.unifiedFilterScroll}
          >
            {/* Activity Type Chips */}
            {[
              { key: 'all', label: 'All' },
              { key: 'expense', label: 'Expenses', icon: 'cart-outline' },
              { key: 'transfer', label: 'Transfers & ATM', icon: 'swap-horizontal-outline' },
              { key: 'deposit', label: 'Deposits', icon: 'arrow-down-circle-outline' },
            ].map((chip) => {
              const active = activityTypeFilter === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  onPress={() => setActivityTypeFilter(chip.key as any)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.pillActive : colors.card,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  {chip.icon ? (
                    <Ionicons
                      name={chip.icon as any}
                      size={13}
                      color={active ? colors.pillActiveText : colors.textSecondary}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? colors.pillActiveText : colors.text },
                      active && { fontWeight: '700' },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Month Filter Pill */}
            <TouchableOpacity
              onPress={() => setIsMonthPickerVisible(true)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedMonth ? colors.pillActive : colors.card,
                  borderColor: selectedMonth ? colors.accent : colors.border,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={13}
                color={selectedMonth ? colors.pillActiveText : colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedMonth ? colors.pillActiveText : colors.text },
                  selectedMonth && { fontWeight: '700' },
                ]}
              >
                {selectedMonth ? formatMonthGroupHeader(selectedMonth) : 'Month ▾'}
              </Text>
              {selectedMonth ? (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedMonth(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={14} color={colors.pillActiveText} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

            {/* Category Filter Pill */}
            {selectedCategoryTab ? (
              <View
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: colors.pillActive,
                    borderColor: activeCategoryObj?.color || colors.accent,
                  },
                ]}
              >
                <View
                  style={[
                    styles.catDot,
                    { backgroundColor: activeCategoryObj?.color || colors.accent },
                  ]}
                />
                <Text style={[styles.filterChipText, { color: colors.pillActiveText, fontWeight: '700' }]}>
                  {activeCategoryObj?.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedCategoryTab(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={14} color={colors.pillActiveText} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setIsFilterModalVisible(true)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="pricetag-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.filterChipText, { color: colors.text }]}>
                  Category ▾
                </Text>
              </TouchableOpacity>
            )}

            {/* Account Filter Pill */}
            {filter.accountIds && filter.accountIds.length > 0 && (
              <View
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.accent,
                  },
                ]}
              >
                <Ionicons name="wallet-outline" size={13} color={colors.pillActiveText} />
                <Text style={[styles.filterChipText, { color: colors.pillActiveText, fontWeight: '700' }]}>
                  {filter.accountIds.length === 1
                    ? accounts.find((a) => a.id === filter.accountIds![0])?.name || '1 Account'
                    : `${filter.accountIds.length} Accounts`}
                </Text>
                <TouchableOpacity
                  onPress={() => setFilter({ ...filter, accountIds: undefined })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={14} color={colors.pillActiveText} />
                </TouchableOpacity>
              </View>
            )}

            {/* Clear All Reset Pill (Appears only when any filter is active) */}
            {hasAnyFilter && (
              <TouchableOpacity
                onPress={resetAllFilters}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: `${colors.danger}15`,
                    borderColor: `${colors.danger}35`,
                  },
                ]}
              >
                <Ionicons name="close" size={13} color={colors.danger} />
                <Text style={[styles.filterChipText, { color: colors.danger, fontWeight: '700' }]}>
                  Reset
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* 4. Chronological Unified SectionList (Immediately visible!) */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          renderSectionHeader={({ section }) => (
            <View>
              {section.isFirstSectionInMonth && (
                <MonthSectionHeader
                  title={section.monthTitle}
                  totalAmount={section.monthTotal}
                  count={section.monthCount}
                />
              )}
              <DaySectionHeader
                title={section.dayTitle}
                totalAmount={section.dayTotal}
              />
            </View>
          )}
          renderItem={({ item }) => (
            <ActivityCard
              item={item}
              onRefresh={onRefresh}
            />
          )}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="swap-horizontal-outline"
                title="No activity found"
                description={
                  hasAnyFilter
                    ? 'No transactions match your current filters or search keywords.'
                    : 'Record your first bill, transfer, or deposit to see it here.'
                }
                actionLabel={hasAnyFilter ? 'Reset Filters' : 'Add a Bill'}
                onAction={() => {
                  if (hasAnyFilter) {
                    resetAllFilters();
                  } else {
                    router.push('/add-bill');
                  }
                }}
              />
            ) : undefined
          }
          ListFooterComponent={
            loading && activityItems.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : undefined
          }
        />

        {/* Unified Filter Modal */}
        <FilterModal
          visible={isFilterModalVisible}
          onClose={() => setIsFilterModalVisible(false)}
          categories={categories}
          accounts={accounts}
          currentFilter={filter}
          onApplyFilter={(newFilter) => setFilter(newFilter)}
        />

        {/* Month Picker Modal */}
        <MonthPickerModal
          visible={isMonthPickerVisible}
          onClose={() => setIsMonthPickerVisible(false)}
          months={availableMonths}
          selectedMonth={selectedMonth}
          onSelectMonth={(month) => setSelectedMonth(month)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  summarySpend: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  searchBarWrapper: {
    marginBottom: 8,
  },
  unifiedFilterRow: {
    marginBottom: 10,
  },
  unifiedFilterScroll: {
    gap: 7,
    paddingVertical: 2,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  catDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  listContent: {
    paddingBottom: 40,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
