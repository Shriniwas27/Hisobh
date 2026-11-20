import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui/Card';
import { AccountsSummaryCard } from '../../components/accounts/AccountsSummaryCard';
import { FloatingAddButton } from '../../components/ui/FloatingAddButton';
import { formatCurrency } from '../../utils/currency';
import {
  getMonthSummary,
  getAccounts,
  getReminders,
  getDueReminders,
} from '../../db/queries';
import { Account, BillReminder } from '../../types';
import { format, subMonths } from 'date-fns';

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { settings, updateSettings, profile, refreshTrigger } = useApp();
  const router = useRouter();

  const [currentMonthTotal, setCurrentMonthTotal] = useState(0);
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allReminders, setAllReminders] = useState<BillReminder[]>([]);
  const [dueReminders, setDueReminders] = useState<BillReminder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(() => {
    try {
      const now = new Date();
      const currentMonthKey = format(now, 'yyyy-MM');
      const prevMonthKey = format(subMonths(now, 1), 'yyyy-MM');

      // Accounts
      const accs = getAccounts();
      setAccounts(accs);

      // Bill Reminders
      const rems = getReminders();
      const active = rems.filter((r) => r.is_active === 1);
      setAllReminders(active);
      const dues = getDueReminders(5);
      setDueReminders(dues);

      // Monthly spends
      const currSum = getMonthSummary(currentMonthKey);
      const prevSum = getMonthSummary(prevMonthKey);

      setCurrentMonthTotal(currSum.total_amount);
      setPrevMonthTotal(prevSum.total_amount);

      const dayOfMonth = Math.max(now.getDate(), 1);
      setDailyAverage(Math.round(currSum.total_amount / dayOfMonth));
    } catch (err) {
      console.error('Error loading home data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const onRefresh = async () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  // Time-based dynamic greeting
  const now = new Date();
  const currentHour = now.getHours();
  let greetingText = 'Good evening';
  let greetingIcon: keyof typeof Ionicons.glyphMap = 'moon';
  if (currentHour < 12) {
    greetingText = 'Good morning';
    greetingIcon = 'sunny';
  } else if (currentHour < 17) {
    greetingText = 'Good afternoon';
    greetingIcon = 'partly-sunny';
  }

  const firstName = profile?.name ? profile.name.trim().split(' ')[0] : 'there';
  const formattedDate = format(now, 'EEEE, d MMMM');
  const currentMonthName = format(now, 'MMMM');
  const prevMonthName = format(subMonths(now, 1), 'MMM');

  // Month progress calculation
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = Math.max(daysInCurrentMonth - currentDay, 0);
  const monthProgressPercent = Math.min(Math.round((currentDay / daysInCurrentMonth) * 100), 100);

  // Percentage change calculation vs last month
  let diffPercentage = 0;
  let isIncrease = true;
  if (prevMonthTotal > 0) {
    diffPercentage = Math.round(((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100);
    isIncrease = diffPercentage >= 0;
  }

  const maskAmount = (amount: number) => {
    return formatCurrency(amount, settings);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        >
          {/* 1. Header & Greeting Bar */}
          <View style={styles.header}>
            <View style={styles.headerGreetingCol}>
              <View style={styles.greetingRow}>
                <Ionicons name={greetingIcon} size={15} color={colors.accent} />
                <Text style={[styles.greetingSub, { color: colors.textSecondary }]}>
                  {greetingText}
                </Text>
              </View>
              <Text style={[styles.userNameTitle, { color: colors.text }]}>
                {firstName} 👋
              </Text>
              <Text style={[styles.dateSub, { color: colors.textMuted }]}>
                {formattedDate}
              </Text>
            </View>

            <View style={styles.headerRightRow}>
              {/* Notification Bell with Badge */}
              <TouchableOpacity
                onPress={() => router.push('/reminders')}
                activeOpacity={0.8}
                style={[
                  styles.headerIconBtn,
                  {
                    borderColor: dueReminders.length > 0 ? `${colors.danger}40` : colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              >
                <Ionicons
                  name={dueReminders.length > 0 ? 'notifications' : 'notifications-outline'}
                  size={20}
                  color={dueReminders.length > 0 ? colors.danger : colors.text}
                />
                {dueReminders.length > 0 && (
                  <View style={[styles.bellBadge, { backgroundColor: colors.danger }]}>
                    <Text style={styles.bellBadgeText}>{dueReminders.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Profile Avatar Button */}
              <TouchableOpacity
                onPress={() => router.push('/profile')}
                activeOpacity={0.8}
                style={[
                  styles.profileAvatarBtn,
                  {
                    borderColor: colors.accent,
                    backgroundColor: colors.card,
                  },
                ]}
              >
                {profile.avatarUri ? (
                  <Image source={{ uri: profile.avatarUri }} style={styles.headerAvatarImg} />
                ) : (
                  <View style={[styles.headerAvatarFallback, { backgroundColor: `${colors.accent}20` }]}>
                    <Ionicons name="person" size={17} color={colors.accent} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Premium Hero Spend Card */}
          <View
            style={[
              styles.heroCardWrapper,
              {
                backgroundColor: isDark ? '#1C1C20' : '#FFFFFF',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.22)' : colors.border,
                shadowColor: isDark ? '#000000' : '#8A8175',
              },
            ]}
          >
            {/* Card Header: Tag */}
            <View style={styles.heroCardHeader}>
              <View style={[styles.heroTagPill, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : `${colors.accent}14` }]}>
                <Ionicons name="sparkles" size={12} color={colors.accent} />
                <Text style={[styles.heroTagText, { color: colors.accent }]}>
                  {currentMonthName.toUpperCase()} OUTFLOW
                </Text>
              </View>
            </View>

            {/* Giant Formatted Spend Amount */}
            <View style={styles.heroAmountRow}>
              <Text style={[styles.heroAmount, { color: colors.text }]}>
                {maskAmount(currentMonthTotal)}
              </Text>
            </View>

            {/* Stats & Comparison Footer */}
            <View style={styles.heroFooterRow}>
              {prevMonthTotal > 0 ? (
                <View
                  style={[
                    styles.heroPill,
                    {
                      backgroundColor: isIncrease ? (isDark ? '#451010' : colors.dangerLight) : (isDark ? '#063B26' : colors.successLight),
                      borderColor: isIncrease ? `${colors.danger}40` : `${colors.success}40`,
                    },
                  ]}
                >
                  <Ionicons
                    name={isIncrease ? 'trending-up' : 'trending-down'}
                    size={13}
                    color={isIncrease ? colors.danger : colors.success}
                  />
                  <Text
                    style={[
                      styles.heroPillText,
                      { color: isIncrease ? colors.danger : colors.success },
                    ]}
                  >
                    {Math.abs(diffPercentage)}% vs {prevMonthName}
                  </Text>
                </View>
              ) : (
                <View style={[styles.heroPill, { backgroundColor: isDark ? '#24242A' : '#F1EFEA', borderColor: colors.border }]}>
                  <Text style={[styles.heroPillText, { color: colors.textSecondary }]}>
                    ✦ Monthly tracker
                  </Text>
                </View>
              )}

              <View style={[styles.heroPill, { backgroundColor: isDark ? '#24242A' : '#F1EFEA', borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                <Text style={[styles.heroPillText, { color: colors.textSecondary }]}>
                  {daysRemaining}d left in month
                </Text>
              </View>
            </View>

            {/* Month Elapsed Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#2A2A32' : '#ECE8E0' }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${monthProgressPercent}%`,
                      backgroundColor: colors.accent,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                  Day {currentDay} of {daysInCurrentMonth} ({monthProgressPercent}%)
                </Text>
                <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                  Avg {maskAmount(dailyAverage)}/day
                </Text>
              </View>
            </View>
          </View>

          {/* 3. Fintech Quick Shortcuts Hub */}
          <View style={styles.quickActionsContainer}>
            {[
              {
                label: 'Add Bill',
                icon: 'add-circle',
                route: '/add-bill',
                color: colors.accent,
                bg: `${colors.accent}16`,
              },
              {
                label: 'Bill Alarms',
                icon: 'alarm',
                route: '/reminders',
                color: '#8B5CF6',
                bg: '#8B5CF618',
                badge: dueReminders.length > 0 ? dueReminders.length : undefined,
              },
              {
                label: 'Insights',
                icon: 'pie-chart',
                route: '/reports',
                color: '#0EA5E9',
                bg: '#0EA5E918',
              },
              {
                label: 'Categories',
                icon: 'grid',
                route: '/category-ledger',
                color: '#10B981',
                bg: '#10B98118',
              },
            ].map((action, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.75}
                onPress={() => router.push(action.route as any)}
                style={styles.quickActionItem}
              >
                <View
                  style={[
                    styles.quickActionIconWrap,
                    {
                      backgroundColor: action.bg,
                      borderColor: isDark ? `${action.color}35` : `${action.color}25`,
                    },
                  ]}
                >
                  <Ionicons name={action.icon as any} size={22} color={action.color} />
                  {action.badge ? (
                    <View style={[styles.quickActionBadge, { backgroundColor: colors.danger }]}>
                      <Text style={styles.quickActionBadgeText}>{action.badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.quickActionLabel, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 4. Side-by-Side Spending Pulse Cards */}
          <View style={styles.metricsRow}>
            {/* Last Month Card */}
            <Card style={styles.metricCard}>
              <View style={styles.metricHeaderRow}>
                <View style={[styles.metricIconWrap, { backgroundColor: `${colors.accent}14` }]}>
                  <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                </View>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  LAST MONTH
                </Text>
              </View>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {maskAmount(prevMonthTotal)}
              </Text>
              <Text style={[styles.metricSubtitle, { color: colors.textMuted }]}>
                {prevMonthName} Total Outflow
              </Text>
            </Card>

            {/* Daily Average Pace */}
            <Card style={styles.metricCard}>
              <View style={styles.metricHeaderRow}>
                <View style={[styles.metricIconWrap, { backgroundColor: '#10B98118' }]}>
                  <Ionicons name="flash-outline" size={14} color="#10B981" />
                </View>
                <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                  DAILY PACE
                </Text>
              </View>
              <Text style={[styles.metricValue, { color: colors.text }]}>
                {maskAmount(dailyAverage)}
              </Text>
              <Text style={[styles.metricSubtitle, { color: colors.textMuted }]}>
                Current Daily Burn
              </Text>
            </Card>
          </View>

          {/* 5. Liquid Funds & Accounts (Bank, Cash, UPI) */}
          <AccountsSummaryCard accounts={accounts} onRefresh={loadData} />

          {/* 6. Recurring Bill Alarms & Due Dates Carousel */}
          {allReminders.length > 0 ? (
            <View style={styles.remindersSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.remindersHeaderLeft}>
                  <Ionicons name="notifications" size={16} color={colors.accent} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Bill Alarms
                  </Text>
                  {dueReminders.length > 0 && (
                    <View style={[styles.dueCountBadge, { backgroundColor: `${colors.danger}20` }]}>
                      <Text style={[styles.dueCountText, { color: colors.danger }]}>
                        {dueReminders.length} Due
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => router.push('/reminders')}>
                  <Text style={[styles.seeAllText, { color: colors.accent }]}>
                    Manage →
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.remindersScrollContent}
              >
                {allReminders.map((rem) => {
                  const isDueToday = rem.is_due_today;
                  const daysLeft = rem.days_until_due ?? 0;
                  const isUpcoming = daysLeft > 0 && daysLeft <= 3;

                  return (
                    <TouchableOpacity
                      key={rem.id}
                      activeOpacity={0.8}
                      onPress={() => router.push('/reminders')}
                      style={[
                        styles.reminderMiniCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: isDueToday ? colors.danger : colors.border,
                        },
                      ]}
                    >
                      <View style={styles.reminderMiniTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          {rem.category_color ? (
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: rem.category_color }} />
                          ) : null}
                          <Text style={[styles.reminderMiniTitle, { color: colors.text }]} numberOfLines={1}>
                            {rem.title}
                          </Text>
                        </View>
                        <Text style={[styles.reminderMiniAmount, { color: colors.text }]}>
                          {maskAmount(rem.amount)}
                        </Text>
                      </View>

                      <View style={styles.reminderMiniBottom}>
                        <View
                          style={[
                            styles.reminderDuePill,
                            {
                              backgroundColor: isDueToday
                                ? `${colors.danger}20`
                                : isUpcoming
                                ? '#F59E0B20'
                                : `${colors.accent}15`,
                            },
                          ]}
                        >
                          <Ionicons
                            name={isDueToday ? 'alert-circle' : isUpcoming ? 'time-outline' : 'calendar-outline'}
                            size={10}
                            color={isDueToday ? colors.danger : isUpcoming ? '#F59E0B' : colors.accent}
                          />
                          <Text
                            style={[
                              styles.reminderDueText,
                              {
                                color: isDueToday ? colors.danger : isUpcoming ? '#F59E0B' : colors.accent,
                                fontWeight: '700',
                              },
                            ]}
                          >
                            {isDueToday ? 'DUE TODAY' : isUpcoming ? `Due in ${daysLeft}d` : `Day ${rem.day_of_month}`}
                          </Text>
                        </View>

                        {rem.vendor ? (
                          <Text style={[styles.reminderMiniVendor, { color: colors.textMuted }]} numberOfLines={1}>
                            {rem.vendor}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            /* Friendly Invitation Card if user hasn't added recurring bill reminders yet */
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/reminders')}
              style={[
                styles.reminderInviteCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.reminderInviteIconWrap, { backgroundColor: `${colors.accent}15` }]}>
                <Ionicons name="alarm-outline" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.reminderInviteTitle, { color: colors.text }]}>
                  Monthly Bill Reminders
                </Text>
                <Text style={[styles.reminderInviteSub, { color: colors.textSecondary }]}>
                  Never miss rent, electricity, or milk bills. Set an alarm reminder.
                </Text>
              </View>
              <View style={[styles.reminderInviteBtn, { backgroundColor: `${colors.accent}18` }]}>
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>
                  + Set
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Floating Add Button at Bottom Right */}
        <FloatingAddButton bottomRight={true} isTabScreen={true} />
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
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 115,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerGreetingCol: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  userNameTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  dateSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  profileAvatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImg: {
    width: '100%',
    height: '100%',
  },
  headerAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardWrapper: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  privacyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmountRow: {
    marginTop: 4,
    marginBottom: 12,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    gap: 6,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 6,
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickActionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  quickActionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  metricSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  remindersSection: {
    marginTop: 2,
    marginBottom: 16,
  },
  remindersHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dueCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dueCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  remindersScrollContent: {
    gap: 10,
    paddingVertical: 4,
  },
  reminderMiniCard: {
    width: 175,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  reminderMiniTop: {
    marginBottom: 8,
  },
  reminderMiniTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  reminderMiniAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  reminderMiniBottom: {
    gap: 4,
  },
  reminderDuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reminderDueText: {
    fontSize: 10,
  },
  reminderMiniVendor: {
    fontSize: 11,
  },
  reminderInviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  reminderInviteIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderInviteTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  reminderInviteSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  reminderInviteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
});
