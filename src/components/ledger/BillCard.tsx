import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Bill } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

interface BillCardProps {
  bill: Bill;
  onPress: () => void;
  showRunningTotal?: boolean;
}

export const BillCard: React.FC<BillCardProps> = ({
  bill,
  onPress,
  showRunningTotal = false,
}) => {
  const { colors } = useTheme();
  const { settings } = useApp();

  const iconName = (bill.category_icon || 'receipt-outline') as keyof typeof Ionicons.glyphMap;
  const categoryColor = bill.category_color || colors.accent;
  const hasImages = (bill.image_count ?? 0) > 0 || (bill.images && bill.images.length > 0);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderLight,
        },
      ]}
    >
      {/* Category Icon Badge */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: `${categoryColor}18`, // 10% opacity tint
          },
        ]}
      >
        <Ionicons name={iconName} size={20} color={categoryColor} />
      </View>

      {/* Bill Details */}
      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.vendorText, { color: colors.text }]}
            numberOfLines={1}
          >
            {bill.vendor}
            {bill.items_summary ? ` · ${bill.items_summary}` : ''}
          </Text>
        </View>

        <View style={styles.subtitleRow}>
          <Text
            style={[styles.subtitleText, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {bill.category_name || 'Category'} · {bill.account_name ? bill.account_name : bill.payment_method}
          </Text>

          {hasImages && (
            <View style={[styles.imageBadge, { backgroundColor: colors.pillInactive }]}>
              <Ionicons name="camera-outline" size={12} color={colors.textSecondary} />
            </View>
          )}
        </View>
      </View>

      {/* Amount and optional running total */}
      <View style={styles.amountContainer}>
        <Text style={[styles.amountText, { color: colors.text }]}>
          -{formatCurrency(bill.total_amount, settings)}
        </Text>
        {showRunningTotal && bill.running_total !== undefined && (
          <Text style={[styles.runningTotalText, { color: colors.textMuted }]}>
            Bal: {formatCurrency(bill.running_total, settings)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
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
    marginRight: 14,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  subtitleText: {
    fontSize: 13,
  },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  amountContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 10,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  runningTotalText: {
    fontSize: 11,
    marginTop: 2,
  },
});

