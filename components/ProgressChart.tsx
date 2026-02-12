import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Animated,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Line, Path, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';
import { getExerciseHistory, ExerciseHistorySession, ExerciseType } from '../database';
import { getExerciseList, ExerciseListItem } from '../exerciseDatabase';
import { useDragDismiss } from '../hooks/useDragDismiss';
import { getAIPrediction, AIInsight } from '../gemini';

type Timeframe = '1w' | '2w' | '1m' | '3m' | '6m';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '1w', label: '1 Week' },
  { key: '2w', label: '2 Weeks' },
  { key: '1m', label: '1 Month' },
  { key: '3m', label: '3 Months' },
  { key: '6m', label: '6 Months' },
];

const TIMEFRAME_SHORT: Record<Timeframe, string> = {
  '1w': '1W', '2w': '2W', '1m': '1M', '3m': '3M', '6m': '6M',
};

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '1w': 7, '2w': 14, '1m': 30, '3m': 90, '6m': 180,
};

interface DataPoint {
  date: string;
  value: number;
}

interface ChartData {
  raw: DataPoint[];
  smoothed: DataPoint[];
}

function getSessionData(sessions: ExerciseHistorySession[], timeframe: Timeframe, exerciseType: ExerciseType = 'weighted'): ChartData {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TIMEFRAME_DAYS[timeframe]);
  const cutoffStr = cutoff.toISOString();
  const isWeighted = exerciseType === 'weighted' || exerciseType === 'weighted_bodyweight';

  const raw: DataPoint[] = [];
  for (const session of sessions) {
    if (session.created_at < cutoffStr) continue;
    const workingSets = session.sets.filter(set => set.completed && set.set_type === 'working');
    if (workingSets.length === 0) continue;
    if (isWeighted) {
      let bestKg = 0;
      for (const set of workingSets) {
        if (set.kg > bestKg) bestKg = set.kg;
      }
      if (bestKg > 0) {
        raw.push({ date: session.created_at.split('T')[0], value: bestKg });
      }
    } else {
      // bodyweight: best reps; duration: best seconds (stored in reps)
      let bestVal = 0;
      for (const set of workingSets) {
        if (set.reps > bestVal) bestVal = set.reps;
      }
      if (bestVal > 0) {
        raw.push({ date: session.created_at.split('T')[0], value: bestVal });
      }
    }
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));

  // Rolling best over last 3 sessions to smooth out lighter days
  const WINDOW = 3;
  const smoothed = raw.map((pt, i) => {
    let best = pt.value;
    for (let j = Math.max(0, i - WINDOW + 1); j < i; j++) {
      if (raw[j].value > best) best = raw[j].value;
    }
    return { date: pt.date, value: best };
  });

  return { raw, smoothed };
}

function linearRegression(points: DataPoint[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.value ?? 0 };
  const xs = points.map((_, i) => i);
  const ys = points.map(p => p.value);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
  const sumXX = xs.reduce((sum, x) => sum + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

const TARGET_PERCENT = 5; // default: target is 5% above current best

function getRecommendationPoints(points: DataPoint[]): DataPoint[] {
  if (points.length < 3) return [];
  const { slope, intercept } = linearRegression(points);
  const lastDate = new Date(points[points.length - 1].date + 'T00:00:00');
  const lastVal = points[points.length - 1].value;
  // Avg days between sessions
  const firstDate = new Date(points[0].date + 'T00:00:00');
  const avgGap = Math.max(3, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * (points.length - 1))));

  const recommendations: DataPoint[] = [];
  for (let i = 1; i <= 4; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + avgGap * i);
    // Linear projection with slight diminishing returns
    const projected = slope * (points.length - 1 + i) + intercept;
    const damped = lastVal + (projected - lastVal) * (1 - 0.05 * i);
    recommendations.push({
      date: futureDate.toISOString().split('T')[0],
      value: Math.round(Math.max(damped, lastVal * 0.95)),
    });
  }
  return recommendations;
}

interface Prediction {
  percent: number;
  sessions: number | null; // estimated sessions to reach target
}

function getTargetPrediction(points: DataPoint[], target: number): Prediction | null {
  if (points.length < 3 || target <= 0) return null;
  const current = points[points.length - 1].value;
  if (current >= target) return { percent: 100, sessions: 0 };

  const { slope } = linearRegression(points);
  const gap = target - current;

  if (slope <= 0) {
    return { percent: Math.max(5, Math.round(15 - Math.abs(slope) * 10)), sessions: null };
  }

  const sessionsNeeded = Math.ceil(gap / slope);
  const rawConfidence = Math.min(slope / (gap * 0.05), 1);
  const percent = Math.round(35 + rawConfidence * 55);
  return { percent: Math.min(percent, 95), sessions: sessionsNeeded };
}

interface WeightRec {
  action: 'increase' | 'hold' | 'decrease';
  weight: number;
  text: string;
}

function getWeightRecommendation(points: DataPoint[], rawPoints: DataPoint[]): WeightRec | null {
  if (rawPoints.length < 2) return null;

  const lastRaw = rawPoints[rawPoints.length - 1].value;
  const { slope } = linearRegression(points.length >= 3 ? points : rawPoints);

  if (slope > 1.5) {
    // Strong upward trend — increase
    const rec = Math.round(lastRaw * 1.05);
    return { action: 'increase', weight: rec, text: `Increase to ${rec}kg — strong progress` };
  } else if (slope > 0.3) {
    // Mild upward — small bump
    const rec = Math.round(lastRaw * 1.025);
    return { action: 'increase', weight: rec, text: `Try ${rec}kg — steady progression` };
  } else if (slope > -0.5) {
    // Flat — hold
    return { action: 'hold', weight: Math.round(lastRaw), text: `Hold at ${Math.round(lastRaw)}kg — consolidate gains` };
  } else {
    // Declining — deload
    const rec = Math.round(lastRaw * 0.9);
    return { action: 'decrease', weight: rec, text: `Deload to ${rec}kg — recover and rebuild` };
  }
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

const STORAGE_KEY_EXERCISE = '@progress_chart_exercise';
const targetKey = (name: string) => `@e1rm_target_${name}`;

export function ProgressChart() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [exerciseList, setExerciseList] = useState<ExerciseListItem[]>([]);
  const [filteredList, setFilteredList] = useState<ExerciseListItem[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedExerciseType, setSelectedExerciseType] = useState<ExerciseType>('weighted');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [sessions, setSessions] = useState<ExerciseHistorySession[]>([]);
  const [targetMode, setTargetMode] = useState<'auto' | 'manual'>('auto');
  const [manualTarget, setManualTarget] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showTimeframePicker, setShowTimeframePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [reasoningText, setReasoningText] = useState<string | null>(null);

  const { panHandlers, animatedStyle } = useDragDismiss(() => setShowExercisePicker(false));
  const { panHandlers: sessionPanHandlers, animatedStyle: sessionAnimatedStyle } = useDragDismiss(() => setShowSessionModal(false));

  useEffect(() => {
    (async () => {
      const list = await getExerciseList();
      setExerciseList(list);
      setFilteredList(list);
      const saved = await AsyncStorage.getItem(STORAGE_KEY_EXERCISE);
      const match = list.find(e => e.name === saved);
      if (match) {
        setSelectedExercise(match.name);
        setSelectedExerciseType(match.exerciseType);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;
    setAiInsight(null);
    (async () => {
      const result = await getExerciseHistory(selectedExercise, 200);
      if (result.success) setSessions(result.sessions);
    })();
  }, [selectedExercise]);

  useEffect(() => {
    setAiInsight(null);
  }, [timeframe, targetMode, manualTarget]);

  useEffect(() => {
    if (!selectedExercise) return;
    (async () => {
      const saved = await AsyncStorage.getItem(targetKey(selectedExercise));
      if (saved) {
        setTargetMode('manual');
        setManualTarget(saved);
      } else {
        setTargetMode('auto');
        setManualTarget('');
      }
    })();
  }, [selectedExercise]);

  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredList(exerciseList);
    } else {
      const q = searchText.toLowerCase();
      setFilteredList(exerciseList.filter(e => e.name.toLowerCase().includes(q)));
    }
  }, [searchText, exerciseList]);

  const selectExercise = useCallback(async (item: ExerciseListItem) => {
    setSelectedExercise(item.name);
    setSelectedExerciseType(item.exerciseType);
    setShowExercisePicker(false);
    setSearchText('');
    await AsyncStorage.setItem(STORAGE_KEY_EXERCISE, item.name);
  }, []);

  const saveManualTarget = useCallback(async (val: string) => {
    setManualTarget(val);
    if (selectedExercise && val && !isNaN(Number(val))) {
      await AsyncStorage.setItem(targetKey(selectedExercise), val);
    }
  }, [selectedExercise]);

  const setTargetAuto = useCallback(async () => {
    setTargetMode('auto');
    setManualTarget('');
    setShowTargetPicker(false);
    if (selectedExercise) {
      await AsyncStorage.removeItem(targetKey(selectedExercise));
    }
  }, [selectedExercise]);

  const setTargetManual = useCallback(() => {
    setTargetMode('manual');
    setShowTargetPicker(false);
  }, []);

  const chartData = useMemo(() => getSessionData(sessions, timeframe, selectedExerciseType), [sessions, timeframe, selectedExerciseType]);
  const { raw: rawPoints, smoothed: points } = chartData;
  const allTimeBest = rawPoints.length > 0 ? Math.max(...rawPoints.map(p => p.value)) : 0;
  const autoTarget = useMemo(() => {
    if (allTimeBest <= 0) return 0;
    return Math.round(allTimeBest * (1 + TARGET_PERCENT / 100));
  }, [allTimeBest]);
  const targetValue = targetMode === 'manual' && manualTarget ? Number(manualTarget) : autoTarget;

  const prediction = aiInsight?.prediction ?? null;
  const weightRec = aiInsight?.recommendation ?? null;

  // Sessions filtered to current timeframe, sorted recent-first
  const timeframeSessions = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TIMEFRAME_DAYS[timeframe]);
    const cutoffStr = cutoff.toISOString();
    return sessions
      .filter(sess => sess.created_at >= cutoffStr)
      .filter(sess => sess.sets.some(set => set.completed && set.set_type === 'working'))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [sessions, timeframe]);

  const runAI = useCallback(async () => {
    if (!selectedExercise || points.length < 2 || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await getAIPrediction(selectedExercise, points, targetValue);
      if (result) setAiInsight(result);
    } finally {
      setAiLoading(false);
    }
  }, [selectedExercise, points, targetValue, aiLoading]);

  // Chart dimensions
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - s(32) - s(24) - s(12); // carousel margins + card padding + chart padding
  const chartHeight = s(130);
  const paddingLeft = s(32);
  const paddingRight = s(16);
  const paddingTop = s(10);
  const paddingBottom = s(18);
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;


  const chartContent = useMemo(() => {
    if (!selectedExercise) {
      return (
        <View style={[styles.emptyChart, { height: chartHeight }]}>
          <Ionicons name="barbell-outline" size={s(32)} color={colors.border} />
          <Text style={styles.emptyText}>Select an exercise to see progression</Text>
        </View>
      );
    }
    if (points.length === 0) {
      return (
        <View style={[styles.emptyChart, { height: chartHeight }]}>
          <Ionicons name="analytics-outline" size={s(32)} color={colors.border} />
          <Text style={styles.emptyText}>No data for this timeframe</Text>
        </View>
      );
    }

    const recPoints: DataPoint[] = aiInsight?.projectedPoints ?? [];
    const totalPoints = points.length + recPoints.length;

    const allValues = [
      ...points.map(p => p.value),
      ...rawPoints.map(p => p.value),
      ...recPoints.map(p => p.value),
      targetValue,
    ].filter(v => v > 0);
    const minVal = Math.floor(Math.min(...allValues) * 0.95);
    const maxVal = Math.ceil(Math.max(...allValues) * 1.05);
    const range = maxVal - minVal || 1;

    // X spans real + recommendation points
    const getX = (i: number) => {
      if (totalPoints <= 1) return paddingLeft + graphWidth / 2;
      return paddingLeft + (i / (totalPoints - 1)) * graphWidth;
    };
    const getY = (val: number) => paddingTop + graphHeight - ((val - minVal) / range) * graphHeight;

    const buildPath = (pts: DataPoint[], offset = 0) => {
      if (pts.length === 0) return '';
      if (pts.length === 1) return `M${getX(offset)},${getY(pts[0].value)}`;
      let d = `M${getX(offset)},${getY(pts[0].value)}`;
      for (let i = 1; i < pts.length; i++) {
        const x0 = getX(offset + i - 1);
        const y0 = getY(pts[i - 1].value);
        const x1 = getX(offset + i);
        const y1 = getY(pts[i].value);
        const cpx = (x0 + x1) / 2;
        d += ` C${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
      }
      return d;
    };

    const pathD = buildPath(points);

    // Recommendation path starts from last real point
    const recWithAnchor = [points[points.length - 1], ...recPoints];
    const recPathD = buildPath(recWithAnchor, points.length - 1);

    const lastRealX = getX(points.length - 1);
    const firstX = getX(0);
    const bottomY = paddingTop + graphHeight;
    const areaD = `${pathD} L${lastRealX},${bottomY} L${firstX},${bottomY} Z`;

    const ySteps = 4;
    const yLabels: number[] = [];
    for (let i = 0; i <= ySteps; i++) {
      yLabels.push(Math.round(minVal + (range * i) / ySteps));
    }

    // X-axis labels across real + recommended
    const allDates = [...points.map(p => p.date), ...recPoints.map(p => p.date)];
    const maxXLabels = Math.min(5, allDates.length);
    const xLabelIndices: number[] = [];
    if (allDates.length <= maxXLabels) {
      for (let i = 0; i < allDates.length; i++) xLabelIndices.push(i);
    } else {
      for (let i = 0; i < maxXLabels; i++) {
        xLabelIndices.push(Math.round((i / (maxXLabels - 1)) * (allDates.length - 1)));
      }
    }

    const targetY = getY(targetValue);

    // Glow color based on prediction probability
    const predPercent = prediction?.percent ?? 0;
    const glowColor = predPercent >= 75 ? '#4CAF50' : predPercent >= 50 ? '#FFC107' : '#F44336';

    return (
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          {/* Green area fill gradient */}
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4CAF50" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#4CAF50" stopOpacity="0.02" />
          </LinearGradient>
          {/* Trend line gradient: lighter green → solid green (left to right) */}
          <LinearGradient id="trendGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#81C784" stopOpacity="0.5" />
            <Stop offset="0.6" stopColor="#4CAF50" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#4CAF50" stopOpacity="1" />
          </LinearGradient>
          {/* Projected line glow */}
          <LinearGradient id="projGlow" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#2196F3" stopOpacity="0.15" />
            <Stop offset="1" stopColor={glowColor} stopOpacity="0.35" />
          </LinearGradient>
          {/* Projected line fill */}
          <LinearGradient id="projLine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#2196F3" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#2196F3" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {yLabels.map((val, i) => (
          <React.Fragment key={`y-${i}`}>
            <Line
              x1={paddingLeft}
              y1={getY(val)}
              x2={chartWidth - paddingRight}
              y2={getY(val)}
              stroke={colors.card}
              strokeWidth="1"
              strokeDasharray={i === 0 ? '' : '4,4'}
            />
            <SvgText
              x={paddingLeft - 6}
              y={getY(val) + 3}
              fill={colors.textMuted}
              fontSize={s(9).toString()}
              textAnchor="end"
              fontFamily="Inter_500Medium"
            >
              {val}
            </SvgText>
          </React.Fragment>
        ))}

        <Path d={areaD} fill="url(#areaGrad)" />

        {targetValue > 0 && (
          <>
            <Line
              x1={paddingLeft}
              y1={targetY}
              x2={chartWidth - paddingRight}
              y2={targetY}
              stroke="#FF9500"
              strokeWidth="1.5"
              strokeDasharray="6,4"
              opacity={0.8}
            />
            <SvgText
              x={chartWidth - paddingRight - 2}
              y={targetY - 5}
              fill="#FF9500"
              fontSize={s(8).toString()}
              textAnchor="end"
              fontFamily="Inter_600SemiBold"
              opacity={0.9}
            >
              TARGET
            </SvgText>
          </>
        )}

        {/* Trend line — green gradient, lighter at start */}
        <Path
          d={pathD}
          stroke="url(#trendGrad)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => {
          const opacity = 0.3 + (i / Math.max(points.length - 1, 1)) * 0.7;
          return (
            <Circle key={`dot-${i}`} cx={getX(i)} cy={getY(p.value)} r={s(3)} fill="#4CAF50" opacity={opacity} />
          );
        })}

        {/* Projected line — blue with probability glow */}
        {recPoints.length > 0 && (
          <>
            {/* Outer glow layer */}
            <Path
              d={recPathD}
              stroke="url(#projGlow)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Main projected line */}
            <Path
              d={recPathD}
              stroke="url(#projLine)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6,4"
            />
            {recPoints.map((p, i) => {
              const opacity = 0.4 + (i / Math.max(recPoints.length - 1, 1)) * 0.6;
              return (
                <Circle
                  key={`pred-${i}`}
                  cx={getX(points.length + i)}
                  cy={getY(p.value)}
                  r={s(3.5)}
                  fill="#2196F3"
                  opacity={opacity}
                />
              );
            })}
          </>
        )}

        {xLabelIndices.map((idx) => (
          <SvgText
            key={`x-${idx}`}
            x={getX(idx)}
            y={chartHeight - 3}
            fill={idx >= points.length ? '#2196F3' : colors.textMuted}
            fontSize={s(9).toString()}
            textAnchor="middle"
            fontFamily="Inter_500Medium"
            opacity={idx >= points.length ? 0.7 : 1}
          >
            {formatDateLabel(allDates[idx])}
          </SvgText>
        ))}
      </Svg>
    );
  }, [points, rawPoints, targetValue, selectedExercise, aiInsight, chartWidth, chartHeight, graphWidth, graphHeight, paddingLeft, paddingRight, paddingTop, paddingBottom, colors]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Progressive Overload</Text>

      {/* Selectors row */}
      <View style={styles.selectorsRow}>
        <TouchableOpacity
          style={styles.exerciseButton}
          onPress={() => setShowExercisePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="barbell-outline" size={s(14)} color={selectedExercise ? '#4CAF50' : colors.textMuted} />
          <Text style={[styles.exerciseButtonText, !selectedExercise && styles.placeholderText]} numberOfLines={1}>
            {selectedExercise || 'Select exercise'}
          </Text>
          <Ionicons name="chevron-down" size={s(12)} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowTimeframePicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownButtonText}>{TIMEFRAME_SHORT[timeframe]}</Text>
          <Ionicons name="chevron-down" size={s(12)} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowTargetPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="flag-outline" size={s(16)} color={targetMode === 'manual' ? '#FF9500' : colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, aiInsight && styles.aiActiveButton]}
          onPress={runAI}
          activeOpacity={0.7}
          disabled={aiLoading || !selectedExercise || points.length < 2}
        >
          {aiLoading ? (
            <ActivityIndicator size={s(14)} color="#2196F3" />
          ) : (
            <Ionicons name="sparkles" size={s(16)} color={aiInsight ? '#2196F3' : colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>

      {/* Chart — tap to open session history */}
      <TouchableOpacity
        style={styles.chartContainer}
        activeOpacity={0.8}
        onPress={() => { if (selectedExercise && rawPoints.length > 0) setShowSessionModal(true); }}
      >
        {chartContent}
      </TouchableOpacity>

      {/* Legend */}
      {selectedExercise && points.length > 0 && (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Trend</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDash, { backgroundColor: '#2196F3' }]} />
            <Text style={styles.legendText}>Projected</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDash, { backgroundColor: '#FF9500' }]} />
            <Text style={styles.legendText}>Target</Text>
          </View>
        </View>
      )}

      {/* Stats + Target */}
      {selectedExercise && points.length > 0 && (
        <>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, weightRec && {
              borderBottomWidth: s(2),
              borderBottomColor: weightRec.action === 'increase' ? '#4CAF50' : weightRec.action === 'decrease' ? '#FF9800' : '#9E9E9E',
            }]}>
              <Text style={styles.statLabel}>Best</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{allTimeBest}</Text>
                <Text style={styles.statUnit}>
                  {selectedExerciseType === 'duration' ? 's'
                    : (selectedExerciseType === 'bodyweight') ? ' reps'
                    : selectedExerciseType === 'weighted_bodyweight' ? ' +kg'
                    : 'kg'}
                </Text>
              </View>
              {weightRec && (
                <View style={styles.hintRow}>
                  <Text style={styles.hintLabel}>REC</Text>
                  <Ionicons
                    name={weightRec.action === 'increase' ? 'caret-up' : weightRec.action === 'decrease' ? 'caret-down' : 'remove'}
                    size={s(10)}
                    color={weightRec.action === 'increase' ? '#4CAF50' : weightRec.action === 'decrease' ? '#FF9800' : '#9E9E9E'}
                  />
                  <Text style={[styles.statHint, {
                    color: weightRec.action === 'increase' ? '#4CAF50' : weightRec.action === 'decrease' ? '#FF9800' : '#9E9E9E',
                  }]}>
                    {weightRec.weight}{selectedExerciseType === 'duration' ? 's' : selectedExerciseType === 'bodyweight' ? '' : 'kg'}
                  </Text>
                  {aiInsight?.recommendation?.reasoning && (
                    <TouchableOpacity
                      onPress={() => setReasoningText(aiInsight.recommendation.reasoning)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="information-circle-outline" size={s(12)} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            <View style={[styles.statCard, prediction && {
              borderBottomWidth: s(2),
              borderBottomColor: prediction.percent >= 70 ? '#4CAF50' : prediction.percent >= 40 ? '#FF9500' : '#F87171',
            }]}>
              <Text style={styles.statLabel}>Target</Text>
              <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{targetValue || '—'}</Text>
                <Text style={styles.statUnit}>
                  {selectedExerciseType === 'duration' ? 's'
                    : selectedExerciseType === 'bodyweight' ? ' reps'
                    : selectedExerciseType === 'weighted_bodyweight' ? ' +kg'
                    : 'kg'}
                </Text>
              </View>
              {prediction && (
                <View style={styles.hintRow}>
                  <Text style={styles.hintLabel}>CHANCE</Text>
                  <View style={[styles.hintDot, {
                    backgroundColor: prediction.percent >= 70 ? '#4CAF50' : prediction.percent >= 40 ? '#FF9500' : '#F87171',
                  }]} />
                  <Text style={[styles.statHint, {
                    color: prediction.percent >= 100 ? '#4CAF50'
                      : prediction.percent >= 70 ? '#4CAF50'
                      : prediction.percent >= 40 ? '#FF9500'
                      : '#F87171',
                  }]}>
                    {prediction.percent >= 100 ? 'Reached' : `${prediction.percent}%`}
                  </Text>
                  {aiInsight?.prediction?.reasoning && (
                    <TouchableOpacity
                      onPress={() => setReasoningText(aiInsight.prediction.reasoning)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="information-circle-outline" size={s(12)} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {targetMode === 'manual' && (
            <View style={styles.manualInputRow}>
              <Ionicons name="flag" size={s(12)} color="#FF9500" />
              <Text style={styles.manualInputLabel}>Target</Text>
              <TextInput
                style={styles.targetInput}
                value={manualTarget}
                onChangeText={saveManualTarget}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.targetInputUnit}>
                {selectedExerciseType === 'duration' ? 's'
                  : selectedExerciseType === 'bodyweight' ? 'reps'
                  : selectedExerciseType === 'weighted_bodyweight' ? '+kg'
                  : 'kg'}
              </Text>
            </View>
          )}
        </>
      )}

      {/* AI Reasoning Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={reasoningText !== null}
        onRequestClose={() => setReasoningText(null)}
      >
        <TouchableOpacity
          style={styles.reasoningOverlay}
          activeOpacity={1}
          onPress={() => setReasoningText(null)}
        >
          <View style={styles.reasoningCard}>
            <View style={styles.reasoningHeader}>
              <Ionicons name="sparkles" size={s(14)} color="#2196F3" />
              <Text style={styles.reasoningTitle}>AI Insight</Text>
            </View>
            <Text style={styles.reasoningBody}>{reasoningText}</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Timeframe Picker Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={showTimeframePicker}
        onRequestClose={() => setShowTimeframePicker(false)}
      >
        <TouchableOpacity
          style={styles.miniPickerOverlay}
          activeOpacity={1}
          onPress={() => setShowTimeframePicker(false)}
        >
          <View style={styles.miniPickerCard}>
            <Text style={styles.miniPickerTitle}>Timeframe</Text>
            {TIMEFRAMES.map((tf) => (
              <TouchableOpacity
                key={tf.key}
                style={[styles.miniPickerOption, timeframe === tf.key && styles.miniPickerOptionActive]}
                onPress={() => { setTimeframe(tf.key); setShowTimeframePicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.miniPickerOptionText, timeframe === tf.key && styles.miniPickerOptionTextActive]}>
                  {tf.label}
                </Text>
                {timeframe === tf.key && (
                  <Ionicons name="checkmark" size={s(16)} color="#4CAF50" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Target Mode Picker Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={showTargetPicker}
        onRequestClose={() => setShowTargetPicker(false)}
      >
        <TouchableOpacity
          style={styles.miniPickerOverlay}
          activeOpacity={1}
          onPress={() => setShowTargetPicker(false)}
        >
          <View style={styles.miniPickerCard}>
            <Text style={styles.miniPickerTitle}>Target Mode</Text>
            <TouchableOpacity
              style={[styles.miniPickerOption, targetMode === 'auto' && styles.miniPickerOptionActive]}
              onPress={setTargetAuto}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[styles.miniPickerOptionText, targetMode === 'auto' && styles.miniPickerOptionTextActive]}>Auto</Text>
                <Text style={styles.miniPickerOptionDesc}>{TARGET_PERCENT}% above your current best</Text>
              </View>
              {targetMode === 'auto' && (
                <Ionicons name="checkmark" size={s(16)} color="#4CAF50" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.miniPickerOption, targetMode === 'manual' && styles.miniPickerOptionActive]}
              onPress={setTargetManual}
              activeOpacity={0.7}
            >
              <View>
                <Text style={[styles.miniPickerOptionText, targetMode === 'manual' && styles.miniPickerOptionTextActive]}>Manual</Text>
                <Text style={styles.miniPickerOptionDesc}>Set your own target</Text>
              </View>
              {targetMode === 'manual' && (
                <Ionicons name="checkmark" size={s(16)} color="#4CAF50" />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Exercise Picker Modal */}
      <Modal
        animationType="none"
        transparent
        visible={showExercisePicker}
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <KeyboardAvoidingView style={styles.pickerOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[styles.pickerContainer, animatedStyle]}>
            <View style={styles.pickerDragHandleContainer} {...panHandlers}>
              <View style={styles.pickerDragHandle} />
            </View>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Exercise</Text>
              <TouchableOpacity
                onPress={() => { setShowExercisePicker(false); setSearchText(''); }}
                style={styles.pickerCloseButton}
              >
                <Ionicons name="close" size={s(18)} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={s(16)} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredList}
              keyExtractor={(item) => item.name}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, item.name === selectedExercise && styles.pickerItemSelected]}
                  onPress={() => selectExercise(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerItemText, item.name === selectedExercise && styles.pickerItemTextSelected]}>
                    {item.name}
                  </Text>
                  {item.name === selectedExercise && (
                    <Ionicons name="checkmark-circle" size={s(20)} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              )}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Session History Modal */}
      <Modal
        animationType="none"
        transparent
        visible={showSessionModal}
        onRequestClose={() => setShowSessionModal(false)}
      >
        <View style={styles.pickerOverlay}>
          <Animated.View style={[styles.sessionModalContainer, sessionAnimatedStyle]}>
            <View style={styles.pickerDragHandleContainer} {...sessionPanHandlers}>
              <View style={styles.pickerDragHandle} />
            </View>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Session History</Text>
              <TouchableOpacity
                onPress={() => setShowSessionModal(false)}
                style={styles.pickerCloseButton}
              >
                <Ionicons name="close" size={s(18)} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={timeframeSessions}
              keyExtractor={(item) => item.created_at}
              contentContainerStyle={styles.sessionListContent}
              renderItem={({ item: sess }) => {
                const exType = selectedExerciseType;
                const exIsWeighted = exType === 'weighted' || exType === 'weighted_bodyweight';
                const exIsDuration = exType === 'duration';
                const workingSets = sess.sets
                  .filter(set => set.set_type === 'working')
                  .sort((a, b) => a.set_number - b.set_number);
                const d = new Date(sess.created_at);
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const dateLabel = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
                const completedWorking = workingSets.filter(s => s.completed);
                const bestKg = exIsWeighted ? Math.max(...completedWorking.map(s => s.kg), 0) : 0;
                const bestVal = !exIsWeighted ? Math.max(...completedWorking.map(s => s.reps), 0) : 0;
                const totalVol = exIsWeighted ? completedWorking.reduce((sum, s) => sum + s.kg * s.reps, 0) : 0;
                return (
                  <View style={styles.sessionCard}>
                    <View style={styles.sessionCardHeader}>
                      <Text style={styles.sessionDate}>{dateLabel}</Text>
                      <View style={styles.sessionBadges}>
                        <View style={styles.sessionBadge}>
                          <Text style={styles.sessionBadgeText}>
                            {exIsWeighted
                              ? `${exType === 'weighted_bodyweight' ? '+' : ''}${bestKg}kg`
                              : exIsDuration
                              ? `${bestVal}s`
                              : `${bestVal} reps`}
                          </Text>
                        </View>
                        {exIsWeighted && (
                          <View style={[styles.sessionBadge, styles.sessionBadgeVol]}>
                            <Text style={styles.sessionBadgeText}>{totalVol}kg vol</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {workingSets.map((set, i) => (
                      <View key={i} style={styles.sessionSetRow}>
                        <Text style={styles.sessionSetNum}>Set {i + 1}</Text>
                        <Text style={[
                          styles.sessionSetValue,
                          !set.completed && styles.sessionSetSkipped,
                        ]}>
                          {!set.completed
                            ? 'skipped'
                            : exIsWeighted
                            ? `${exType === 'weighted_bodyweight' ? '+' : ''}${set.kg}kg × ${set.reps}`
                            : exIsDuration
                            ? `${set.reps}s`
                            : `${set.reps} reps`}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.sessionEmpty}>
                  <Ionicons name="barbell-outline" size={s(24)} color={colors.border} />
                  <Text style={styles.emptyText}>No sessions in this timeframe</Text>
                </View>
              }
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: {
    backgroundColor: c.card,
    padding: s(12),
    borderRadius: s(10),
  },
  title: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    letterSpacing: s(-0.3),
    marginBottom: s(8),
  },
  // Selectors
  selectorsRow: {
    flexDirection: 'row',
    gap: s(6),
    marginBottom: s(8),
  },
  exerciseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: s(8),
    paddingHorizontal: s(10),
    paddingVertical: s(7),
    gap: s(5),
  },
  exerciseButtonText: {
    flex: 1,
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  placeholderText: {
    color: c.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: s(8),
    paddingHorizontal: s(10),
    paddingVertical: s(7),
    gap: s(4),
  },
  dropdownButtonText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  iconButton: {
    backgroundColor: c.bg,
    borderRadius: s(8),
    padding: s(7),
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiActiveButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  // AI Reasoning modal
  reasoningOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(40),
  },
  reasoningCard: {
    backgroundColor: c.card,
    borderRadius: s(14),
    padding: s(16),
    width: '100%',
    maxWidth: s(280),
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(8),
  },
  reasoningTitle: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  reasoningBody: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
    lineHeight: s(18),
  },
  // Chart
  chartContainer: {
    backgroundColor: c.bg,
    borderRadius: s(8),
    padding: s(6),
    paddingTop: s(2),
  },
  // Session history modal
  sessionModalContainer: {
    backgroundColor: c.bg,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    maxHeight: '70%',
    paddingBottom: s(24),
  },
  sessionListContent: {
    paddingHorizontal: s(16),
    paddingBottom: s(8),
  },
  sessionCard: {
    backgroundColor: c.card,
    borderRadius: s(10),
    padding: s(12),
    marginBottom: s(8),
    gap: s(6),
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(4),
  },
  sessionDate: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  sessionBadges: {
    flexDirection: 'row',
    gap: s(6),
  },
  sessionBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(6),
  },
  sessionBadgeVol: {
    backgroundColor: 'rgba(33, 150, 243, 0.12)',
  },
  sessionBadgeText: {
    fontSize: s(10),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  sessionSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    paddingVertical: s(2),
  },
  sessionSetNum: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    width: s(36),
  },
  sessionSetValue: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  sessionSetSkipped: {
    color: c.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  sessionEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(32),
    gap: s(8),
  },
  emptyChart: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: s(8),
  },
  emptyText: {
    fontSize: s(13),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: s(6),
    gap: s(16),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  legendDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
  },
  legendDash: {
    width: s(12),
    height: s(2),
    borderRadius: s(1),
  },
  legendText: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: s(6),
    marginTop: s(8),
  },
  statCard: {
    flex: 1,
    backgroundColor: c.bg,
    paddingTop: s(6),
    paddingBottom: s(6),
    paddingHorizontal: s(10),
    borderRadius: s(8),
    alignItems: 'center',
    gap: s(1),
    overflow: 'hidden',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: s(2),
  },
  statValue: {
    fontSize: s(18),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    letterSpacing: s(-0.5),
  },
  statUnit: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  statLabel: {
    fontSize: s(9),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: s(0.8),
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    marginTop: s(4),
  },
  hintLabel: {
    fontSize: s(8),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    letterSpacing: s(0.5),
  },
  hintDot: {
    width: s(5),
    height: s(5),
    borderRadius: s(3),
  },
  statHint: {
    fontSize: s(10),
    fontFamily: 'Inter_700Bold',
  },
  // Manual target input
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s(10),
    gap: s(6),
  },
  manualInputLabel: {
    fontSize: s(12),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  targetInput: {
    backgroundColor: c.bg,
    borderRadius: s(8),
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    width: s(60),
    textAlign: 'center',
  },
  targetInputUnit: {
    fontSize: s(12),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  // Mini picker modals (timeframe + target mode)
  miniPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(40),
  },
  miniPickerCard: {
    backgroundColor: c.card,
    borderRadius: s(14),
    width: '100%',
    maxWidth: s(280),
    overflow: 'hidden',
  },
  miniPickerTitle: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    paddingHorizontal: s(16),
    paddingTop: s(16),
    paddingBottom: s(10),
  },
  miniPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(12),
    paddingHorizontal: s(16),
  },
  miniPickerOptionActive: {
    backgroundColor: c.bg,
  },
  miniPickerOptionText: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    color: c.text,
  },
  miniPickerOptionTextActive: {
    color: '#4CAF50',
    fontFamily: 'Inter_600SemiBold',
  },
  miniPickerOptionDesc: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    marginTop: s(1),
  },
  // Exercise picker modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: c.bg,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    maxHeight: '85%',
    paddingBottom: s(24),
  },
  pickerDragHandleContainer: {
    alignItems: 'center',
    paddingTop: s(10),
    paddingBottom: s(4),
  },
  pickerDragHandle: {
    width: s(36),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: c.border,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(20),
    paddingBottom: s(14),
    borderBottomWidth: s(1),
    borderBottomColor: c.card,
  },
  pickerTitle: {
    fontSize: s(18),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  pickerCloseButton: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: s(10),
    marginHorizontal: s(20),
    marginVertical: s(10),
    paddingHorizontal: s(12),
    gap: s(8),
  },
  searchInput: {
    flex: 1,
    fontSize: s(14),
    fontFamily: 'Inter_400Regular',
    color: c.text,
    paddingVertical: s(10),
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(14),
    paddingHorizontal: s(20),
    borderBottomWidth: s(1),
    borderBottomColor: c.card,
  },
  pickerItemSelected: {
    backgroundColor: c.card,
  },
  pickerItemText: {
    fontSize: s(15),
    color: c.text,
    fontFamily: 'Inter_500Medium',
  },
  pickerItemTextSelected: {
    color: '#4CAF50',
    fontFamily: 'Inter_600SemiBold',
  },
});
