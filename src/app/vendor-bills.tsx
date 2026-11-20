import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { SearchBar } from '../components/ui/SearchBar';
import { EmptyState } from '../components/common/EmptyState';
import {
  getVendorTransactions,
  getVendorSummary,
  getAllVendors,
} from '../db/queries';
import { Bill, VendorSummary } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate } from '../utils/dates';

export default function VendorBillsScreen() {
  const { colors, isDark } = useTheme();
  const { settings, refreshTrigger } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ vendor?: string }>();

  const [currentVendor, setCurrentVendor] = useState<string>(params.vendor || '');
  const [vendorList, setVendorList] = useState<{ vendor: string; count: number; total_spent: number; last_date: string }[]>([]);
  const [vendorStats, setVendorStats] = useState<VendorSummary | null>(null);
  const [transactions, setTransactions] = useState<Bill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [vendorFilterText, setVendorFilterText] = useState('');

  const loadData = useCallback(() => {
    const all = getAllVendors();
    setVendorList(all);

    let activeVendor = currentVendor;
    if (!activeVendor && all.length > 0) {
      activeVendor = all[0].vendor;
      setCurrentVendor(activeVendor);
    }

    if (activeVendor) {
      const stats = getVendorSummary(activeVendor);
      setVendorStats(stats);
      const bills = getVendorTransactions(activeVendor);
      setTransactions(bills);
    } else {
      setVendorStats(null);
      setTransactions([]);
    }
  }, [currentVendor]);

  useEffect(() => {
    if (params.vendor && params.vendor !== currentVendor) {
      setCurrentVendor(params.vendor);
    }
  }, [params.vendor]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger, currentVendor]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  // Filter transactions by commodity / notes / date
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((b) => {
      const notesMatch = b.notes ? b.notes.toLowerCase().includes(q) : false;
      const itemsMatch = b.items_summary ? b.items_summary.toLowerCase().includes(q) : false;
      const catMatch = b.category_name ? b.category_name.toLowerCase().includes(q) : false;
      const dateMatch = b.date.includes(q);
      return notesMatch || itemsMatch || catMatch || dateMatch;
    });
  }, [transactions, searchQuery]);

  // Filtered vendors in switcher modal
  const filteredVendorsInModal = useMemo(() => {
    if (!vendorFilterText.trim()) return vendorList;
    const q = vendorFilterText.toLowerCase().trim();
    return vendorList.filter((v) => v.vendor.toLowerCase().includes(q));
  }, [vendorList, vendorFilterText]);

  const avgSpend = vendorStats && vendorStats.count > 0
    ? Math.round(vendorStats.total_amount / vendorStats.count)
    : 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowVendorPicker(true)}
          style={[styles.vendorTitleSelector, { backgroundColor: colors.inputBg }]}
          activeOpacity={0.7}
        >
          <Ionicons name="storefront-outline" size={17} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {currentVendor || 'Select Vendor'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push({ pathname: '/add-bill', params: { vendor: currentVendor } })}
          style={[styles.headerActionBtn, { backgroundColor: colors.accent }]}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {currentVendor && vendorStats ? (
          <>
            {/* Vendor Summary Card */}
            <Card style={styles.statsCard}>
              <View style={styles.statsHeaderRow}>
                <View style={styles.vendorIconBadge}>
                  <Ionicons name="business" size={24} color={colors.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.vendorName, { color: colors.text }]} numberOfLines={1}>
                    {vendorStats.vendor}
                  </Text>
                  <Text style={[styles.vendorSubtitle, { color: colors.textSecondary }]}>
                    {vendorStats.top_category ? `Primary: ${vendorStats.top_category}` : 'Transaction History'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowVendorPicker(true)}
                  style={[styles.switchChip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                >
                  <Text style={[styles.switchChipText, { color: colors.accent }]}>Switch</Text>
                  <Ionicons name="swap-horizontal" size={13} color={colors.accent} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>

              <View style={[styles.statsDivider, { backgroundColor: colors.borderLight }]} />

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>TOTAL SPENT</Text>
                  <Text style={[styles.statTotalValue, { color: colors.text }]}>
                    {formatCurrency(vendorStats.total_amount, settings)}
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>TRANSACTIONS</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {vendorStats.count} {vendorStats.count === 1 ? 'bill' : 'bills'}
                  </Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>AVERAGE BILL</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(avgSpend, settings)}
                  </Text>
                </View>

                {vendorStats.first_date && vendorStats.last_date && (
                  <View style={styles.statBox}>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>TIMELINE</Text>
                    <Text style={[styles.statSubValue, { color: colors.textSecondary }]} numberOfLines={1}>
                      {formatDisplayDate(vendorStats.first_date, settings.dateFormat)} - {formatDisplayDate(vendorStats.last_date, settings.dateFormat)}
                    </Text>
                  </View>
                )}
              </View>
            </Card>

            {/* Search Bar for this vendor's transactions */}
            <View style={styles.searchSection}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`Search commodity, item, notes in ${currentVendor}...`}
              />
            </View>

            {/* Transaction List */}
            <View style={styles.txListHeader}>
              <Text style={[styles.txCountText, { color: colors.textSecondary }]}>
                {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
                {searchQuery ? ` matching "${searchQuery}"` : ''}
              </Text>
            </View>

            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title={searchQuery ? 'No matching bills found' : 'No transactions recorded'}
                description={
                  searchQuery
                    ? `No bills for ${currentVendor} match "${searchQuery}".`
                    : `Add a new bill paid to ${currentVendor} to start tracking.`
                }
                actionLabel={`Add Bill for ${currentVendor}`}
                onAction={() => router.push({ pathname: '/add-bill', params: { vendor: currentVendor } })}
              />
            ) : (
              filteredTransactions.map((bill) => (
                <TouchableOpacity
                  key={bill.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/bill/${bill.id}`)}
                  style={[
                    styles.txCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.txRow}>
                    <View style={styles.txLeft}>
                      {/* Commodity / Item name or Category */}
                      <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                        {bill.items_summary ? bill.items_summary : (bill.category_name || 'Expense')}
                      </Text>
                      
                      <View style={styles.txMetaRow}>
                        <Text style={[styles.txDate, { color: colors.textSecondary }]}>
                          {formatDisplayDate(bill.date, settings.dateFormat)}
                        </Text>

                        {/* Category Chip */}
                        {bill.category_name && (
                          <View
                            style={[
                              styles.catChip,
                              { backgroundColor: `${bill.category_color || colors.accent}15` },
                            ]}
                          >
                            <Text
                              style={[
                                styles.catChipText,
                                { color: bill.category_color || colors.accent },
                              ]}
                            >
                              {bill.category_name}
                            </Text>
                          </View>
                        )}

                        {/* Account Pill */}
                        {bill.account_name && (
                          <View style={[styles.accChip, { backgroundColor: colors.inputBg }]}>
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
                              style={[styles.accChipText, { color: colors.textSecondary }]}
                              numberOfLines={1}
                            >
                              {bill.account_name}
                            </Text>
                          </View>
                        )}
                      </View>

                      {bill.notes ? (
                        <Text style={[styles.txNotes, { color: colors.textMuted }]} numberOfLines={1}>
                          {bill.notes}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, { color: colors.text }]}>
                        {formatCurrency(bill.total_amount, settings)}
                      </Text>

                      <View style={styles.txIcons}>
                        {(bill.image_count ?? 0) > 0 && (
                          <View style={[styles.photoBadge, { backgroundColor: `${colors.accent}15` }]}>
                            <Ionicons name="image-outline" size={12} color={colors.accent} />
                            <Text style={[styles.photoBadgeText, { color: colors.accent }]}>
                              {bill.image_count}
                            </Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <EmptyState
            icon="storefront-outline"
            title="No Vendor Selected"
            description="Select a vendor from your bills or add a new transaction."
            actionLabel="Choose Vendor"
            onAction={() => setShowVendorPicker(true)}
          />
        )}
      </ScrollView>

      {/* Switch Vendor Modal */}
      <Modal
        visible={showVendorPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowVendorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Vendor</Text>
              <TouchableOpacity
                onPress={() => setShowVendorPicker(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
              <SearchBar
                value={vendorFilterText}
                onChangeText={setVendorFilterText}
                placeholder="Search vendor name..."
              />
            </View>

            <FlatList
              data={filteredVendorsInModal}
              keyExtractor={(item) => item.vendor}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              renderItem={({ item }) => {
                const isSelected = item.vendor.toLowerCase() === currentVendor.toLowerCase();
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setCurrentVendor(item.vendor);
                      setShowVendorPicker(false);
                      setVendorFilterText('');
                    }}
                    style={[
                      styles.vendorItemRow,
                      {
                        backgroundColor: isSelected ? `${colors.accent}15` : colors.inputBg,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.vendorItemIcon}>
                      <Ionicons
                        name="storefront"
                        size={18}
                        color={isSelected ? colors.accent : colors.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[
                          styles.vendorItemName,
                          { color: isSelected ? colors.accent : colors.text, fontWeight: isSelected ? '700' : '600' },
                        ]}
                      >
                        {item.vendor}
                      </Text>
                      <Text style={[styles.vendorItemMeta, { color: colors.textMuted }]}>
                        {item.count} bills · Total {formatCurrency(item.total_spent, settings)}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted }}>No vendors found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorTitleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '65%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    maxWidth: 160,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  statsCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 16,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorName: {
    fontSize: 18,
    fontWeight: '700',
  },
  vendorSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  switchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  switchChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statTotalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statSubValue: {
    fontSize: 12,
    marginTop: 2,
  },
  searchSection: {
    marginBottom: 12,
  },
  txListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  txCountText: {
    fontSize: 13,
    fontWeight: '600',
  },
  txCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txLeft: {
    flex: 1,
    marginRight: 12,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  txDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  catChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  accChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  txNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  txIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  photoBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  vendorItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  vendorItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorItemName: {
    fontSize: 15,
  },
  vendorItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});

