import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Circle, Text as SvgText } from 'react-native-svg';
import { CategorySpending } from '../../types';
import { formatCurrency, formatCompactCurrency } from '../../utils/currency';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';

interface DonutChartProps {
  data: CategorySpending[];
  totalPaise: number;
  size?: number;
  strokeWidth?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  totalPaise,
  size = 140,
  strokeWidth = 18,
}) => {
  const { colors } = useTheme();
  const { settings } = useApp();

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Take top 4 categories, lump remainder into "Other"
  const topCategories = data.slice(0, 4);
  const remainingTotal = data.slice(4).reduce((sum, item) => sum + item.total_amount, 0);
  const remainingCount = data.slice(4).reduce((sum, item) => sum + item.bill_count, 0);

  const displaySegments = [...topCategories];
  if (remainingTotal > 0) {
    const remPercent = totalPaise > 0 ? (remainingTotal / totalPaise) * 100 : 0;
    displaySegments.push({
      category_id: -1,
      name: 'Everything else',
      color: '#A8A29E',
      icon: 'ellipsis-horizontal-outline',
      total_amount: remainingTotal,
      bill_count: remainingCount,
      percentage: remPercent,
    });
  }

  let accumulatedPercent = 0;

  return (
    <View style={styles.container}>
      {/* SVG Donut Ring */}
      <View style={[styles.chartWrapper, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${center}, ${center}`}>
            {/* Background Base Ring */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={colors.border}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Colored Category Arcs */}
            {totalPaise > 0 &&
              displaySegments.map((item, index) => {
                const strokeDashoffset =
                  circumference - (accumulatedPercent / 100) * circumference;
                const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                accumulatedPercent += item.percentage;

                return (
                  <Circle
                    key={index}
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={-((circumference - strokeDashoffset))}
                    fill="transparent"
                    strokeLinecap="round"
                  />
                );
              })}
          </G>
        </Svg>

        {/* Center Text inside Donut */}
        <View style={styles.centerTextContainer}>
          <Text style={[styles.centerSubLabel, { color: colors.textSecondary }]}>SPENT</Text>
          <Text
            style={[styles.centerMainLabel, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCompactCurrency(totalPaise, settings.currencySymbol)}
          </Text>
        </View>
      </View>

      {/* Legend on the right */}
      <View style={styles.legendContainer}>
        {displaySegments.length === 0 ? (
          <Text style={[styles.emptyLegendText, { color: colors.textMuted }]}>
            No spending in this period
          </Text>
        ) : (
          displaySegments.map((item, idx) => (
            <View key={idx} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text
                style={[styles.legendName, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[styles.legendPercent, { color: colors.textSecondary }]}>
                {Math.round(item.percentage)}%
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '65%',
  },
  centerSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  centerMainLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  legendContainer: {
    flex: 1,
    marginLeft: 20,
    justifyContent: 'center',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  legendPercent: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyLegendText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

