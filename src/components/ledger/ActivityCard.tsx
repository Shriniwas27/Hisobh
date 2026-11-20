import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { UnifiedActivityItem } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatDisplayDate } from '../../utils/dates';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { deleteTransfer, deleteIncome } from '../../db/queries';

interface ActivityCardProps {
  item: UnifiedActivityItem;
  onRefresh?: () => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ item, onRefresh }) => {
  const { colors } = useTheme();
  const { settings, triggerRefresh } = useApp();
  const router = useRouter();

  const isExpense = item.type === 'expense';
  const isWithdrawal = item.type === 'withdrawal';
  const isBankTransfer = item.type === 'bank_transfer';
  const isDeposit = item.type === 'deposit';
  const isTransfer = item.type === 'transfer' || isWithdrawal || isBankTransfer;

  // Icon & Theme Styling based on transaction type
  let iconName: keyof typeof Ionicons.glyphMap = 'receipt-outline';
  let badgeColor = colors.accent;
  let typeLabel = 'Expense';

  if (isExpense) {
    iconName = (item.category_icon || 'receipt-outline') as any;
    badgeColor = item.category_color || colors.accent;
    typeLabel = item.category_name || 'Expense';
  } else if (isWithdrawal) {
    iconName = 'cash-outline';
    badgeColor = '#10B981';
    typeLabel = 'Cash Withdrawal';
  } else if (isBankTransfer) {
    iconName = 'business-outline';
    badgeColor = '#2563EB';
    typeLabel = 'Bank Transfer';
  } else if (isDeposit) {
    iconName = 'arrow-down-circle-outline';
    badgeColor = '#10B981';
    typeLabel = 'Deposit';
  } else {
    iconName = 'swap-horizontal-outline';
    badgeColor = '#8B5CF6';
    typeLabel = 'Transfer';
  }

  const handlePress = () => {
    if (isExpense) {
      router.push(`/bill/${item.record_id}`);
      return;
    }

    if (isTransfer) {
      Alert.alert(
        isWithdrawal ? '💵 Cash Withdrawal' : '🏦 Bank Transfer',
        `Date: ${formatDisplayDate(item.date, settings.dateFormat)}\n` +
        `Amount: ${formatCurrency(item.amount, settings)}\n` +
        `From: ${item.from_account_name || 'Account'}\n` +
        `To: ${item.to_account_name || 'Account'}\n` +
        (item.notes ? `Notes: ${item.notes}\n` : ''),
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Delete Transfer',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Delete Transfer',
                'Are you sure you want to delete this transfer? Account balances will be reverted.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      deleteTransfer(item.record_id);
                      triggerRefresh();
                      if (onRefresh) onRefresh();
                    },
                  },
                ]
              );
            },
          },
        ]
      );
      return;
    }

    if (isDeposit) {
      Alert.alert(
        '💰 Deposit Details',
        `Date: ${formatDisplayDate(item.date, settings.dateFormat)}\n` +
        `Source: ${item.title}\n` +
        `Amount: ${formatCurrency(item.amount, settings)}\n` +
        `Account: ${item.account_name || 'Account'}\n` +
        (item.notes ? `Notes: ${item.notes}\n` : ''),
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Delete Deposit',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Delete Deposit',
                'Are you sure you want to delete this deposit?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      deleteIncome(item.record_id);
                      triggerRefresh();
                      if (onRefresh) onRefresh();
                    },
                  },
                ]
              );
            },
          },
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderLight,
        },
      ]}
    >
      {/* Icon Badge */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: `${badgeColor}18`,
          },
        ]}
      >
        <Ionicons name={iconName} size={20} color={badgeColor} />
      </View>

      {/* Main Details */}
      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          {isExpense ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                router.push({ pathname: '/vendor-bills', params: { vendor: item.title } });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, marginRight: 8 }}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text
                style={[styles.titleText, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Ionicons name="storefront-outline" size={12} color={colors.accent} />
            </TouchableOpacity>
          ) : (
            <Text
              style={[styles.titleText, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
          )}

          {/* Type Badge */}
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: `${badgeColor}15` },
            ]}
          >
            <Text style={[styles.typeBadgeText, { color: badgeColor }]}>
              {typeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.subtitleRow}>
          <Text
            style={[styles.subtitleText, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {formatDisplayDate(item.date, settings.dateFormat)} · {item.subtitle || item.account_name || 'Activity'}
          </Text>

          {(item.image_count ?? 0) > 0 && (
            <View style={[styles.imageBadge, { backgroundColor: colors.pillInactive }]}>
              <Ionicons name="camera-outline" size={11} color={colors.textSecondary} />
            </View>
          )}
        </View>
      </View>

      {/* Amount Container */}
      <View style={styles.amountContainer}>
        <Text
          style={[
            styles.amountText,
            {
              color: isDeposit
                ? colors.success
                : isTransfer
                ? colors.text
                : colors.text,
            },
          ]}
        >
          {isDeposit ? `+${formatCurrency(item.amount, settings)}` : isExpense ? `-${formatCurrency(item.amount, settings)}` : formatCurrency(item.amount, settings)}
        </Text>

        {isTransfer && (
          <View style={[styles.transferPill, { backgroundColor: colors.inputBg }]}>
            <Ionicons
              name={isWithdrawal ? 'arrow-down-outline' : 'swap-horizontal'}
              size={10}
              color={colors.textMuted}
            />
            <Text style={[styles.transferPillText, { color: colors.textMuted }]}>
              {isWithdrawal ? 'Withdrawal' : 'Transfer'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  subtitleText: {
    fontSize: 12,
    flexShrink: 1,
  },
  imageBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  amountContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  transferPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  transferPillText: {
    fontSize: 9,
    fontWeight: '600',
  },
});

