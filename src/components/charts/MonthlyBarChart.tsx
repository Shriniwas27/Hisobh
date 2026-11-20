import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MonthSpending } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { formatCompactCurrency } from '../../utils/currency';

interface MonthlyBarChartProps {
  data: MonthSpending[];
  height?: number;
}

export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({
  data,
  height = 140,
}) => {
  const { colors } = useTheme();
  const { settings } = useApp();

  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No monthly history available yet
        </Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.total_amount), 1);

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.barsContainer}>
        {data.map((item, index) => {
          const isCurrentMonth = index === data.length - 1;
          const barHeightRatio = Math.max(item.total_amount / maxVal, 0.05);

          return (
            <View key={item.month_key} style={styles.barColumn}>
              {/* Value Label above Bar */}
              <Text
                style={[
                  styles.barValueText,
                  { color: isCurrentMonth ? colors.text : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {item.total_amount > 0
                  ? formatCompactCurrency(item.total_amount, settings.currencySymbol)
                  : '0'}
              </Text>

              {/* Bar Fill Track */}
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${barHeightRatio * 100}%`,
                      backgroundColor: isCurrentMonth ? colors.accent : colors.pillActive,
                    },
                  ]}
                />
              </View>

              {/* Month Name Label */}
              <Text
                style={[
                  styles.barMonthText,
                  {
                    color: isCurrentMonth ? colors.text : colors.textSecondary,
                    fontWeight: isCurrentMonth ? '700' : '500',
                  },
                ]}
              >
                {item.month_name}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 10,
    justifyContent: 'flex-end',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  barColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: 22,
    height: '70%',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
  },
  barValueText: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  barMonthText: {
    fontSize: 11,
    marginTop: 6,
  },
});

