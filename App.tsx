import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  FlatList,
  PanResponder,
  Animated,
  Alert,
  Dimensions,
  ActivityIndicator,
  AppState,
  RefreshControl,
  Switch,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Rect, Line, Path, G, Text as SvgText } from 'react-native-svg';
import { supabase } from './supabase';
import { ThemeProvider, useTheme, Colors } from './theme';
import { saveWorkout, getWorkouts, getLastSetForExercise, getWorkoutsForMonth, getWorkoutsByDate, deleteWorkout as deleteWorkoutDB, get14DayStats, getWorkoutById, getWorkoutsForDateRange, getExerciseHistory, clearWorkoutCaches, ExerciseType } from './database';
import { createActivityEntry, updateMyLeaderboardEntry, updateSupplementLeaderboard, getUnreadNotificationCount, getNotifications, getMyProfile, Profile, markNotificationRead, createNotification } from './friendsDatabase';
import { Calendar } from './components/Calendar';
import { WorkoutSummaryModal } from './components/WorkoutSummaryModal';
import { WorkoutListModal } from './components/WorkoutListModal';
import { Auth } from './components/Auth';
import { FriendsTab } from './components/friends/FriendsTab';
import { Settings } from './components/Settings';
import { WorkoutStartPage } from './components/WorkoutStartPage';
import { FoodLogger } from './components/FoodLogger';
import { ProgressChart } from './components/ProgressChart';
import { getDailyNutritionSummary, getNutritionGoals, saveNutritionGoals, DailyNutritionSummary, NutritionGoals, MealSlotConfig, getMealConfig, saveMealConfig, DEFAULT_MEAL_SLOTS, clearFoodCaches } from './foodDatabase';
import { saveRoutine } from './routineDatabase';
import { getWeightStats, saveWeightEntry, saveStartingWeight, deleteWeightEntry, WeightStats, clearWeightCaches } from './weightDatabase';
import { getDailySupplementSummary, getSupplementGoals, saveSupplementEntry, saveSupplementGoals, DailySupplementSummary, SupplementGoals, clearSupplementCaches } from './supplementDatabase';
import { WeightHistoryModal } from './components/WeightHistoryModal';
import { getGymStreak, getNutritionStreak, getCombinedStreak, StreakResult } from './streakDatabase';
import { AnimatedStreakBadge } from './components/AnimatedStreakBadge';
import { getExerciseList, addCustomExercise, FALLBACK_EXERCISES, invalidateExerciseCache, ExerciseListItem, EXERCISE_TYPE_DEFAULTS, FALLBACK_CATEGORY_MAP } from './exerciseDatabase';
import { Logo } from './components/Logo';

import { ExerciseStatsModal } from './components/ExerciseStatsModal';
import { initPresence, cleanupPresence, updatePresence } from './presenceManager';
import {
  createLiveSession,
  acceptInvite as acceptLiveInvite,
  joinSessionChannel,
  reconnectToSession,
  updateMyLiveState,
  sendReaction,
  endSession as endLiveSession,
  leaveSession as leaveLiveSession,
  cancelSession as cancelLiveSession,
  forceEndSession as forceEndLiveSession,
  subscribeToSessionEvents,
  subscribeToSession as subscribeToSessionInfo,
  declineInvite as declineLiveInvite,
  getSessionSummary,
  subscribeToLiveState,
  subscribeToReactions,
  subscribeToConnectionStatus,
  getCurrentSession,
  getCurrentUserId,
  getParticipantStates,
  getParticipantFinished,
  kickParticipant as kickLiveParticipant,
  transferLeadership as transferLiveLeadership,
  isCurrentUserLeader,
  type LiveUserState,
  type LiveReaction,
  type LiveSessionSummary,
  type ConnectionStatus,
} from './liveSessionManager';
import { LiveInviteModal } from './components/live/LiveInviteModal';
import { LiveInviteReceivedModal } from './components/live/LiveInviteReceivedModal';
import { LiveSessionBanner, MiniLiveSessionBanner } from './components/live/LiveSessionBanner';
import { LiveReactionToast } from './components/live/LiveReactionToast';
import { JoinRequestModal } from './components/live/JoinRequestModal';
import { JoinByCodeModal } from './components/live/JoinByCodeModal';
import {
  initBuddySync,
  joinBuddySync,
  onLocalSetCompleted,
  onLocalExerciseDone,
  getBuddySyncState,
  isBuddySyncActive,
  subscribeToBuddySync,
  cleanupBuddySync,
  type BuddySyncState,
} from './buddyWorkoutSync';
import { getLiveSession, inviteToExistingSession, getPendingLiveInvites, updateLiveSessionStatus } from './friendsDatabase';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { s } from './responsive';
import { EXERCISE_MUSCLE_MAP, MUSCLE_DISPLAY_NAMES, MuscleGroup } from './muscleMapping';
import * as Haptics from 'expo-haptics';
import { initNotifications, scheduleRestTimerNotification, cancelRestTimerNotification, showSocialNotification, registerPushToken, clearPushToken } from './notifications';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  chest: '#FF6B6B',
  back: '#4ECDC4',
  shoulders: '#FF9500',
  biceps: '#AF52DE',
  triceps: '#5AC8FA',
  quads: '#34C759',
  hamstrings: '#FFCC00',
  glutes: '#FF2D55',
  abs: '#007AFF',
  forearms: '#8E8E93',
  calves: '#30B0C7',
};

type SetType = 'warmup' | 'working' | 'drop' | 'failure';

interface Set {
  kg: string;
  reps: string;
  type: SetType;
  completed: boolean;
  drops?: { kg: string; reps: string }[];
}

interface Exercise {
  id: string;
  name: string;
  exerciseType: ExerciseType;
  category?: string;
  sets: Set[];
  prevKg: number;
  prevReps: number;
  supersetWith?: string | null;
}

const EXERCISE_TYPES: ExerciseType[] = ['weighted', 'bodyweight', 'duration', 'weighted_bodyweight'];
const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weighted: 'Weighted',
  bodyweight: 'Bodyweight',
  duration: 'Timed',
  weighted_bodyweight: 'Weighted BW',
};
const EXERCISE_TYPE_COLORS: Record<ExerciseType, string> = {
  weighted: '#FCA5A5',
  bodyweight: '#BBF7D0',
  duration: '#FDE68A',
  weighted_bodyweight: '#DDD6FE',
};


// Circular Progress Ring Component
const CircularProgress = ({
  size,
  strokeWidth,
  progress,
  color,
  trackColor = '#f0f0f0',
  children,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ width: size - strokeWidth * 2 - s(4), alignItems: 'center' }}>
        {children}
      </View>
    </View>
  );
};

// Self-contained timer component — manages its own interval to avoid re-rendering parent
const WorkoutTimerDisplay: React.FC<{
  startRef: React.MutableRefObject<number | null>;
  active: boolean;
  style?: any;
}> = React.memo(({ startRef, active, style }) => {
  const [time, setTime] = useState(() =>
    startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0
  );
  useEffect(() => {
    if (!active || !startRef.current) return;
    setTime(Math.floor((Date.now() - startRef.current) / 1000));
    const interval = setInterval(() => {
      setTime(Math.floor((Date.now() - startRef.current!) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);
  const mins = Math.floor(time / 60);
  const secs = time % 60;
  return <Text style={style}>{`${mins}:${secs.toString().padStart(2, '0')}`}</Text>;
});

// Rest Duration Picker
const REST_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300];
const formatRestOption = (sec: number) => sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;

const RestPicker = React.memo(({
  initialDuration,
  onSelect,
  onClose,
}: {
  initialDuration: number;
  onSelect: (sec: number) => void;
  onClose: () => void;
}) => {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(() =>
    REST_OPTIONS.includes(initialDuration) ? initialDuration : 60
  );

  return (
    <View style={{ width: '100%' }}>
      <Text style={{ fontSize: s(15), fontFamily: 'Inter_700Bold', color: colors.text, textAlign: 'center', marginBottom: s(14) }}>Rest Duration</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
        {REST_OPTIONS.map((sec) => {
          const active = sec === selected;
          return (
            <TouchableOpacity
              key={sec}
              onPress={() => { setSelected(sec); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.7}
              style={{
                width: '22%', flexGrow: 1,
                paddingVertical: s(11),
                borderRadius: s(10),
                backgroundColor: active ? colors.accent : `${colors.border}90`,
                alignItems: 'center',
              }}
            >
              <Text style={{
                fontSize: s(14), fontFamily: active ? 'Inter_700Bold' : 'Inter_600SemiBold',
                color: active ? '#fff' : colors.textSecondary,
                fontVariant: ['tabular-nums'],
              }}>
                {formatRestOption(sec)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={{ marginTop: s(16), paddingVertical: s(13), borderRadius: s(10), backgroundColor: colors.accent, alignItems: 'center' }}
        activeOpacity={0.7}
        onPress={() => { onSelect(selected); onClose(); }}
      >
        <Text style={{ fontSize: s(14), fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Save</Text>
      </TouchableOpacity>
    </View>
  );
});

// Set Row Component
const SetRow = React.memo(({
  exercise,
  set,
  index,
  exerciseType,
  onComplete,
  onFocus,
  updateSet,
  onCycleType,
  onAddDrop,
  onUpdateDrop,
  onRemoveDrop,
  onDelete,
}: {
  exercise: Exercise;
  set: Set;
  index: number;
  exerciseType: ExerciseType;
  onComplete: () => void;
  onFocus: () => void;
  updateSet: (field: 'kg' | 'reps', value: string) => void;
  onCycleType?: () => void;
  onAddDrop?: () => void;
  onUpdateDrop?: (dropIndex: number, field: 'kg' | 'reps', value: string) => void;
  onRemoveDrop?: (dropIndex: number) => void;
  onDelete?: () => void;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dropsExpanded, setDropsExpanded] = useState(true);

  const showKg = exerciseType === 'weighted' || exerciseType === 'weighted_bodyweight';
  const showDrops = showKg; // only weighted types support drop sets

  const typeColors = {
    working: { bg: 'rgba(234, 179, 8, 0.15)', text: '#EAB308', solid: '#EAB308', pastel: '#FDE68A' },
    warmup: { bg: 'rgba(255, 255, 255, 0.15)', text: '#999', solid: '#999', pastel: '#FFFFFF' },
    drop: { bg: 'rgba(255, 87, 51, 0.15)', text: '#FF5733', solid: '#FF5733', pastel: '#FFB3A1' },
    failure: { bg: 'rgba(159, 18, 57, 0.15)', text: '#9F1239', solid: '#9F1239', pastel: '#E8879E' },
  };
  const tc = typeColors[set.type];
  const typeLabel = set.type === 'warmup' ? 'W' : set.type === 'drop' ? 'D' : set.type === 'failure' ? 'F' : String(index + 1);
  const allTypes: SetType[] = ['working', 'warmup', 'drop', 'failure'];
  const activeIdx = allTypes.indexOf(set.type);
  // Order: active type on top (biggest), then next types getting smaller & more transparent
  const stacked = allTypes
    .map((t, i) => ({ type: t, color: typeColors[t].pastel, distFromActive: (i - activeIdx + 4) % 4 }))
    .sort((a, b) => b.distFromActive - a.distFromActive); // furthest first (drawn behind)
  const prevTypeRef = useRef(set.type);
  useEffect(() => {
    if (prevTypeRef.current !== set.type) {
      LayoutAnimation.configureNext(LayoutAnimation.create(250, 'easeInEaseOut', 'scaleXY'));
      prevTypeRef.current = set.type;
    }
  }, [set.type]);

  // Format prev display based on exercise type
  const prevDisplay = (() => {
    if (!exercise.prevKg && !exercise.prevReps) return '—';
    switch (exerciseType) {
      case 'bodyweight': return `${exercise.prevReps}`;
      case 'duration': return `${exercise.prevReps}s`;
      case 'weighted_bodyweight': return exercise.prevKg ? `+${exercise.prevKg}×${exercise.prevReps}` : `${exercise.prevReps}`;
      default: return `${exercise.prevKg}×${exercise.prevReps}`;
    }
  })();

  return (
    <View>
      <View style={[styles.setRow, set.completed && styles.setRowCompleted]}>
        <TouchableOpacity
          onPress={onCycleType}
          onLongPress={() => {
            if (onDelete) {
              Alert.alert('Delete Set', `Remove set ${index + 1}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
              ]);
            }
          }}
          style={{ alignItems: 'center' }}
          activeOpacity={0.6}
        >
          <View style={{ width: s(30), height: s(22), justifyContent: 'center', alignItems: 'center' }}>
            {!set.completed && stacked.map((item) => {
              const d = item.distFromActive;
              if (d === 0) return null;
              const size = d === 1 ? s(18) : d === 2 ? s(14) : s(10);
              const opacity = d === 1 ? 0.5 : d === 2 ? 0.3 : 0.15;
              const offset = d === 1 ? s(-6) : d === 2 ? s(-12) : s(-17);
              return (
                <View key={item.type} style={{ position: 'absolute', left: offset, width: size, height: size, borderRadius: size / 2, backgroundColor: item.color, opacity, zIndex: 0 }} />
              );
            })}
            <View style={[styles.setNumberCell, { backgroundColor: set.completed ? 'rgba(74, 222, 128, 0.15)' : tc.pastel, zIndex: 10, elevation: 10 }]}>
              <Text style={[styles.setNumberText, { color: '#000' }, set.completed && styles.setNumberTextCompleted]}>{typeLabel}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.prevCell}>
          <Text style={styles.prevText}>{prevDisplay}</Text>
        </View>

        {showKg && (
          <TextInput
            style={[styles.compactInput, set.completed && styles.compactInputCompleted]}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={set.kg}
            onChangeText={(value) => updateSet('kg', value)}
            onFocus={onFocus}
            editable={!set.completed}
          />
        )}

        <TextInput
          style={[styles.compactInput, set.completed && styles.compactInputCompleted]}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
          value={set.reps}
          onChangeText={(value) => updateSet('reps', value)}
          onFocus={onFocus}
          editable={!set.completed}
        />

        <TouchableOpacity
            style={[styles.checkButton, set.completed && styles.checkButtonActive]}
            onPress={() => { onFocus(); onComplete(); }}
          >
            <Ionicons
              name={set.completed ? 'checkmark' : 'ellipse-outline'}
              size={s(set.completed ? 14 : 10)}
              color={set.completed ? '#fff' : colors.border}
            />
          </TouchableOpacity>
      </View>

    </View>
  );
});

SplashScreen.preventAutoHideAsync();

// Set Inter as the default font for ALL Text and TextInput components
function setDefaultFonts() {
  const originalTextRender = (Text as any).render;
  if (originalTextRender) {
    (Text as any).render = function(props: any, ref: any) {
      return originalTextRender.call(this, {
        ...props,
        style: [{ fontFamily: 'Inter_400Regular' }, props.style],
      }, ref);
    };
  }

  const originalTextInputRender = (TextInput as any).render;
  if (originalTextInputRender) {
    (TextInput as any).render = function(props: any, ref: any) {
      return originalTextInputRender.call(this, {
        ...props,
        style: [{ fontFamily: 'Inter_400Regular' }, props.style],
      }, ref);
    };
  }
}

let defaultFontsSet = false;

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  if (!defaultFontsSet) {
    setDefaultFonts();
    defaultFontsSet = true;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <AppContent />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function UsernameSetupScreen({ colors, insets, onComplete }: { colors: Colors; insets: any; onComplete: (name: string) => void }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', trimmed)
        .limit(1);
      if (existing && existing.length > 0) {
        setSaving(false);
        Alert.alert('Error', 'Username is already taken');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error: updateError } = await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id);
      if (updateError) throw updateError;
      onComplete(trimmed);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: s(32), paddingTop: insets.top }}>
      <Text style={{ fontSize: s(24), fontFamily: 'Inter_700Bold', color: colors.text, marginBottom: s(8) }}>Choose a Username</Text>
      <Text style={{ fontSize: s(14), color: colors.textMuted, marginBottom: s(24), textAlign: 'center' }}>This is how friends will find and see you.</Text>
      <TextInput
        style={{ width: '100%', backgroundColor: colors.card, color: colors.text, borderRadius: s(10), padding: s(14), fontSize: s(16), fontFamily: 'Inter_500Medium', borderWidth: 1, borderColor: colors.border }}
        placeholder="Username"
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoFocus
        maxLength={20}
      />
      <TouchableOpacity
        onPress={handleSave}
        disabled={saving || value.trim().length < 3}
        style={{ marginTop: s(16), backgroundColor: value.trim().length >= 3 ? '#38BDF8' : colors.border, borderRadius: s(10), paddingVertical: s(14), width: '100%', alignItems: 'center' }}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: s(16), fontFamily: 'Inter_600SemiBold' }}>Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const { colors, isDark, mode, setMode, toggle, themeId, setThemeId, presets } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sortedPresets = useMemo(() => {
    const order = ['cherry', 'sunset', 'gold', 'forest', 'ocean', 'default', 'midnight', 'lavender', 'rose'];
    return order.map(id => presets.find(p => p.id === id)).filter((p): p is typeof presets[0] => !!p);
  }, [presets]);
  const selectedColorIdx = sortedPresets.findIndex(p => p.id === themeId);

  // Authentication state
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  const [activeTab, setActiveTab] = useState<'home' | 'workout' | 'friends' | 'profile' | 'food'>('home');
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  // Plus Menu PanResponder
  const plusMenuPanY = useRef(new Animated.Value(0)).current;
  const plusMenuPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          plusMenuPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) {
          Animated.timing(plusMenuPanY, {
            toValue: Dimensions.get('window').height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowPlusMenu(false);
            plusMenuPanY.setValue(0);
          });
        } else {
          Animated.spring(plusMenuPanY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (showPlusMenu) {
      plusMenuPanY.setValue(0);
    }
  }, [showPlusMenu]);
  const [startedFromRoutine, setStartedFromRoutine] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [hasActiveWorkout, setHasActiveWorkout] = useState(false);
  const hasActiveWorkoutRef = useRef(false);
  useEffect(() => { hasActiveWorkoutRef.current = hasActiveWorkout; }, [hasActiveWorkout]);

  // Live Workout Buddy state
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const pendingLiveReconnectRef = useRef<string | null>(null);
  const [showReconnectBanner, setShowReconnectBanner] = useState(false);
  const [liveInviteModalVisible, setLiveInviteModalVisible] = useState(false);
  const [liveInviteReceivedVisible, setLiveInviteReceivedVisible] = useState(false);
  const [pendingLiveInvite, setPendingLiveInvite] = useState<{
    sessionId: string;
    hostName: string;
    routineName?: string | null;
    routineExercises?: { name: string; sets: number }[] | null;
    syncMode?: string | null;
  } | null>(null);
  const [liveParticipantStates, setLiveParticipantStates] = useState<Map<string, LiveUserState>>(new Map());
  const [liveConnectionStatus, setLiveConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [liveReaction, setLiveReaction] = useState<LiveReaction | null>(null);
  const [buddySyncState, setBuddySyncState] = useState<BuddySyncState | null>(null);
  const [liveSessionSummary, setLiveSessionSummary] = useState<LiveSessionSummary | null>(null);
  const [waitingForAllFinish, setWaitingForAllFinish] = useState(false);
  const [participantFinished, setParticipantFinished] = useState<Map<string, boolean>>(new Map());
  const [participantWaiting, setParticipantWaiting] = useState<Map<string, boolean>>(new Map());
  const [invitedFriends, setInvitedFriends] = useState<{ userId: string; name: string; status: 'pending' | 'joined' | 'declined' }[]>([]);
  const waitingForAllFinishRef = useRef(false);
  const liveSessionIdRef = useRef<string | null>(null);
  const pendingWorkoutSummaryRef = useRef<any>(null);
  const [showMiniBuddyBanner, setShowMiniBuddyBanner] = useState(false);
  const showMiniBuddyRef = useRef(false);
  const buddyBannerHeightRef = useRef(0);
  const workoutScrollRef = useRef<ScrollView>(null);
  const [joinByCodeModalVisible, setJoinByCodeModalVisible] = useState(false);
  const [joinRequestModal, setJoinRequestModal] = useState<{ visible: boolean; senderName: string; senderId: string; notifId: string; loading: boolean }>({ visible: false, senderName: '', senderId: '', notifId: '', loading: false });
  const [isSessionLeader, setIsSessionLeader] = useState(false);
  const [sessionLeaderId, setSessionLeaderId] = useState<string | null>(null);
  // Keep refs in sync for use in non-reactive callbacks
  waitingForAllFinishRef.current = waitingForAllFinish;
  liveSessionIdRef.current = liveSessionId;

  // Workout Session State
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);

  const workoutTimeRef = useRef(0);
  const workoutStartRef = useRef<number | null>(null);
  const workoutRestoredRef = useRef(false);
  const [restTime, setRestTime] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const restStartRef = useRef<{ startedAt: number; duration: number } | null>(null);
  const [restDuration, setRestDuration] = useState(180); // default 3min countdown
  const [showRestPresets, setShowRestPresets] = useState(false);
  const [exerciseSelectorVisible, setExerciseSelectorVisible] = useState(false);
  const [setTypesHintVisible, setSetTypesHintVisible] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseList, setExerciseList] = useState<ExerciseListItem[]>(
    FALLBACK_EXERCISES.map(name => ({ name, exerciseType: (EXERCISE_TYPE_DEFAULTS[name] || 'weighted') as ExerciseType, category: FALLBACK_CATEGORY_MAP[name] || 'Other' }))
  );
  const [addingExercise, setAddingExercise] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null);

  // Rest ring animations
  const restPillScale = useRef(new Animated.Value(0)).current;
  const restCountdownScale = useRef(new Animated.Value(1)).current;
  const restRingProgress = useRef(new Animated.Value(1)).current;
  const restBreathing = useRef(new Animated.Value(1)).current;
  const restRippleScale = useRef(new Animated.Value(0)).current;
  const restRippleOpacity = useRef(new Animated.Value(0)).current;
  const restCompletedGlow = useRef(new Animated.Value(0)).current;
  const restReadyFlash = useRef(new Animated.Value(0)).current; // red overlay opacity
  const restReadyFill = useRef(new Animated.Value(0)).current; // red fill width 0→1
  const restWhiteFlash = useRef(new Animated.Value(0)).current; // white flash opacity
  const restReadyText = useRef(new Animated.Value(0)).current; // GET READY text opacity
  const lastHapticSecond = useRef<number | null>(null);
  const halfwayPulsed = useRef(false);
  const readyFlashed = useRef(false);
  const [restCompleted, setRestCompleted] = useState(false);
  const breathingAnim = useRef<Animated.CompositeAnimation | null>(null);

  // Swipe down gesture
  const modalTranslateY = useRef(new Animated.Value(0)).current;

  // Calendar and workout summary
  const [workoutDays, setWorkoutDays] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<any | null>(null);
  const [selectedDayWorkouts, setSelectedDayWorkouts] = useState<any[]>([]);
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [isJustCompleted, setIsJustCompleted] = useState(false);
  const [workoutListModalVisible, setWorkoutListModalVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [workoutSavedCounter, setWorkoutSavedCounter] = useState(0);

  // Workout tab sub-view
  const [workoutSubView, setWorkoutSubView] = useState<'history' | 'start'>('history');
  // Profile tab sub-view
  const [profileSubView, setProfileSubView] = useState<'profile' | 'settings'>('profile');
  const [colorBarWidth, setColorBarWidth] = useState(0);
  const [workoutHistory, setWorkoutHistory] = useState<any[]>([]);
  const [workoutHistoryLoading, setWorkoutHistoryLoading] = useState(false);
  const [stats14Day, setStats14Day] = useState({
    totalVolume: 0,
    totalDuration: 0,
    totalWorkouts: 0,
    avgWorkoutLength: 0,
  });

  // Nutrition state
  const [todayNutrition, setTodayNutrition] = useState<DailyNutritionSummary>({
    totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, entryCount: 0,
  });
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals>({
    calorie_goal: 2000, protein_goal: 150, carbs_goal: 250, fat_goal: 65,
  });

  // Weight tracking state
  const [weightStats, setWeightStats] = useState<WeightStats>({
    current: null, trend: null, startingWeight: null, change: null, entries: [], trendLine: [],
  });
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showWeightHistoryModal, setShowWeightHistoryModal] = useState(false);
  const [chartPage, setChartPage] = useState(0);
  const [selectedExerciseForStats, setSelectedExerciseForStats] = useState<string | null>(null);
  const [selectedExerciseTypeForStats, setSelectedExerciseTypeForStats] = useState<ExerciseType>('weighted');
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  const [startingWeightInput, setStartingWeightInput] = useState('');

  // Supplement tracking state
  const [supplementSummary, setSupplementSummary] = useState<DailySupplementSummary>({
    totalWater: 0, totalCreatine: 0, waterEntries: [], creatineEntries: [],
  });
  const [supplementGoals, setSupplementGoals] = useState<SupplementGoals>({
    water_goal: 2500, creatine_goal: 5,
  });
  const [supplementRefreshKey, setSupplementRefreshKey] = useState(0);
  const [homeRefreshing, setHomeRefreshing] = useState(false);

  // Meal config state
  const [mealConfig, setMealConfig] = useState<MealSlotConfig[]>(DEFAULT_MEAL_SLOTS);

  // Streak state
  const [streaks, setStreaks] = useState({ gymCurrent: 0, gymBest: 0, gymAtRisk: false, nutritionCurrent: 0, nutritionBest: 0, nutritionAtRisk: false, combinedCurrent: 0, combinedBest: 0, combinedAtRisk: false });
  const [showNutritionStreak, setShowNutritionStreak] = useState(false);
  const [showCombinedStreak, setShowCombinedStreak] = useState(false);

  // Load streak visibility preferences
  useEffect(() => {
    AsyncStorage.getItem('streak_show_nutrition').then((val) => {
      if (val !== null) setShowNutritionStreak(val === 'true');
    });
    AsyncStorage.getItem('streak_show_combined').then((val) => {
      if (val !== null) setShowCombinedStreak(val === 'true');
    });
  }, []);

  // Check authentication status (session persisted via AsyncStorage)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user profile (for username display)
  useEffect(() => {
    if (session?.user?.id) {
      getMyProfile().then(result => {
        if (result.success && result.data) setMyProfile(result.data);
      });
    } else {
      setMyProfile(null);
    }
  }, [session?.user?.id]);

  // Live presence tracking
  useEffect(() => {
    if (session?.user?.id) {
      initPresence(session.user.id);
    } else {
      cleanupPresence();
    }
    return () => { cleanupPresence(); };
  }, [session?.user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && session?.user?.id) {
        initPresence(session.user.id);
        // Re-register push token — it may have changed while backgrounded
        registerPushToken(session.user.id);
        // Reconnect live session channel if one is active
        if (liveSessionIdRef.current) {
          joinSessionChannel(liveSessionIdRef.current);
        } else {
          // Check for pending live invites received while offline/backgrounded
          checkPendingLiveInvites();
        }
        // Refresh nutrition + supplements for the current day
        // Handles day rollover (app left open overnight) and syncing changes from food diary
        loadTodayNutrition();
        loadSupplementData();
      }
      // Don't cleanup on background — let the WebSocket disconnect naturally
      // so Supabase server-side timeout handles removal (~30s).
      // This prevents the offline flicker when switching apps briefly.
    });
    return () => sub.remove();
  }, [session?.user?.id]);

  // Broadcast workout status to presence
  useEffect(() => {
    updatePresence({ working_out: hasActiveWorkout, live_session: liveSessionId || undefined });
    if (!liveSessionId) setInvitedFriends([]);
  }, [hasActiveWorkout, liveSessionId]);

  // Live session subscriptions
  useEffect(() => {
    const unsub1 = subscribeToLiveState((_my, participants) => {
      setLiveParticipantStates(new Map(participants));
      // Mark invited friends as joined when they appear in participants
      const joinedIds = new Set(participants.keys());
      setInvitedFriends(prev => {
        const changed = prev.some(f => f.status === 'pending' && joinedIds.has(f.userId));
        if (!changed) return prev;
        return prev.map(f => joinedIds.has(f.userId) ? { ...f, status: 'joined' } : f);
      });
    });
    const unsub2 = subscribeToReactions((reaction) => {
      // Only show reactions targeted at us, or untargeted (broadcast to all)
      if (reaction.targetUserId && reaction.targetUserId !== getCurrentUserId()) return;
      setLiveReaction(reaction);
      setTimeout(() => setLiveReaction(null), 2000);
    });
    const unsub3 = subscribeToConnectionStatus((status) => {
      setLiveConnectionStatus(status);
    });
    const unsub4 = subscribeToBuddySync((state) => {
      setBuddySyncState(state);
    });
    const unsub5 = subscribeToSessionEvents((event, userId) => {
      // Helper: check if all remaining participants have finished or left
      const checkAllDone = () => {
        const states = getParticipantStates();
        const finished = getParticipantFinished();
        // If no participants left at all, everyone is gone
        if (states.size === 0) return true;
        // Check if every remaining participant is marked finished
        for (const [uid] of states) {
          if (!finished.get(uid)) return false;
        }
        return true;
      };

      const completeSession = () => {
        const pendingSummary = pendingWorkoutSummaryRef.current;
        const pendingSessionId = liveSessionIdRef.current;
        setWaitingForAllFinish(false);
        waitingForAllFinishRef.current = false;
        pendingWorkoutSummaryRef.current = null;
        setParticipantFinished(new Map());
        setParticipantWaiting(new Map());
        cleanupBuddySync();
        forceEndLiveSession();
        if (pendingSessionId) {
          getSessionSummary(pendingSessionId).then(summary => {
            setLiveSessionSummary(summary);
          });
        }
        setLiveSessionId(null);
        setExercises([]);
        setIsResting(false);
        setRestTime(0);
        setHasActiveWorkout(false);
        setStartedFromRoutine(false);
        setModalVisible(false);
        if (pendingSummary) {
          setSelectedWorkout(pendingSummary);
          setIsJustCompleted(true);
          setSummaryModalVisible(true);
        }
      };

      if (event === 'participant_finished') {
        if (waitingForAllFinishRef.current) {
          // Only auto-complete if ALL remaining participants are now done
          if (checkAllDone()) {
            completeSession();
          } else {
            // Update finished/waiting maps but keep waiting
            if (userId) {
              setParticipantFinished(prev => new Map(prev).set(userId, true));
              setParticipantWaiting(prev => new Map(prev).set(userId, true));
            }
          }
        } else {
          // Participant finished while we're still working out — update Maps
          if (userId) {
            setParticipantFinished(prev => new Map(prev).set(userId, true));
            setParticipantWaiting(prev => new Map(prev).set(userId, true));
          }
        }
      }
      if (event === 'participant_left') {
        if (waitingForAllFinishRef.current) {
          // Participant left — check if all REMAINING participants are done
          // (liveSessionManager already removed this user from participantStates)
          if (checkAllDone()) {
            completeSession();
          }
          // Otherwise keep waiting — other participants are still active
        } else {
          // Participant left while we're still working out
          if (userId) {
            const wasFinished = getParticipantFinished().get(userId);
            if (wasFinished) {
              // They finished but left early — keep card visible as "done" (not "waiting")
              setParticipantWaiting(prev => {
                const next = new Map(prev);
                next.delete(userId);
                return next;
              });
            } else {
              // Left without finishing — remove entirely
              setParticipantWaiting(prev => {
                const next = new Map(prev);
                next.delete(userId);
                return next;
              });
              setParticipantFinished(prev => {
                const next = new Map(prev);
                next.delete(userId);
                return next;
              });
            }
          }
        }
      }
      if (event === 'leader_changed') {
        setIsSessionLeader(isCurrentUserLeader());
        const sess = getCurrentSession();
        setSessionLeaderId(sess?.leaderId || null);
      }
      if (event === 'kicked') {
        // We were kicked from the session — clear dedup so we can be re-invited
        const kickedSessionId = liveSessionIdRef.current;
        if (kickedSessionId) {
          shownSessionInviteIds.current.delete(kickedSessionId);
        }
        Alert.alert('Removed', 'You\'ve been removed from the live session.');
        cleanupBuddySync();
        setParticipantFinished(new Map());
        setParticipantWaiting(new Map());
        setLiveSessionId(null);
        liveSessionIdRef.current = null; // immediately clear so new invites aren't blocked
        setIsSessionLeader(false);
        setSessionLeaderId(null);
      }
      if (event === 'participant_kicked') {
        // Someone else was kicked — remove from our maps
        if (userId) {
          setParticipantWaiting(prev => { const n = new Map(prev); n.delete(userId); return n; });
          setParticipantFinished(prev => { const n = new Map(prev); n.delete(userId); return n; });
        }
      }
    });
    const unsub6 = subscribeToSessionInfo((sess) => {
      setIsSessionLeader(isCurrentUserLeader());
      setSessionLeaderId(sess?.leaderId || null);
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); };
  }, []);

  // Initialize phone notifications
  useEffect(() => {
    if (session?.user?.id) {
      initNotifications().then((granted) => {
        if (granted) registerPushToken(session.user.id);
      });

      // Check for pending live invites received while offline
      checkPendingLiveInvites();

      // Handle notification taps
      const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        if (data?.notifType === 'live_invite' && data?.session_id && data?.host_name) {
          getLiveSession(data.session_id as string).then((sessResult) => {
            const sData = sessResult.success ? sessResult.data : null;
            shownSessionInviteIds.current.add(data.session_id as string);
            setPendingLiveInvite({
              sessionId: data.session_id as string,
              hostName: data.host_name as string,
              routineName: sData?.routine_name || null,
              routineExercises: sData?.routine_data?.map((e: any) => ({ name: e.name, sets: e.sets })) || null,
              syncMode: sData?.sync_mode || null,
            });
            setLiveInviteReceivedVisible(true);
          });
        } else if (data?.type === 'social') {
          setActiveTab('friends');
          setProfileSubView('profile');
        }
      });

      return () => subscription.remove();
    }
  }, [session?.user?.id]);

  // Workout timer (timestamp-based so it survives background) — ref only, no state re-renders
  useEffect(() => {
    if (hasActiveWorkout) {
      if (!workoutStartRef.current) {
        workoutStartRef.current = Date.now();
      }
      workoutTimeRef.current = Math.floor((Date.now() - workoutStartRef.current) / 1000);
      const interval = setInterval(() => {
        workoutTimeRef.current = Math.floor((Date.now() - workoutStartRef.current!) / 1000);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [hasActiveWorkout]);

  // Persist active workout to AsyncStorage so it survives app kill
  const WORKOUT_STORAGE_KEY = 'active_workout';
  useEffect(() => {
    // Don't clear storage until restore has had a chance to run
    if (!workoutRestoredRef.current) {
      return;
    }
    if (hasActiveWorkout && exercises.length > 0) {
      const payload = {
        exercises,
        startTimestamp: workoutStartRef.current,
        restDuration,
        startedFromRoutine,
        liveSessionId: liveSessionId || pendingLiveReconnectRef.current || null,
      };
      AsyncStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(payload));
    } else if (!hasActiveWorkout) {
      AsyncStorage.removeItem(WORKOUT_STORAGE_KEY);
    }
  }, [hasActiveWorkout, exercises, restDuration, startedFromRoutine, liveSessionId]);

  // Push workout state to live session channel (on meaningful changes only)
  useEffect(() => {
    if (!liveSessionId || !hasActiveWorkout) return;
    const focusedEx = focusedExerciseId ? exercises.find(e => e.id === focusedExerciseId) : exercises[0];
    const nextSetIdx = focusedEx ? focusedEx.sets.findIndex(s => !s.completed) : -1;
    const currentSetIdx = nextSetIdx >= 0 ? nextSetIdx + 1 : (focusedEx?.sets.length || 0);
    const totalVolume = exercises.reduce((vol, ex) => {
      if (ex.exerciseType === 'bodyweight' || ex.exerciseType === 'duration') return vol;
      return vol + ex.sets.reduce((sv, set) => sv + (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0), 0);
    }, 0);
    const setsCompleted = exercises.reduce((sum, ex) => sum + ex.sets.filter(set => set.completed).length, 0);
    const completedSetsInExercise = focusedEx ? focusedEx.sets.filter(s => s.completed).length : 0;
    const exerciseSummary = exercises.map(ex => ({
      name: ex.name,
      completedSets: ex.sets.filter(s => s.completed).length,
      totalSets: ex.sets.length,
      sets: ex.sets.map(s => ({
        kg: parseFloat(s.kg) || 0,
        reps: parseInt(s.reps) || 0,
        completed: !!s.completed,
      })),
    }));

    // Current set details (the set being attempted)
    const currentSet = focusedEx && nextSetIdx >= 0 ? focusedEx.sets[nextSetIdx] : null;
    const currentSetWeight = currentSet ? (parseFloat(currentSet.kg) || 0) : 0;
    const currentSetReps = currentSet ? (parseInt(currentSet.reps) || 0) : 0;

    // Last completed set (most recent across all exercises)
    let lastSetWeight = 0;
    let lastSetReps = 0;
    for (let i = exercises.length - 1; i >= 0; i--) {
      const completedSets = exercises[i].sets.filter(s => s.completed);
      if (completedSets.length > 0) {
        const last = completedSets[completedSets.length - 1];
        lastSetWeight = parseFloat(last.kg) || 0;
        lastSetReps = parseInt(last.reps) || 0;
        break;
      }
    }

    updateMyLiveState({
      username: myProfile?.username || session?.user?.email || '',
      status: isResting ? 'resting' : 'lifting',
      currentExercise: focusedEx?.name || null,
      currentSetIndex: currentSetIdx,
      totalSetsInExercise: focusedEx?.sets.length || 0,
      currentSetWeight,
      currentSetReps,
      lastSetWeight,
      lastSetReps,
      restTimeRemaining: isResting ? restDuration : undefined,
      totalVolume,
      setsCompleted,
      completedSetsInExercise,
      exerciseCount: exercises.length,
      exerciseSummary,
      workoutDuration: workoutTimeRef.current,
    });
  }, [exercises, isResting, focusedExerciseId, liveSessionId, hasActiveWorkout, myProfile?.username]);

  // Restore active workout on mount
  useEffect(() => {
    AsyncStorage.getItem(WORKOUT_STORAGE_KEY).then((raw) => {
      if (!raw) {
        workoutRestoredRef.current = true;
        return;
      }
      try {
        const saved = JSON.parse(raw);
        if (saved.exercises?.length > 0 && saved.startTimestamp) {
          // Back-fill category for exercises saved before category was added
          const restoredExercises = saved.exercises.map((ex: Exercise) => ({
            ...ex,
            category: ex.category || FALLBACK_CATEGORY_MAP[ex.name] || undefined,
          }));
          setExercises(restoredExercises);
          workoutStartRef.current = saved.startTimestamp;
          workoutTimeRef.current = Math.floor((Date.now() - saved.startTimestamp) / 1000);
          setHasActiveWorkout(true);
          if (saved.restDuration) setRestDuration(saved.restDuration);
          if (saved.startedFromRoutine) setStartedFromRoutine(true);
          // Flag live session for reconnect once auth is ready
          if (saved.liveSessionId) {
            pendingLiveReconnectRef.current = saved.liveSessionId;
            setShowReconnectBanner(true);
          }
        }
      } catch {}
      workoutRestoredRef.current = true;
    });
  }, []);

  // Reconnect to live session once auth is ready
  const handleLiveReconnect = useCallback(async () => {
    const sid = pendingLiveReconnectRef.current;
    if (!sid || !session) return;
    setShowReconnectBanner(false);
    try {
      const sessionInfo = await reconnectToSession(sid);
      if (sessionInfo) {
        pendingLiveReconnectRef.current = null;
        setLiveSessionId(sid);
        if (sessionInfo.routineData) {
          const syncExercises = sessionInfo.routineData.exercises.map((e: any) => ({
            name: e.name,
            sets: e.sets,
          }));
          const isHost = sessionInfo.hostId === session.user.id;
          const syncFn = isHost ? initBuddySync : joinBuddySync;
          syncFn(syncExercises, sessionInfo.routineData.syncMode, {
            onStartSyncedRest: (duration) => startRestAnimation(duration),
            onAdvanceExercise: (idx) => {
              if (exercises[idx]) setFocusedExerciseId(exercises[idx].id);
            },
            onSyncStateChanged: () => {},
          });
        }
      } else {
        // Session ended or cancelled while we were away
        pendingLiveReconnectRef.current = null;
        Alert.alert('Session Ended', 'The live workout session is no longer active.');
      }
    } catch (e) {
      // Keep ref so user can retry — show banner again
      setShowReconnectBanner(true);
      console.warn('Failed to reconnect live session:', e);
      Alert.alert('Reconnect Failed', 'Could not reconnect to the live session.');
    }
  }, [session, exercises]);

  const dismissLiveReconnect = useCallback(() => {
    pendingLiveReconnectRef.current = null;
    setShowReconnectBanner(false);
  }, []);

  // Breathing animation for rest ring
  useEffect(() => {
    if (isResting) {
      restBreathing.setValue(1);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(restBreathing, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
          Animated.timing(restBreathing, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      );
      breathingAnim.current = loop;
      loop.start();
      return () => { loop.stop(); breathingAnim.current = null; };
    } else {
      restBreathing.setValue(1);
    }
  }, [isResting]);

  // Rest timer (timestamp-based, smooth progress updates)
  useEffect(() => {
    if (isResting) {
      if (!restStartRef.current) {
        restStartRef.current = { startedAt: Date.now(), duration: restTime };
      }
      lastHapticSecond.current = null;
      halfwayPulsed.current = false;
      readyFlashed.current = false;
      restReadyFlash.setValue(0);
      restReadyFill.setValue(0);
      restWhiteFlash.setValue(0);
      restReadyText.setValue(0);
      restCountdownScale.setValue(1);
      setRestCompleted(false);
      scheduleRestTimerNotification(restStartRef.current.duration);

      // Smooth progress update at 60fps-ish
      const smoothInterval = setInterval(() => {
        if (!restStartRef.current) return;
        const elapsedMs = Date.now() - restStartRef.current.startedAt;
        const totalMs = restStartRef.current.duration * 1000;
        const progress = Math.max(0, 1 - elapsedMs / totalMs);
        restRingProgress.setValue(progress);
      }, 16);

      // Second-tick interval for haptics, state, text
      const interval = setInterval(() => {
        if (!restStartRef.current) return;
        const elapsed = Math.floor((Date.now() - restStartRef.current.startedAt) / 1000);
        const remaining = restStartRef.current.duration - elapsed;
        const totalDuration = restStartRef.current.duration;

        if (remaining <= 0) {
          // End-state: heavy haptic, completion animation
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          restRingProgress.setValue(0);
          // Stop breathing
          if (breathingAnim.current) breathingAnim.current.stop();
          restBreathing.setValue(1);
          // Completion glow
          restCompletedGlow.setValue(1);
          Animated.timing(restCompletedGlow, { toValue: 0, duration: 600, useNativeDriver: true }).start();
          // Completion ripple
          restRippleScale.setValue(0.8);
          restRippleOpacity.setValue(0.4);
          Animated.parallel([
            Animated.timing(restRippleScale, { toValue: 1.8, duration: 300, useNativeDriver: true }),
            Animated.timing(restRippleOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]).start();
          restStartRef.current = null;
          lastHapticSecond.current = null;
          cancelRestTimerNotification();
          // Smooth "GO!" entrance
          restCountdownScale.setValue(1.5);
          Animated.spring(restCountdownScale, {
            toValue: 1, friction: 5, tension: 180, useNativeDriver: true,
          }).start();
          restPillScale.setValue(0.92);
          Animated.spring(restPillScale, {
            toValue: 1, friction: 6, tension: 200, useNativeDriver: true,
          }).start();
          setRestCompleted(true);
          setRestTime(0);
          // Auto-dismiss after brief pause
          setTimeout(() => {
            setIsResting(false);
            setRestCompleted(false);
          }, 1500);
        } else {
          setRestTime(remaining);

          // Flash sequence at 10 seconds: white flash → red fill → GET READY → fade out
          if (remaining === 10 && !readyFlashed.current) {
            readyFlashed.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            restReadyFill.setValue(0);
            restReadyFlash.setValue(0);
            restReadyText.setValue(0);
            restWhiteFlash.setValue(1);
            Animated.sequence([
              // Phase 1: white flash in and out
              Animated.timing(restWhiteFlash, { toValue: 0, duration: 300, useNativeDriver: false }),
              // Phase 2: red fills across
              Animated.parallel([
                Animated.timing(restReadyFlash, { toValue: 1, duration: 100, useNativeDriver: false }),
                Animated.timing(restReadyFill, { toValue: 1, duration: 400, useNativeDriver: false }),
              ]),
              // Phase 3: GET READY text appears
              Animated.timing(restReadyText, { toValue: 1, duration: 200, useNativeDriver: false }),
              // Phase 4: hold
              Animated.delay(500),
              // Phase 5: fade everything out
              Animated.parallel([
                Animated.timing(restReadyFlash, { toValue: 0, duration: 500, useNativeDriver: false }),
                Animated.timing(restReadyText, { toValue: 0, duration: 500, useNativeDriver: false }),
              ]),
            ]).start();
          }

          // Halfway pulse (single soft pulse at ~50%)
          const halfwayPoint = Math.round(totalDuration / 2);
          if (remaining === halfwayPoint && !halfwayPulsed.current) {
            halfwayPulsed.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            restCountdownScale.setValue(1.06);
            Animated.spring(restCountdownScale, {
              toValue: 1, friction: 6, tension: 200, useNativeDriver: true,
            }).start();
          }

          // Last 10 seconds: pulse every second, intensifying as it gets closer to 0
          if (remaining <= 10 && remaining > 0 && lastHapticSecond.current !== remaining) {
            lastHapticSecond.current = remaining;
            const intensity = 11 - remaining; // 1..10
            Haptics.impactAsync(intensity >= 8 ? Haptics.ImpactFeedbackStyle.Heavy : intensity >= 4 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
            const pulseScale = 1 + intensity * 0.04; // 1.04 → 1.40
            restCountdownScale.setValue(pulseScale);
            Animated.spring(restCountdownScale, {
              toValue: 1, friction: 4, tension: 250, useNativeDriver: true,
            }).start();
          }
        }
      }, 1000);
      return () => { clearInterval(interval); clearInterval(smoothInterval); };
    } else {
      restStartRef.current = null;
      cancelRestTimerNotification();
    }
  }, [isResting]);

  // Load workouts for current month
  useEffect(() => {
    if (session) {
      loadWorkoutsForMonth();
    }
  }, [currentMonth, session]);

  // Load 14-day stats
  useEffect(() => {
    if (session) {
      load14DayStats();
    }
  }, [session]);

  // Load exercise list from DB
  const loadExerciseList = async () => {
    const list = await getExerciseList();
    setExerciseList(list);
  };

  useEffect(() => {
    if (session) {
      loadExerciseList();
    }
  }, [session]);

  // Load streaks whenever home tab is active
  useEffect(() => {
    if (session && activeTab === 'home') {
      loadStreaks();
    }
  }, [session, activeTab]);

  const loadStreaks = async () => {
    const [gym, nutrition, combined] = await Promise.all([getGymStreak(), getNutritionStreak(), getCombinedStreak()]);
    setStreaks({ gymCurrent: gym.current, gymBest: gym.best, gymAtRisk: gym.atRisk, nutritionCurrent: nutrition.current, nutritionBest: nutrition.best, nutritionAtRisk: nutrition.atRisk, combinedCurrent: combined.current, combinedBest: combined.best, combinedAtRisk: combined.atRisk });
  };

  // Load today's nutrition + goals (backed by cache, instant unless data changed)
  useEffect(() => {
    if (session && activeTab === 'home') {
      loadTodayNutrition();
      getNutritionGoals().then(setNutritionGoals);
      getMealConfig().then(setMealConfig);
      loadWeightStats();
      loadSupplementData();
    }
  }, [session, activeTab]);

  const getLocalToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const loadTodayNutrition = async () => {
    const today = getLocalToday();
    const summary = await getDailyNutritionSummary(today);
    setTodayNutrition(summary);
  };

  const loadWeightStats = async () => {
    const stats = await getWeightStats();
    setWeightStats(stats);
    if (stats.startingWeight !== null) {
      setStartingWeightInput(String(stats.startingWeight));
    }
  };

  const onHomeRefresh = async () => {
    setHomeRefreshing(true);
    await Promise.all([
      loadTodayNutrition(),
      loadSupplementData(),
      loadWeightStats(),
      loadStreaks(),
    ]);
    setHomeRefreshing(false);
  };

  const loadSupplementData = async () => {
    const today = getLocalToday();
    const [summary, goals] = await Promise.all([
      getDailySupplementSummary(today),
      getSupplementGoals(),
    ]);
    setSupplementSummary(summary);
    setSupplementGoals(goals);
    setSupplementRefreshKey(prev => prev + 1);
  };

  const handleSaveWeight = async () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }
    const result = await saveWeightEntry(weight);
    if (result) {
      setShowWeightModal(false);
      setWeightInput('');
      loadWeightStats();
    } else {
      Alert.alert('Error', 'Failed to save weight. Please try again.');
    }
  };

  const handleSaveStartingWeight = async () => {
    const weight = parseFloat(startingWeightInput);
    if (isNaN(weight) || weight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid starting weight.');
      return;
    }
    const success = await saveStartingWeight(weight);
    if (success) {
      loadWeightStats();
    } else {
      Alert.alert('Error', 'Failed to save starting weight.');
    }
  };

  const handleDeleteWeightEntry = async (id: string) => {
    const success = await deleteWeightEntry(id);
    if (success) {
      loadWeightStats();
    } else {
      Alert.alert('Error', 'Failed to delete weight entry.');
    }
  };

  const handleAddSupplement = (type: 'water' | 'creatine', amount: number) => {
    // Optimistic UI update
    setSupplementSummary(prev => ({
      ...prev,
      totalWater: type === 'water' ? prev.totalWater + amount : prev.totalWater,
      totalCreatine: type === 'creatine' ? prev.totalCreatine + amount : prev.totalCreatine,
    }));
    // Persist in background
    saveSupplementEntry(type, amount).then(result => {
      if (result) {
        loadSupplementData();
        setSupplementRefreshKey(prev => prev + 1);
        const water = type === 'water' ? amount : 0;
        const creatine = type === 'creatine' ? amount : 0;
        updateSupplementLeaderboard(water, creatine).catch(() => {});
      } else {
        // Revert on failure
        loadSupplementData();
      }
    });
  };

  // Load workout history when tab changes or workout saved
  useEffect(() => {
    if (session && activeTab === 'workout' && workoutSubView === 'history') {
      loadWorkoutHistory();
    }
  }, [session, activeTab, workoutSubView, workoutSavedCounter]);

  const loadWorkoutHistory = async () => {
    if (workoutHistory.length === 0) setWorkoutHistoryLoading(true);
    const result = await getWorkouts(30);
    if (result.success && result.workouts) {
      setWorkoutHistory(result.workouts);
    }
    setWorkoutHistoryLoading(false);
  };

  // Detect which workouts contain PRs by scanning history oldest→newest
  const workoutPRMap = useMemo(() => {
    const prMap = new Map<string, string[]>(); // workoutId → exercise names with PRs
    if (workoutHistory.length === 0) return prMap;
    const bestWeight: Record<string, number> = {};
    const bestVolume: Record<string, number> = {};
    // Process oldest first
    const sorted = [...workoutHistory].reverse();
    for (const workout of sorted) {
      const prExercises: string[] = [];
      for (const ex of (workout.exercises || [])) {
        const completedSets = (ex.sets || []).filter((s: any) => s.completed);
        const maxKg = completedSets.reduce((max: number, s: any) => Math.max(max, Number(s.kg) || 0), 0);
        const maxSetVol = completedSets.reduce((max: number, s: any) => Math.max(max, (Number(s.kg) || 0) * (Number(s.reps) || 0)), 0);
        const name = ex.name;
        if (maxKg > 0 || maxSetVol > 0) {
          const isWeightPR = bestWeight[name] !== undefined && maxKg > bestWeight[name];
          const isVolumePR = bestVolume[name] !== undefined && maxSetVol > bestVolume[name];
          if (isWeightPR || isVolumePR) {
            prExercises.push(name);
          }
          bestWeight[name] = Math.max(bestWeight[name] || 0, maxKg);
          bestVolume[name] = Math.max(bestVolume[name] || 0, maxSetVol);
        }
      }
      if (prExercises.length > 0) prMap.set(workout.id, prExercises);
    }
    return prMap;
  }, [workoutHistory]);

  // Check for pending live session invites (handles offline scenario)
  const shownSessionInviteIds = useRef<Set<string>>(new Set());
  const checkPendingLiveInvites = async () => {
    if (liveSessionIdRef.current) return; // already in a session
    const result = await getPendingLiveInvites();
    if (!result.success || !result.session) return;
    const sess = result.session;
    if (shownSessionInviteIds.current.has(sess.id)) return;
    // Double-check status is still valid
    const fresh = await getLiveSession(sess.id);
    if (!fresh.success || !fresh.data) return;
    if (fresh.data.status !== 'pending' && fresh.data.status !== 'active') return;
    shownSessionInviteIds.current.add(sess.id);
    setPendingLiveInvite({
      sessionId: sess.id,
      hostName: result.hostName || 'Someone',
      routineName: fresh.data.routine_name || null,
      routineExercises: fresh.data.routine_data?.map((e: any) => ({ name: e.name, sets: e.sets })) || null,
      syncMode: fresh.data.sync_mode || null,
    });
    setLiveInviteReceivedVisible(true);
  };

  // Poll unread notification count every 30s + trigger phone notifications for new ones
  const lastSeenNotifRef = useRef<string | null>(null);
  const shownInviteNotifIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!session) return;

    const pollNotifications = async () => {
      const countResult = await getUnreadNotificationCount();
      if (countResult.success) {
        setUnreadNotifications(countResult.count);
      }

      // Fetch recent notifications and fire phone alerts for new ones
      if (myProfile?.notifications_enabled !== false) {
        const notifResult = await getNotifications(5);
        if (notifResult.success && notifResult.data && notifResult.data.length > 0) {
          const latestId = notifResult.data[0].id;
          if (lastSeenNotifRef.current && lastSeenNotifRef.current !== latestId) {
            // Show phone notifications for each new unread notification
            for (const notif of notifResult.data) {
              if (notif.id === lastSeenNotifRef.current) break;
              if (!notif.read) {
                // Handle live workout invite as an in-app modal (skip if already shown via realtime)
                if (notif.type === 'live_invite' && notif.data?.session_id && notif.data?.host_name && !shownInviteNotifIds.current.has(notif.id) && !shownSessionInviteIds.current.has(notif.data.session_id) && !liveSessionIdRef.current) {
                  shownInviteNotifIds.current.add(notif.id);
                  // Fetch session to get routine data
                  const sessResult = await getLiveSession(notif.data.session_id);
                  const sData = sessResult.success ? sessResult.data : null;
                  setPendingLiveInvite({
                    sessionId: notif.data.session_id,
                    hostName: notif.data.host_name,
                    routineName: sData?.routine_name || null,
                    routineExercises: sData?.routine_data?.map((e: any) => ({ name: e.name, sets: e.sets })) || null,
                    syncMode: sData?.sync_mode || null,
                  });
                  setLiveInviteReceivedVisible(true);
                }
                showSocialNotification(notif.title, notif.body || '', { notifType: notif.type });
              }
            }
          }
          lastSeenNotifRef.current = latestId;
        }
      }
    };

    pollNotifications();
    const interval = setInterval(pollNotifications, 30000);

    // Realtime subscription for instant live invites
    const realtimeChannel = supabase
      .channel('live-invite-listener')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`,
      }, (payload: any) => {
        const notif = payload.new;
        if (notif?.type === 'live_invite' && notif?.data?.session_id && notif?.data?.host_name
            && !shownInviteNotifIds.current.has(notif.id)
            && !shownSessionInviteIds.current.has(notif.data.session_id)
            && !liveSessionIdRef.current) {
          shownInviteNotifIds.current.add(notif.id);
          shownSessionInviteIds.current.add(notif.data.session_id);
          // Fetch session to get routine data
          getLiveSession(notif.data.session_id).then((sessResult) => {
            const sData = sessResult.success ? sessResult.data : null;
            setPendingLiveInvite({
              sessionId: notif.data.session_id,
              hostName: notif.data.host_name,
              routineName: sData?.routine_name || null,
              routineExercises: sData?.routine_data?.map((e: any) => ({ name: e.name, sets: e.sets })) || null,
              syncMode: sData?.sync_mode || null,
            });
            setLiveInviteReceivedVisible(true);
          });
        }
        // Handle join requests — show actionable alert if working out
        if (notif?.type === 'join_request' && notif?.data?.sender_id && notif?.data?.sender_name) {
          const senderName = notif.data.sender_name;
          const senderId = notif.data.sender_id;
          if (hasActiveWorkoutRef.current) {
            setJoinRequestModal({ visible: true, senderName, senderId, notifId: notif.id, loading: false });
          } else {
            showSocialNotification(notif.title, notif.body || '', { notifType: notif.type });
          }
        }
        // Handle accepted join request — auto-join the session
        if (notif?.type === 'live_accepted' && notif?.data?.accepted_join && notif?.data?.session_id) {
          const sid = notif.data.session_id;
          if (!liveSessionIdRef.current && !shownSessionInviteIds.current.has(sid)) {
            shownSessionInviteIds.current.add(sid);
            markNotificationRead(notif.id).catch(() => {});
            // Suppress the live_invite modal that createLiveSession also sends
            shownInviteNotifIds.current.add(notif.id);
            acceptLiveInvite(sid).then(async (accepted) => {
              if (accepted) {
                setLiveSessionId(sid);
                if (hasActiveWorkoutRef.current) {
                  // Already working out — keep current exercises, just attach to session
                  setModalVisible(true);
                } else {
                  const sessionResult = await getLiveSession(sid);
                  const sData = sessionResult.success ? sessionResult.data : null;
                  if (sData?.routine_data && sData?.sync_mode) {
                    const routineExercises = sData.routine_data.map((e: any) => ({
                      name: e.name,
                      sets: e.sets,
                    }));
                    await startWorkoutFromRoutine(routineExercises);
                    joinBuddySync(routineExercises, sData.sync_mode, {
                      onStartSyncedRest: (duration: number) => startRestAnimation(duration),
                      onAdvanceExercise: (idx: number) => {
                        if (exercises[idx]) setFocusedExerciseId(exercises[idx].id);
                      },
                      onSyncStateChanged: () => {},
                    });
                  } else {
                    setModalVisible(true);
                    setHasActiveWorkout(true);
                    workoutTimeRef.current = 0;
                    workoutStartRef.current = Date.now();
                    setExercises([]);
                    setStartedFromRoutine(false);
                  }
                }
              }
            }).catch(() => {});
          }
        }
        // Handle invite declined — mark invited friend as declined
        if (notif?.type === 'live_accepted' && notif?.data?.declined_by && notif?.data?.session_id) {
          const declinedUserId = notif.data.declined_by;
          setInvitedFriends(prev => prev.map(f =>
            f.userId === declinedUserId ? { ...f, status: 'declined' } : f
          ));
        }
        // Also bump unread count
        getUnreadNotificationCount().then(r => {
          if (r.success) setUnreadNotifications(r.count);
        });
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(realtimeChannel);
    };
  }, [session, myProfile?.notifications_enabled]);

  // Swipe down gesture handler
  const minimizeWorkoutRef = useRef(() => {});
  const swipeDownPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 8 && gestureState.dy > Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            modalTranslateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.5) {
            Animated.timing(modalTranslateY, {
              toValue: Dimensions.get('window').height,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              minimizeWorkoutRef.current();
              modalTranslateY.setValue(0);
            });
          } else {
            Animated.spring(modalTranslateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
      }),
    [modalTranslateY]
  );

  const load14DayStats = async () => {
    const result = await get14DayStats();
    if (result.success && result.stats) {
      setStats14Day(result.stats);
    } else {
      console.log('Error loading 14-day stats:', result.error);
    }
  };

  const loadWorkoutsForMonth = async () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    const result = await getWorkoutsForMonth(year, month);

    if (result.success && result.workouts) {
      // Group workouts by date
      const workoutsByDate: { [key: string]: any[] } = {};

      result.workouts.forEach((workout: any) => {
        const date = new Date(workout.created_at);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        if (!workoutsByDate[dateStr]) {
          workoutsByDate[dateStr] = [];
        }
        workoutsByDate[dateStr].push(workout);
      });

      // Create workout days data
      const workoutDaysData = Object.entries(workoutsByDate).map(([dateStr, workouts]) => {
        // Check if any workout has incomplete sets
        const hasIncomplete = workouts.some((workout: any) =>
          workout.exercises.some((ex: any) =>
            ex.sets.some((set: any) => !set.completed)
          )
        );

        return {
          date: dateStr,
          hasWorkout: true,
          workoutCount: workouts.length,
          isIncomplete: hasIncomplete,
          isPR: false, // Can implement PR detection logic later
        };
      });

      setWorkoutDays(workoutDaysData);
    }
  };

  const handleDayPress = async (date: string) => {
    setSelectedDate(date);
    const result = await getWorkoutsByDate(date);

    if (result.success && result.workouts && result.workouts.length > 0) {
      if (result.workouts.length > 1) {
        // Multiple workouts - show workout list modal
        const workoutList = result.workouts.map((workout: any) => ({
          id: workout.id,
          created_at: workout.created_at,
          duration: workout.duration,
          total_exercises: workout.total_exercises,
          total_sets: workout.total_sets,
        }));

        setSelectedDayWorkouts(workoutList);
        setWorkoutListModalVisible(true);
      } else {
        // Single workout - show summary modal directly
        const workout = result.workouts[0];
        const workoutSummary = {
          id: workout.id,
          date: date,
          duration: workout.duration,
          exercises: workout.exercises.map((ex: any) => ({
            name: ex.name,
            sets: ex.sets.map((set: any) => ({
              kg: set.kg,
              reps: set.reps,
              completed: set.completed,
            })),
            isPR: false, // Can implement PR detection later
          })),
        };

        setSelectedWorkout(workoutSummary);
        setSummaryModalVisible(true);
      }
    } else {
      Alert.alert('No Workout', 'No workout found for this day.');
    }
  };

  const handleSelectWorkout = async (workoutId: string) => {
    const result = await getWorkoutById(workoutId);

    if (result.success && result.workout) {
      const workoutSummary = {
        id: result.workout.id,
        date: selectedDate,
        duration: result.workout.duration,
        exercises: result.workout.exercises.map((ex: any) => ({
          name: ex.name,
          sets: ex.sets.map((set: any) => ({
            kg: set.kg,
            reps: set.reps,
            completed: set.completed,
          })),
          isPR: false, // Can implement PR detection later
        })),
      };

      setSelectedWorkout(workoutSummary);
      setSummaryModalVisible(true);
    } else {
      Alert.alert('Error', 'Could not load workout details.');
    }
  };

  const handleDeleteWorkout = async () => {
    if (!selectedWorkout) return;

    const result = await deleteWorkoutDB(selectedWorkout.id);

    if (result.success) {
      setSummaryModalVisible(false);
      setWorkoutHistory(prev => prev.filter(w => w.id !== selectedWorkout.id));
      loadWorkoutsForMonth(); // Refresh calendar
      load14DayStats(); // Refresh stats
      loadStreaks(); // Refresh streaks
    } else {
      Alert.alert('Error', 'Could not delete workout.');
    }
  };

  const handleEditWorkout = () => {
    // TODO: Implement edit functionality
    Alert.alert('Edit Workout', 'Edit functionality coming soon!');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startWorkout = () => {
    if (hasActiveWorkout) {
      // If there's already an active workout, just resume it
      resumeWorkout();
    } else {
      // Start a fresh workout
      setModalVisible(true);
      setHasActiveWorkout(true);
      workoutTimeRef.current = 0;
      workoutStartRef.current = Date.now();
      setExercises([]);
      setStartedFromRoutine(false);
    }
  };

  const startWorkoutFromRoutine = async (routineExercises: { name: string; sets: number; exercise_type?: string }[]) => {
    // Show modal immediately so the UI doesn't appear frozen
    workoutTimeRef.current = 0;
    workoutStartRef.current = Date.now();
    setHasActiveWorkout(true);
    setModalVisible(true);
    setStartedFromRoutine(true);

    // Build exercises with placeholder prev data first, then fill in async
    const builtExercises: Exercise[] = routineExercises.map((re) => {
      const match = exerciseList.find(e => e.name === re.name);
      const exType = (re.exercise_type as ExerciseType) || match?.exerciseType || 'weighted';
      const sets: Set[] = Array.from({ length: re.sets }, () => ({
        kg: '',
        reps: '',
        type: 'working' as SetType,
        completed: false,
      }));
      return {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: re.name,
        exerciseType: exType,
        category: match?.category,
        sets,
        prevKg: 0,
        prevReps: 0,
      };
    });
    setExercises(builtExercises);

    // Fetch all previous set data in parallel, then update
    const lastSets = await Promise.all(
      routineExercises.map(re => getLastSetForExercise(re.name))
    );
    setExercises(prev => prev.map((ex, i) => ({
      ...ex,
      prevKg: lastSets[i].success ? lastSets[i].kg : 0,
      prevReps: lastSets[i].success ? lastSets[i].reps : 0,
    })));
  };

  const resumeWorkout = () => {
    // Just open the modal without resetting anything
    setModalVisible(true);
  };

  const addExercise = async (exerciseName: string) => {
    // Fetch previous data for this exercise
    const lastSet = await getLastSetForExercise(exerciseName);
    const match = exerciseList.find(e => e.name === exerciseName);
    const exType = match?.exerciseType || 'weighted';
    const exCategory = match?.category;

    if (replacingExerciseId) {
      // Replace mode: swap name, type, and prev data, keep existing sets
      setExercises(exercises.map(ex => {
        if (ex.id === replacingExerciseId) {
          return {
            ...ex,
            name: exerciseName,
            exerciseType: exType,
            category: exCategory,
            prevKg: lastSet.success ? lastSet.kg : 0,
            prevReps: lastSet.success ? lastSet.reps : 0,
          };
        }
        return ex;
      }));
      setReplacingExerciseId(null);
    } else {
      const newExercise: Exercise = {
        id: Date.now().toString(),
        name: exerciseName,
        exerciseType: exType,
        category: exCategory,
        sets: [{ kg: '', reps: '', type: 'working', completed: false }],
        prevKg: lastSet.success ? lastSet.kg : 0,
        prevReps: lastSet.success ? lastSet.reps : 0,
      };
      setExercises([...exercises, newExercise]);
    }
    setExerciseSelectorVisible(false);
  };

  const cycleExerciseType = (exerciseId: string) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const currentIdx = EXERCISE_TYPES.indexOf(ex.exerciseType);
        const nextType = EXERCISE_TYPES[(currentIdx + 1) % EXERCISE_TYPES.length];
        return { ...ex, exerciseType: nextType };
      }
      return ex;
    }));
  };

  const deleteExercise = (exerciseId: string) => {
    setExercises(exercises.filter(ex => ex.id !== exerciseId));
  };

  const moveExercise = (exerciseId: string, direction: 'up' | 'down') => {
    const index = exercises.findIndex(ex => ex.id === exerciseId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === exercises.length - 1) return;

    const newExercises = [...exercises];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newExercises[index], newExercises[targetIndex]] = [newExercises[targetIndex], newExercises[index]];
    setExercises(newExercises);
  };

  const addSet = (exerciseId: string) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        return { ...ex, sets: [...ex.sets, { kg: '', reps: '', type: 'working', completed: false }] };
      }
      return ex;
    }));
  };

  const startRestAnimation = (duration?: number) => {
    const dur = duration ?? restDuration;
    restStartRef.current = { startedAt: Date.now(), duration: dur };
    setIsResting(true);
    setRestTime(dur);
    restRingProgress.setValue(1);
    restCountdownScale.setValue(1);
    restCompletedGlow.setValue(0);
    restRippleOpacity.setValue(0);
    setRestCompleted(false);
    halfwayPulsed.current = false;
    restPillScale.setValue(0.85);
    Animated.spring(restPillScale, {
      toValue: 1,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const toggleSetComplete = (exerciseId: string, setIndex: number) => {
    // In strict sync, block completing the next set while waiting for buddy
    const syncState = getBuddySyncState();
    if (syncState?.isActive && syncState.syncMode === 'strict' && syncState.waitingForBuddy) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSets = [...ex.sets];
        const wasCompleted = newSets[setIndex].completed;
        newSets[setIndex] = { ...newSets[setIndex], completed: !wasCompleted };

        if (!wasCompleted) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          const exerciseIdx = exercises.findIndex(e => e.id === exerciseId);

          if (isBuddySyncActive()) {
            // Notify sync module
            onLocalSetCompleted(exerciseIdx, setIndex);
            // In soft mode, start rest normally. In strict, sync module decides.
            const currentSync = getBuddySyncState();
            if (!currentSync || currentSync.syncMode === 'soft') {
              startRestAnimation();
            }
            // Strict mode: rest deferred until onStartSyncedRest callback fires
          } else {
            startRestAnimation();
          }

          // Check if all sets for this exercise are done (for sync auto-advance)
          const allDone = newSets.every(s => s.completed);
          if (allDone && isBuddySyncActive()) {
            onLocalExerciseDone(exerciseIdx);
          }
        }

        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const stopRestTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsResting(false);
    setRestTime(0);
  };

  const startManualRest = () => {
    if (isResting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    restStartRef.current = { startedAt: Date.now(), duration: restDuration };
    setIsResting(true);
    setRestTime(restDuration);
    restRingProgress.setValue(1);
    restCountdownScale.setValue(1);
    restCompletedGlow.setValue(0);
    restRippleOpacity.setValue(0);
    setRestCompleted(false);
    halfwayPulsed.current = false;
    restPillScale.setValue(0.85);
    Animated.spring(restPillScale, {
      toValue: 1, friction: 6, tension: 200, useNativeDriver: true,
    }).start();
  };

  const duplicateLastSet = (exerciseId: string) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId && ex.sets.length > 0) {
        const lastSet = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { ...lastSet }] };
      }
      return ex;
    }));
  };

  const updateSet = (exerciseId: string, setIndex: number, field: 'kg' | 'reps', value: string) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSets = [...ex.sets];
        newSets[setIndex] = { ...newSets[setIndex], [field]: value };
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };


  const changeSetType = (exerciseId: string, setIndex: number, type: SetType) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSets = [...ex.sets];
        const currentSet = newSets[setIndex];
        if (type === 'drop' && currentSet.type !== 'drop') {
          newSets[setIndex] = { ...currentSet, type, drops: [{ kg: '', reps: '' }] };
        } else if (type !== 'drop' && currentSet.type === 'drop') {
          const { drops, ...rest } = currentSet;
          newSets[setIndex] = { ...rest, type };
        } else {
          newSets[setIndex] = { ...currentSet, type };
        }
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const cycleSetType = (exerciseId: string, setIndex: number) => {
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    const current = exercise.sets[setIndex].type;
    const next: SetType = current === 'working' ? 'warmup' : current === 'warmup' ? 'drop' : current === 'drop' ? 'failure' : 'working';
    changeSetType(exerciseId, setIndex, next);
  };

  const addDrop = (exerciseId: string, setIndex: number) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSets = [...ex.sets];
        const drops = newSets[setIndex].drops || [];
        newSets[setIndex] = { ...newSets[setIndex], drops: [...drops, { kg: '', reps: '' }] };
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const updateDrop = (exerciseId: string, setIndex: number, dropIndex: number, field: 'kg' | 'reps', value: string) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSets = [...ex.sets];
        const drops = [...(newSets[setIndex].drops || [])];
        drops[dropIndex] = { ...drops[dropIndex], [field]: value };
        newSets[setIndex] = { ...newSets[setIndex], drops };
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const removeDrop = (exerciseId: string, setIndex: number, dropIndex: number) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSets = [...ex.sets];
        const drops = (newSets[setIndex].drops || []).filter((_, i) => i !== dropIndex);
        newSets[setIndex] = { ...newSets[setIndex], drops: drops.length > 0 ? drops : [{ kg: '', reps: '' }] };
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const replaceExercise = (exerciseId: string) => {
    setReplacingExerciseId(exerciseId);
    setExerciseSelectorVisible(true);
  };

  const toggleSuperset = (exerciseId: string) => {
    const index = exercises.findIndex(ex => ex.id === exerciseId);
    if (index === -1) return;
    const exercise = exercises[index];

    if (exercise.supersetWith) {
      // Unlink superset pair
      setExercises(exercises.map(ex => {
        if (ex.id === exercise.supersetWith || ex.id === exerciseId) {
          return { ...ex, supersetWith: null };
        }
        return ex;
      }));
    } else if (index < exercises.length - 1) {
      const nextExercise = exercises[index + 1];
      if (!nextExercise.supersetWith) {
        // Link with next exercise
        setExercises(exercises.map(ex => {
          if (ex.id === exerciseId) return { ...ex, supersetWith: nextExercise.id };
          if (ex.id === nextExercise.id) return { ...ex, supersetWith: exerciseId };
          return ex;
        }));
      }
    }
  };

  const deleteSet = (exerciseId: string, setIndex: number) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSets = ex.sets.filter((_, index) => index !== setIndex);
        // Keep at least one set
        if (newSets.length === 0) {
          return ex;
        }
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const moveSet = (exerciseId: string, setIndex: number, direction: 'up' | 'down') => {
    setExercises(exercises.map(ex => {
      if (ex.id === exerciseId) {
        const newSets = [...ex.sets];
        if (direction === 'up' && setIndex === 0) return ex;
        if (direction === 'down' && setIndex === newSets.length - 1) return ex;

        const targetIndex = direction === 'up' ? setIndex - 1 : setIndex + 1;
        [newSets[setIndex], newSets[targetIndex]] = [newSets[targetIndex], newSets[setIndex]];
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const finishWorkout = () => {
    if (exercises.length === 0) {
      Alert.alert('No Data', 'Add some exercises before finishing the workout.');
      return;
    }

    const completedSets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.completed).length, 0);
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    const incompleteSets = totalSets - completedSets;

    const message = incompleteSets > 0
      ? `You have ${incompleteSets} incomplete set${incompleteSets > 1 ? 's' : ''}. Finish workout anyway?`
      : 'Save and finish this workout?';

    Alert.alert('Finish Workout?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', style: 'default', onPress: doFinishWorkout },
    ]);
  };

  const doFinishWorkout = async () => {
    // Filter out empty sets based on exercise type, then discard empty exercises
    const filteredExercises = exercises
      .map(ex => ({
        name: ex.name,
        exerciseType: ex.exerciseType,
        sets: ex.sets.filter(set => {
          if (ex.exerciseType === 'bodyweight' || ex.exerciseType === 'duration') {
            return (parseInt(set.reps) || 0) > 0;
          }
          return (parseFloat(set.kg) || 0) > 0 || (parseInt(set.reps) || 0) > 0;
        }),
      }))
      .filter(ex => ex.sets.length > 0);

    if (filteredExercises.length === 0) {
      Alert.alert('No Data', 'No valid sets to save.');
      return;
    }

    // Prepare workout data
    const workoutData = {
      duration: workoutTimeRef.current,
      exercises: filteredExercises,
    };

    // Save to database
    const result = await saveWorkout(workoutData);

    if (result.success) {
      // Refresh calendar, stats, body graph, and streaks
      loadWorkoutsForMonth();
      load14DayStats();
      setWorkoutSavedCounter(prev => prev + 1);
      loadStreaks();

      // Create activity feed entry and update leaderboard (skip bodyweight/duration for volume)
      const totalVolume = filteredExercises.reduce((vol, ex) => {
        if (ex.exerciseType === 'bodyweight' || ex.exerciseType === 'duration') return vol;
        return vol + ex.sets.reduce((setVol, set) => {
          return setVol + (parseFloat(set.kg) || 0) * (parseInt(set.reps) || 0);
        }, 0);
      }, 0);

      createActivityEntry({
        workout_id: result.workoutId!,
        duration: workoutTimeRef.current,
        total_volume: totalVolume,
        exercise_names: filteredExercises.map(ex => ex.name),
        total_exercises: filteredExercises.length,
        total_sets: filteredExercises.reduce((sum, ex) => sum + ex.sets.length, 0),
      }).catch(err => console.log('Activity entry error:', err));

      updateMyLeaderboardEntry(totalVolume).catch(err => console.log('Leaderboard update error:', err));

      // Build summary data for the completion modal
      const completionSummary = {
        date: new Date().toISOString(),
        duration: workoutTimeRef.current,
        exercises: filteredExercises.map(ex => ({
          name: ex.name,
          sets: ex.sets.map(set => ({
            kg: parseFloat(set.kg) || 0,
            reps: parseInt(set.reps) || 0,
            completed: set.completed,
          })),
          isPR: false,
        })),
      };

      // End live session if active
      if (liveSessionId) {
        const liveSummary = {
          totalVolume,
          setsCompleted: filteredExercises.reduce((sum, ex) => sum + ex.sets.filter((s: any) => s.completed).length, 0),
          exerciseNames: filteredExercises.map(ex => ex.name),
          username: myProfile?.username || session?.user?.email || 'You',
        };
        const allDone = await endLiveSession(liveSummary);

        if (!allDone) {
          // Others haven't finished yet — enter waiting state
          // Keep modal open with waiting overlay; workout is already saved to DB
          pendingWorkoutSummaryRef.current = completionSummary;
          setWaitingForAllFinish(true);
          waitingForAllFinishRef.current = true; // Set immediately so event handlers can detect
          AsyncStorage.removeItem(WORKOUT_STORAGE_KEY);
          return; // Don't close modal — waiting UI will show
        }

        // All done — complete normally
        cleanupBuddySync();
        setParticipantFinished(new Map());
        setParticipantWaiting(new Map());
        const summary = await getSessionSummary(liveSessionId);
        setLiveSessionSummary(summary);
        setLiveSessionId(null);
      }

      // Close workout modal and show summary
      setModalVisible(false);
      setSelectedWorkout(completionSummary);
      setIsJustCompleted(true);
      setSummaryModalVisible(true);

      // Clean up workout state
      AsyncStorage.removeItem(WORKOUT_STORAGE_KEY);
      setExercises([]);
      setIsResting(false);
      setRestTime(0);
      setHasActiveWorkout(false);
      workoutStartRef.current = null;
      setStartedFromRoutine(false);
    } else {
      Alert.alert(
        'Save Failed',
        'Could not save workout. Please check your Supabase configuration.',
        [{ text: 'OK' }]
      );
    }
  };

  const deleteActiveWorkout = () => {
    if (liveSessionId) {
      Alert.alert('Leave Session First', 'You\'re in a live session. Leave the session first to delete your workout.');
      return;
    }
    Alert.alert(
      'Delete Workout?',
      'Are you sure you want to delete this entire workout? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            AsyncStorage.removeItem(WORKOUT_STORAGE_KEY);
            setModalVisible(false);
            setExercises([]);
            setIsResting(false);
            setRestTime(0);
            workoutTimeRef.current = 0;
            setHasActiveWorkout(false);
            workoutStartRef.current = null;
            Alert.alert('Deleted', 'Workout has been deleted.');
          },
        },
      ]
    );
  };

  const minimizeWorkout = () => {
    // Just close modal, keep the workout data
    setModalVisible(false);
  };
  minimizeWorkoutRef.current = minimizeWorkout;

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            clearWorkoutCaches();
            clearFoodCaches();
            clearWeightCaches();
            clearSupplementCaches();
            invalidateExerciseCache();
            if (session?.user?.id) await clearPushToken(session.user.id);
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  // Show loading screen
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingLeft: insets.left, paddingRight: insets.right }]}>
        <Logo size={s(72)} />
        <Text style={{ marginTop: s(16), fontSize: s(24), fontFamily: 'Inter_800ExtraBold', color: colors.text, letterSpacing: s(1) }}>Momentum</Text>
        <Text style={{ marginTop: s(8), color: colors.textMuted, fontSize: s(14) }}>Loading...</Text>
      </View>
    );
  }

  // Show auth screen if not logged in
  if (!session) {
    return (
      <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right }}>
        <Auth onAuthSuccess={() => {}} />
      </View>
    );
  }

  // Enforce username for existing users who don't have one
  if (myProfile && !myProfile.username) {
    return <UsernameSetupScreen colors={colors} insets={insets} onComplete={(name: string) => {
      setMyProfile({ ...myProfile, username: name });
    }} />;
  }

  // Show locked screen if admin has locked this account
  if (myProfile?.is_locked) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingLeft: insets.left, paddingRight: insets.right, paddingHorizontal: s(32) }]}>
        <Ionicons name="lock-closed" size={s(64)} color={colors.textMuted} />
        <Text style={{ marginTop: s(16), fontSize: s(22), fontFamily: 'Inter_800ExtraBold', color: colors.text, textAlign: 'center' }}>Account Locked</Text>
        <Text style={{ marginTop: s(8), color: colors.textMuted, fontSize: s(14), textAlign: 'center', lineHeight: s(20) }}>
          Your account has been locked. Please contact support if you believe this is a mistake.
        </Text>
        <TouchableOpacity
          style={{ marginTop: s(24), paddingVertical: s(12), paddingHorizontal: s(24), backgroundColor: colors.card, borderRadius: s(10) }}
          onPress={async () => {
            if (session?.user?.id) await clearPushToken(session.user.id);
            await supabase.auth.signOut();
          }}
        >
          <Text style={{ color: colors.text, fontSize: s(14), fontFamily: 'Inter_600SemiBold' }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + s(10) }]}>
        <View style={styles.headerLeft}>
          <Logo size={s(28)} />
          <Text style={styles.headerBrandText} numberOfLines={1} adjustsFontSizeToFit>Momentum.</Text>
        </View>
        <View style={styles.headerRight}>
          <AnimatedStreakBadge value={streaks.gymCurrent} color="#FF9500" bgColor="rgba(255,149,0,0.12)" borderColor="rgba(255,149,0,0.3)" atRisk={streaks.gymAtRisk} />
          {showNutritionStreak && (
            <AnimatedStreakBadge value={streaks.nutritionCurrent} color="#34C759" bgColor="rgba(52,199,89,0.12)" borderColor="rgba(52,199,89,0.3)" atRisk={streaks.nutritionAtRisk} />
          )}
          {showCombinedStreak && (
            <AnimatedStreakBadge value={streaks.combinedCurrent} color="#FF3B30" bgColor="rgba(255,59,48,0.12)" borderColor="rgba(255,59,48,0.3)" atRisk={streaks.combinedAtRisk} />
          )}
          <TouchableOpacity onPress={() => { setActiveTab('profile'); setProfileSubView('profile'); }} activeOpacity={0.7}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {(myProfile?.username || session?.user?.email)?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'food' ? (
        <FoodLogger onSupplementChange={loadSupplementData} refreshKey={supplementRefreshKey} />
      ) : activeTab === 'workout' ? (
        workoutSubView === 'start' ? (
          <View style={{ flex: 1 }}>
            <View style={styles.workoutTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), flex: 1 }}>
                <TouchableOpacity onPress={() => setWorkoutSubView('history')} style={styles.workoutBackButton}>
                  <Ionicons name="chevron-back" size={s(20)} color={colors.accent} />
                </TouchableOpacity>
                <Text style={styles.workoutHistTitle} numberOfLines={1} adjustsFontSizeToFit>Start Workout</Text>
              </View>
            </View>
            <WorkoutStartPage
              onStartEmpty={startWorkout}
              onStartFromRoutine={startWorkoutFromRoutine}
              exerciseList={exerciseList}
              onJoinByCode={() => setJoinByCodeModalVisible(true)}
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.workoutTopRow}>
              <Text style={styles.workoutHistTitle}>Workouts</Text>
              <TouchableOpacity
                style={styles.startWorkoutBanner}
                onPress={() => setWorkoutSubView('start')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={s(18)} color="#FFFFFF" />
                <Text style={styles.startWorkoutBannerText} numberOfLines={1} adjustsFontSizeToFit>New</Text>
              </TouchableOpacity>
            </View>

            {workoutHistoryLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : workoutHistory.length === 0 ? (
              <View style={styles.workoutEmptyState}>
                <View style={styles.workoutEmptyIcon}>
                  <Ionicons name="barbell-outline" size={s(40)} color={colors.border} />
                </View>
                <Text style={styles.workoutEmptyTitle}>No workouts yet</Text>
                <Text style={styles.workoutEmptySubtitle}>Tap "Start Workout" to begin</Text>
              </View>
            ) : (
              <FlatList
                data={workoutHistory}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: s(120) }}
                renderItem={({ item, index: cardIndex }) => {
                  const exercises = item.exercises || [];
                  const totalVolume = exercises.reduce((vol: number, ex: any) =>
                    vol + (ex.sets || []).reduce((sv: number, set: any) =>
                      sv + ((set.completed ? (set.kg || 0) * (set.reps || 0) : 0)), 0), 0);
                  const totalSets = exercises.reduce((c: number, ex: any) =>
                    c + (ex.sets || []).filter((set: any) => set.completed).length, 0);
                  const totalReps = exercises.reduce((c: number, ex: any) =>
                    c + (ex.sets || []).filter((set: any) => set.completed).reduce((r: number, set: any) => r + (set.reps || 0), 0), 0);
                  const duration = item.duration || 0;
                  const hrs = Math.floor(duration / 3600);
                  const mins = Math.floor((duration % 3600) / 60);
                  const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

                  // Derive muscle groups from exercises
                  const muscleGroups = new Set<MuscleGroup>();
                  for (const ex of exercises) {
                    const mapping = EXERCISE_MUSCLE_MAP[ex.name];
                    if (mapping) {
                      mapping.primary.forEach((m: MuscleGroup) => muscleGroups.add(m));
                    }
                  }
                  const muscleList = Array.from(muscleGroups);
                  const primaryColor = muscleList.length > 0 ? MUSCLE_GROUP_COLORS[muscleList[0]] : colors.accent;

                  // Per-exercise set counts + PR detection
                  const cardPRs = workoutPRMap.get(item.id) || [];
                  const prSet = new Set(cardPRs);
                  const exerciseDetails = exercises.map((ex: any) => ({
                    name: ex.name,
                    sets: (ex.sets || []).filter((set: any) => set.completed).length,
                    isPR: prSet.has(ex.name),
                  }));

                  const dateObj = new Date(item.created_at);
                  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                  return (
                    <TouchableOpacity
                      style={styles.workoutCard}
                      activeOpacity={0.7}
                      onPress={() => {
                        const workoutSummary = {
                          id: item.id,
                          date: item.created_at.split('T')[0],
                          duration: item.duration,
                          exercises: exercises.map((ex: any) => ({
                            name: ex.name,
                            sets: (ex.sets || []).map((set: any) => ({
                              kg: set.kg,
                              reps: set.reps,
                              completed: set.completed,
                            })),
                            isPR: false,
                          })),
                        };
                        setSelectedWorkout(workoutSummary);
                        setSummaryModalVisible(true);
                      }}
                    >
                      {/* Top row: date + PR badge */}
                      <View style={styles.wcTopRow}>
                        <Text style={styles.wcDate}>{dateStr}  ·  {timeStr}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                          {cardPRs.length > 0 && (
                            <View style={styles.wcPRBadge}>
                              <Ionicons name="trophy" size={s(10)} color="#422006" />
                              <Text style={styles.wcPRBadgeText}>{cardPRs.length} PR{cardPRs.length > 1 ? 's' : ''}</Text>
                            </View>
                          )}
                          <Ionicons name="chevron-forward" size={s(14)} color={colors.textMuted} />
                        </View>
                      </View>

                      {/* Muscle tags */}
                      {muscleList.length > 0 && (
                        <View style={styles.wcMuscles}>
                          {muscleList.slice(0, 4).map((m) => (
                            <View key={m} style={[styles.wcMusclePill, { backgroundColor: `${MUSCLE_GROUP_COLORS[m]}15` }]}>
                              <View style={[styles.wcMuscleDot, { backgroundColor: MUSCLE_GROUP_COLORS[m] }]} />
                              <Text style={[styles.wcMuscleText, { color: MUSCLE_GROUP_COLORS[m] }]}>{MUSCLE_DISPLAY_NAMES[m]}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Stats grid */}
                      <View style={styles.wcStatsGrid}>
                        <View style={styles.wcStatItem}>
                          <Text style={styles.wcStatNumber}>{durationStr}</Text>
                          <Text style={styles.wcStatLabel}>Duration</Text>
                        </View>
                        <View style={styles.wcStatItem}>
                          <Text style={styles.wcStatNumber}>{totalSets}</Text>
                          <Text style={styles.wcStatLabel}>Sets</Text>
                        </View>
                        <View style={styles.wcStatItem}>
                          <Text style={styles.wcStatNumber}>{totalReps}</Text>
                          <Text style={styles.wcStatLabel}>Reps</Text>
                        </View>
                        <View style={styles.wcStatItem}>
                          <Text style={styles.wcStatNumber}>{totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}</Text>
                          <Text style={styles.wcStatLabel}>Volume</Text>
                        </View>
                      </View>

                      {/* Exercises */}
                      <View style={styles.wcExercises}>
                        {exerciseDetails.slice(0, 4).map((ex: { name: string; sets: number; isPR: boolean }, i: number) => (
                          <View key={i} style={styles.wcExRow}>
                            <Text style={styles.wcExName} numberOfLines={1}>{ex.name}</Text>
                            {ex.isPR && (
                              <View style={styles.wcExPR}>
                                <Ionicons name="star" size={s(8)} color="#422006" />
                              </View>
                            )}
                            <Text style={styles.wcExSets}>{ex.sets} sets</Text>
                          </View>
                        ))}
                        {exerciseDetails.length > 4 && (
                          <Text style={styles.wcExMore}>+{exerciseDetails.length - 4} more exercises</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        )
      ) : activeTab === 'friends' ? (
        <FriendsTab
          currentUserId={session?.user?.id || ''}
          unreadNotifications={unreadNotifications}
          onUnreadCountChange={setUnreadNotifications}
          onInviteLive={() => {
            setLiveInviteModalVisible(true);
          }}
        />
      ) : activeTab === 'home' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={homeRefreshing} onRefresh={onHomeRefresh} tintColor={colors.accent} />
          }
        >
          {/* Today's Nutrition + Supplements Row */}
          <View style={styles.topCardsRow}>
            {/* Nutrition Card */}
            <View style={styles.nutritionCardCompact}>
              <Text style={styles.compactCardTitle} numberOfLines={1} adjustsFontSizeToFit>Nutrition</Text>
              <CircularProgress
                size={s(82)}
                strokeWidth={s(7)}
                progress={nutritionGoals.calorie_goal > 0 ? todayNutrition.totalCalories / nutritionGoals.calorie_goal : 0}
                color={todayNutrition.totalCalories > nutritionGoals.calorie_goal ? '#FF3B30' : '#34C759'}
                trackColor={colors.border}
              >
                <Text style={styles.compactCalorieValue} numberOfLines={1} adjustsFontSizeToFit>{todayNutrition.totalCalories}</Text>
                <Text style={styles.compactCalorieLabel} numberOfLines={1} adjustsFontSizeToFit>/ {nutritionGoals.calorie_goal}</Text>
              </CircularProgress>
              <View style={styles.macroBarsList}>
                {[
                  { label: 'Protein', value: todayNutrition.totalProtein, goal: nutritionGoals.protein_goal, color: colors.accent },
                  { label: 'Carbs', value: todayNutrition.totalCarbs, goal: nutritionGoals.carbs_goal, color: '#FF9500' },
                  { label: 'Fat', value: todayNutrition.totalFat, goal: nutritionGoals.fat_goal, color: '#AF52DE' },
                ].map((macro) => (
                  <View key={macro.label} style={styles.macroBarRow}>
                    <View style={styles.macroBarLabelRow}>
                      <View style={[styles.macroDot, { backgroundColor: macro.color }]} />
                      <Text style={styles.macroBarLabel} numberOfLines={1}>{macro.label}</Text>
                      <Text style={styles.macroBarValue} numberOfLines={1} adjustsFontSizeToFit>{macro.value}<Text style={styles.macroBarGoal}>/{macro.goal}g</Text></Text>
                    </View>
                    <View style={styles.macroBarTrack}>
                      <View style={[styles.macroBarFill, {
                        width: `${Math.min((macro.goal > 0 ? macro.value / macro.goal : 0) * 100, 100)}%`,
                        backgroundColor: macro.color,
                      }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Water + Creatine Stacked */}
            <View style={styles.supplementColumn}>
              {/* Water Card */}
              <View style={styles.supplementMiniCard}>
                <View style={styles.supplementHeader}>
                  <Ionicons name="water" size={s(14)} color="#5AC8FA" />
                  <Text style={styles.supplementTitle} numberOfLines={1} adjustsFontSizeToFit>Water</Text>
                </View>
                <Text style={styles.supplementValue} numberOfLines={1} adjustsFontSizeToFit>
                  {supplementSummary.totalWater}
                  <Text style={styles.supplementGoalText}> / {supplementGoals.water_goal}ml</Text>
                </Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, {
                    width: `${Math.min((supplementGoals.water_goal > 0 ? supplementSummary.totalWater / supplementGoals.water_goal : 0) * 100, 100)}%`,
                    backgroundColor: supplementSummary.totalWater >= supplementGoals.water_goal ? '#34C759' : '#5AC8FA',
                  }]} />
                </View>
                <View style={styles.quickAddRow}>
                  <TouchableOpacity style={styles.quickAddBtn} onPress={() => handleAddSupplement('water', 250)}>
                    <Text style={styles.quickAddText}>+250</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickAddBtn} onPress={() => handleAddSupplement('water', 500)}>
                    <Text style={styles.quickAddText}>+500</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Creatine Card */}
              <View style={styles.supplementMiniCard}>
                <View style={styles.supplementHeader}>
                  <Ionicons name="flash" size={s(14)} color="#FFCC00" />
                  <Text style={styles.supplementTitle} numberOfLines={1} adjustsFontSizeToFit>Creatine</Text>
                </View>
                <Text style={styles.supplementValue} numberOfLines={1} adjustsFontSizeToFit>
                  {supplementSummary.totalCreatine}
                  <Text style={styles.supplementGoalText}> / {supplementGoals.creatine_goal}g</Text>
                </Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, {
                    width: `${Math.min((supplementGoals.creatine_goal > 0 ? supplementSummary.totalCreatine / supplementGoals.creatine_goal : 0) * 100, 100)}%`,
                    backgroundColor: supplementSummary.totalCreatine >= supplementGoals.creatine_goal ? '#34C759' : '#FFCC00',
                  }]} />
                </View>
                <View style={styles.quickAddRow}>
                  <TouchableOpacity style={styles.quickAddBtn} onPress={() => handleAddSupplement('creatine', 5)}>
                    <Text style={styles.quickAddText}>+5g</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickAddBtn} onPress={() => handleAddSupplement('creatine', 1)}>
                    <Text style={styles.quickAddText}>+1g</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>


          {/* Slidable Charts */}
          <View style={styles.chartCarousel}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const page = Math.round(e.nativeEvent.contentOffset.x / (Dimensions.get('window').width - s(32)));
                setChartPage(page);
              }}
              scrollEventThrottle={16}
            >
          {/* Weight Trend */}
          <TouchableOpacity
            style={[styles.weightCard, styles.carouselPage]}
            activeOpacity={0.8}
            onPress={() => setShowWeightHistoryModal(true)}
          >
            <View style={styles.weightCardHeader}>
              <Text style={styles.weightCardTitle} numberOfLines={1} adjustsFontSizeToFit>Weight Trend</Text>
              <TouchableOpacity
                style={styles.logWeightButtonSmall}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowWeightModal(true);
                }}
              >
                <Ionicons name="add" size={s(16)} color={colors.accent} />
                <Text style={styles.logWeightButtonTextSmall} numberOfLines={1} adjustsFontSizeToFit>Log</Text>
              </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.weightStatsRow}>
              <View style={styles.weightStatItem}>
                <Text style={styles.weightStatValue} numberOfLines={1} adjustsFontSizeToFit>
                  {weightStats.current !== null ? weightStats.current : '--'}
                </Text>
                <Text style={styles.weightStatLabel} numberOfLines={1} adjustsFontSizeToFit>Current</Text>
              </View>
              <View style={styles.weightStatItem}>
                <Text style={[
                  styles.weightStatValue,
                  weightStats.change !== null && weightStats.change < 0 && styles.weightTrendDown,
                  weightStats.change !== null && weightStats.change > 0 && styles.weightTrendUp,
                ]} numberOfLines={1} adjustsFontSizeToFit>
                  {weightStats.trend !== null ? weightStats.trend : '--'}
                </Text>
                <Text style={styles.weightStatLabel} numberOfLines={1} adjustsFontSizeToFit>Trend</Text>
              </View>
              {weightStats.startingWeight !== null && (
                <View style={styles.weightStatItem}>
                  <Text style={[
                    styles.weightStatValue,
                    weightStats.change !== null && weightStats.change < 0 && styles.weightTrendDown,
                    weightStats.change !== null && weightStats.change > 0 && styles.weightTrendUp,
                  ]} numberOfLines={1} adjustsFontSizeToFit>
                    {weightStats.change !== null
                      ? `${weightStats.change > 0 ? '+' : ''}${weightStats.change}`
                      : '--'}
                  </Text>
                  <Text style={styles.weightStatLabel} numberOfLines={1} adjustsFontSizeToFit>Change</Text>
                </View>
              )}
            </View>

            {/* Chart */}
            {weightStats.entries.length > 0 ? (
              <View style={styles.weightChartContainer}>
                {(() => {
                  const chartWidth = Dimensions.get('window').width - 32 - 24 - 16; // margins(16*2) + card padding(12*2) + chart container padding(8*2)
                  const chartHeight = 95;
                  const paddingLeft = 35;
                  const paddingRight = 10;
                  const paddingTop = 10;
                  const paddingBottom = 20;
                  const graphWidth = chartWidth - paddingLeft - paddingRight;
                  const graphHeight = chartHeight - paddingTop - paddingBottom;

                  // Sort entries by date ascending for chart
                  const sortedEntries = [...weightStats.entries].sort((a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                  );
                  const trendLine = weightStats.trendLine;

                  // Calculate min/max for scale
                  const allWeights = sortedEntries.map(e => e.weight);
                  const minWeight = Math.floor(Math.min(...allWeights) - 1);
                  const maxWeight = Math.ceil(Math.max(...allWeights) + 1);
                  const weightRange = maxWeight - minWeight || 1;

                  // Calculate bar width based on number of entries
                  const barWidth = Math.min(12, (graphWidth / sortedEntries.length) * 0.6);
                  const barGap = (graphWidth - barWidth * sortedEntries.length) / (sortedEntries.length + 1);

                  // Generate trend line path
                  let trendPath = '';
                  trendLine.forEach((point, i) => {
                    const x = paddingLeft + barGap + (barWidth / 2) + i * (barWidth + barGap);
                    const y = paddingTop + graphHeight - ((point.value - minWeight) / weightRange) * graphHeight;
                    trendPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
                  });

                  return (
                    <Svg width={chartWidth} height={chartHeight}>
                      {/* Y-axis labels */}
                      <SvgText
                        x={paddingLeft - 5}
                        y={paddingTop + 4}
                        fill={colors.textMuted}
                        fontSize="10"
                        textAnchor="end"
                      >
                        {maxWeight}
                      </SvgText>
                      <SvgText
                        x={paddingLeft - 5}
                        y={paddingTop + graphHeight + 4}
                        fill={colors.textMuted}
                        fontSize="10"
                        textAnchor="end"
                      >
                        {minWeight}
                      </SvgText>

                      {/* Horizontal grid lines */}
                      <Line
                        x1={paddingLeft}
                        y1={paddingTop}
                        x2={chartWidth - paddingRight}
                        y2={paddingTop}
                        stroke={colors.border}
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />
                      <Line
                        x1={paddingLeft}
                        y1={paddingTop + graphHeight}
                        x2={chartWidth - paddingRight}
                        y2={paddingTop + graphHeight}
                        stroke={colors.border}
                        strokeWidth="1"
                      />

                      {/* Bars for daily weights */}
                      {sortedEntries.map((entry, i) => {
                        const barHeight = ((entry.weight - minWeight) / weightRange) * graphHeight;
                        const x = paddingLeft + barGap + i * (barWidth + barGap);
                        const y = paddingTop + graphHeight - barHeight;
                        return (
                          <Rect
                            key={entry.id}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={colors.border}
                            rx={2}
                          />
                        );
                      })}

                      {/* EMA Trend Line */}
                      <Path
                        d={trendPath}
                        stroke="#38BDF8"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Trend line dots */}
                      {trendLine.map((point, i) => {
                        const x = paddingLeft + barGap + (barWidth / 2) + i * (barWidth + barGap);
                        const y = paddingTop + graphHeight - ((point.value - minWeight) / weightRange) * graphHeight;
                        return (
                          <Circle
                            key={point.date}
                            cx={x}
                            cy={y}
                            r={3}
                            fill="#38BDF8"
                          />
                        );
                      })}
                    </Svg>
                  );
                })()}
                <View style={styles.weightChartLegend}>
                  <View style={styles.weightLegendItem}>
                    <View style={[styles.weightLegendDot, { backgroundColor: colors.border }]} />
                    <Text style={styles.weightLegendText} numberOfLines={1} adjustsFontSizeToFit>Daily</Text>
                  </View>
                  <View style={styles.weightLegendItem}>
                    <View style={[styles.weightLegendDot, { backgroundColor: '#38BDF8' }]} />
                    <Text style={styles.weightLegendText} numberOfLines={1} adjustsFontSizeToFit>EMA Trend</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.weightEmptyChart}>
                <Text style={styles.weightEmptyText} numberOfLines={1} adjustsFontSizeToFit>Log your weight to see trends</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Progressive Overload */}
          <View style={styles.carouselPage}>
            <ProgressChart />
          </View>
            </ScrollView>

            {/* Page dots */}
            <View style={styles.carouselDots}>
              <View style={[styles.carouselDot, chartPage === 0 && styles.carouselDotActive]} />
              <View style={[styles.carouselDot, chartPage === 1 && styles.carouselDotActive]} />
            </View>
          </View>

          {/* Calendar */}
          <Calendar workoutDays={workoutDays} onDayPress={handleDayPress} />

          {/* Bottom padding for tab bar */}
          <View style={{ height: s(100) }} />
        </ScrollView>
      ) : (
        profileSubView === 'settings' ? (
          <Settings
            onBack={() => setProfileSubView('profile')}
            nutritionGoals={nutritionGoals}
            setNutritionGoals={setNutritionGoals}
            saveNutritionGoals={saveNutritionGoals}
            mealConfig={mealConfig}
            setMealConfig={setMealConfig}
            saveMealConfig={saveMealConfig}
            startingWeightInput={startingWeightInput}
            setStartingWeightInput={setStartingWeightInput}
            handleSaveStartingWeight={handleSaveStartingWeight}
            supplementGoals={supplementGoals}
            setSupplementGoals={setSupplementGoals}
            saveSupplementGoals={saveSupplementGoals}
            showNutritionStreak={showNutritionStreak}
            setShowNutritionStreak={setShowNutritionStreak}
            showCombinedStreak={showCombinedStreak}
            setShowCombinedStreak={setShowCombinedStreak}
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* User Info */}
            <View style={styles.profileContainer}>
              <View style={[styles.profileAvatar, { backgroundColor: colors.accent }]}>
                <Text style={styles.profileAvatarText}>
                  {(myProfile?.username || session?.user?.email)?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              {myProfile?.username && (
                <Text style={styles.profileUsername}>{myProfile.username}</Text>
              )}
              <Text style={styles.profileEmail}>{session?.user?.email}</Text>
            </View>

            {/* Appearance */}
            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Appearance</Text>

              {/* Mode Selector: Light / Dark / Night */}
              <View style={styles.modeSelector}>
                {([
                  { key: 'light' as const, label: 'Light', icon: 'sunny-outline' as const },
                  { key: 'dark' as const, label: 'Dark', icon: 'moon-outline' as const },
                  { key: 'night' as const, label: 'Night', icon: 'eye-off-outline' as const },
                ]).map((m) => {
                  const active = mode === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.modeBtn, active && { backgroundColor: colors.accent }]}
                      onPress={() => setMode(m.key)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={m.icon}
                        size={s(16)}
                        color={active ? '#FFFFFF' : colors.textMuted}
                      />
                      <Text style={[
                        styles.modeBtnText,
                        active && { color: '#FFFFFF' },
                      ]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Color Picker Bar */}
              <View style={styles.colorBarWrap}>
                {/* Visual bar (no touch handling) */}
                <View style={styles.colorBar} pointerEvents="none">
                  {sortedPresets.map((p) => (
                    <View key={p.id} style={{ flex: 1, backgroundColor: p.accent }} />
                  ))}
                </View>
                {/* Transparent touch layer */}
                <View
                  style={styles.colorBarTouch}
                  onLayout={(e) => setColorBarWidth(e.nativeEvent.layout.width)}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => {
                    if (colorBarWidth <= 0) return;
                    const idx = Math.min(sortedPresets.length - 1, Math.max(0, Math.floor(e.nativeEvent.locationX / (colorBarWidth / sortedPresets.length))));
                    setThemeId(sortedPresets[idx].id);
                  }}
                  onResponderMove={(e) => {
                    if (colorBarWidth <= 0) return;
                    const idx = Math.min(sortedPresets.length - 1, Math.max(0, Math.floor(e.nativeEvent.locationX / (colorBarWidth / sortedPresets.length))));
                    setThemeId(sortedPresets[idx].id);
                  }}
                />
                {/* Thumb */}
                {colorBarWidth > 0 && selectedColorIdx >= 0 && (
                  <View
                    style={[
                      styles.colorThumb,
                      {
                        left: (selectedColorIdx + 0.5) * (colorBarWidth / sortedPresets.length) - s(17),
                        backgroundColor: sortedPresets[selectedColorIdx].accent,
                      },
                    ]}
                    pointerEvents="none"
                  />
                )}
              </View>
              <Text style={styles.colorPickerLabel}>
                {presets.find(p => p.id === themeId)?.name}
              </Text>
            </View>

            {/* Settings */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setProfileSubView('settings')}
              activeOpacity={0.6}
            >
              <Ionicons name="settings-outline" size={s(20)} color={colors.textSecondary} style={{ marginRight: s(12) }} />
              <Text style={styles.settingsRowText}>Settings</Text>
              <Ionicons name="chevron-forward" size={s(18)} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Sign Out */}
            <TouchableOpacity
              style={styles.profileSignOut}
              onPress={handleSignOut}
              activeOpacity={0.6}
            >
              <Ionicons name="log-out-outline" size={s(20)} color="#F87171" style={{ marginRight: s(12) }} />
              <Text style={styles.profileSignOutText}>Sign Out</Text>
            </TouchableOpacity>

            {/* Version */}
            <Text style={styles.versionText}>v1.0.0</Text>

            <View style={{ height: s(100) }} />
          </ScrollView>
        )
      )}

      {/* Active Workout Banner */}
      {hasActiveWorkout && (
        <View style={[styles.activeWorkoutBanner, { bottom: insets.bottom + s(70) }]}>
          <TouchableOpacity
            style={styles.activeWorkoutFloatingButton}
            onPress={resumeWorkout}
          >
            <View style={styles.activeWorkoutFloatingContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeWorkoutFloatingTitle}>Workout in Progress</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <WorkoutTimerDisplay startRef={workoutStartRef} active={hasActiveWorkout} style={styles.activeWorkoutFloatingSubtitle} />
                  <Text style={styles.activeWorkoutFloatingSubtitle}> • {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</Text>
                </View>
              </View>
              {showReconnectBanner && !liveSessionId && (
                <View style={styles.floatingReconnectBadge}>
                  <Ionicons name="people" size={s(12)} color="#fff" />
                </View>
              )}
              <Text style={styles.activeWorkoutFloatingArrow}>→</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Tab Bar */}
      <View style={[styles.bottomTabBar, { paddingBottom: insets.bottom + s(10) }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => { setActiveTab('home'); setProfileSubView('profile'); }}
        >
          <Ionicons
            name={activeTab === 'home' ? 'home' : 'home-outline'}
            size={s(24)}
            color={activeTab === 'home' ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => { setActiveTab('workout'); setWorkoutSubView('history'); setProfileSubView('profile'); }}
        >
          <Ionicons
            name={activeTab === 'workout' ? 'barbell' : 'barbell-outline'}
            size={s(24)}
            color={activeTab === 'workout' ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setShowPlusMenu(true)}
        >
          <Ionicons
            name="add-circle"
            size={s(32)}
            color={hasActiveWorkout ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => { setActiveTab('food'); setProfileSubView('profile'); }}
        >
          <Ionicons
            name={activeTab === 'food' ? 'nutrition' : 'nutrition-outline'}
            size={s(24)}
            color={activeTab === 'food' ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => { setActiveTab('friends'); setProfileSubView('profile'); }}
        >
          <View style={styles.tabItemWithBadge}>
            <Ionicons
              name={activeTab === 'friends' ? 'people' : 'people-outline'}
              size={s(24)}
              color={activeTab === 'friends' ? colors.accent : colors.textMuted}
            />
            {unreadNotifications > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

      </View>

      {/* Plus Menu Action Sheet */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showPlusMenu}
        onRequestClose={() => setShowPlusMenu(false)}
      >
        <TouchableOpacity
          style={styles.plusMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowPlusMenu(false)}
        >
          <Animated.View
            style={[
              styles.plusMenuContainerNew,
              { transform: [{ translateY: plusMenuPanY }] },
            ]}
          >
            {/* Grab Bar */}
            <View style={styles.plusMenuGrabArea} {...plusMenuPanResponder.panHandlers}>
              <View style={styles.plusMenuGrabBar} />
            </View>

            {/* Top Row: Large Buttons */}
            <View style={styles.plusMenuRowLarge}>
              <TouchableOpacity
                style={[styles.plusMenuBigBtn, { backgroundColor: '#34C759' }]}
                onPress={() => {
                  setShowPlusMenu(false);
                  if (hasActiveWorkout) {
                    resumeWorkout();
                  } else {
                    setWorkoutSubView('start');
                    setActiveTab('workout');
                    setProfileSubView('profile');
                  }
                }}
              >
                <Ionicons name="barbell" size={s(32)} color="#fff" style={{ marginBottom: s(8) }} />
                <Text style={styles.plusMenuBigBtnText}>
                  {hasActiveWorkout ? 'Resume Workout' : 'Log Workout'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.plusMenuBigBtn, { backgroundColor: '#FF9500' }]}
                onPress={() => {
                  setShowPlusMenu(false);
                  setActiveTab('food');
                  setProfileSubView('profile');
                }}
              >
                <Ionicons name="nutrition" size={s(32)} color="#fff" style={{ marginBottom: s(8) }} />
                <Text style={styles.plusMenuBigBtnText}>Log Food</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Grid: Smaller Actions */}
            <View style={styles.plusMenuGrid}>
              {[
                { label: 'Weight', icon: 'scale-outline', color: colors.accent },
                { label: 'Water', icon: 'water-outline', color: '#5AC8FA' },
                { label: 'Habit', icon: 'checkbox-outline', color: '#5856D6' },
                { label: 'Creatine', icon: 'flash-outline', color: '#FFCC00' },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.plusMenuGridItem} onPress={() => setShowPlusMenu(false)}>
                  <View style={[styles.plusMenuGridIcon, { backgroundColor: item.color }]}>
                    <Ionicons name={item.icon as any} size={s(22)} color="#fff" />
                  </View>
                  <Text style={styles.plusMenuGridText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {(modalVisible || waitingForAllFinish) && (
        <View style={styles.fullscreenOverlay}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ translateY: modalTranslateY }],
              },
            ]}
          >
            {/* Swipe indicator */}
            <View
              style={styles.swipeIndicatorContainer}
              {...swipeDownPanResponder.panHandlers}
            >
              <View style={styles.swipeIndicator} />
            </View>

            {/* Header bar */}
            <View style={styles.headerRow}>
              {/* Session timer — always dead center */}
              <WorkoutTimerDisplay startRef={workoutStartRef} active={hasActiveWorkout} style={styles.timerElapsed} />

              {/* Left: rest config + invite code */}
              <View style={styles.headerLeftGroup}>
                <TouchableOpacity
                  style={[styles.timerRestBtn, isResting && { backgroundColor: 'rgba(255,149,0,0.12)' }]}
                  onPress={() => setShowRestPresets(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="timer-outline" size={s(12)} color={isResting ? '#FF9500' : colors.textMuted} />
                  <Text style={[styles.timerRestBtnText, isResting && { color: '#FF9500' }]}>
                    {restDuration >= 60 ? `${Math.floor(restDuration / 60)}m` : `${restDuration}s`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timerRestBtn, isResting && { backgroundColor: 'rgba(255,149,0,0.12)' }]}
                  onPress={isResting ? stopRestTimer : () => startRestAnimation()}
                  activeOpacity={0.7}
                >
                  <Ionicons name={isResting ? 'stop' : 'play'} size={s(12)} color={isResting ? '#FF9500' : colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Right: actions */}
              <View style={styles.workoutHeaderRight}>
                <TouchableOpacity onPress={() => setLiveInviteModalVisible(true)} style={styles.topDeleteBtn} activeOpacity={0.7}>
                  <Ionicons name="person-add-outline" size={s(13)} color={colors.text} />
                </TouchableOpacity>
                {liveSessionId ? (
                  <TouchableOpacity onPress={() => {
                    const noParticipants = liveParticipantStates.size === 0;
                    if (isSessionLeader && noParticipants) {
                      Alert.alert('End Session?', 'No one else is in the session.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'End', style: 'destructive', onPress: () => {
                          cancelLiveSession().catch(() => {});
                          cleanupBuddySync();
                          setParticipantFinished(new Map());
                          setParticipantWaiting(new Map());
                          setLiveSessionId(null);
                          setIsSessionLeader(false);
                          setSessionLeaderId(null);
                        }},
                      ]);
                    } else {
                      const msg = isSessionLeader
                        ? 'Leadership will transfer to another participant.'
                        : 'Others can continue their workout.';
                      Alert.alert('Leave Session?', msg, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Leave', style: 'destructive', onPress: () => {
                          leaveLiveSession().catch(() => {});
                          cleanupBuddySync();
                          setParticipantFinished(new Map());
                          setParticipantWaiting(new Map());
                          setLiveSessionId(null);
                          setIsSessionLeader(false);
                          setSessionLeaderId(null);
                        }},
                      ]);
                    }
                  }} style={styles.topDeleteBtn} activeOpacity={0.7}>
                    <Ionicons name="exit-outline" size={s(13)} color="#EF4444" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={deleteActiveWorkout} style={styles.topDeleteBtn} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={s(13)} color="#EF4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={finishWorkout} style={styles.topFinishBtn} activeOpacity={0.8}>
                  <Ionicons name="checkmark" size={s(16)} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Full-width rest bar — appears below header when resting */}
            {(isResting || restCompleted) && (() => {
              const fraction = restDuration > 0 ? 1 - (restTime / restDuration) : 1;
              const fillPct = restDuration > 0 ? (restTime / restDuration) * 100 : 0;
              const barColor = restCompleted ? '#34C759' : restTime <= 9 ? '#FF3B30' : '#FF9500';
              const recoveryTips = [
                'Catching breath',
                'Burn fading',
                'Grip returning',
                'Muscles loosening',
                'Feeling the pump',
                'Heart rate dropping',
                'Getting lighter',
                'Almost recharged',
              ];
              const elapsed = restDuration - restTime;
              const dots = '.'.repeat(elapsed % 6 + 1);
              const tipIndex = Math.floor(elapsed / 6) % recoveryTips.length;
              const microText = restCompleted ? 'GO!' : restTime <= 10 ? 'Almost there' : 'Recovering' + dots + ' ' + recoveryTips[tipIndex];
              return (
              <TouchableOpacity onPress={restCompleted ? undefined : stopRestTimer} activeOpacity={0.8} style={styles.restBarWrap}>
                <Animated.View style={[styles.restBar, { transform: [{ scaleX: restBreathing }, { scale: restCompleted ? restPillScale : 1 }] }]}>
                  {/* Track background */}
                  <View style={[styles.restBarTrack, { backgroundColor: `${barColor}15` }]} />
                  {/* White flash */}
                  <Animated.View style={[styles.restBarTrack, { backgroundColor: '#fff', opacity: restWhiteFlash }]} />
                  {/* Red fill overlay */}
                  <Animated.View style={[styles.restBarTrack, {
                    backgroundColor: '#FF3B30',
                    opacity: restReadyFlash,
                    width: restReadyFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  }]} />
                  {/* Fill */}
                  {restTime !== 10 && <Animated.View style={[styles.restBarFill, { width: `${restCompleted ? 100 : fillPct}%`, backgroundColor: barColor }]} />}
                  {/* Normal content */}
                  <View style={[styles.restBarContent, (restTime <= 10 || restCompleted) && { justifyContent: 'center' }]}>
                    {restTime > 10 && !restCompleted && <Text style={[styles.restBarMicro, { color: barColor }]}>{microText}</Text>}
                    {(restTime <= 9 || restTime > 10 || restCompleted) && (
                      <Animated.Text style={[restTime <= 10 || restCompleted ? styles.restBarTimeBig : styles.restBarTime, { color: barColor, transform: [{ scale: restCountdownScale }] }]}>
                        {restCompleted ? 'GO!' : restTime <= 10 ? String(restTime) : formatTime(restTime)}
                      </Animated.Text>
                    )}
                  </View>
                  {/* GET READY text */}
                  <Animated.View style={[styles.restBarContent, { justifyContent: 'center', opacity: restReadyText }]} pointerEvents="none">
                    <Animated.Text style={{ fontSize: s(15), fontFamily: 'Inter_800ExtraBold', color: '#fff', transform: [{ scale: restReadyText.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
                      GET READY
                    </Animated.Text>
                  </Animated.View>
                </Animated.View>
              </TouchableOpacity>
              );
            })()}

            {/* Rest duration picker modal */}
            <Modal transparent visible={showRestPresets} animationType="fade" onRequestClose={() => setShowRestPresets(false)}>
              <TouchableOpacity style={styles.restModalOverlay} activeOpacity={1} onPress={() => setShowRestPresets(false)}>
                <View style={[styles.restModalCard, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
                  <RestPicker
                    initialDuration={restDuration}
                    onSelect={(d) => setRestDuration(d)}
                    onClose={() => setShowRestPresets(false)}
                  />
                </View>
              </TouchableOpacity>
            </Modal>

            {/* Reconnect to live session banner */}
            {showReconnectBanner && !liveSessionId && (
              <View style={styles.reconnectBanner}>
                <View style={styles.reconnectBannerContent}>
                  <Ionicons name="people" size={s(18)} color="#FF9500" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reconnectBannerTitle}>Buddy Session Found</Text>
                    <Text style={styles.reconnectBannerSub}>You were in a live workout</Text>
                  </View>
                  <TouchableOpacity style={styles.reconnectBtn} onPress={handleLiveReconnect} activeOpacity={0.8}>
                    <Text style={styles.reconnectBtnText}>Rejoin</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={dismissLiveReconnect} style={styles.reconnectDismiss}>
                    <Ionicons name="close" size={s(16)} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

          {/* Mini buddy banner — sticky when scrolled past full banner */}
          {liveSessionId && showMiniBuddyBanner && (
            <MiniLiveSessionBanner
              participantStates={liveParticipantStates}
              connectionStatus={liveConnectionStatus}
              onSendReaction={sendReaction}
              buddySyncState={buddySyncState}
              participantFinished={participantFinished}
              participantWaiting={participantWaiting}
              onPress={() => workoutScrollRef.current?.scrollTo({ y: 0, animated: true })}
            />
          )}

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={s(48)}>
          <ScrollView
            ref={workoutScrollRef}
            style={styles.exercisesList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={true}
            contentContainerStyle={{ paddingBottom: s(120) }}
            scrollEventThrottle={16}
            onScroll={(e) => {
              if (liveSessionId && buddyBannerHeightRef.current > 0) {
                const scrolled = e.nativeEvent.contentOffset.y > buddyBannerHeightRef.current;
                if (scrolled !== showMiniBuddyRef.current) {
                  showMiniBuddyRef.current = scrolled;
                  setShowMiniBuddyBanner(scrolled);
                }
              } else if (showMiniBuddyRef.current) {
                showMiniBuddyRef.current = false;
                setShowMiniBuddyBanner(false);
              }
            }}
          >
            {/* Live Workout Buddy banner */}
            {liveSessionId && (
              <View onLayout={(e) => { buddyBannerHeightRef.current = e.nativeEvent.layout.height; }}>
                <LiveSessionBanner
                  participantStates={liveParticipantStates}
                  connectionStatus={liveConnectionStatus}
                  onSendReaction={sendReaction}
                  isLeader={isSessionLeader}
                  leaderId={sessionLeaderId || undefined}
                  onKickParticipant={(userId) => {
                    const name = liveParticipantStates.get(userId)?.username || 'this participant';
                    Alert.alert('Kick Participant?', `Remove ${name} from the session?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Kick', style: 'destructive', onPress: () => {
                        kickLiveParticipant(userId).catch(() => {});
                      }},
                    ]);
                  }}
                  onTransferLeadership={(userId) => {
                    const name = liveParticipantStates.get(userId)?.username || 'this participant';
                    Alert.alert('Transfer Leadership?', `Make ${name} the session leader?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Transfer', onPress: () => {
                        transferLiveLeadership(userId).then(() => {
                          setIsSessionLeader(isCurrentUserLeader());
                          setSessionLeaderId(userId);
                        }).catch(() => {});
                      }},
                    ]);
                  }}
                  buddySyncState={buddySyncState}
                  participantFinished={participantFinished}
                  participantWaiting={participantWaiting}
                  invitedFriends={invitedFriends}
                />
              </View>
            )}

            {exercises.map((exercise, exerciseIndex) => {
              const isInSuperset = !!exercise.supersetWith;
              const nextExercise = exercises[exerciseIndex + 1];
              const isSupersetFirst = isInSuperset && nextExercise && exercise.supersetWith === nextExercise.id;
              const isSupersetSecond = isInSuperset && exerciseIndex > 0 && exercises[exerciseIndex - 1]?.supersetWith === exercise.id;

              return (
              <View key={exercise.id}>
              {isSupersetSecond && (
                <View style={styles.supersetConnector}>
                  <View style={styles.supersetConnectorLine} />
                  <Text style={styles.supersetConnectorText}>SUPERSET</Text>
                  <View style={styles.supersetConnectorLine} />
                </View>
              )}
              <View style={[
                styles.exerciseCard,
                focusedExerciseId === exercise.id && styles.exerciseCardFocused,
                focusedExerciseId === exercise.id && exercise.sets.length > 0 && exercise.sets.every(st => st.completed) && { borderLeftColor: '#4ADE80' },
                isInSuperset && { borderLeftColor: colors.accent, borderLeftWidth: s(3) },
                isSupersetFirst && { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
                isSupersetSecond && { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
              ]}>
                <View style={styles.exerciseHeader}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => { setSelectedExerciseForStats(exercise.name); setSelectedExerciseTypeForStats(exercise.exerciseType || 'weighted'); setStatsModalVisible(true); }} activeOpacity={0.6}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => cycleExerciseType(exercise.id)}
                    style={{ paddingHorizontal: s(6), paddingVertical: s(2), borderRadius: s(4), backgroundColor: EXERCISE_TYPE_COLORS[exercise.exerciseType], marginLeft: s(6) }}
                    activeOpacity={0.6}
                  >
                    <Text style={{ fontSize: s(9), fontFamily: 'Inter_500Medium', color: '#000', textTransform: 'uppercase', letterSpacing: 0.5 }}>{EXERCISE_TYPE_LABELS[exercise.exerciseType]}</Text>
                  </TouchableOpacity>
                  <View style={[styles.exerciseControls, { marginLeft: s(8) }]}>
                    <TouchableOpacity
                      onPress={() => deleteExercise(exercise.id)}
                      style={styles.deleteIconButton}
                    >
                      <Ionicons name="close" size={s(12)} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.setTableHeader}>
                  <TouchableOpacity
                    style={[styles.setColumnHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(2) }]}
                    onPress={() => setSetTypesHintVisible(true)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.tableHeaderText}>SET</Text>
                    <Ionicons name="help-circle-outline" size={s(10)} color={colors.textMuted} />
                  </TouchableOpacity>
                  <Text style={[styles.tableHeaderText, styles.prevColumnHeader]}>PREV</Text>
                  {(exercise.exerciseType === 'weighted' || exercise.exerciseType === 'weighted_bodyweight') && (
                    <Text style={[styles.tableHeaderText, styles.inputColumnHeader]}>{exercise.exerciseType === 'weighted_bodyweight' ? '+KG' : 'KG'}</Text>
                  )}
                  <Text style={[styles.tableHeaderText, styles.inputColumnHeader]}>{exercise.exerciseType === 'duration' ? 'SEC' : 'REPS'}</Text>
                  <Text style={[styles.tableHeaderText, styles.checkColumnHeader]}></Text>
                </View>

                {exercise.sets.map((set, index) => (
                  <SetRow
                    key={index}
                    exercise={exercise}
                    set={set}
                    index={index}
                    exerciseType={exercise.exerciseType}
                    onComplete={() => toggleSetComplete(exercise.id, index)}
                    onFocus={() => setFocusedExerciseId(exercise.id)}
                    updateSet={(field, value) => updateSet(exercise.id, index, field, value)}
                    onCycleType={() => cycleSetType(exercise.id, index)}
                    onAddDrop={() => addDrop(exercise.id, index)}
                    onUpdateDrop={(dropIdx, field, value) => updateDrop(exercise.id, index, dropIdx, field, value)}
                    onRemoveDrop={(dropIdx) => removeDrop(exercise.id, index, dropIdx)}
                    onDelete={() => deleteSet(exercise.id, index)}
                  />
                ))}


                <View style={styles.exerciseActions}>
                  <TouchableOpacity
                    style={styles.addSetButton}
                    onPress={() => addSet(exercise.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={s(13)} color={colors.accent} />
                    <Text style={styles.addSetButtonText}>Add Set</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.duplicateSetButton}
                    onPress={() => replaceExercise(exercise.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="repeat-outline" size={s(11)} color={colors.textSecondary} />
                    <Text style={styles.duplicateSetButtonText}>Change</Text>
                  </TouchableOpacity>
                  {exerciseIndex > 0 && (
                    <TouchableOpacity
                      style={styles.duplicateSetButton}
                      onPress={() => moveExercise(exercise.id, 'up')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-up-outline" size={s(11)} color={colors.textSecondary} />
                      <Text style={styles.duplicateSetButtonText}>Up</Text>
                    </TouchableOpacity>
                  )}
                  {exerciseIndex < exercises.length - 1 && (
                    <TouchableOpacity
                      style={styles.duplicateSetButton}
                      onPress={() => moveExercise(exercise.id, 'down')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-down-outline" size={s(11)} color={colors.textSecondary} />
                      <Text style={styles.duplicateSetButtonText}>Down</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              </View>
              );
            })}

            {/* Add exercise button — at bottom of list */}
            <TouchableOpacity
              style={styles.inlineAddExercise}
              onPress={() => setExerciseSelectorVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={s(16)} color="#fff" />
              <Text style={styles.inlineAddExerciseText}>Add Exercise</Text>
            </TouchableOpacity>

          </ScrollView>
          </KeyboardAvoidingView>

          {/* Live reaction toast — absolute positioned over workout modal */}
          <LiveReactionToast reaction={liveReaction} />

          {/* Waiting for others to finish overlay */}
          {waitingForAllFinish && (
            <View style={styles.waitingOverlay}>
              <View style={styles.waitingCard}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.waitingTitle}>Workout Saved!</Text>
                <Text style={styles.waitingSubtitle}>
                  {liveParticipantStates.size > 1 ? 'Waiting for others to finish...' : 'Waiting for your buddy to finish...'}
                </Text>
                <Text style={styles.waitingHint}>Your workout has been saved. Once everyone finishes, you'll see the session summary.</Text>
                <TouchableOpacity
                  style={styles.forceEndBtn}
                  onPress={() => {
                    Alert.alert(
                      'End Session?',
                      'This will end the live session just for you. Others can continue their workout.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'End For Me',
                          style: 'destructive',
                          onPress: async () => {
                            const pendingSummary = pendingWorkoutSummaryRef.current;
                            const pendingSessionId = liveSessionId;
                            pendingWorkoutSummaryRef.current = null;
                            setWaitingForAllFinish(false);
                            waitingForAllFinishRef.current = false;
                            setParticipantFinished(new Map());
                            setParticipantWaiting(new Map());
                            cleanupBuddySync();
                            forceEndLiveSession();

                            // Fetch session summary before clearing session ID
                            if (pendingSessionId) {
                              try {
                                const summary = await getSessionSummary(pendingSessionId);
                                setLiveSessionSummary(summary);
                              } catch {}
                            }
                            setLiveSessionId(null);

                            // Clean up workout state
                            setExercises([]);
                            setIsResting(false);
                            setRestTime(0);
                            setHasActiveWorkout(false);
                            setStartedFromRoutine(false);
                            setModalVisible(false);

                            // Always show summary — workout was already saved
                            if (pendingSummary) {
                              setSelectedWorkout(pendingSummary);
                              setIsJustCompleted(true);
                              setSummaryModalVisible(true);
                            }
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="exit-outline" size={s(16)} color="#EF4444" />
                  <Text style={styles.forceEndBtnText}>End Session For Me</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          </Animated.View>
        </View>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={exerciseSelectorVisible}
        onRequestClose={() => { setExerciseSelectorVisible(false); setExerciseSearch(''); setReplacingExerciseId(null); }}
      >
        <KeyboardAvoidingView style={styles.exerciseSelectorModal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.exerciseSelectorContent}>
            <View style={styles.exerciseSelectorDragHandle} />
            <View style={styles.exerciseSelectorHeader}>
              <Text style={styles.exerciseSelectorTitle}>{replacingExerciseId ? 'Replace Exercise' : 'Select Exercise'}</Text>
              <TouchableOpacity
                onPress={() => { setExerciseSelectorVisible(false); setExerciseSearch(''); setReplacingExerciseId(null); }}
                style={styles.exerciseSelectorClose}
              >
                <Ionicons name="close" size={s(18)} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.exerciseSearchContainer}>
              <Ionicons name="search" size={s(16)} color={colors.textMuted} />
              <TextInput
                style={styles.exerciseSearchInput}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textMuted}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {exerciseSearch.length > 0 && (
                <TouchableOpacity onPress={() => setExerciseSearch('')}>
                  <Ionicons name="close-circle" size={s(16)} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={exerciseList.filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase()))}
              keyExtractor={(item) => item.name}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.exerciseListItem}
                  onPress={() => { addExercise(item.name); setExerciseSearch(''); }}
                >
                  <Text style={styles.exerciseListItemText}>{item.name}</Text>
                  {item.exerciseType !== 'weighted' && (
                    <Text style={{ fontSize: s(10), fontFamily: 'Inter_500Medium', color: colors.textMuted, marginLeft: s(8) }}>
                      {item.exerciseType === 'bodyweight' ? 'BW' : item.exerciseType === 'duration' ? 'Timed' : '+Weight'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.exerciseSearchEmpty}>
                  <Text style={styles.exerciseSearchEmptyText}>No exercises found</Text>
                </View>
              }
              ListFooterComponent={
                exerciseSearch.trim().length > 0 &&
                !exerciseList.some(e => e.name.toLowerCase() === exerciseSearch.trim().toLowerCase()) ? (
                  <TouchableOpacity
                    style={styles.addCustomExerciseButton}
                    disabled={addingExercise}
                    onPress={async () => {
                      const name = exerciseSearch.trim();
                      setAddingExercise(true);
                      const success = await addCustomExercise(name);
                      if (success) {
                        await loadExerciseList();
                        addExercise(name);
                        setExerciseSearch('');
                      }
                      setAddingExercise(false);
                    }}
                  >
                    {addingExercise ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={s(20)} color={colors.accent} />
                        <Text style={styles.addCustomExerciseText}>Create "{exerciseSearch.trim()}"</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Workout Summary Modal */}
      <WorkoutSummaryModal
        visible={summaryModalVisible}
        workout={selectedWorkout}
        onClose={() => {
          setSummaryModalVisible(false);
          setIsJustCompleted(false);
          setLiveSessionSummary(null);
        }}
        onEdit={handleEditWorkout}
        onDelete={handleDeleteWorkout}
        isJustCompleted={isJustCompleted}
        liveSessionSummary={liveSessionSummary}
      />

      {/* Workout List Modal (for multiple workouts on same day) */}
      <WorkoutListModal
        visible={workoutListModalVisible}
        date={selectedDate || ''}
        workouts={selectedDayWorkouts}
        onClose={() => setWorkoutListModalVisible(false)}
        onSelectWorkout={handleSelectWorkout}
      />

      {/* Weight Input Modal */}
      <Modal
        visible={showWeightModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowWeightModal(false); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity
          style={styles.weightModalOverlay}
          activeOpacity={1}
          onPress={() => { setShowWeightModal(false); }}
        >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.weightModalContent}>
                <Text style={styles.weightModalTitle}>Log Today's Weight</Text>
                <View style={styles.weightInputRow}>
                  <TextInput
                    style={styles.weightModalInput}
                    keyboardType="decimal-pad"
                    placeholder="0.0"
                    placeholderTextColor={colors.textMuted}
                    value={weightInput}
                    onChangeText={setWeightInput}
                  />
                  <Text style={styles.weightModalUnit}>kg</Text>
                </View>
                <View style={styles.weightModalButtons}>
                  <TouchableOpacity
                    style={styles.weightModalCancelButton}
                    onPress={() => {
                      setShowWeightModal(false);
                      setWeightInput('');
                    }}
                  >
                    <Text style={styles.weightModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.weightModalSaveButton}
                    onPress={handleSaveWeight}
                  >
                    <Text style={styles.weightModalSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Weight History Modal */}
      <WeightHistoryModal
        visible={showWeightHistoryModal}
        entries={weightStats.entries}
        trendLine={weightStats.trendLine}
        onClose={() => setShowWeightHistoryModal(false)}
        onDelete={handleDeleteWeightEntry}
      />

      {/* Set Types Hint Modal */}
      <Modal visible={setTypesHintVisible} transparent animationType="fade" onRequestClose={() => setSetTypesHintVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setSetTypesHintVisible(false)}>
          <View style={{ backgroundColor: colors.card, borderRadius: s(16), padding: s(20), width: '85%', gap: s(14) }}>
            <Text style={{ fontSize: s(15), fontFamily: 'Inter_700Bold', color: colors.text, textAlign: 'center' }}>Set Types</Text>
            <Text style={{ fontSize: s(11), fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center' }}>Tap the colored circle to cycle through types</Text>
            {([
              { label: 'Warm Up', desc: 'Lighter sets to prepare muscles and joints', pastel: '#FFFFFF' },
              { label: 'Working', desc: 'Your main sets at target weight', pastel: '#FDE68A' },
              { label: 'Drop Set', desc: 'Reduce weight immediately and continue reps', pastel: '#FFB3A1' },
              { label: 'Failure', desc: 'Push until you cannot complete another rep', pastel: '#E8879E' },
            ] as const).map((item) => (
              <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
                <View style={{ width: s(22), height: s(22), borderRadius: s(11), backgroundColor: item.pastel, borderWidth: item.pastel === '#FFFFFF' ? 1 : 0, borderColor: colors.border }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: s(12), fontFamily: 'Inter_700Bold', color: colors.text }}>{item.label}</Text>
                  <Text style={{ fontSize: s(10), fontFamily: 'Inter_400Regular', color: colors.textSecondary, marginTop: s(1) }}>{item.desc}</Text>
                </View>
              </View>
            ))}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: s(12), marginTop: s(4), alignItems: 'center' }}>
              <Text style={{ fontSize: s(11), fontFamily: 'Inter_400Regular', color: colors.textSecondary }}>Press and hold a set to delete it</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Exercise Stats Modal */}
      <ExerciseStatsModal
        visible={statsModalVisible}
        exerciseName={selectedExerciseForStats}
        exerciseType={selectedExerciseTypeForStats}
        onClose={() => { setStatsModalVisible(false); setSelectedExerciseForStats(null); }}
      />

      {/* Live Workout Invite Modal (friend picker + routine selection) */}
      <LiveInviteModal
        visible={liveInviteModalVisible}
        onClose={() => setLiveInviteModalVisible(false)}
        midSession={!!liveSessionId}
        inviteCode={getCurrentSession()?.inviteCode || undefined}
        sessionParticipantIds={liveSessionId ? Array.from(liveParticipantStates.keys()) : undefined}
        currentSessionId={liveSessionId || undefined}
        onInvite={async (friendIds, routineData, groupOptions, friendNames) => {
          setLiveInviteModalVisible(false);

          // Track invited friends
          if (friendNames) {
            const newInvites = friendIds.map(id => ({
              userId: id,
              name: friendNames[id] || 'Unknown',
              status: 'pending' as const,
            }));
            setInvitedFriends(prev => [...prev, ...newInvites]);
          }

          // Mid-session invite: just send notifications to selected friends
          if (liveSessionId) {
            await inviteToExistingSession(liveSessionId, friendIds);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return;
          }

          // New session flow
          const sessionId = await createLiveSession(friendIds, routineData ? {
            routineData: routineData.exercises.map((e, i) => ({ name: e.name, sets: e.sets, exercise_order: i + 1 })),
            syncMode: routineData.syncMode,
            routineName: routineData.routineName,
          } : undefined, groupOptions);
          if (sessionId) {
            setLiveSessionId(sessionId);
            await joinSessionChannel(sessionId);
            // If routine was selected, auto-start the workout from it
            if (routineData) {
              await startWorkoutFromRoutine(routineData.exercises);
              initBuddySync(routineData.exercises, routineData.syncMode, {
                onStartSyncedRest: (duration) => startRestAnimation(duration),
                onAdvanceExercise: (idx) => {
                  if (exercises[idx]) setFocusedExerciseId(exercises[idx].id);
                },
                onSyncStateChanged: () => {},
              });
            }
          }
        }}
      />

      {/* Live Workout Invite Received Modal */}
      <LiveInviteReceivedModal
        visible={liveInviteReceivedVisible}
        hostName={pendingLiveInvite?.hostName || ''}
        routineName={pendingLiveInvite?.routineName}
        routineExercises={pendingLiveInvite?.routineExercises}
        syncMode={pendingLiveInvite?.syncMode as any}
        hasActiveWorkout={hasActiveWorkout}
        onAccept={async () => {
          if (!pendingLiveInvite) {
            setLiveInviteReceivedVisible(false);
            return;
          }
          const sid = pendingLiveInvite.sessionId;
          // Verify session is still joinable before accepting
          const check = await getLiveSession(sid);
          if (!check.success || !check.data || check.data.status === 'completed' || check.data.status === 'cancelled') {
            setLiveInviteReceivedVisible(false);
            setPendingLiveInvite(null);
            Alert.alert('Session Ended', 'This live session is no longer available.');
            return;
          }
          setLiveInviteReceivedVisible(false);
          setPendingLiveInvite(null);
          try {
            const accepted = await acceptLiveInvite(sid);
            if (accepted) {
              setLiveSessionId(sid);
              if (hasActiveWorkout) {
                // Already working out — keep current exercises, just attach to session
                setModalVisible(true);
              } else {
                // Not working out — check if session has a routine to start from
                const sessionResult = await getLiveSession(sid);
                const sData = sessionResult.success ? sessionResult.data : null;
                if (sData?.routine_data && sData?.sync_mode) {
                  const routineExercises = sData.routine_data.map((e: any) => ({
                    name: e.name,
                    sets: e.sets,
                  }));
                  await startWorkoutFromRoutine(routineExercises);
                  joinBuddySync(routineExercises, sData.sync_mode, {
                    onStartSyncedRest: (duration) => startRestAnimation(duration),
                    onAdvanceExercise: (idx) => {
                      if (exercises[idx]) setFocusedExerciseId(exercises[idx].id);
                    },
                    onSyncStateChanged: () => {},
                  });
                } else {
                  // Free-form session — start empty workout
                  setModalVisible(true);
                  setHasActiveWorkout(true);
                  workoutTimeRef.current = 0;
                  workoutStartRef.current = Date.now();
                  setExercises([]);
                  setStartedFromRoutine(false);
                }
              }
            } else {
              Alert.alert('Error', 'Could not join live session. It may have been cancelled.');
            }
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to join live session.');
          }
        }}
        onDecline={async () => {
          setLiveInviteReceivedVisible(false);
          if (pendingLiveInvite) {
            await declineLiveInvite(pendingLiveInvite.sessionId);
          }
          setPendingLiveInvite(null);
        }}
      />

      {/* Join Request Modal */}
      <JoinRequestModal
        visible={joinRequestModal.visible}
        senderName={joinRequestModal.senderName}
        loading={joinRequestModal.loading}
        onAccept={async () => {
          setJoinRequestModal(prev => ({ ...prev, loading: true }));
          markNotificationRead(joinRequestModal.notifId).catch(() => {});
          // Track as invited friend
          setInvitedFriends(prev => [...prev, { userId: joinRequestModal.senderId, name: joinRequestModal.senderName, status: 'pending' }]);
          try {
            let sessionId = liveSessionIdRef.current;
            if (sessionId) {
              await inviteToExistingSession(sessionId, [joinRequestModal.senderId]);
            } else {
              const newSessionId = await createLiveSession([joinRequestModal.senderId]);
              if (newSessionId) {
                sessionId = newSessionId;
                await updateLiveSessionStatus(newSessionId, 'active', {
                  started_at: new Date().toISOString(),
                });
                await joinSessionChannel(newSessionId);
                setLiveSessionId(newSessionId);
              }
            }
            // Tell the requester they were accepted — they auto-join from this
            if (sessionId) {
              createNotification(
                joinRequestModal.senderId, 'live_accepted', 'Join Request Accepted',
                'You\'ve been added to the workout!',
                { session_id: sessionId, accepted_join: true }
              ).catch(() => {});
            }
          } catch (e) {
            Alert.alert('Error', 'Failed to add them to your session.');
          }
          setJoinRequestModal({ visible: false, senderName: '', senderId: '', notifId: '', loading: false });
        }}
        onDecline={() => {
          markNotificationRead(joinRequestModal.notifId).catch(() => {});
          createNotification(joinRequestModal.senderId, 'join_request', 'Join request declined', 'Your request to join was declined.', { declined: true }).catch(() => {});
          setJoinRequestModal({ visible: false, senderName: '', senderId: '', notifId: '', loading: false });
        }}
      />

      {/* Join by Invite Code Modal */}
      <JoinByCodeModal
        visible={joinByCodeModalVisible}
        onClose={() => setJoinByCodeModalVisible(false)}
        onJoined={async (sessionId) => {
          setJoinByCodeModalVisible(false);
          setLiveSessionId(sessionId);
          if (hasActiveWorkout) {
            // Already working out — keep current exercises, just attach to session
            setModalVisible(true);
          } else {
            // Fetch session to get routine data and start workout
            const sessionResult = await getLiveSession(sessionId);
            const sData = sessionResult.success ? sessionResult.data : null;
            if (sData?.routine_data && sData?.sync_mode) {
              const routineExercises = sData.routine_data.map((e: any) => ({
                name: e.name,
                sets: e.sets,
              }));
              await startWorkoutFromRoutine(routineExercises);
              joinBuddySync(routineExercises, sData.sync_mode, {
                onStartSyncedRest: (duration) => startRestAnimation(duration),
                onAdvanceExercise: (idx) => {
                  if (exercises[idx]) setFocusedExerciseId(exercises[idx].id);
                },
                onSyncStateChanged: () => {},
              });
            } else {
              // Free-form session — start empty workout
              setModalVisible(true);
              setHasActiveWorkout(true);
              workoutTimeRef.current = 0;
              workoutStartRef.current = Date.now();
              setExercises([]);
              setStartedFromRoutine(false);
            }
          }
        }}
      />

      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(16),
    paddingBottom: s(12),
    backgroundColor: c.card,
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: s(10),
    flexShrink: 1,
  },
  headerBrandText: {
    fontSize: s(20),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    letterSpacing: s(-0.5),
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: s(4),
    flexShrink: 0,
  },
  streakBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: s(7),
    paddingVertical: s(4),
    borderRadius: s(12),
    gap: s(3),
    borderWidth: 1,
  },
  streakBadgeText: {
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
    color: '#FF9500',
  },
  headerAvatar: {
    width: s(32),
    height: s(32),
    borderRadius: s(12),
    backgroundColor: '#007AFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: s(2),
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
  },
  scrollContent: {
    paddingTop: s(16),
    paddingBottom: s(40),
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderTopWidth: 0,
    paddingTop: s(10),
    paddingHorizontal: s(20),
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(4),
  },
  tabItemWithBadge: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: s(-4),
    right: s(-10),
    backgroundColor: '#F87171', // Red 400
    borderRadius: s(8),
    minWidth: s(16),
    height: s(16),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(3),
    borderWidth: s(1),
    borderColor: c.card,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: s(9),
    fontFamily: 'Inter_700Bold',
  },
  // Plus Menu
  plusMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  plusMenuContainerNew: {
    backgroundColor: c.card,
    borderTopLeftRadius: s(24),
    borderTopRightRadius: s(24),
    paddingHorizontal: s(20),
    paddingBottom: s(40),
    minHeight: s(350),
    paddingTop: s(12),
  },
  plusMenuGrabArea: {
    width: '100%',
    height: s(30),
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: s(10),
  },
  plusMenuGrabBar: {
    width: s(48),
    height: s(6),
    borderRadius: s(3),
    backgroundColor: c.textMuted,
  },
  plusMenuRowLarge: {
    flexDirection: 'row',
    gap: s(12),
    marginBottom: s(16),
  },
  plusMenuBigBtn: {
    flex: 1,
    height: s(120),
    borderRadius: s(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusMenuBigBtnText: {
    fontSize: s(17),
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: s(10),
    lineHeight: s(22),
  },
  plusMenuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(12),
    justifyContent: 'space-between',
  },
  plusMenuGridItem: {
    width: '48%',
    backgroundColor: c.border,
    borderRadius: s(8),
    paddingVertical: s(14),
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: s(14),
    gap: s(12),
    marginBottom: s(6),
  },
  plusMenuGridIcon: {
    width: s(34),
    height: s(34),
    borderRadius: s(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusMenuGridText: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  activeWorkoutBanner: {
    paddingHorizontal: s(16),
    paddingVertical: s(8),
    backgroundColor: 'transparent',
    position: 'absolute',
    left: 0,
    right: 0,
  },
  activeWorkoutFloatingButton: {
    backgroundColor: '#4ADE80',
    paddingVertical: s(14),
    paddingHorizontal: s(18),
    borderRadius: s(10),
  },
  activeWorkoutFloatingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeWorkoutFloatingTitle: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.bg,
    marginBottom: s(3),
  },
  activeWorkoutFloatingSubtitle: {
    fontSize: s(13),
    color: c.card,
    fontFamily: 'Inter_600SemiBold',
  },
  activeWorkoutFloatingArrow: {
    fontSize: s(22),
    color: c.bg,
    fontFamily: 'Inter_700Bold',
    marginLeft: s(10),
  },
  // Dashboard Cards
  summary14Day: {
    backgroundColor: c.card,
    marginHorizontal: s(16),
    marginTop: s(16),
    marginBottom: s(12),
    padding: s(18),
    borderRadius: s(10),
  },
  summary14DayTitle: {
    fontSize: s(16),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    marginBottom: s(14),
    letterSpacing: s(-0.5),
    textAlign: 'center',
  },
  volumeCard: {
    backgroundColor: '#38BDF8',
    padding: s(20),
    borderRadius: s(8),
    alignItems: 'center',
    marginBottom: s(12),
  },
  volumeValue: {
    fontSize: s(36),
    fontFamily: 'Inter_800ExtraBold',
    color: c.bg,
    marginBottom: s(4),
    letterSpacing: s(-1),
  },
  volumeLabel: {
    fontSize: s(12),
    color: c.card,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: s(1.5),
  },
  statsGrid: {
    flexDirection: 'row',
    gap: s(10),
    justifyContent: 'center',
  },
  statCard: {
    flex: 1,
    backgroundColor: c.border,
    padding: s(12),
    borderRadius: s(12),
    alignItems: 'center',
    borderWidth: s(1),
    borderColor: c.textMuted,
  },
  statCardValue: {
    fontSize: s(16),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    marginBottom: s(4),
  },
  statCardLabel: {
    fontSize: s(11),
    color: c.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  // Top Cards Row (Nutrition + Supplements side by side)
  topCardsRow: {
    flexDirection: 'row' as const,
    marginHorizontal: s(16),
    gap: s(10),
  },
  // Nutrition Card (left half)
  nutritionCardCompact: {
    flex: 1,
    backgroundColor: c.card,
    paddingTop: s(14),
    paddingBottom: s(14),
    paddingHorizontal: s(14),
    borderRadius: s(10),
    alignItems: 'center' as const,
  },
  compactCardTitle: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    marginBottom: s(10),
    textTransform: 'uppercase' as const,
    letterSpacing: s(1),
  },
  compactCalorieValue: {
    fontSize: s(20),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    letterSpacing: s(-0.5),
  },
  compactCalorieLabel: {
    fontSize: s(9),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
    marginTop: s(2),
  },
  macroBarsList: {
    width: '100%' as any,
    marginTop: s(14),
    gap: s(8),
  },
  macroBarRow: {
    width: '100%' as any,
  },
  macroBarLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: s(4),
  },
  macroDot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
    marginRight: s(5),
  },
  macroBarLabel: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
    flex: 1,
  },
  macroBarValue: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  macroBarGoal: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  macroBarTrack: {
    height: s(3),
    backgroundColor: c.border,
    borderRadius: s(1.5),
    overflow: 'hidden' as const,
  },
  macroBarFill: {
    height: '100%' as any,
    borderRadius: s(1.5),
  },
  // Supplement Column (right half, stacked)
  supplementColumn: {
    flex: 1,
    gap: s(10),
  },
  supplementMiniCard: {
    flex: 1,
    backgroundColor: c.card,
    padding: s(12),
    borderRadius: s(10),
  },
  supplementHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: s(5),
    marginBottom: s(6),
  },
  supplementTitle: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: s(0.6),
  },
  supplementValue: {
    fontSize: s(16),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    marginBottom: s(6),
  },
  supplementGoalText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
  },
  progressBarTrack: {
    height: s(4),
    backgroundColor: c.border,
    borderRadius: s(2),
    overflow: 'hidden' as const,
    marginBottom: s(8),
  },
  progressBarFill: {
    height: '100%' as any,
    borderRadius: s(2),
  },
  quickAddRow: {
    flexDirection: 'row' as const,
    gap: s(6),
  },
  quickAddBtn: {
    flex: 1,
    backgroundColor: c.border,
    paddingVertical: s(5),
    borderRadius: s(8),
    alignItems: 'center' as const,
  },
  quickAddText: {
    fontSize: s(11),
    color: c.text,
    fontFamily: 'Inter_700Bold',
  },
  // Original nutrition card styles (kept for reference/other uses)
  nutritionCard: {
    backgroundColor: c.card,
    marginHorizontal: s(16),
    marginTop: 0,
    marginBottom: s(8),
    padding: s(18),
    borderRadius: s(10),
  },
  nutritionCardTitle: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    marginBottom: s(14),
    textAlign: 'center',
  },
  nutritionRingsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  ringCalorieValue: {
    fontSize: s(24),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    letterSpacing: s(-0.5),
  },
  ringCalorieLabel: {
    fontSize: s(11),
    color: c.textSecondary,
    fontFamily: 'Inter_600SemiBold',
  },
  ringCalorieUnit: {
    fontSize: s(10),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
  },
  macroRingsColumn: {
    marginLeft: s(24),
    gap: s(6),
  },
  macroRingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  macroRingValue: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  macroRingLabel: {
    fontSize: s(13),
    color: c.text,
    fontFamily: 'Inter_600SemiBold',
  },
  macroRingGoal: {
    fontSize: s(11),
    color: c.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  // Chart Carousel
  chartCarousel: {
    marginTop: s(16),
    marginBottom: s(12),
  },
  carouselPage: {
    width: Dimensions.get('window').width - s(32),
    marginHorizontal: s(16),
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: s(6),
    marginTop: s(6),
  },
  carouselDot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
    backgroundColor: c.border,
  },
  carouselDotActive: {
    backgroundColor: c.text,
    width: s(16),
  },
  // Weight Card
  weightCard: {
    backgroundColor: c.card,
    padding: s(12),
    borderRadius: s(10),
  },
  weightCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(8),
  },
  weightCardTitle: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  logWeightButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: s(8),
    paddingVertical: s(8),
    paddingHorizontal: s(12),
  },
  logWeightButtonTextSmall: {
    fontSize: s(13),
    color: c.accent,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: s(4),
  },
  weightStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: s(10),
  },
  weightStatItem: {
    alignItems: 'center',
  },
  weightStatValue: {
    fontSize: s(18),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    letterSpacing: s(-0.5),
  },
  weightStatLabel: {
    fontSize: s(12),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
    marginTop: s(4),
  },
  weightTrendDown: {
    color: '#34C759',
  },
  weightTrendUp: {
    color: '#FF9500',
  },
  weightChartContainer: {
    backgroundColor: c.bg,
    borderRadius: s(8),
    padding: s(8),
  },
  weightChartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: s(6),
    gap: s(16),
  },
  weightLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightLegendDot: {
    width: s(10),
    height: s(10),
    borderRadius: s(5),
    marginRight: s(6),
  },
  weightLegendText: {
    fontSize: s(11),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
  },
  weightEmptyChart: {
    backgroundColor: c.bg,
    borderRadius: s(8),
    padding: s(36),
    alignItems: 'center',
  },
  weightEmptyText: {
    fontSize: s(14),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  // Weight Modal
  weightModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(24),
  },
  weightModalContent: {
    backgroundColor: c.card,
    borderRadius: s(22),
    padding: s(28),
    width: s(320),
  },
  weightModalTitle: {
    fontSize: s(20),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    textAlign: 'center',
    marginBottom: s(24),
  },
  weightInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(28),
  },
  weightModalInput: {
    backgroundColor: c.bg,
    borderRadius: s(8),
    paddingHorizontal: s(24),
    paddingVertical: s(16),
    fontSize: s(28),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    minWidth: s(140),
    textAlign: 'center',
  },
  weightModalUnit: {
    fontSize: s(20),
    color: c.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: s(12),
  },
  weightModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s(12),
  },
  weightModalCancelButton: {
    flex: 1,
    backgroundColor: c.border,
    borderRadius: s(8),
    paddingVertical: s(16),
    alignItems: 'center',
  },
  weightModalCancelText: {
    fontSize: s(16),
    color: c.textSecondary,
    fontFamily: 'Inter_600SemiBold',
  },
  weightModalSaveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: s(8),
    paddingVertical: s(16),
    alignItems: 'center',
  },
  weightModalSaveText: {
    fontSize: s(17),
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
  // Workout Modal (fullscreen overlay replaces <Modal> to avoid iOS Fabric freeze)
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: c.bg,
    paddingTop: s(10),
    marginTop: s(48),
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    overflow: 'hidden',
  },
  swipeIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: s(8),
    backgroundColor: c.bg,
  },
  swipeIndicator: {
    width: s(36),
    height: s(5),
    backgroundColor: c.border,
    borderRadius: s(3),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(16),
    paddingBottom: s(12),
    paddingTop: s(2),
  },
  modalTitle: {
    fontSize: s(18),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(16),
  },
  deleteWorkoutButton: {
    width: s(36),
    height: s(36),
    borderRadius: s(12),
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    fontSize: s(18),
    color: c.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  // Workout header bar
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(14),
    paddingVertical: s(8),
  },
  workoutHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    zIndex: 1,
  },
  timerElapsed: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: s(20),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    zIndex: 1,
  },
  timerRestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    backgroundColor: c.border,
    paddingHorizontal: s(8),
    paddingVertical: s(6),
    borderRadius: s(8),
  },
  timerRestBtnText: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    fontVariant: ['tabular-nums'],
  },
  // Full-width rest bar
  restBarWrap: {
    paddingHorizontal: s(14),
    paddingBottom: s(6),
  },
  restBar: {
    height: s(28),
    borderRadius: s(8),
    overflow: 'hidden',
    position: 'relative',
  },
  restBarTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: s(8),
  },
  restBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: s(8),
    opacity: 0.2,
  },
  restBarContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(12),
  },
  restBarMicro: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
  },
  restBarTime: {
    fontSize: s(13),
    fontFamily: 'Inter_800ExtraBold',
    fontVariant: ['tabular-nums'],
  },
  restBarTimeBig: {
    fontSize: s(15),
    fontFamily: 'Inter_800ExtraBold',
    fontVariant: ['tabular-nums'],
  },
  // Rest duration modal
  restModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(40),
  },
  restModalCard: {
    borderRadius: s(16),
    padding: s(16),
    width: '100%',
    maxWidth: s(300),
  },
  restModalTitle: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    textAlign: 'center',
    marginBottom: s(16),
  },
  restModalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(8),
  },
  restModalBtn: {
    width: '30%',
    flexGrow: 1,
    paddingVertical: s(12),
    borderRadius: s(10),
    backgroundColor: c.border,
    alignItems: 'center',
  },
  restModalBtnActive: {
    backgroundColor: '#FF9500',
  },
  restModalBtnText: {
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
    color: c.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  restModalBtnTextActive: {
    color: '#fff',
  },
  floatingReconnectBadge: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: s(6),
  },
  reconnectBanner: {
    marginHorizontal: s(14),
    marginBottom: s(10),
    borderRadius: s(12),
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.25)',
    overflow: 'hidden',
  },
  reconnectBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s(12),
    gap: s(10),
  },
  reconnectBannerTitle: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: '#FF9500',
  },
  reconnectBannerSub: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
    marginTop: s(1),
  },
  reconnectBtn: {
    backgroundColor: '#FF9500',
    paddingHorizontal: s(14),
    paddingVertical: s(8),
    borderRadius: s(8),
  },
  reconnectBtnText: {
    color: '#fff',
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
  },
  reconnectDismiss: {
    padding: s(4),
  },
  inlineAddExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: s(5),
    backgroundColor: c.accent,
    paddingHorizontal: s(16),
    paddingVertical: s(10),
    borderRadius: s(24),
    marginTop: s(12),
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  inlineAddExerciseText: {
    color: '#fff',
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
  },
  exercisesList: {
    flex: 1,
    paddingHorizontal: s(12),
  },
  exerciseCard: {
    backgroundColor: c.card,
    borderRadius: s(12),
    borderTopLeftRadius: s(3),
    borderBottomLeftRadius: s(3),
    padding: s(10),
    marginBottom: s(8),
    borderLeftWidth: s(3),
    borderLeftColor: 'transparent',
  },
  exerciseCardFocused: {
    borderLeftColor: '#D1D5DB',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(6),
  },
  exerciseName: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  exerciseControls: {
    flexDirection: 'row',
    gap: s(4),
  },
  iconButton: {
    width: s(24),
    height: s(24),
    borderRadius: s(6),
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: s(14),
    color: c.text,
    fontFamily: 'Inter_700Bold',
  },
  deleteIconButton: {
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(4),
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconText: {
    fontSize: s(16),
    color: '#F87171',
    fontFamily: 'Inter_700Bold',
  },
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: s(4),
    paddingLeft: s(20),
    paddingRight: s(6),
    marginBottom: s(2),
    gap: s(8),
  },
  tableHeaderText: {
    fontSize: s(9),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  setColumnHeader: { width: s(30) },
  prevColumnHeader: { width: s(50) },
  inputColumnHeader: { flex: 1 },
  checkColumnHeader: { width: s(36) },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(5),
    paddingLeft: s(20),
    paddingRight: s(6),
    gap: s(8),
    borderRadius: s(8),
    marginBottom: s(2),
  },
  setRowCompleted: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  setNumberCell: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    backgroundColor: `${c.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setNumberText: {
    fontSize: s(10),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
  },
  setNumberTextCompleted: {
    color: '#4ADE80',
  },
  prevCell: {
    width: s(50),
    alignItems: 'center',
  },
  prevText: {
    fontSize: s(11),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
    fontVariant: ['tabular-nums'],
  },
  compactInput: {
    flex: 1,
    backgroundColor: c.bg,
    borderRadius: s(6),
    paddingVertical: s(6),
    textAlign: 'center',
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  compactInputCompleted: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    color: '#4ADE80',
  },
  checkButton: {
    width: s(26),
    height: s(26),
    borderRadius: s(13),
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: s(2),
    borderColor: c.border,
  },
  checkButtonActive: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  checkButtonText: {
    fontSize: s(12),
    color: c.border,
    fontFamily: 'Inter_700Bold',
  },
  checkButtonTextActive: {
    color: '#fff',
  },
  exerciseActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: s(4),
    gap: s(6),
  },
  addSetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
    paddingVertical: s(6),
    borderRadius: s(6),
  },
  addSetButtonText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },
  duplicateSetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
    paddingVertical: s(6),
    borderRadius: s(6),
  },
  duplicateSetButtonText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  dropSubRows: {
    marginLeft: s(16),
    paddingLeft: s(8),
    borderLeftWidth: s(2),
    borderLeftColor: 'rgba(244, 63, 94, 0.2)',
    marginBottom: s(4),
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(3),
    paddingHorizontal: s(6),
    gap: s(8),
    borderRadius: s(6),
    marginBottom: s(2),
  },
  addDropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(3),
    paddingVertical: s(4),
    marginTop: s(2),
  },
  addDropButtonText: {
    fontSize: s(10),
    fontFamily: 'Inter_600SemiBold',
    color: '#F43F5E',
  },
  supersetConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(2),
    gap: s(6),
  },
  supersetConnectorLine: {
    flex: 1,
    height: s(1),
    backgroundColor: c.accent,
    opacity: 0.3,
  },
  supersetConnectorText: {
    fontSize: s(9),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
    letterSpacing: 1,
  },
  topDeleteBtn: {
    width: s(30),
    height: s(30),
    borderRadius: s(8),
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topFinishBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    height: s(30),
    width: s(30),
    borderRadius: s(8),
  },
  topFinishBtnText: {
    color: '#fff',
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
  },
  waitingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    borderRadius: s(16),
  },
  waitingCard: {
    backgroundColor: c.card,
    borderRadius: s(20),
    padding: s(28),
    alignItems: 'center',
    width: '85%',
    gap: s(12),
    borderWidth: 1,
    borderColor: c.border,
  },
  waitingTitle: {
    fontSize: s(20),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    marginTop: s(8),
  },
  waitingSubtitle: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },
  waitingHint: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: s(18),
    marginTop: s(4),
  },
  forceEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginTop: s(16),
    paddingVertical: s(10),
    paddingHorizontal: s(20),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  forceEndBtnText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
  },
  exerciseSelectorModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  exerciseSelectorContent: {
    backgroundColor: c.bg,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    maxHeight: '85%',
    paddingBottom: s(24),
  },
  exerciseSelectorDragHandle: {
    width: s(36),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: s(10),
    marginBottom: s(10),
  },
  exerciseSelectorClose: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(20),
    paddingBottom: s(14),
  },
  exerciseSelectorTitle: {
    fontSize: s(18),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  exerciseSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: s(12),
    marginHorizontal: s(16),
    marginVertical: s(12),
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    gap: s(10),
  },
  exerciseSearchInput: {
    flex: 1,
    fontSize: s(16),
    color: c.text,
    padding: 0,
  },
  exerciseSearchEmpty: {
    padding: s(28),
    alignItems: 'center',
  },
  exerciseSearchEmptyText: {
    fontSize: s(15),
    color: c.textMuted,
  },
  exerciseListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(14),
    paddingHorizontal: s(20),
    borderBottomWidth: s(1),
    borderBottomColor: c.card,
  },
  exerciseListItemText: {
    fontSize: s(16),
    color: c.text,
    fontFamily: 'Inter_500Medium',
  },
  addCustomExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingVertical: s(16),
    paddingHorizontal: s(20),
    borderTopWidth: s(1),
    borderTopColor: c.card,
  },
  addCustomExerciseText: {
    fontSize: s(16),
    color: c.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  profileContainer: {
    alignItems: 'center',
    paddingTop: s(32),
    paddingBottom: s(8),
    paddingHorizontal: s(20),
  },
  profileAvatar: {
    width: s(80),
    height: s(80),
    borderRadius: s(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s(14),
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: s(32),
    fontFamily: 'Inter_800ExtraBold',
  },
  profileUsername: {
    fontSize: s(22),
    color: c.text,
    fontFamily: 'Inter_700Bold',
    marginBottom: s(2),
  },
  profileEmail: {
    fontSize: s(13),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  profileSection: {
    marginHorizontal: s(16),
    marginTop: s(20),
    backgroundColor: c.card,
    borderRadius: s(16),
    padding: s(16),
  },
  profileSectionTitle: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: s(14),
  },
  modeSelector: {
    flexDirection: 'row' as const,
    backgroundColor: c.bg,
    borderRadius: s(12),
    padding: s(3),
    gap: s(3),
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: s(10),
    borderRadius: s(10),
    gap: s(6),
  },
  modeBtnText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
  },
  colorBarWrap: {
    marginTop: s(16),
    position: 'relative' as const,
    height: s(40),
  },
  colorBar: {
    flexDirection: 'row' as const,
    height: s(28),
    borderRadius: s(14),
    overflow: 'hidden' as const,
    marginTop: s(6),
  },
  colorBarTouch: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  colorThumb: {
    position: 'absolute' as const,
    top: s(2),
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  colorPickerLabel: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textAlign: 'center' as const,
    marginTop: s(8),
  },
  settingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: s(16),
    marginTop: s(12),
    backgroundColor: c.card,
    borderRadius: s(16),
    paddingHorizontal: s(16),
    paddingVertical: s(15),
  },
  settingsRowText: {
    flex: 1,
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  profileSignOut: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginHorizontal: s(16),
    marginTop: s(12),
    backgroundColor: c.card,
    borderRadius: s(16),
    paddingHorizontal: s(16),
    paddingVertical: s(15),
  },
  profileSignOutText: {
    flex: 1,
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: '#F87171',
  },
  versionText: {
    textAlign: 'center' as const,
    color: c.textMuted,
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    marginTop: s(20),
  },
  goalsSection: {
    marginHorizontal: s(16),
    marginTop: s(24),
    backgroundColor: c.card,
    borderRadius: s(10),
    padding: s(20),
  },
  goalsSectionTitle: {
    fontSize: s(17),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    marginBottom: s(16),
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(14),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
  },
  goalLabel: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  goalInput: {
    backgroundColor: c.bg,
    borderRadius: s(10),
    paddingHorizontal: s(12),
    paddingVertical: s(10),
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    textAlign: 'right',
    minWidth: s(80),
  },
  goalUnit: {
    fontSize: s(13),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
    width: s(28),
  },

  // Workout history
  workoutTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: s(16),
    paddingTop: s(14),
    paddingBottom: s(14),
  },
  workoutHistHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: s(20),
    paddingTop: s(8),
    paddingBottom: s(12),
    backgroundColor: c.bg,
  },
  workoutBackButton: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    backgroundColor: c.card,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  workoutHistTitle: {
    fontSize: s(22),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    letterSpacing: s(-0.5),
    flexShrink: 1,
  },
  startWorkoutBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#007AFF',
    paddingVertical: s(8),
    paddingHorizontal: s(14),
    borderRadius: s(10),
    gap: s(5),
  },
  startWorkoutBannerText: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  workoutEmptyState: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingBottom: s(80),
  },
  workoutEmptyIcon: {
    width: s(80),
    height: s(80),
    borderRadius: s(40),
    backgroundColor: c.card,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: s(16),
  },
  workoutEmptyTitle: {
    color: c.textMuted,
    fontSize: s(17),
    fontFamily: 'Inter_600SemiBold',
  },
  workoutEmptySubtitle: {
    color: c.textMuted,
    fontSize: s(14),
    marginTop: s(4),
  },
  workoutCard: {
    backgroundColor: c.card,
    borderRadius: s(16),
    padding: s(16),
    marginBottom: s(10),
  },
  wcTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: s(10),
  },
  wcDate: {
    fontSize: s(12),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
    letterSpacing: s(0.2),
  },
  wcPRBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(10),
    gap: s(4),
  },
  wcPRBadgeText: {
    fontSize: s(10),
    fontFamily: 'Inter_700Bold',
    color: '#422006',
  },
  wcMuscles: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: s(6),
    marginBottom: s(14),
  },
  wcMusclePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: s(9),
    paddingVertical: s(4),
    borderRadius: s(8),
    gap: s(5),
  },
  wcMuscleDot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
  },
  wcMuscleText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
  },
  wcStatsGrid: {
    flexDirection: 'row' as const,
    backgroundColor: c.bg,
    borderRadius: s(12),
    paddingVertical: s(12),
    marginBottom: s(14),
  },
  wcStatItem: {
    flex: 1,
    alignItems: 'center' as const,
  },
  wcStatNumber: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  wcStatLabel: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    marginTop: s(2),
    textTransform: 'uppercase' as const,
    letterSpacing: s(0.5),
  },
  wcExercises: {
    gap: s(8),
  },
  wcExRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: s(8),
  },
  wcExName: {
    flex: 1,
    fontSize: s(13),
    fontFamily: 'Inter_500Medium',
    color: c.text,
  },
  wcExPR: {
    width: s(16),
    height: s(16),
    borderRadius: s(8),
    backgroundColor: '#FACC15',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  wcExSets: {
    fontSize: s(12),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  wcExMore: {
    fontSize: s(12),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    paddingLeft: s(2),
  },
});
