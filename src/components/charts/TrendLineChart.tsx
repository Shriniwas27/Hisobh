import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { formatCompactCurrency } from '../../utils/currency';
import { useApp } from '../../context/AppContext';

export interface TrendDataPoint {
  label: string;
  value: number; // in paise
}

interface TrendLineChartProps {
  data: TrendDataPoint[];
  height?: number;
  highlightIndex?: number;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  height = 95,
  highlightIndex,
}) => {
  const { colors, isDark } = useTheme();
  const { settings } = useApp();
  const [containerWidth, setContainerWidth] = useState<number>(300);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 50 && w !== containerWidth) {
      setContainerWidth(w);
    }
  };

  if (!data || data.length < 2) {
    return (
      <View style={[styles.emptyContainer, { height }]} onLayout={onLayout}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No spending activity recorded for this period
        </Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const allZero = maxVal === 0;

  const width = containerWidth;
  const paddingX = 14;
  const paddingY = 16;
  const graphWidth = Math.max(width - paddingX * 2, 100);
  const graphHeight = Math.max(height - paddingY * 2, 40);

  // If all values are 0, draw a clean subtle baseline
  if (allZero) {
    const yBaseline = height - paddingY;
    return (
      <View style={styles.container} onLayout={onLayout}>
        <View style={[styles.tooltip, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.tooltipText, { color: colors.textSecondary }]}>
            No spending recorded
          </Text>
        </View>

        <Svg width={width} height={height}>
          {/* Subtle baseline */}
          <Path
            d={`M ${paddingX} ${yBaseline} L ${width - paddingX} ${yBaseline}`}
            stroke={colors.border}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          {/* Subtle dots at points */}
          {data.map((d, idx) => {
            const x = paddingX + (idx / (data.length - 1)) * graphWidth;
            return (
              <Circle
                key={idx}
                cx={x}
                cy={yBaseline}
                r="3"
                fill={colors.border}
              />
            );
          })}
        </Svg>
      </View>
    );
  }

  const range = maxVal - minVal || 1;

  // Compute SVG coordinates
  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * graphWidth;
    const normalizedY = (d.value - minVal) / range;
    const y = paddingY + graphHeight - normalizedY * graphHeight;
    return { x, y, ...d };
  });

  // Construct smooth Bezier SVG Path
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (curr.x - prev.x) / 2;
    const cpY2 = curr.y;
    linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
  }

  // Construct closed Area Path for Gradient
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  // Highlight point (highest value point by default)
  const activeIdx =
    highlightIndex !== undefined && highlightIndex < points.length
      ? highlightIndex
      : points.reduce((maxI, pt, i, arr) => (pt.value > arr[maxI].value ? i : maxI), 0);
  const activePt = points[activeIdx];

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Tooltip bubble matching reference */}
      <View
        style={[
          styles.tooltip,
          {
            left: Math.min(Math.max(activePt.x - 45, 10), width - 100),
            backgroundColor: colors.pillActive,
          },
        ]}
      >
        <Text style={[styles.tooltipText, { color: colors.pillActiveText }]}>
          {activePt.label} · {formatCompactCurrency(activePt.value, settings.currencySymbol)}
        </Text>
      </View>

      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#E58A2B" stopOpacity={isDark ? "0.38" : "0.22"} />
            <Stop offset="100%" stopColor="#E58A2B" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Gradient Area */}
        <Path d={areaPath} fill="url(#amberGradient)" />

        {/* Smooth Line */}
        <Path
          d={linePath}
          fill="none"
          stroke="#E58A2B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Active Point Circle */}
        <Circle
          cx={activePt.x}
          cy={activePt.y}
          r="4.5"
          fill="#FFFFFF"
          stroke="#E58A2B"
          strokeWidth="2.5"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    position: 'relative',
    alignItems: 'center',
    width: '100%',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  emptyText: {
    fontSize: 12,
  },
  tooltip: {
    position: 'absolute',
    top: -10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
