import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/currency';

interface DayHeaderProps {
  title: string;
  totalAmount: number;
}

export const DaySectionHeader: React.FC<DayHeaderProps> = ({ title, totalAmount }) => {
  const { colors } = useTheme();
  const { settings } = useApp();

  return (
    <View style={styles.dayHeader}>
      <Text style={[styles.dayTitle, { color: colors.textSecondary }]}>
        {title}
      </Text>
      <Text style={[styles.dayTotal, { color: colors.textSecondary }]}>
        -{formatCurrency(totalAmount, settings)}
      </Text>
    </View>
  );
};

interface MonthHeaderProps {
  title: string;
  totalAmount: number;
  count: number;
}

export const MonthSectionHeader: React.FC<MonthHeaderProps> = ({
  title,
  totalAmount,
  count,
}) => {
  const { colors } = useTheme();
  const { settings } = useApp();

  return (
    <View style={[styles.monthHeader, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View>
        <Text style={[styles.monthTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.monthSubtitle, { color: colors.textMuted }]}>
          {count} {count === 1 ? 'entry' : 'entries'}
        </Text>
      </View>
      <View style={styles.monthTotalWrapper}>
        <Text style={[styles.monthTotalLabel, { color: colors.textMuted }]}>MONTH TOTAL</Text>
        <Text style={[styles.monthTotalAmount, { color: colors.text }]}>
          -{formatCurrency(totalAmount, settings)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 6,
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayTotal: {
    fontSize: 12,
    fontWeight: '600',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  monthSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  monthTotalWrapper: {
    alignItems: 'flex-end',
  },
  monthTotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  monthTotalAmount: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
});

