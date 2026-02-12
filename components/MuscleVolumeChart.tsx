import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { getWorkoutsForDateRange } from '../database';
import {
  MuscleGroup,
  EXERCISE_MUSCLE_MAP,
} from '../muscleMapping';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';

// ============================================================
// Types & Constants
// ============================================================

type TimeFilter = '7days' | '30days';

interface ChartMuscleGroup {
  key: string;
  label: string;
  muscles: MuscleGroup[];
  goalPercentage: number; // expected proportion of total volume (sums to 1)
}

const CHART_GROUPS: ChartMuscleGroup[] = [
  { key: 'chest', label: 'Chest', muscles: ['chest'], goalPercentage: 0.18 },
  { key: 'back', label: 'Back', muscles: ['back'], goalPercentage: 0.20 },
  { key: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'], goalPercentage: 0.25 },
  { key: 'shoulders', label: 'Shoulders', muscles: ['shoulders'], goalPercentage: 0.12 },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'], goalPercentage: 0.15 },
  { key: 'core', label: 'Core', muscles: ['abs'], goalPercentage: 0.10 },
];

// Exercises with multiple primary muscles = compound
function isCompound(exerciseName: string): boolean {
  const mapping = EXERCISE_MUSCLE_MAP[exerciseName];
  if (!mapping) return false;
  return mapping.primary.length >= 2 || (
    mapping.primary.length >= 1 && mapping.secondary.length >= 1
  );
}

interface BarData {
  key: string;
  label: string;
  compound: number;
  isolation: number;
  total: number;
  goalVolume: number;
  deviation: number; // percentage below/above goal
}

interface MuscleVolumeChartProps {
  refreshKey?: number;
  embedded?: boolean;
}

// ============================================================
// Component
// ============================================================

export function MuscleVolumeChart({ refreshKey, embedded }: MuscleVolumeChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [filter, setFilter] = useState<TimeFilter>('7days');
  const [data, setData] = useState<BarData[]>([]);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [filter, refreshKey]);

  const loadData = async () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = new Date(end);
    if (filter === '7days') {
      start.setDate(start.getDate() - 6);
    } else {
      start.setDate(start.getDate() - 29);
    }
    start.setHours(0, 0, 0, 0);

    const result = await getWorkoutsForDateRange(start.toISOString(), end.toISOString());
    if (!result.success || !result.workouts) return;

    // Accumulate compound and isolation volume per muscle
    const compoundVol: Record<MuscleGroup, number> = {} as any;
    const isolationVol: Record<MuscleGroup, number> = {} as any;
    const allMuscles: MuscleGroup[] = [
      'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
      'abs', 'quads', 'hamstrings', 'glutes', 'calves',
    ];
    for (const m of allMuscles) {
      compoundVol[m] = 0;
      isolationVol[m] = 0;
    }

    for (const workout of result.workouts) {
      for (const exercise of workout.exercises || []) {
        const mapping = EXERCISE_MUSCLE_MAP[exercise.name];
        if (!mapping) continue;

        let exerciseVolume = 0;
        for (const set of exercise.sets || []) {
          exerciseVolume += (set.kg || 0) * (set.reps || 0);
        }

        const compound = isCompound(exercise.name);
        const bucket = compound ? compoundVol : isolationVol;

        for (const m of mapping.primary) {
          bucket[m] += exerciseVolume;
        }
        for (const m of mapping.secondary) {
          bucket[m] += exerciseVolume * 0.5;
        }
      }
    }

    // Aggregate into chart groups
    let totalVolume = 0;
    const bars: BarData[] = CHART_GROUPS.map(group => {
      let comp = 0;
      let iso = 0;
      for (const m of group.muscles) {
        comp += compoundVol[m];
        iso += isolationVol[m];
      }
      totalVolume += comp + iso;
      return { key: group.key, label: group.label, compound: comp, isolation: iso, total: comp + iso, goalVolume: 0, deviation: 0 };
    });

    // Calculate goal volumes and deviations
    for (const bar of bars) {
      const group = CHART_GROUPS.find(g => g.key === bar.key)!;
      bar.goalVolume = totalVolume * group.goalPercentage;
      if (bar.goalVolume > 0) {
        bar.deviation = ((bar.total - bar.goalVolume) / bar.goalVolume) * 100;
      }
    }

    setData(bars);
  };

  // Chart dimensions
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - s(80); // padding + labels
  const chartHeight = s(140);
  const barWidth = Math.min(s(32), (chartWidth - s(40)) / CHART_GROUPS.length - s(8));
  const maxVal = Math.max(...data.map(d => d.total), 1);

  const selected = selectedBar ? data.find(d => d.key === selectedBar) : null;

  // Find undertrained groups (>15% below goal)
  const undertrained = data.filter(d => d.deviation < -15 && d.total > 0);
  const mostUndertrained = data.length > 0
    ? data.reduce((prev, curr) => (curr.deviation < prev.deviation ? curr : prev), data[0])
    : null;

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Muscle Volume</Text>
        <View style={styles.filterRow}>
          {(['7days', '30days'] as TimeFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.pill, filter === f && styles.pillActive]}
              onPress={() => { setFilter(f); setSelectedBar(null); }}
            >
              <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
                {f === '7days' ? '7D' : '30D'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
          <Text style={styles.legendText}>Compound</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#7DD3FC' }]} />
          <Text style={styles.legendText}>Isolation</Text>
        </View>
      </View>

      {data.every(d => d.total === 0) ? (
        <View style={styles.emptyState}>
          <Ionicons name="barbell-outline" size={s(36)} color={colors.border} />
          <Text style={styles.emptyText}>No workout data for this period</Text>
        </View>
      ) : (
        <>
          {/* Stacked Bar Chart */}
          <View style={styles.chartContainer}>
            <Svg width={chartWidth} height={chartHeight + s(30)}>
              {/* Y-axis grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const y = chartHeight - pct * chartHeight;
                return (
                  <Line
                    key={pct}
                    x1={0}
                    y1={y}
                    x2={chartWidth}
                    y2={y}
                    stroke={colors.card}
                    strokeWidth={1}
                    strokeDasharray={pct === 0 ? '' : '4,4'}
                  />
                );
              })}

              {/* Bars */}
              {data.map((bar, i) => {
                const centerX = ((i + 0.5) / data.length) * chartWidth;
                const x = centerX - barWidth / 2;
                const compHeight = maxVal > 0 ? (bar.compound / maxVal) * chartHeight : 0;
                const isoHeight = maxVal > 0 ? (bar.isolation / maxVal) * chartHeight : 0;
                const totalHeight = compHeight + isoHeight;
                const isSelected = selectedBar === bar.key;
                const isUndertrained = bar.deviation < -15 && bar.total > 0;

                return (
                  <React.Fragment key={bar.key}>
                    {/* Compound (bottom, darker) */}
                    <Rect
                      x={x}
                      y={chartHeight - totalHeight}
                      width={barWidth}
                      height={Math.max(compHeight, 0)}
                      rx={s(4)}
                      fill={isSelected ? '#0EA5E9' : '#38BDF8'}
                      opacity={isSelected ? 1 : 0.9}
                      onPress={() => setSelectedBar(isSelected ? null : bar.key)}
                    />
                    {/* Isolation (top, lighter) */}
                    {isoHeight > 0 && (
                      <Rect
                        x={x}
                        y={chartHeight - isoHeight}
                        width={barWidth}
                        height={Math.max(isoHeight, 0)}
                        rx={isoHeight === totalHeight ? s(4) : 0}
                        fill={isSelected ? '#BAE6FD' : '#7DD3FC'}
                        opacity={isSelected ? 1 : 0.7}
                        onPress={() => setSelectedBar(isSelected ? null : bar.key)}
                      />
                    )}

                    {/* Undertrained indicator */}
                    {isUndertrained && (
                      <SvgText
                        x={centerX}
                        y={chartHeight - totalHeight - s(6)}
                        textAnchor="middle"
                        fontSize={s(10)}
                        fill="#FF9500"
                        fontFamily="Inter_700Bold"
                      >
                        {Math.round(bar.deviation)}%
                      </SvgText>
                    )}

                    {/* X-axis label */}
                    <SvgText
                      x={centerX}
                      y={chartHeight + s(16)}
                      textAnchor="middle"
                      fontSize={s(10)}
                      fill={isUndertrained ? '#FF9500' : colors.textMuted}
                      fontFamily={isSelected ? 'Inter_700Bold' : 'Inter_500Medium'}
                    >
                      {bar.label}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          </View>

          {/* Selected bar detail */}
          {selected && (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{selected.label}</Text>
                <TouchableOpacity onPress={() => setSelectedBar(null)}>
                  <Ionicons name="close-circle" size={s(18)} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.detailStat}>
                  <Text style={styles.detailStatValue}>{formatVol(selected.compound)}</Text>
                  <Text style={styles.detailStatLabel}>Compound</Text>
                </View>
                <View style={styles.detailStat}>
                  <Text style={styles.detailStatValue}>{formatVol(selected.isolation)}</Text>
                  <Text style={styles.detailStatLabel}>Isolation</Text>
                </View>
                <View style={styles.detailStat}>
                  <Text style={[styles.detailStatValue, {
                    color: selected.deviation < -15 ? '#FF9500' : selected.deviation > 15 ? '#34C759' : colors.text,
                  }]}>
                    {selected.deviation > 0 ? '+' : ''}{Math.round(selected.deviation)}%
                  </Text>
                  <Text style={styles.detailStatLabel}>vs Goal</Text>
                </View>
              </View>
            </View>
          )}

          {/* Suggestions */}
          {undertrained.length > 0 && !selected && (
            <View style={styles.suggestions}>
              {undertrained.slice(0, 2).map(bar => (
                <View key={bar.key} style={styles.suggestionRow}>
                  <Ionicons name="alert-circle" size={s(14)} color="#FF9500" />
                  <Text style={styles.suggestionText}>
                    {bar.label} {Math.round(bar.deviation)}% below goal
                  </Text>
                </View>
              ))}
              {mostUndertrained && mostUndertrained.deviation < -15 && (
                <View style={styles.suggestionRow}>
                  <Ionicons name="bulb-outline" size={s(14)} color="#38BDF8" />
                  <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>
                    Increase {mostUndertrained.label.toLowerCase()} volume by {Math.min(Math.abs(Math.round(mostUndertrained.deviation * 0.5)), 30)}% this week
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function formatVol(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

// ============================================================
// Styles
// ============================================================

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    backgroundColor: c.card,
    marginHorizontal: s(20),
    marginTop: s(12),
    padding: s(16),
    borderRadius: s(10),
  },
  containerEmbedded: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginTop: 0,
    padding: s(12),
    borderRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(10),
  },
  title: {
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    letterSpacing: s(-0.3),
  },
  filterRow: { flexDirection: 'row', gap: s(6) },
  pill: {
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    borderRadius: s(8),
    backgroundColor: c.border,
  },
  pillActive: { backgroundColor: '#38BDF8' },
  pillText: { fontSize: s(12), fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  pillTextActive: { color: c.bg },
  legendRow: {
    flexDirection: 'row',
    gap: s(16),
    marginBottom: s(12),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  legendDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(2),
  },
  legendText: {
    fontSize: s(11),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: s(4),
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(32),
    gap: s(8),
  },
  emptyText: {
    fontSize: s(13),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  detailCard: {
    backgroundColor: c.border,
    borderRadius: s(10),
    padding: s(12),
    marginTop: s(8),
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  detailTitle: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  detailRow: {
    flexDirection: 'row',
    gap: s(8),
  },
  detailStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.card,
    paddingVertical: s(8),
    borderRadius: s(8),
  },
  detailStatValue: {
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  detailStatLabel: {
    fontSize: s(10),
    color: c.textMuted,
    marginTop: s(2),
    fontFamily: 'Inter_500Medium',
  },
  suggestions: {
    marginTop: s(10),
    gap: s(6),
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  suggestionText: {
    fontSize: s(12),
    color: '#FF9500',
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
});
