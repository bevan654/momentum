import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Types (mirrored from WorkoutSummaryModal) ───

interface WorkoutSet {
  kg: number;
  reps: number;
  completed: boolean;
}

interface WorkoutExercise {
  name: string;
  sets: WorkoutSet[];
  isPR?: boolean;
  exercise_type?: string;
}

interface WorkoutSummary {
  id?: string;
  date: string;
  duration: number;
  exercises: WorkoutExercise[];
}

interface PRRecord {
  exerciseName: string;
  type: 'weight' | 'volume' | 'reps';
  value: number;
  label: string;
}

interface WorkoutShareCardProps {
  workout: WorkoutSummary;
  prs: PRRecord[];
}

// ─── Brand colors ───
const BRAND_BLUE = '#3B82F6';
const BRAND_BLUE_LIGHT = '#60A5FA';
const ACCENT_AMBER = '#F59E0B';
const ACCENT_RED = '#EF4444';
const ACCENT_GREEN = '#22C55E';

// ─── Helpers ───

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
};

const getDayName = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
};

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
  return `0:${String(m).padStart(2, '0')}`;
};

const formatVolume = (vol: number) => {
  return vol.toLocaleString('en-US');
};

// ─── Card dimensions (story aspect ratio 9:16) ───
const CARD_W = 540;
const CARD_H = 960;

// ─── Component ───

export const WorkoutShareCard: React.FC<WorkoutShareCardProps> = ({ workout, prs }) => {
  const prNames = new Set(prs.map(pr => pr.exerciseName));

  const totalVolume = workout.exercises.reduce((sum, ex) => {
    const t = ex.exercise_type || 'weighted';
    if (t === 'bodyweight' || t === 'duration') return sum;
    return sum + ex.sets.filter(s => s.completed).reduce((v, s) => v + s.kg * s.reps, 0);
  }, 0);

  const totalSets = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(s => s.completed).length,
    0,
  );

  const completedExercises = workout.exercises.filter(
    ex => ex.sets.some(s => s.completed),
  );
  const displayExercises = completedExercises.slice(0, 6);
  const overflowCount = completedExercises.length - 6;

  return (
    <View style={st.card}>
      {/* ─── Top branding bar ─── */}
      <View style={st.topBar}>
        <View style={st.brandRow}>
          <LinearGradient
            colors={[BRAND_BLUE, BRAND_BLUE_LIGHT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={st.brandPill}
          >
            <View style={st.brandDot} />
            <Text style={st.brandName}>MOMENTUM</Text>
          </LinearGradient>
        </View>

        {/* Date + time */}
        <View style={st.headerRow}>
          <View>
            <Text style={st.dateText}>{formatDate(workout.date)}</Text>
            <Text style={st.dayText}>{getDayName(workout.date)}</Text>
          </View>
          <View style={st.timePill}>
            <View style={st.liveDot} />
            <Text style={st.timeText}>{formatDuration(workout.duration)}</Text>
          </View>
        </View>
      </View>

      {/* ─── Bottom content ─── */}
      <View style={st.bottomSection}>
        {/* Exercise list */}
        <View style={st.exerciseList}>
          {displayExercises.map((ex, idx) => {
            const isPR = prNames.has(ex.name) || ex.isPR;
            const num = String(idx + 1).padStart(2, '0');
            const completedSets = ex.sets.filter(s => s.completed);
            const exType = ex.exercise_type || 'weighted';
            const bestSet = completedSets.reduce(
              (best, s) => (s.kg * s.reps > best.kg * best.reps ? s : best),
              completedSets[0] || { kg: 0, reps: 0 },
            );
            const bestLabel = exType === 'bodyweight'
              ? `${completedSets.length} sets · Best ${Math.max(...completedSets.map(s => s.reps), 0)} reps`
              : exType === 'duration'
              ? `${completedSets.length} sets · Best ${Math.max(...completedSets.map(s => s.reps), 0)}s`
              : exType === 'weighted_bodyweight'
              ? `${completedSets.length} sets · Best +${bestSet.kg}kg × ${bestSet.reps}`
              : `${completedSets.length} sets · Best ${bestSet.kg}kg × ${bestSet.reps}`;

            if (isPR) {
              return (
                <View key={idx} style={st.prRow}>
                  <View style={st.rowLeft}>
                    <Text style={st.prNum}>{num}</Text>
                    <View style={st.exerciseInfo}>
                      <Text style={st.prName} numberOfLines={1}>{ex.name}</Text>
                      <Text style={st.prDetail}>{bestLabel}</Text>
                    </View>
                  </View>
                  <LinearGradient
                    colors={[ACCENT_AMBER, '#FBBF24']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={st.prBadge}
                  >
                    <Text style={st.prBadgeText}>NEW PR</Text>
                  </LinearGradient>
                </View>
              );
            }

            return (
              <View key={idx} style={st.exerciseRow}>
                <View style={st.rowLeft}>
                  <Text style={st.exerciseNum}>{num}</Text>
                  <View style={st.exerciseInfo}>
                    <Text style={st.exerciseName} numberOfLines={1}>{ex.name}</Text>
                    <Text style={st.exerciseDetail}>{bestLabel}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {overflowCount > 0 && (
            <View style={st.exerciseRow}>
              <View style={st.rowLeft}>
                <Text style={st.exerciseNum}> </Text>
                <View style={st.exerciseInfo}>
                  <Text style={[st.exerciseName, { color: 'rgba(255,255,255,0.4)' }]}>+{overflowCount} more</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Stats grid */}
        <View style={st.statsGrid}>
          <View style={st.statCard}>
            <Text style={st.statValue}>{formatVolume(totalVolume)}</Text>
            <Text style={st.statLabel}>KG LIFTED</Text>
            <View style={[st.statAccent, { backgroundColor: BRAND_BLUE }]} />
          </View>
          <View style={st.statCard}>
            <Text style={st.statValue}>{totalSets}</Text>
            <Text style={st.statLabel}>SETS</Text>
            <View style={[st.statAccent, { backgroundColor: ACCENT_GREEN }]} />
          </View>
          <View style={st.statCard}>
            <Text style={st.statValue}>{completedExercises.length}</Text>
            <Text style={st.statLabel}>EXERCISES</Text>
            <View style={[st.statAccent, { backgroundColor: ACCENT_AMBER }]} />
          </View>
          <View style={st.statCard}>
            <Text style={st.statValue}>{formatDuration(workout.duration)}</Text>
            <Text style={st.statLabel}>DURATION</Text>
            <View style={[st.statAccent, { backgroundColor: ACCENT_RED }]} />
          </View>
        </View>

        {/* Bottom branding */}
        <View style={st.bottomBrand}>
          <View style={st.bottomBrandLine} />
          <Text style={st.bottomBrandTag}>TRACKED WITH MOMENTUM</Text>
          <View style={st.bottomBrandLine} />
        </View>
      </View>
    </View>
  );
};

// ─── Styles ───

const st = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },

  // ─── Top bar ───
  topBar: {
    padding: 40,
    paddingTop: 52,
  },
  brandRow: {
    marginBottom: 28,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  brandName: {
    fontSize: 20,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateText: {
    fontSize: 80,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -5,
    lineHeight: 80,
  },
  dayText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: BRAND_BLUE_LIGHT,
    letterSpacing: 6,
    marginTop: 8,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  liveDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT_RED,
  },
  timeText: {
    fontSize: 26,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // ─── Bottom ───
  bottomSection: {
    padding: 40,
    paddingBottom: 52,
  },

  // ─── Exercise list ───
  exerciseList: {
    gap: 16,
    marginBottom: 36,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseNum: {
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    color: 'rgba(255,255,255,0.25)',
    width: 28,
  },
  exerciseName: {
    fontSize: 19,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  exerciseDetail: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 3,
    letterSpacing: 0.2,
  },

  // PR row
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  prNum: {
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    color: ACCENT_AMBER,
    width: 28,
  },
  prName: {
    fontSize: 19,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  prDetail: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(245,158,11,0.6)',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  prBadge: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  prBadgeText: {
    fontSize: 13,
    fontFamily: 'Inter_800ExtraBold',
    color: '#000000',
    letterSpacing: 1.5,
  },

  // ─── Stats grid ───
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    width: (CARD_W - 80 - 12) / 2,
    alignItems: 'center',
    paddingVertical: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  statAccent: {
    position: 'absolute',
    top: 0,
    left: '30%',
    right: '30%',
    height: 3,
    borderRadius: 2,
  },
  statValue: {
    fontSize: 28,
    fontFamily: 'Inter_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 2.5,
    marginTop: 4,
  },

  // ─── Bottom branding ───
  bottomBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  bottomBrandLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59,130,246,0.3)',
  },
  bottomBrandTag: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: BRAND_BLUE_LIGHT,
    letterSpacing: 3,
  },
});
