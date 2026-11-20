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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
import { DonutChart } from '../../components/charts/DonutChart';
import { MonthlyBarChart } from '../../components/charts/MonthlyBarChart';
import { EmptyState } from '../../components/common/EmptyState';
import { MonthPickerModal } from '../../components/ledger/MonthPickerModal';
import {
  getCategorySpendingBreakdown,
  getMonthlyHistory,
  getTopSpendingDestinations,
  getAccountOutflowMetrics,
  getRecentBillsForAccount,
  getAccounts,
  getDistinctActivityMonths,
} from '../../db/queries';
import {
  CategorySpending,
  MonthSpending,
  DestinationSpending,
  AccountOutflowMetrics,
  Account,
  Bill,
} from '../../types';
import {
  PeriodPreset,
  getDateRangeForPreset,
  formatMonthGroupHeader,
  getMonthShortName,
  formatDisplayDate,
} from '../../utils/dates';
import { formatCurrency } from '../../utils/currency';

export default function ReportsScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSettings, refreshTrigger } = useApp();
  const router = useRouter();

  // Filter States
  const [preset, setPreset] = useState<PeriodPreset | 'custom_month'>('this_month');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Account Filter State (null = All Accounts)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Data States
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategorySpending[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<MonthSpending[]>([]);
  const [topDestinations, setTopDestinations] = useState<DestinationSpending[]>([]);
  const [outflowMetrics, setOutflowMetrics] = useState<AccountOutflowMetrics>({
    total_spent: 0,
    bill_count: 0,
    avg_bill: 0,
    max_bill: 0,
    max_bill_vendor: null,
    transfers_out_amount: 0,
    transfers_out_count: 0,
    total_outflow: 0,
  });
  const [recentBills, setRecentBills] = useState<Bill[]>([]);

  const [refreshing, setRefreshing] = useState(false);

  // Compute active date range
  const dateRange = useMemo(() => {
    if (preset === 'custom_month' && selectedMonth) {
      return {
        startDate: `${selectedMonth}-01`,
        endDate: `${selectedMonth}-31`,
        title: formatMonthGroupHeader(selectedMonth),
      };
    }
    return getDateRangeForPreset(preset);
  }, [preset, selectedMonth]);

  // Only display Bank Accounts in Insights (since UPI and Bank Account draw from the same funds)
  const bankAccounts = useMemo(() => {
    const banks = accounts.filter((acc) => acc.type === 'bank');
    return banks.length > 0 ? banks : accounts.filter((acc) => acc.type !== 'upi');
  }, [accounts]);

  // Find active selected account object
  const selectedAccount = useMemo(() => {
    if (selectedAccountId === null) return null;
    return bankAccounts.find((a) => a.id === selectedAccountId) || accounts.find((a) => a.id === selectedAccountId) || null;
  }, [bankAccounts, accounts, selectedAccountId]);

  // Load report and drilldown data
  const loadReportData = useCallback(() => {
    try {
      const { startDate, endDate } = dateRange;

      // 1. Refresh Accounts & Months
      const allAccs = getAccounts();
      setAccounts(allAccs);

      const months = getDistinctActivityMonths();
      setAvailableMonths(months);

      // 2. Category Outflow Breakdown (where money went by category)
      const breakdown = getCategorySpendingBreakdown(startDate, endDate, selectedAccountId);
      setCategoryBreakdown(breakdown);

      // 3. Monthly Outflow Trend (last 6 months for this account or all)
      const history = getMonthlyHistory(6, selectedAccountId);
      setMonthlyHistory(history);

      // 4. Top Spending Destinations / Merchants (where expenses went)
      const destinations = getTopSpendingDestinations(startDate, endDate, selectedAccountId, 6);
      setTopDestinations(destinations);

      // 5. Account Outflow Summary Metrics
      const metrics = getAccountOutflowMetrics(startDate, endDate, selectedAccountId);
      setOutflowMetrics(metrics);

      // 6. Recent Bills for this account & period
      const recent = getRecentBillsForAccount(startDate, endDate, selectedAccountId, 5);
      setRecentBills(recent);
    } catch (e) {
      console.error('Error loading reports & account insights:', e);
    }
  }, [dateRange, selectedAccountId]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData, refreshTrigger]);

  const onRefresh = async () => {
    setRefreshing(true);
    loadReportData();
    setRefreshing(false);
  };

  const handleSelectCustomMonth = (month: string | null) => {
    if (month) {
      setSelectedMonth(month);
      setPreset('custom_month');
    } else {
      setSelectedMonth(null);
      setPreset('all_time');
    }
    setIsMonthPickerVisible(false);
  };

  const durationPresets: { label: string; value: PeriodPreset }[] = [
    { label: 'This Month', value: 'this_month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'Last 3 Months', value: 'last_3_months' },
    { label: 'Last 6 Months', value: 'last_6_months' },
    { label: 'This Year', value: 'this_year' },
    { label: 'All Time', value: 'all_time' },
  ];

  const totalSpent = outflowMetrics.total_spent;
  const maxDestinationAmount = topDestinations.length > 0 ? topDestinations[0].total_spent : 1;

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
        {/* 1. Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Insights & Analytics</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Track spending patterns, duration trends, and account outflows
          </Text>
        </View>

        {/* 2. Bank Account Selector Filter Bar (UPI unified with Bank Account) */}
        <View style={styles.filterSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionLabelWrapper}>
              <Ionicons name="business-outline" size={14} color={colors.accent} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                BANK ACCOUNT
              </Text>
            </View>
            {selectedAccountId !== null && (
              <TouchableOpacity onPress={() => setSelectedAccountId(null)}>
                <Text style={[styles.clearBtnText, { color: colors.accent }]}>All Accounts</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {/* All Accounts Option */}
            <TouchableOpacity
              onPress={() => setSelectedAccountId(null)}
              activeOpacity={0.7}
              style={[
                styles.accountFilterChip,
                {
                  backgroundColor:
                    selectedAccountId === null ? colors.pillActive : colors.card,
                  borderColor:
                    selectedAccountId === null ? colors.accent : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.accountIconBox,
                  {
                    backgroundColor:
                      selectedAccountId === null
                        ? `${colors.accent}30`
                        : isDark
                        ? '#2C2C30'
                        : '#F3F4F6',
                  },
                ]}
              >
                <Ionicons
                  name="apps-outline"
                  size={14}
                  color={selectedAccountId === null ? colors.pillActiveText : colors.textSecondary}
                />
              </View>
              <Text
                style={[
                  styles.accountChipText,
                  {
                    color:
                      selectedAccountId === null
                        ? colors.pillActiveText
                        : colors.text,
                    fontWeight: selectedAccountId === null ? '700' : '500',
                  },
                ]}
              >
                All Accounts
              </Text>
            </TouchableOpacity>

            {/* Individual Bank Accounts Only (UPI merged into Bank Account) */}
            {bankAccounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;

              return (
                <TouchableOpacity
                  key={acc.id}
                  onPress={() => setSelectedAccountId(acc.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.accountFilterChip,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? '#2A2723'
                          : '#FFF7ED'
                        : colors.card,
                      borderColor: isSelected
                        ? acc.color || colors.accent
                        : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.accountIconBox,
                      { backgroundColor: acc.color ? `${acc.color}25` : `${colors.accent}20` },
                    ]}
                  >
                    <Ionicons
                      name="business-outline"
                      size={14}
                      color={acc.color || colors.accent}
                    />
                  </View>
                  <Text
                    style={[
                      styles.accountChipText,
                      {
                        color: isSelected ? colors.text : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* 3. Duration Selector Filter Bar */}
        <View style={styles.filterSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionLabelWrapper}>
              <Ionicons name="calendar-outline" size={14} color={colors.accent} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                DURATION & TIMELINE
              </Text>
            </View>
            <Text style={[styles.activeRangeText, { color: colors.accent }]}>
              {dateRange.title}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {durationPresets.map((item) => {
              const isSelected = preset === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => {
                    setPreset(item.value);
                    setSelectedMonth(null);
                  }}
                  activeOpacity={0.7}
                  style={[
                    styles.periodChip,
                    {
                      backgroundColor: isSelected ? colors.pillActive : colors.card,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.periodChipText,
                      {
                        color: isSelected ? colors.pillActiveText : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Custom Month Picker Button */}
            <TouchableOpacity
              onPress={() => setIsMonthPickerVisible(true)}
              activeOpacity={0.7}
              style={[
                styles.periodChip,
                styles.customMonthChip,
                {
                  backgroundColor:
                    preset === 'custom_month' ? colors.pillActive : colors.card,
                  borderColor:
                    preset === 'custom_month' ? colors.accent : colors.border,
                },
              ]}
            >
              <Ionicons
                name="calendar"
                size={13}
                color={preset === 'custom_month' ? colors.pillActiveText : colors.accent}
              />
              <Text
                style={[
                  styles.periodChipText,
                  {
                    color:
                      preset === 'custom_month' ? colors.pillActiveText : colors.text,
                    fontWeight: preset === 'custom_month' ? '700' : '600',
                  },
                ]}
              >
                {selectedMonth
                  ? `${getMonthShortName(selectedMonth)} ▾`
                  : 'Pick Month ▾'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 4. Selected Account Focus Card */}
        {selectedAccount && (
          <Card
            style={[
              styles.accountBannerCard,
              {
                borderColor: selectedAccount.color || colors.accent,
                borderLeftWidth: 4,
              },
            ]}
          >
            <View style={styles.accountBannerTop}>
              <View style={styles.accountBannerLeft}>
                <View
                  style={[
                    styles.accountBannerIcon,
                    {
                      backgroundColor: selectedAccount.color
                        ? `${selectedAccount.color}25`
                        : `${colors.accent}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      (selectedAccount.icon as any) ||
                      (selectedAccount.type === 'bank' ? 'business-outline' : 'cash-outline')
                    }
                    size={22}
                    color={selectedAccount.color || colors.accent}
                  />
                </View>
                <View>
                  <Text style={[styles.accountBannerTitle, { color: colors.text }]}>
                    {selectedAccount.name}
                  </Text>
                  <Text style={[styles.accountBannerType, { color: colors.textSecondary }]}>
                    {selectedAccount.type === 'bank'
                      ? 'Bank Account Outflow'
                      : selectedAccount.type === 'cash'
                      ? 'Cash Drawer Outflow'
                      : 'UPI Handle Outflow'}
                  </Text>
                </View>
              </View>

              <View style={styles.accountBannerBalance}>
                <Text style={[styles.balanceSub, { color: colors.textSecondary }]}>Current Balance</Text>
                <Text style={[styles.balanceVal, { color: colors.text }]}>
                  {formatCurrency(selectedAccount.current_balance ?? 0, settings)}
                </Text>
              </View>
            </View>

            {/* Note if linked to bank */}
            {selectedAccount.type === 'bank' && (
              <View style={[styles.bankLinkedPill, { backgroundColor: isDark ? '#26262B' : '#F8FAFC' }]}>
                <Ionicons name="information-circle-outline" size={14} color="#3B82F6" />
                <Text style={[styles.bankLinkedText, { color: colors.textSecondary }]}>
                  Includes card, netbanking & linked UPI payments debited from this bank.
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* 5. Key Outflow Financial Metrics Grid */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Total Spent */}
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>TOTAL SPENT</Text>
              <View style={[styles.metricIconBox, { backgroundColor: `${colors.accent}15` }]}>
                <Ionicons name="cart-outline" size={13} color={colors.accent} />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatCurrency(totalSpent, settings)}
            </Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]}>
              {outflowMetrics.bill_count} {outflowMetrics.bill_count === 1 ? 'bill' : 'bills'} recorded
            </Text>
          </View>

          {/* Card 2: Average Expense */}
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>AVG EXPENSE</Text>
              <View style={[styles.metricIconBox, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="calculator-outline" size={13} color="#10B981" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatCurrency(outflowMetrics.avg_bill, settings)}
            </Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]}>
              per transaction
            </Text>
          </View>

          {/* Card 3: Largest Expense */}
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>LARGEST BILL</Text>
              <View style={[styles.metricIconBox, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="trending-up-outline" size={13} color="#F59E0B" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatCurrency(outflowMetrics.max_bill, settings)}
            </Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]} numberOfLines={1}>
              {outflowMetrics.max_bill_vendor ? `At ${outflowMetrics.max_bill_vendor}` : 'No bills'}
            </Text>
          </View>

          {/* Card 4: Transfers Out (if account selected or transfers exist) */}
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>TRANSFERS OUT</Text>
              <View style={[styles.metricIconBox, { backgroundColor: '#8B5CF615' }]}>
                <Ionicons name="swap-horizontal-outline" size={13} color="#8B5CF6" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {formatCurrency(outflowMetrics.transfers_out_amount, settings)}
            </Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]}>
              {outflowMetrics.transfers_out_count} ATM/transfers
            </Text>
          </View>
        </View>

        {/* 6. Where Expenses Go (Category Share & Donut) */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: colors.text }]}>
                {selectedAccount
                  ? `${selectedAccount.name} • Where Expenses Went`
                  : 'Where Expenses Went (by Category)'}
              </Text>
              <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                Category breakdown in {dateRange.title}
              </Text>
            </View>
            <Text style={[styles.chartTotal, { color: colors.accent }]}>
              {formatCurrency(totalSpent, settings)}
            </Text>
          </View>

          {totalSpent === 0 ? (
            <EmptyState
              icon="pie-chart-outline"
              title="No spending recorded"
              description={
                selectedAccount
                  ? `No bills found for ${selectedAccount.name} during ${dateRange.title}.`
                  : `No bills recorded for ${dateRange.title}. Try selecting another duration.`
              }
            />
          ) : (
            <View>
              <DonutChart
                data={categoryBreakdown}
                totalPaise={totalSpent}
                size={140}
                strokeWidth={20}
              />

              {/* Detailed Breakdown List */}
              <View style={styles.categoryBreakdownList}>
                {categoryBreakdown.map((cat) => (
                  <View key={cat.category_id} style={[styles.categoryBreakdownItem, { borderColor: colors.borderLight }]}>
                    <View style={styles.catLeftCol}>
                      <View style={[styles.catColorDot, { backgroundColor: cat.color }]} />
                      <View>
                        <Text style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
                        <Text style={[styles.catCount, { color: colors.textMuted }]}>
                          {cat.bill_count} {cat.bill_count === 1 ? 'bill' : 'bills'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.catRightCol}>
                      <Text style={[styles.catAmount, { color: colors.text }]}>
                        {formatCurrency(cat.total_amount, settings)}
                      </Text>
                      <View style={styles.catPercentBarRow}>
                        <View style={[styles.catPercentTrack, { backgroundColor: isDark ? '#2C2C30' : '#E5E7EB' }]}>
                          <View
                            style={[
                              styles.catPercentFill,
                              {
                                width: `${Math.min(cat.percentage, 100)}%`,
                                backgroundColor: cat.color,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.catPercentText, { color: colors.textSecondary }]}>
                          {cat.percentage.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* 7. Where Expenses Go: Top Payees & Merchants */}
        {topDestinations.length > 0 && (
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={[styles.chartTitle, { color: colors.text }]}>
                  {selectedAccount
                    ? `${selectedAccount.name} • Top Destinations & Payees`
                    : 'Top Spending Destinations & Payees'}
                </Text>
                <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                  Tap any vendor to open their ledger
                </Text>
              </View>
              <Ionicons name="storefront-outline" size={20} color={colors.accent} />
            </View>

            <View style={styles.destinationsList}>
              {topDestinations.map((dest, idx) => {
                const ratio = Math.max(dest.total_spent / maxDestinationAmount, 0.05);
                return (
                  <TouchableOpacity
                    key={`${dest.vendor}-${idx}`}
                    onPress={() =>
                      router.push({ pathname: '/vendor-bills', params: { vendor: dest.vendor } })
                    }
                    activeOpacity={0.7}
                    style={[styles.destinationRow, { borderColor: colors.borderLight }]}
                  >
                    <View style={styles.destinationRankBox}>
                      <Text style={[styles.destinationRank, { color: colors.textMuted }]}>
                        #{idx + 1}
                      </Text>
                    </View>

                    <View style={styles.destinationMain}>
                      <View style={styles.destinationTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
                          <Text style={[styles.destinationVendor, { color: colors.text }]} numberOfLines={1}>
                            {dest.vendor}
                          </Text>
                          <Ionicons name="storefront-outline" size={12} color={colors.accent} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={[styles.destinationAmount, { color: colors.text }]}>
                            {formatCurrency(dest.total_spent, settings)}
                          </Text>
                          <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
                        </View>
                      </View>

                      {/* Progress bar and category tag */}
                      <View style={styles.destinationBottomRow}>
                        <View style={[styles.destinationTrack, { backgroundColor: isDark ? '#2C2C30' : '#E5E7EB' }]}>
                          <View
                            style={[
                              styles.destinationFill,
                              {
                                width: `${ratio * 100}%`,
                                backgroundColor: dest.category_color || colors.accent,
                              },
                            ]}
                          />
                        </View>
                        <View
                          style={[
                            styles.destinationCatTag,
                            {
                              backgroundColor: dest.category_color
                                ? `${dest.category_color}20`
                                : `${colors.accent}20`,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.destinationCatText,
                              { color: dest.category_color || colors.accent },
                            ]}
                          >
                            {dest.category_name}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* 8. Monthly Spending Trend */}
        <Card style={styles.chartCard}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>Monthly Outflow History</Text>
          <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
            {selectedAccount
              ? `Past 6 months expenditure for ${selectedAccount.name}`
              : 'Past 6 months total expenditure across all accounts'}
          </Text>

          <MonthlyBarChart data={monthlyHistory} height={140} />
        </Card>

        {/* 9. Recent Bills in this Duration / Account */}
        {recentBills.length > 0 && (
          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={[styles.chartTitle, { color: colors.text }]}>
                  {selectedAccount ? `Recent Bills (${selectedAccount.name})` : 'Recent Bills in Period'}
                </Text>
                <Text style={[styles.chartSub, { color: colors.textSecondary }]}>
                  Tap any transaction to inspect items and receipt
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/ledger')}>
                <Text style={[styles.clearBtnText, { color: colors.accent }]}>View All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentBillsList}>
              {recentBills.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => router.push(`/bill/${b.id}`)}
                  activeOpacity={0.7}
                  style={[styles.recentBillRow, { borderColor: colors.borderLight }]}
                >
                  <View
                    style={[
                      styles.recentBillCatDot,
                      { backgroundColor: b.category_color || colors.accent },
                    ]}
                  >
                    <Ionicons
                      name={(b.category_icon as any) || 'receipt-outline'}
                      size={14}
                      color="#FFFFFF"
                    />
                  </View>

                  <View style={styles.recentBillCenter}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({ pathname: '/vendor-bills', params: { vendor: b.vendor } });
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={[styles.recentBillVendor, { color: colors.text }]}>{b.vendor}</Text>
                      <Ionicons name="storefront-outline" size={11} color={colors.accent} />
                    </TouchableOpacity>
                    <Text style={[styles.recentBillSub, { color: colors.textMuted }]}>
                      {formatDisplayDate(b.date, settings.dateFormat)} • {b.category_name}
                    </Text>
                  </View>

                  <View style={styles.recentBillRight}>
                    <Text style={[styles.recentBillAmount, { color: colors.text }]}>
                      {formatCurrency(b.total_amount, settings)}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Month Picker Modal */}
      <MonthPickerModal
        visible={isMonthPickerVisible}
        onClose={() => setIsMonthPickerVisible(false)}
        months={availableMonths}
        selectedMonth={selectedMonth}
        onSelectMonth={handleSelectCustomMonth}
      />
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
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  filterSection: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeRangeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  accountFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 7,
  },
  accountIconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountChipText: {
    fontSize: 13,
  },
  accountTypeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  accountTypeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  periodChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  customMonthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  periodChipText: {
    fontSize: 13,
  },
  accountBannerCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  accountBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  accountBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  accountBannerType: {
    fontSize: 12,
    marginTop: 2,
  },
  accountBannerBalance: {
    alignItems: 'flex-end',
  },
  balanceSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  balanceVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  bankLinkedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  bankLinkedText: {
    fontSize: 11,
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    width: '48.5%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  metricSub: {
    fontSize: 11,
    marginTop: 2,
  },
  chartCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartSub: {
    fontSize: 12,
    marginTop: 2,
  },
  chartTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  categoryBreakdownList: {
    marginTop: 18,
    gap: 10,
  },
  categoryBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  catColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
  },
  catCount: {
    fontSize: 11,
    marginTop: 1,
  },
  catRightCol: {
    alignItems: 'flex-end',
    width: 130,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  catPercentBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    width: '100%',
  },
  catPercentTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  catPercentFill: {
    height: '100%',
    borderRadius: 2,
  },
  catPercentText: {
    fontSize: 11,
    fontWeight: '600',
    width: 38,
    textAlign: 'right',
  },
  destinationsList: {
    gap: 12,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  destinationRankBox: {
    width: 24,
    alignItems: 'center',
  },
  destinationRank: {
    fontSize: 12,
    fontWeight: '700',
  },
  destinationMain: {
    flex: 1,
  },
  destinationTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  destinationVendor: {
    fontSize: 14,
    fontWeight: '700',
  },
  destinationAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  destinationBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  destinationTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  destinationFill: {
    height: '100%',
    borderRadius: 3,
  },
  destinationCatTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  destinationCatText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recentBillsList: {
    gap: 10,
  },
  recentBillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentBillCatDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentBillCenter: {
    flex: 1,
  },
  recentBillVendor: {
    fontSize: 14,
    fontWeight: '600',
  },
  recentBillSub: {
    fontSize: 11,
    marginTop: 2,
  },
  recentBillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentBillAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
});
