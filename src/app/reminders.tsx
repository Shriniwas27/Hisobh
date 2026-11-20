import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/common/EmptyState';
import {
  getReminders,
  addReminder,
  updateReminder,
  deleteReminder,
  toggleReminder,
  getCategories,
} from '../db/queries';
import {
  scheduleReminderNotification,
  cancelReminderNotification,
  triggerTestNotification,
  initNotifications,
} from '../services/notificationService';
import { BillReminder, Category } from '../types';
import { formatCurrency } from '../utils/currency';

export default function RemindersScreen() {
  const { colors, isDark } = useTheme();
  const { settings, refreshTrigger, triggerRefresh } = useApp();
  const router = useRouter();

  const [reminders, setReminders] = useState<BillReminder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<BillReminder | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState<number>(5);
  const [timeStr, setTimeStr] = useState('09:00');
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [testingAlarm, setTestingAlarm] = useState(false);

  const loadData = useCallback(() => {
    const list = getReminders();
    setReminders(list);
    const cats = getCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    loadData();
    initNotifications();
  }, [loadData, refreshTrigger]);

  const handleOpenAdd = () => {
    setEditingReminder(null);
    setTitle('');
    setAmountStr('');
    setDayOfMonth(5);
    setTimeStr('09:00');
    setSelectedCatId(categories[0]?.id ?? null);
    setVendor('');
    setNotes('');
    setModalVisible(true);
  };

  const handleOpenEdit = (rem: BillReminder) => {
    setEditingReminder(rem);
    setTitle(rem.title);
    setAmountStr(rem.amount > 0 ? (rem.amount / 100).toString() : '');
    setDayOfMonth(rem.day_of_month);
    setTimeStr(rem.time_str || '09:00');
    setSelectedCatId(rem.category_id || null);
    setVendor(rem.vendor || '');
    setNotes(rem.notes || '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a reminder title (e.g. Milk Bill).');
      return;
    }

    const amtInPaise = Math.round(parseFloat(amountStr || '0') * 100) || 0;
    const day = Math.min(Math.max(dayOfMonth, 1), 31);

    if (editingReminder) {
      updateReminder(editingReminder.id, {
        title: title.trim(),
        amount: amtInPaise,
        day_of_month: day,
        time_str: timeStr,
        category_id: selectedCatId,
        vendor: vendor.trim() || null,
        notes: notes.trim() || null,
      });

      const updated = {
        ...editingReminder,
        title: title.trim(),
        amount: amtInPaise,
        day_of_month: day,
        time_str: timeStr,
        category_id: selectedCatId,
        vendor: vendor.trim() || null,
        notes: notes.trim() || null,
      };

      await scheduleReminderNotification(updated);
    } else {
      const newId = addReminder({
        title: title.trim(),
        amount: amtInPaise,
        day_of_month: day,
        time_str: timeStr,
        category_id: selectedCatId,
        vendor: vendor.trim() || null,
        notes: notes.trim() || null,
        is_active: 1,
      });

      const created: BillReminder = {
        id: newId,
        title: title.trim(),
        amount: amtInPaise,
        day_of_month: day,
        time_str: timeStr,
        category_id: selectedCatId,
        vendor: vendor.trim() || null,
        notes: notes.trim() || null,
        is_active: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await scheduleReminderNotification(created);
    }

    setModalVisible(false);
    triggerRefresh();
    loadData();
  };

  const handleToggle = async (rem: BillReminder, val: boolean) => {
    toggleReminder(rem.id, val);
    const updated = { ...rem, is_active: val ? 1 : 0 };
    if (val) {
      await scheduleReminderNotification(updated);
    } else if (rem.notification_id) {
      await cancelReminderNotification(rem.notification_id);
    }
    loadData();
  };

  const handleDelete = (rem: BillReminder) => {
    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to delete the reminder for "${rem.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (rem.notification_id) {
              await cancelReminderNotification(rem.notification_id);
            }
            deleteReminder(rem.id);
            triggerRefresh();
            loadData();
          },
        },
      ]
    );
  };

  const handleTestAlarm = async () => {
    setTestingAlarm(true);
    const testTitle = reminders.length > 0 ? reminders[0].title : 'Milk Bill';
    const testAmt = reminders.length > 0 ? reminders[0].amount : 150000;
    await triggerTestNotification(testTitle, testAmt);
    setTimeout(() => {
      setTestingAlarm(false);
      Alert.alert(
        '🔔 Alarm Sent!',
        `A test notification for "${testTitle}" was scheduled. Check your phone's notification tray/banner.`
      );
    }, 2200);
  };

  const handleRecordBill = (rem: BillReminder) => {
    router.push({
      pathname: '/add-bill',
      params: {
        vendor: rem.vendor || rem.title,
        amount: rem.amount > 0 ? (rem.amount / 100).toString() : '',
        categoryId: rem.category_id ? rem.category_id.toString() : '',
      },
    });
  };

  const activeReminders = reminders.filter((r) => r.is_active === 1);
  const totalMonthlyCommitment = activeReminders.reduce((acc, r) => acc + (r.amount || 0), 0);

  // Day picker options
  const commonDays = [1, 2, 5, 10, 15, 20, 25, 28, 30, 31];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Bill Reminders & Alarms</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Monthly recurring alerts</Text>
        </View>

        <TouchableOpacity
          onPress={handleOpenAdd}
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
      >
        {/* Summary Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View>
              <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>MONTHLY RECURRING BILLS</Text>
              <Text style={[styles.heroAmount, { color: colors.text }]}>
                {formatCurrency(totalMonthlyCommitment, settings)}
              </Text>
              <Text style={[styles.heroSub, { color: colors.textMuted }]}>
                {activeReminders.length} active {activeReminders.length === 1 ? 'alarm' : 'alarms'} scheduled
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleTestAlarm}
              disabled={testingAlarm}
              style={[
                styles.testAlarmBtn,
                { backgroundColor: testingAlarm ? colors.textMuted : `${colors.accent}15`, borderColor: colors.accent },
              ]}
            >
              <Ionicons name="notifications-outline" size={18} color={colors.accent} />
              <Text style={[styles.testAlarmText, { color: colors.accent }]}>
                {testingAlarm ? 'Firing...' : 'Test Alarm'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Reminders List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Recurring Bills</Text>
          <TouchableOpacity onPress={handleOpenAdd}>
            <Text style={[styles.addLink, { color: colors.accent }]}>+ Add New</Text>
          </TouchableOpacity>
        </View>

        {reminders.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="No Bill Reminders Yet"
            description="Set monthly recurring alarms for milk bills, house rent, WiFi, electricity, or subscriptions."
            actionLabel="Add Milk Bill Reminder"
            onAction={handleOpenAdd}
          />
        ) : (
          reminders.map((rem) => {
            const isDueToday = rem.is_due_today;
            const daysLeft = rem.days_until_due ?? 0;
            const isUpcoming = daysLeft > 0 && daysLeft <= 3;

            return (
              <Card
                key={rem.id}
                style={[
                  styles.reminderCard,
                  isDueToday && { borderColor: colors.danger, borderWidth: 1.5 },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardHeaderLeft}>
                    {/* Due Badge */}
                    {rem.is_active === 0 ? (
                      <View style={[styles.dueBadge, { backgroundColor: colors.inputBg }]}>
                        <Text style={[styles.dueBadgeText, { color: colors.textMuted }]}>Paused</Text>
                      </View>
                    ) : isDueToday ? (
                      <View style={[styles.dueBadge, { backgroundColor: `${colors.danger}20` }]}>
                        <Ionicons name="alert-circle" size={13} color={colors.danger} />
                        <Text style={[styles.dueBadgeText, { color: colors.danger, fontWeight: '700' }]}>
                          DUE TODAY!
                        </Text>
                      </View>
                    ) : isUpcoming ? (
                      <View style={[styles.dueBadge, { backgroundColor: '#F59E0B20' }]}>
                        <Ionicons name="time-outline" size={13} color="#F59E0B" />
                        <Text style={[styles.dueBadgeText, { color: '#F59E0B', fontWeight: '700' }]}>
                          Due in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.dueBadge, { backgroundColor: `${colors.accent}15` }]}>
                        <Ionicons name="calendar-outline" size={13} color={colors.accent} />
                        <Text style={[styles.dueBadgeText, { color: colors.accent }]}>
                          Every {rem.day_of_month}{getOrdinal(rem.day_of_month)}
                        </Text>
                      </View>
                    )}

                    <Text style={[styles.remTitle, { color: colors.text }]} numberOfLines={1}>
                      {rem.title}
                    </Text>

                    {rem.vendor ? (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: '/vendor-bills', params: { vendor: rem.vendor } })}
                        style={styles.vendorLinkRow}
                      >
                        <Ionicons name="storefront-outline" size={12} color={colors.textSecondary} />
                        <Text style={[styles.remVendor, { color: colors.accent }]} numberOfLines={1}>
                          {rem.vendor}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.cardHeaderRight}>
                    <Text style={[styles.remAmount, { color: colors.text }]}>
                      {formatCurrency(rem.amount, settings)}
                    </Text>
                    <Switch
                      value={rem.is_active === 1}
                      onValueChange={(val) => handleToggle(rem, val)}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor="#FFFFFF"
                      style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                    />
                  </View>
                </View>

                {/* Meta details & chips */}
                <View style={styles.metaRow}>
                  {rem.category_name && (
                    <View style={[styles.metaChip, { backgroundColor: `${rem.category_color || colors.accent}15` }]}>
                      <Text style={[styles.metaChipText, { color: rem.category_color || colors.accent }]}>
                        {rem.category_name}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.metaChip, { backgroundColor: colors.inputBg }]}>
                    <Ionicons name="alarm-outline" size={12} color={colors.textSecondary} />
                    <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>
                      {rem.time_str || '09:00'}
                    </Text>
                  </View>

                  {rem.notes ? (
                    <Text style={[styles.remNotes, { color: colors.textMuted }]} numberOfLines={1}>
                      {rem.notes}
                    </Text>
                  ) : null}
                </View>

                <View style={[styles.cardDivider, { backgroundColor: colors.borderLight }]} />

                {/* Bottom Actions */}
                <View style={styles.cardBottomRow}>
                  <TouchableOpacity
                    onPress={() => handleRecordBill(rem)}
                    style={[styles.recordBillBtn, { backgroundColor: colors.accent }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                    <Text style={styles.recordBillBtnText}>Pay / Record Bill</Text>
                  </TouchableOpacity>

                  <View style={styles.actionIconsRow}>
                    <TouchableOpacity
                      onPress={() => handleOpenEdit(rem)}
                      style={[styles.iconActionBtn, { backgroundColor: colors.inputBg }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDelete(rem)}
                      style={[styles.iconActionBtn, { backgroundColor: `${colors.danger}15` }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingReminder ? 'Edit Bill Reminder' : 'Add Recurring Bill Alarm'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>BILL / REMINDER TITLE *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Milk Bill, House Rent, Broadband"
                placeholderTextColor={colors.textMuted}
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              />

              {/* Amount */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>MONTHLY AMOUNT (₹)</Text>
              <TextInput
                value={amountStr}
                onChangeText={setAmountStr}
                placeholder="e.g. 1500"
                keyboardType="numeric"
                placeholderTextColor={colors.textMuted}
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              />

              {/* Day of Month */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                DAY OF MONTH ({dayOfMonth}{getOrdinal(dayOfMonth)} of every month)
              </Text>
              <View style={styles.daysChipsWrap}>
                {commonDays.map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDayOfMonth(d)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: dayOfMonth === d ? colors.accent : colors.inputBg,
                        borderColor: dayOfMonth === d ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        { color: dayOfMonth === d ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {d}{getOrdinal(d)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notification Time */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ALARM TIME (HH:MM)</Text>
              <TextInput
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="09:00"
                placeholderTextColor={colors.textMuted}
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              />

              {/* Vendor */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>VENDOR / PERSON NAME</Text>
              <TextInput
                value={vendor}
                onChangeText={setVendor}
                placeholder="e.g. Local Milk Vendor, Landlord Ramesh"
                placeholderTextColor={colors.textMuted}
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              />

              {/* Category */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {categories.map((c) => {
                    const isSelected = selectedCatId === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setSelectedCatId(c.id)}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: isSelected ? `${c.color}25` : colors.inputBg,
                            borderColor: isSelected ? c.color : colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.categoryChipText, { color: isSelected ? c.color : colors.text }]}>
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Notes */}
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NOTES</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes or instructions..."
                placeholderTextColor={colors.textMuted}
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSave}
                style={[styles.saveBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.saveBtnText}>Save Alarm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getOrdinal(n: number): string {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
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
  heroCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
  },
  testAlarmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  testAlarmText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  addLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  reminderCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  remTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  vendorLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  remVendor: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  remAmount: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  remNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordBillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  recordBillBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  daysChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 18,
    paddingTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

