import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useDragDismiss } from '../hooks/useDragDismiss';
import { Ionicons } from '@expo/vector-icons';
import { getExerciseHistory, ExerciseHistorySession, ExerciseType } from '../database';
import { getGymStreak } from '../streakDatabase';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';
import { LiveSessionSummaryCard } from './live/LiveSessionSummaryCard';
import type { LiveSessionSummary } from '../liveSessionManager';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { WorkoutShareCard } from './WorkoutShareCard';
import * as MediaLibrary from 'expo-media-library';

const SCREEN_WIDTH = Dimensions.get('window').width;

// --- Types ---

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

interface WorkoutSummaryModalProps {
  visible: boolean;
  workout: WorkoutSummary | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isJustCompleted?: boolean;
  liveSessionSummary?: LiveSessionSummary | null;
}

// --- Animated Counter Hook ---

function useAnimatedCounter(target: number, duration: number, delay: number, active: boolean) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active) {
      setDisplay(target);
      return;
    }
    animValue.setValue(0);
    const listener = animValue.addListener(({ value }) => {
      setDisplay(Math.round(value));
    });

    const timeout = setTimeout(() => {
      Animated.timing(animValue, {
        toValue: target,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, delay);

    return () => {
      clearTimeout(timeout);
      animValue.removeListener(listener);
    };
  }, [target, active]);

  return display;
}

// --- PR Detection ---

async function detectPRs(exercises: WorkoutExercise[]): Promise<PRRecord[]> {
  const prs: PRRecord[] = [];

  await Promise.all(
    exercises.map(async (exercise) => {
      const result = await getExerciseHistory(exercise.name, 100);
      if (!result.success || result.sessions.length <= 1) return;

      // Current workout is the most recent session — compare against the rest
      const previousSessions = result.sessions.slice(1);

      // Best weight ever (previous)
      let prevBestWeight = 0;
      previousSessions.forEach(session => {
        session.sets.forEach(set => {
          if (set.completed && set.kg > prevBestWeight) prevBestWeight = set.kg;
        });
      });

      // Current best weight
      const currentBestWeight = Math.max(
        ...exercise.sets.filter(s => s.completed).map(s => s.kg),
        0
      );

      if (currentBestWeight > prevBestWeight && currentBestWeight > 0) {
        prs.push({
          exerciseName: exercise.name,
          type: 'weight',
          value: currentBestWeight,
          label: `${currentBestWeight} kg`,
        });
      }

      // Best single-set volume (weight × reps) ever (previous)
      let prevBestSetVolume = 0;
      previousSessions.forEach(session => {
        session.sets.forEach(set => {
          if (set.completed) {
            const vol = set.kg * set.reps;
            if (vol > prevBestSetVolume) prevBestSetVolume = vol;
          }
        });
      });

      const currentBestSetVolume = Math.max(
        ...exercise.sets.filter(s => s.completed).map(s => s.kg * s.reps),
        0
      );

      if (currentBestSetVolume > prevBestSetVolume && currentBestSetVolume > 0 && currentBestWeight <= prevBestWeight) {
        prs.push({
          exerciseName: exercise.name,
          type: 'volume',
          value: currentBestSetVolume,
          label: `${currentBestSetVolume} kg×reps`,
        });
      }
    })
  );

  return prs.slice(0, 3); // Max 3 PRs shown
}

// --- Staggered Fade Component ---

const StaggeredFade: React.FC<{
  index: number;
  animate: boolean;
  children: React.ReactNode;
  style?: any;
}> = ({ index, animate, children, style }) => {
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? s(20) : 0)).current;

  useEffect(() => {
    if (!animate) return;
    const delay = 200 + index * 100;
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, [animate]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

// --- PR Pop Component ---

const PRPop: React.FC<{ animate: boolean; delay: number; children: React.ReactNode; style?: any }> = ({
  animate,
  delay: delayMs,
  children,
  style,
}) => {
  const scale = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) return;
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [animate]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
};

// --- Ripple Component ---

const CompletionRipple: React.FC<{ animate: boolean; color: string }> = ({ animate, color }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!animate) return;
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(scale, { toValue: 4, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start();
    }, 100);
    return () => clearTimeout(timeout);
  }, [animate]);

  if (!animate) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: s(120),
        alignSelf: 'center',
        width: s(100),
        height: s(100),
        borderRadius: s(50),
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
};

// --- Main Component ---

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  visible,
  workout,
  onClose,
  onEdit,
  onDelete,
  isJustCompleted = false,
  liveSessionSummary,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onClose);

  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [prs, setPrs] = useState<PRRecord[]>([]);
  const [streak, setStreak] = useState<{ current: number; best: number } | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const shareCardRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);

  // Scale pulse for stat numbers
  const statScale1 = useRef(new Animated.Value(1)).current;
  const statScale2 = useRef(new Animated.Value(1)).current;
  const statScale3 = useRef(new Animated.Value(1)).current;
  const statScale4 = useRef(new Animated.Value(1)).current;
  const streakScale = useRef(new Animated.Value(1)).current;

  // Compute totals
  const totalSets = workout ? workout.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0) : 0;
  const totalReps = workout ? workout.exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).reduce((r, s) => r + s.reps, 0), 0) : 0;
  const totalVolume = workout ? workout.exercises.reduce((sum, ex) => {
    const exType = ex.exercise_type || 'weighted';
    if (exType === 'bodyweight' || exType === 'duration') return sum;
    return sum + ex.sets.filter(s => s.completed).reduce((v, s) => v + s.kg * s.reps, 0);
  }, 0) : 0;

  // Animated counters
  const displaySets = useAnimatedCounter(totalSets, 1200, 400, animateIn);
  const displayReps = useAnimatedCounter(totalReps, 1200, 550, animateIn);
  const displayVolume = useAnimatedCounter(totalVolume, 1400, 700, animateIn);
  const displayStreak = useAnimatedCounter(streak?.current ?? 0, 1500, 1200, animateIn && !!streak);

  // Trigger pulse at end of counter animation
  useEffect(() => {
    if (!animateIn) return;
    const pulseScale = (animVal: Animated.Value, delay: number) => {
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(animVal, { toValue: 1.08, duration: 120, useNativeDriver: true }),
          Animated.timing(animVal, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
      }, delay);
    };
    pulseScale(statScale1, 1600);
    pulseScale(statScale2, 1650);
    pulseScale(statScale3, 1750);
    pulseScale(statScale4, 2100);
    // Streak pop at end of count-up
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(streakScale, { toValue: 1.15, duration: 150, useNativeDriver: true }),
        Animated.spring(streakScale, { toValue: 1, friction: 3, tension: 150, useNativeDriver: true }),
      ]).start();
    }, 2700);
  }, [animateIn]);

  // Load PRs and streak when visible
  useEffect(() => {
    if (visible && workout) {
      if (isJustCompleted) {
        setAnimateIn(true);
        detectPRs(workout.exercises).then(setPrs);
        getGymStreak().then(result => setStreak({ current: result.current, best: result.best }));
      } else {
        setAnimateIn(false);
        setPrs([]);
        // Mark exercises that have isPR flag from data
        const flaggedPRs: PRRecord[] = [];
        workout.exercises.forEach(ex => {
          if (ex.isPR) {
            flaggedPRs.push({ exerciseName: ex.name, type: 'weight', value: 0, label: 'PR' });
          }
        });
        setPrs(flaggedPRs);
        setStreak(null);
      }
    }
    if (!visible) {
      setExpandedExercises(new Set());
      setAnimateIn(false);
    }
  }, [visible, workout, isJustCompleted]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const toggleExerciseExpanded = (exerciseName: string) => {
    const newExpanded = new Set(expandedExercises);
    if (newExpanded.has(exerciseName)) {
      newExpanded.delete(exerciseName);
    } else {
      newExpanded.add(exerciseName);
    }
    setExpandedExercises(newExpanded);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          },
        },
      ]
    );
  };

  const handleShareInstagram = async () => {
    if (!shareCardRef.current) {
      Alert.alert('Error', 'Share card not ready. Please try again.');
      return;
    }
    try {
      setSharing(true);
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1, result: 'tmpfile' });

      // Request write-only media library permissions (no audio/read needed)
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save the image for sharing.');
        return;
      }

      // Save to camera roll
      const asset = await MediaLibrary.createAssetAsync(uri);

      // Always show instructions — open Instagram if possible, otherwise no-op
      Alert.alert(
        'Saved to gallery!',
        'To add it to your Story:\n\n1. Select or take your photo\n2. Tap the sticker icon (top)\n3. Choose the gallery sticker\n4. Pick the workout card from recents',
        [
          {
            text: 'Open Instagram',
            onPress: () => Linking.openURL('instagram://app').catch(() =>
              Linking.openURL('https://www.instagram.com'),
            ),
          },
          { text: 'OK' },
        ],
      );
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Something went wrong');
    } finally {
      setSharing(false);
    }
  };

  const handleShare = async () => {
    if (!shareCardRef.current) return;
    try {
      setSharing(true);
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch (e) {
      // User cancelled or share failed — silent
    } finally {
      setSharing(false);
    }
  };

  if (!workout) return null;

  const prExerciseNames = new Set(prs.map(pr => pr.exerciseName));

  const BADGE_COLORS = [
    '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00',
  ];

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, animatedStyle]}>
          {/* Subtle ripple */}
          <CompletionRipple animate={animateIn} color={colors.accent} />

          {/* Drag handle + header */}
          <View style={styles.header} {...panHandlers}>
            <View style={styles.dragHandle} />
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={s(18)} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>
                  {isJustCompleted ? 'Workout Complete!' : 'Workout Summary'}
                </Text>
                <Text style={styles.headerSubtitle}>{formatDate(workout.date)}</Text>
              </View>
              <View style={styles.closeButtonSpacer} />
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Duration Hero */}
            <StaggeredFade index={0} animate={animateIn}>
              <View style={styles.heroSection}>
                <Animated.View style={[styles.durationPill, { transform: [{ scale: statScale1 }] }]}>
                  <Ionicons name="time-outline" size={s(18)} color={colors.accent} />
                  <Text style={styles.durationText}>{formatDuration(workout.duration)}</Text>
                </Animated.View>
              </View>
            </StaggeredFade>

            {/* Live Session Summary */}
            {liveSessionSummary && (
              <StaggeredFade index={1} animate={animateIn}>
                <LiveSessionSummaryCard summary={liveSessionSummary} />
              </StaggeredFade>
            )}

            {/* Stats Grid */}
            <StaggeredFade index={liveSessionSummary ? 2 : 1} animate={animateIn}>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Animated.Text style={[styles.statValue, { transform: [{ scale: statScale2 }] }]}>
                    {animateIn ? displaySets : totalSets}
                  </Animated.Text>
                  <Text style={styles.statLabel}>Sets</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCard}>
                  <Animated.Text style={[styles.statValue, { transform: [{ scale: statScale3 }] }]}>
                    {animateIn ? displayReps : totalReps}
                  </Animated.Text>
                  <Text style={styles.statLabel}>Reps</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCard}>
                  <Animated.Text style={[styles.statValue, { transform: [{ scale: statScale4 }] }]}>
                    {animateIn ? (displayVolume >= 1000 ? `${(displayVolume / 1000).toFixed(1)}k` : displayVolume) : (totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume.toFixed(0))}
                  </Animated.Text>
                  <Text style={styles.statLabel}>Volume (kg)</Text>
                </View>
              </View>
            </StaggeredFade>

            {/* PRs / Achievements */}
            {prs.length > 0 && (
              <StaggeredFade index={2} animate={animateIn}>
                <View style={styles.prSection}>
                  <Text style={styles.sectionTitle}>Personal Records</Text>
                  <View style={styles.prList}>
                    {prs.map((pr, i) => (
                      <PRPop key={`${pr.exerciseName}-${pr.type}`} animate={animateIn} delay={800 + i * 200}>
                        <View style={styles.prCard}>
                          <View style={styles.prIconContainer}>
                            <Ionicons name="trophy" size={s(18)} color="#422006" />
                          </View>
                          <View style={styles.prInfo}>
                            <Text style={styles.prExercise} numberOfLines={1}>{pr.exerciseName}</Text>
                            <Text style={styles.prDetail}>
                              {pr.type === 'weight' ? 'New max weight' : 'New best set volume'}: {pr.label}
                            </Text>
                          </View>
                        </View>
                      </PRPop>
                    ))}
                  </View>
                </View>
              </StaggeredFade>
            )}

            {/* Streak Indicator */}
            {streak && streak.current > 0 && (
              <StaggeredFade index={3} animate={animateIn}>
                <View style={styles.streakCard}>
                  <View style={styles.streakIcon}>
                    <Ionicons name="flame" size={s(20)} color="#FF9500" />
                  </View>
                  <View style={styles.streakInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Animated.Text style={[styles.streakValue, { transform: [{ scale: streakScale }] }]}>
                        {animateIn ? displayStreak : streak.current}
                      </Animated.Text>
                      <Text style={styles.streakValue}> day streak</Text>
                    </View>
                    <Text style={styles.streakSub}>
                      {streak.current >= streak.best ? 'New personal best!' : `Best: ${streak.best} days`}
                    </Text>
                  </View>
                </View>
              </StaggeredFade>
            )}

            {/* Exercise Breakdown */}
            <StaggeredFade index={4} animate={animateIn}>
              <View style={styles.exercisesList}>
                <Text style={styles.sectionTitle}>Exercise Breakdown</Text>
                {workout.exercises.map((exercise, index) => {
                  const isExpanded = expandedExercises.has(exercise.name);
                  const badgeColor = BADGE_COLORS[index % BADGE_COLORS.length];
                  const hasPR = prExerciseNames.has(exercise.name);
                  const completedSets = exercise.sets.filter(s => s.completed).length;
                  const allCompleted = completedSets === exercise.sets.length;
                  const exType = exercise.exercise_type || 'weighted';
                  const exerciseVolume = (exType === 'bodyweight' || exType === 'duration') ? 0 : exercise.sets
                    .filter(s => s.completed)
                    .reduce((v, s) => v + s.kg * s.reps, 0);

                  return (
                    <StaggeredFade key={index} index={5 + index} animate={animateIn}>
                      <View style={styles.exerciseCard}>
                        <TouchableOpacity
                          onPress={() => toggleExerciseExpanded(exercise.name)}
                          style={styles.exerciseHeader}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.exerciseIndexBadge, { backgroundColor: badgeColor }]}>
                            {allCompleted ? (
                              <Ionicons name="checkmark" size={s(14)} color="#FFFFFF" />
                            ) : (
                              <Text style={styles.exerciseIndexText}>{index + 1}</Text>
                            )}
                          </View>
                          <View style={styles.exerciseHeaderCenter}>
                            <View style={styles.exerciseNameRow}>
                              <Text style={styles.exerciseName} numberOfLines={1}>
                                {exercise.name}
                              </Text>
                              {hasPR && (
                                <View style={styles.prBadge}>
                                  <Ionicons name="star" size={s(10)} color="#422006" />
                                  <Text style={styles.prBadgeText}>PR</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.exerciseStats}>
                              {completedSets}/{exercise.sets.length} sets{exType !== 'bodyweight' && exType !== 'duration' ? `  ·  ${exerciseVolume.toLocaleString()} kg` : ''}
                            </Text>
                          </View>
                          <Ionicons
                            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                            size={s(18)}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>

                        {/* Expandable Set Details */}
                        {isExpanded && (
                          <View style={styles.setsContainer}>
                            <View style={styles.setHeaderRow}>
                              <Text style={styles.setHeaderText}>Set</Text>
                              <Text style={[styles.setHeaderText, { flex: 1 }]}>
                                {exType === 'bodyweight' ? 'Reps' : exType === 'duration' ? 'Time' : exType === 'weighted_bodyweight' ? '+Weight × Reps' : 'Weight × Reps'}
                              </Text>
                              <Text style={styles.setHeaderText}>Done</Text>
                            </View>
                            {exercise.sets.map((set, setIndex) => (
                              <View
                                key={setIndex}
                                style={[
                                  styles.setRow,
                                  setIndex % 2 === 0 && styles.setRowAlt,
                                ]}
                              >
                                <View style={styles.setNumberBadge}>
                                  <Text style={styles.setNumberText}>{setIndex + 1}</Text>
                                </View>
                                <Text style={styles.setText}>
                                  {exType === 'bodyweight' ? `${set.reps} reps`
                                    : exType === 'duration' ? `${set.reps}s`
                                    : exType === 'weighted_bodyweight' ? `+${set.kg} kg  ×  ${set.reps}`
                                    : `${set.kg} kg  ×  ${set.reps}`}
                                </Text>
                                {set.completed ? (
                                  <View style={styles.completedBadge}>
                                    <Ionicons name="checkmark" size={s(12)} color="#FFFFFF" />
                                  </View>
                                ) : (
                                  <View style={styles.incompleteBadge}>
                                    <Ionicons name="close" size={s(12)} color={colors.textMuted} />
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </StaggeredFade>
                  );
                })}
              </View>
            </StaggeredFade>

            <View style={{ height: s(16) }} />
          </ScrollView>

          {/* Footer */}
          {!isJustCompleted && (
            <View style={styles.footer}>
              <View style={styles.footerButtons}>
                <TouchableOpacity style={styles.editButton} onPress={onEdit} activeOpacity={0.8}>
                  <Ionicons name="create-outline" size={s(18)} color="#FFFFFF" style={{ marginRight: s(6) }} />
                  <Text style={styles.editButtonText}>Edit Workout</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} activeOpacity={0.7} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={s(16)} color="#EF4444" style={{ marginRight: s(4) }} />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isJustCompleted && (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.igButton} onPress={handleShareInstagram} disabled={sharing} activeOpacity={0.8}>
                {sharing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="logo-instagram" size={s(20)} color="#FFFFFF" style={{ marginRight: s(8) }} />
                    <Text style={styles.igButtonText}>Share to Instagram Stories</Text>
                  </>
                )}
              </TouchableOpacity>
              <View style={styles.footerButtons}>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare} disabled={sharing} activeOpacity={0.8}>
                  <Ionicons name="share-social-outline" size={s(16)} color={colors.text} style={{ marginRight: s(6) }} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Offscreen share card for capture */}
          <View style={{ position: 'absolute', left: -9999, top: 0, backgroundColor: 'transparent' }} pointerEvents="none">
            <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }} style={{ backgroundColor: 'transparent' }}>
              <WorkoutShareCard workout={workout} prs={prs} />
            </ViewShot>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// --- Styles ---

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
    overflow: 'hidden',
  },

  // Header
  header: {
    backgroundColor: c.bg,
    paddingBottom: s(12),
  },
  dragHandle: {
    width: s(36),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: s(10),
    marginBottom: s(14),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(20),
  },
  closeButton: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonSpacer: {
    width: s(32),
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: s(18),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  headerSubtitle: {
    fontSize: s(12),
    color: c.textSecondary,
    marginTop: s(2),
  },

  // Content
  content: {
    flex: 1,
  },

  // Duration Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: s(20),
    paddingBottom: s(16),
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    paddingHorizontal: s(20),
    paddingVertical: s(10),
    borderRadius: s(20),
    gap: s(8),
  },
  durationText: {
    fontSize: s(22),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: s(16),
    backgroundColor: c.card,
    borderRadius: s(14),
    paddingVertical: s(18),
    marginBottom: s(20),
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: s(26),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
  },
  statLabel: {
    fontSize: s(11),
    color: c.textSecondary,
    fontFamily: 'Inter_500Medium',
    marginTop: s(2),
  },
  statDivider: {
    width: s(1),
    backgroundColor: c.border,
    marginVertical: s(4),
  },

  // PRs Section
  prSection: {
    paddingHorizontal: s(16),
    marginBottom: s(16),
  },
  sectionTitle: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: s(0.8),
    marginBottom: s(10),
    paddingHorizontal: s(4),
  },
  prList: {
    gap: s(8),
  },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    borderRadius: s(12),
    padding: s(12),
    gap: s(12),
  },
  prIconContainer: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    backgroundColor: '#FACC15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  prInfo: {
    flex: 1,
  },
  prExercise: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: '#422006',
  },
  prDetail: {
    fontSize: s(12),
    color: '#854D0E',
    fontFamily: 'Inter_500Medium',
    marginTop: s(1),
  },

  // Streak
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: s(16),
    marginBottom: s(20),
    backgroundColor: c.card,
    borderRadius: s(12),
    padding: s(14),
    gap: s(12),
    borderLeftWidth: s(3),
    borderLeftColor: '#FF9500',
  },
  streakIcon: {
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakInfo: {
    flex: 1,
  },
  streakValue: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  streakSub: {
    fontSize: s(12),
    color: c.textSecondary,
    fontFamily: 'Inter_500Medium',
    marginTop: s(1),
  },

  // Exercises
  exercisesList: {
    paddingHorizontal: s(16),
  },
  exerciseCard: {
    backgroundColor: c.card,
    borderRadius: s(10),
    marginBottom: s(8),
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s(14),
    gap: s(12),
  },
  exerciseIndexBadge: {
    width: s(28),
    height: s(28),
    borderRadius: s(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseIndexText: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  exerciseHeaderCenter: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  exerciseName: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    flexShrink: 1,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FACC15',
    paddingHorizontal: s(7),
    paddingVertical: s(2),
    borderRadius: s(8),
    gap: s(3),
  },
  prBadgeText: {
    fontSize: s(10),
    fontFamily: 'Inter_800ExtraBold',
    color: '#422006',
  },
  exerciseStats: {
    fontSize: s(12),
    color: c.textSecondary,
    marginTop: s(2),
  },

  // Sets
  setsContainer: {
    paddingHorizontal: s(14),
    paddingBottom: s(10),
    borderTopWidth: s(1),
    borderTopColor: c.border,
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(8),
    paddingHorizontal: s(8),
  },
  setHeaderText: {
    fontSize: s(10),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
    width: s(36),
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(8),
    paddingHorizontal: s(8),
    borderRadius: s(8),
  },
  setRowAlt: {
    backgroundColor: c.bg,
  },
  setNumberBadge: {
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: s(12),
  },
  setNumberText: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
    color: c.textSecondary,
  },
  setText: {
    fontSize: s(14),
    color: c.text,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  completedBadge: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incompleteBadge: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: s(16),
    paddingTop: s(14),
    paddingBottom: s(30),
    backgroundColor: c.bg,
    gap: s(10),
  },
  igButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(15),
    borderRadius: s(12),
    backgroundColor: '#E1306C',
  },
  igButtonText: {
    color: '#FFFFFF',
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: s(10),
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
    paddingVertical: s(14),
    borderRadius: s(12),
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(14),
    paddingHorizontal: s(18),
    borderRadius: s(12),
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
  },
  doneButton: {
    flex: 1,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: s(14),
    borderRadius: s(12),
    alignItems: 'center',
  },
  doneButtonText: {
    color: c.text,
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: s(14),
    borderRadius: s(12),
  },
  shareButtonText: {
    color: c.text,
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
  },
});
