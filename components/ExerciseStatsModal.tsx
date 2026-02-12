import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';
import { getExerciseHistory, ExerciseHistorySession } from '../database';
import { useDragDismiss } from '../hooks/useDragDismiss';

type ExerciseType = 'weighted' | 'bodyweight' | 'duration' | 'weighted_bodyweight';

interface ExerciseStatsModalProps {
  visible: boolean;
  exerciseName: string | null;
  exerciseType?: ExerciseType;
  onClose: () => void;
}

export const ExerciseStatsModal: React.FC<ExerciseStatsModalProps> = ({
  visible,
  exerciseName,
  exerciseType: propExerciseType,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onClose);
  const [sessions, setSessions] = useState<ExerciseHistorySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'heaviest'>('newest');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && exerciseName) {
      setLoading(true);
      getExerciseHistory(exerciseName).then((result) => {
        if (result.success) setSessions(result.sessions);
        setLoading(false);
      });
    }
    if (!visible) setSessions([]);
  }, [visible, exerciseName]);

  // Resolve exercise type: use session data if available, otherwise prop, fallback to weighted
  const exerciseType: ExerciseType = useMemo(() => {
    if (sessions.length > 0 && sessions[0].exercise_type) {
      return sessions[0].exercise_type as ExerciseType;
    }
    return propExerciseType || 'weighted';
  }, [sessions, propExerciseType]);

  const isWeighted = exerciseType === 'weighted' || exerciseType === 'weighted_bodyweight';
  const isDuration = exerciseType === 'duration';
  const isBodyweight = exerciseType === 'bodyweight';

  const stats = useMemo(() => {
    if (sessions.length === 0) return null;

    const allSets = sessions.flatMap(sess =>
      sess.sets.filter(st => st.completed)
    );

    // Type-aware primary metric
    const maxWeight = isWeighted && allSets.length > 0 ? Math.max(...allSets.map(st => st.kg)) : 0;
    const maxReps = allSets.length > 0 ? Math.max(...allSets.map(st => st.reps)) : 0;

    const heavySets = allSets.filter(st => st.kg === maxWeight);
    const maxRepsAtHeaviest = heavySets.length > 0 ? Math.max(...heavySets.map(st => st.reps)) : 0;

    // Session metric for chart: avg weight (weighted), avg reps (bodyweight), avg seconds (duration)
    const avgMetricPerSession = sessions.map(sess => {
      const completed = sess.sets.filter(st => st.completed);
      if (completed.length === 0) return 0;
      if (isWeighted) {
        return completed.reduce((sum, st) => sum + st.kg, 0) / completed.length;
      }
      // bodyweight or duration: avg reps/seconds
      return completed.reduce((sum, st) => sum + st.reps, 0) / completed.length;
    });

    const sessionVolumes = sessions.map(sess => {
      const completed = sess.sets.filter(st => st.completed);
      if (!isWeighted) return 0;
      return completed.reduce((sum, st) => sum + st.kg * st.reps, 0);
    });

    const totalSessions = sessions.length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSessions = sessions.filter(s => new Date(s.created_at) >= thirtyDaysAgo);
    const sessionsPerWeek = recentSessions.length > 0
      ? ((recentSessions.length / 30) * 7)
      : 0;

    const avgWeightPerSet = isWeighted && allSets.length > 0
      ? allSets.reduce((sum, st) => sum + st.kg, 0) / allSets.length
      : 0;
    const avgRepsPerSet = allSets.length > 0
      ? allSets.reduce((sum, st) => sum + st.reps, 0) / allSets.length
      : 0;

    // Progression rate: volume-based for weighted, reps-based for bodyweight/duration
    let progressionRate: number | null = null;
    if (sessions.length >= 10) {
      const metricPerSession = isWeighted ? sessionVolumes : sessions.map(sess => {
        const completed = sess.sets.filter(st => st.completed);
        return completed.reduce((sum, st) => sum + st.reps, 0);
      });
      const recent5 = metricPerSession.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const prior5 = metricPerSession.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
      if (prior5 > 0) {
        progressionRate = ((recent5 - prior5) / prior5) * 100;
      }
    }

    let bestSet = { kg: 0, reps: 0, volume: 0 };
    allSets.forEach(st => {
      if (isWeighted) {
        const vol = st.kg * st.reps;
        if (vol > bestSet.volume) bestSet = { kg: st.kg, reps: st.reps, volume: vol };
      } else {
        // For bodyweight/duration: best = highest reps/seconds
        if (st.reps > bestSet.reps) bestSet = { kg: st.kg, reps: st.reps, volume: 0 };
      }
    });

    const sessionDates = sessions.map(s => new Date(s.created_at));

    return {
      maxWeight,
      maxReps,
      maxRepsAtHeaviest,
      avgMetricPerSession,
      totalSessions,
      sessionsPerWeek,
      avgWeightPerSet,
      avgRepsPerSet,
      progressionRate,
      bestSet,
      sessionDates,
    };
  }, [sessions, isWeighted, isDuration, isBodyweight]);

  const sortedSessions = useMemo(() => {
    const list = [...sessions];
    if (sortMode === 'oldest') {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortMode === 'heaviest') {
      list.sort((a, b) => {
        if (isWeighted) {
          const maxA = Math.max(...a.sets.filter(s => s.completed).map(s => s.kg), 0);
          const maxB = Math.max(...b.sets.filter(s => s.completed).map(s => s.kg), 0);
          return maxB - maxA;
        }
        // bodyweight/duration: sort by best reps/seconds
        const maxA = Math.max(...a.sets.filter(s => s.completed).map(s => s.reps), 0);
        const maxB = Math.max(...b.sets.filter(s => s.completed).map(s => s.reps), 0);
        return maxB - maxA;
      });
    }
    // 'newest' is the default order from DB
    return list;
  }, [sessions, sortMode, isWeighted]);

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cycleSortMode = () => {
    setSortMode(prev => prev === 'newest' ? 'oldest' : prev === 'oldest' ? 'heaviest' : 'newest');
  };

  const chartWidth = Dimensions.get('window').width - s(48);
  const chartHeight = s(160);
  const paddingLeft = s(40);
  const paddingRight = s(16);
  const paddingTop = s(16);
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - s(24);

  const shortDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

  const fullDate = (d: Date) => d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const renderWeightTrendChart = () => {
    if (!stats || stats.avgMetricPerSession.length < 1) return null;
    const count = Math.min(10, stats.avgMetricPerSession.length);
    const data = [...stats.avgMetricPerSession].reverse().slice(-count);
    const dates = [...stats.sessionDates].reverse().slice(-count);
    const minVal = Math.floor(Math.min(...data) - 1);
    const maxVal = Math.ceil(Math.max(...data) + 1);
    const range = maxVal - minVal || 1;
    const localChartHeight = chartHeight + s(20);

    let pathD = '';
    const points: { x: number; y: number }[] = [];
    const xDivisor = data.length > 1 ? data.length - 1 : 1;
    data.forEach((val, i) => {
      const x = data.length === 1 ? paddingLeft + graphWidth / 2 : paddingLeft + (i / xDivisor) * graphWidth;
      const y = paddingTop + graphHeight - ((val - minVal) / range) * graphHeight;
      points.push({ x, y });
      pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    const labelStep = data.length <= 5 ? 1 : Math.ceil(data.length / 5);

    return (
      <Svg width={chartWidth} height={localChartHeight}>
        <SvgText x={paddingLeft - s(8)} y={paddingTop + s(4)} fill={colors.textMuted} fontSize={s(10)} textAnchor="end">
          {maxVal}
        </SvgText>
        <SvgText x={paddingLeft - s(8)} y={paddingTop + graphHeight + s(4)} fill={colors.textMuted} fontSize={s(10)} textAnchor="end">
          {minVal}
        </SvgText>
        <Line x1={paddingLeft} y1={paddingTop} x2={chartWidth - paddingRight} y2={paddingTop}
          stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
        <Line x1={paddingLeft} y1={paddingTop + graphHeight} x2={chartWidth - paddingRight} y2={paddingTop + graphHeight}
          stroke={colors.border} strokeWidth="1" />
        <Path d={pathD} stroke="#38BDF8" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((pt, i) => (
          <Circle key={i} cx={pt.x} cy={pt.y} r={s(4)} fill="#38BDF8" />
        ))}
        {dates.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null;
          const x = data.length === 1 ? paddingLeft + graphWidth / 2 : paddingLeft + (i / xDivisor) * graphWidth;
          return (
            <SvgText key={i} x={x} y={paddingTop + graphHeight + s(16)}
              fill={colors.textMuted} fontSize={s(9)} textAnchor="middle">
              {shortDate(d)}
            </SvgText>
          );
        })}
      </Svg>
    );
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, animatedStyle]}>
          {/* Drag handle */}
          <View style={styles.dragHandleContainer} {...panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title} numberOfLines={2}>{exerciseName}</Text>
              {stats?.progressionRate !== null && stats?.progressionRate !== undefined && (
                <View style={[styles.progressBadge, stats.progressionRate >= 0 ? styles.progressBadgeUp : styles.progressBadgeDown]}>
                  <Ionicons
                    name={stats.progressionRate >= 0 ? 'trending-up' : 'trending-down'}
                    size={s(11)}
                    color={stats.progressionRate >= 0 ? '#15803D' : '#B91C1C'}
                  />
                  <Text style={[styles.progressBadgeText, stats.progressionRate >= 0 ? styles.progressTextUp : styles.progressTextDown]}>
                    {stats.progressionRate >= 0 ? '+' : ''}{stats.progressionRate.toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={s(22)} color={colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : !stats ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="stats-chart-outline" size={s(48)} color={colors.textMuted} />
              <Text style={styles.emptyText}>No history yet</Text>
              <Text style={styles.emptySubtext}>Complete a workout with this exercise to see stats</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Personal Records — single card with dividers */}
              <View style={styles.prCard}>
                {isWeighted ? (
                  <>
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{stats.maxWeight}<Text style={styles.prUnit}> {exerciseType === 'weighted_bodyweight' ? '+kg' : 'kg'}</Text></Text>
                      <Text style={styles.prLabel}>{exerciseType === 'weighted_bodyweight' ? 'Best +Weight' : 'Best Weight'}</Text>
                    </View>
                    <View style={styles.prDivider} />
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{stats.maxRepsAtHeaviest}<Text style={styles.prUnit}> reps</Text></Text>
                      <Text style={styles.prLabel}>@ {exerciseType === 'weighted_bodyweight' ? '+' : ''}{stats.maxWeight}kg</Text>
                    </View>
                    <View style={styles.prDivider} />
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{exerciseType === 'weighted_bodyweight' ? '+' : ''}{stats.bestSet.kg}<Text style={styles.prUnit}> x {stats.bestSet.reps}</Text></Text>
                      <Text style={styles.prLabel}>Best Set</Text>
                    </View>
                  </>
                ) : isDuration ? (
                  <>
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{stats.maxReps}<Text style={styles.prUnit}>s</Text></Text>
                      <Text style={styles.prLabel}>Best Time</Text>
                    </View>
                    <View style={styles.prDivider} />
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{stats.totalSessions}</Text>
                      <Text style={styles.prLabel}>Sessions</Text>
                    </View>
                    <View style={styles.prDivider} />
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{stats.avgRepsPerSet.toFixed(0)}<Text style={styles.prUnit}>s</Text></Text>
                      <Text style={styles.prLabel}>Avg Time</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{stats.maxReps}<Text style={styles.prUnit}> reps</Text></Text>
                      <Text style={styles.prLabel}>Best Reps</Text>
                    </View>
                    <View style={styles.prDivider} />
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{stats.totalSessions}</Text>
                      <Text style={styles.prLabel}>Sessions</Text>
                    </View>
                    <View style={styles.prDivider} />
                    <View style={styles.prItem}>
                      <Text style={styles.prValue}>{stats.avgRepsPerSet.toFixed(1)}<Text style={styles.prUnit}> reps</Text></Text>
                      <Text style={styles.prLabel}>Avg Reps</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Trend Chart + Stats in one card */}
              <View style={styles.chartStatsCard}>
                <Text style={styles.chartTitle}>
                  {isWeighted ? 'Weight Trend' : isDuration ? 'Time Trend' : 'Reps Trend'}
                </Text>
                {renderWeightTrendChart()}
                <View style={styles.inlineStats}>
                  <View style={styles.inlineStat}>
                    <Text style={styles.inlineStatValue}>{stats.totalSessions}</Text>
                    <Text style={styles.inlineStatLabel}>Sessions</Text>
                  </View>
                  <View style={styles.inlineStat}>
                    <Text style={styles.inlineStatValue}>{stats.sessionsPerWeek.toFixed(1)}</Text>
                    <Text style={styles.inlineStatLabel}>Per Week</Text>
                  </View>
                  {isWeighted ? (
                    <View style={styles.inlineStat}>
                      <Text style={styles.inlineStatValue}>{stats.avgWeightPerSet.toFixed(1)}</Text>
                      <Text style={styles.inlineStatLabel}>{exerciseType === 'weighted_bodyweight' ? 'Avg +kg' : 'Avg kg'}</Text>
                    </View>
                  ) : null}
                  <View style={styles.inlineStat}>
                    <Text style={styles.inlineStatValue}>{stats.avgRepsPerSet.toFixed(isDuration ? 0 : 1)}</Text>
                    <Text style={styles.inlineStatLabel}>{isDuration ? 'Avg Sec' : 'Avg Reps'}</Text>
                  </View>
                </View>
              </View>

              {/* Session History */}
              <View style={styles.historyHeader}>
                <Text style={styles.sectionTitle}>Session History</Text>
                <TouchableOpacity onPress={cycleSortMode} style={styles.sortButton}>
                  <Ionicons name="swap-vertical" size={s(13)} color={colors.textMuted} />
                  <Text style={styles.sortButtonText}>{sortMode === 'heaviest' ? (isWeighted ? 'heaviest' : 'best') : sortMode}</Text>
                </TouchableOpacity>
              </View>
              {sortedSessions.map((sess, i) => {
                const completedSets = sess.sets.filter(st => st.completed);
                const sessDate = new Date(sess.created_at);
                const volume = isWeighted ? completedSets.reduce((sum, st) => sum + st.kg * st.reps, 0) : 0;
                const maxKg = isWeighted ? Math.max(...completedSets.map(st => st.kg), 0) : 0;
                const totalReps = completedSets.reduce((sum, st) => sum + st.reps, 0);
                const bestReps = Math.max(...completedSets.map(st => st.reps), 0);
                const sessionKey = sess.workout_id + '-' + i;
                const isExpanded = expandedSessions.has(sessionKey);
                return (
                  <TouchableOpacity
                    key={sessionKey}
                    activeOpacity={0.7}
                    onPress={() => toggleSession(sessionKey)}
                    style={styles.sessionCard}
                  >
                    <View style={styles.sessionRow}>
                      <View style={styles.sessionLeft}>
                        <Text style={styles.sessionDate}>{fullDate(sessDate)}</Text>
                        <View style={styles.sessionMeta}>
                          <Text style={styles.sessionMetaText}>{completedSets.length} sets</Text>
                          <View style={styles.metaDot} />
                          {isWeighted ? (
                            <>
                              <Text style={styles.sessionMetaText}>{exerciseType === 'weighted_bodyweight' ? '+' : ''}{maxKg} kg top</Text>
                              <View style={styles.metaDot} />
                              <Text style={styles.sessionMetaText}>{totalReps} reps</Text>
                            </>
                          ) : isDuration ? (
                            <Text style={styles.sessionMetaText}>Best {bestReps}s</Text>
                          ) : (
                            <Text style={styles.sessionMetaText}>Best {bestReps} reps</Text>
                          )}
                        </View>
                      </View>
                      {isWeighted ? (
                        <View style={styles.sessionRight}>
                          <Text style={styles.sessionVolume}>
                            {volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : volume}
                          </Text>
                          <Text style={styles.sessionVolUnit}>kg vol</Text>
                        </View>
                      ) : (
                        <View style={styles.sessionRight}>
                          <Text style={styles.sessionVolume}>{totalReps}</Text>
                          <Text style={styles.sessionVolUnit}>{isDuration ? 'total sec' : 'total reps'}</Text>
                        </View>
                      )}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={s(16)}
                        color={colors.textMuted}
                        style={{ marginLeft: s(6) }}
                      />
                    </View>
                    {isExpanded && (
                      <View style={styles.setsContainer}>
                        {completedSets.map((st, si) => (
                          <View key={si} style={[styles.setRow, si % 2 === 1 && styles.setRowAlt]}>
                            <View style={styles.setNumBadge}>
                              <Text style={styles.setNumText}>{si + 1}</Text>
                            </View>
                            {isWeighted ? (
                              <>
                                <Text style={styles.setWeight}>{exerciseType === 'weighted_bodyweight' ? '+' : ''}{st.kg} kg</Text>
                                <Text style={styles.setReps}>{st.reps} reps</Text>
                                <Text style={styles.setVol}>{(st.kg * st.reps).toFixed(0)}</Text>
                              </>
                            ) : isDuration ? (
                              <>
                                <Text style={styles.setWeight}>{st.reps}s</Text>
                                <Text style={styles.setReps} />
                                <Text style={styles.setVol} />
                              </>
                            ) : (
                              <>
                                <Text style={styles.setWeight}>{st.reps} reps</Text>
                                <Text style={styles.setReps} />
                                <Text style={styles.setVol} />
                              </>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <View style={{ height: s(40) }} />
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  container: {
    flex: 1,
    backgroundColor: c.bg,
    marginTop: s(60),
    borderTopLeftRadius: s(24),
    borderTopRightRadius: s(24),
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: s(10),
    paddingBottom: s(4),
  },
  dragHandle: {
    width: s(36),
    height: s(4),
    borderRadius: s(2),
    backgroundColor: c.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    paddingBottom: s(14),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginRight: s(12),
  },
  title: {
    fontSize: s(18),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    flexShrink: 1,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingHorizontal: s(7),
    paddingVertical: s(3),
    borderRadius: s(8),
  },
  progressBadgeUp: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  progressBadgeDown: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
  },
  progressBadgeText: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
  },
  progressTextUp: {
    color: '#15803D',
  },
  progressTextDown: {
    color: '#B91C1C',
  },
  closeButton: {
    width: s(32),
    height: s(32),
    borderRadius: s(16),
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(40),
  },
  emptyText: {
    fontSize: s(18),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    marginTop: s(16),
  },
  emptySubtext: {
    fontSize: s(14),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    marginTop: s(8),
    textAlign: 'center',
  },
  scrollContent: {
    padding: s(16),
  },

  // PR card — single card, items in a row with vertical dividers
  prCard: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderRadius: s(12),
    paddingVertical: s(12),
    marginBottom: s(12),
  },
  prItem: {
    flex: 1,
    alignItems: 'center',
  },
  prDivider: {
    width: s(1),
    backgroundColor: c.border,
    marginVertical: s(2),
  },
  prValue: {
    fontSize: s(15),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
  },
  prUnit: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  prLabel: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    marginTop: s(2),
  },

  // Combined chart + stats card
  chartStatsCard: {
    backgroundColor: c.card,
    borderRadius: s(12),
    padding: s(14),
    marginBottom: s(12),
  },
  chartTitle: {
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
    marginBottom: s(4),
  },
  inlineStats: {
    flexDirection: 'row',
    borderTopWidth: s(1),
    borderTopColor: c.border,
    marginTop: s(8),
    paddingTop: s(10),
  },
  inlineStat: {
    flex: 1,
    alignItems: 'center',
  },
  inlineStatValue: {
    fontSize: s(14),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
  },
  inlineStatLabel: {
    fontSize: s(9),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    marginTop: s(1),
  },

  // Section title + sort
  sectionTitle: {
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
    marginTop: s(4),
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(8),
    paddingVertical: s(4),
    borderRadius: s(6),
    backgroundColor: c.card,
  },
  sortButtonText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'capitalize',
  },

  // Session cards
  sessionCard: {
    backgroundColor: c.card,
    borderRadius: s(10),
    marginBottom: s(6),
    overflow: 'hidden',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(12),
    paddingVertical: s(11),
  },
  sessionLeft: {
    flex: 1,
  },
  sessionDate: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(3),
    gap: s(6),
  },
  sessionMetaText: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
  metaDot: {
    width: s(3),
    height: s(3),
    borderRadius: s(1.5),
    backgroundColor: c.border,
  },
  sessionRight: {
    alignItems: 'flex-end',
    marginRight: s(2),
  },
  sessionVolume: {
    fontSize: s(14),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
  },
  sessionVolUnit: {
    fontSize: s(9),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    marginTop: s(-1),
  },

  // Expanded sets
  setsContainer: {
    borderTopWidth: s(1),
    borderTopColor: c.border,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(12),
    paddingVertical: s(7),
  },
  setRowAlt: {
    backgroundColor: c.bg,
  },
  setNumBadge: {
    width: s(22),
    height: s(22),
    borderRadius: s(6),
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: s(10),
  },
  setNumText: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
  },
  setWeight: {
    flex: 1,
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  setReps: {
    width: s(56),
    fontSize: s(13),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    textAlign: 'center',
  },
  setVol: {
    width: s(44),
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    textAlign: 'right',
  },
});
