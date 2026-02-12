import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Animated,
  PanResponder,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  FoodEntry,
  FoodEntryInput,
  MealType,
  NutritionGoals,
  FoodCatalogItem,
  FrequentFood,
  MICRONUTRIENT_FIELDS,
  MicronutrientKey,
  MICRONUTRIENT_META,
  MealSlotConfig,
  LEGACY_MEAL_MAP,
  saveFoodEntry,
  saveFoodEntryExtended,
  getFoodEntriesForDate,
  deleteFoodEntry,
  updateFoodEntry,
  duplicateFoodEntry,
  getNutritionGoals,
  getRecentFoods,
  getFrequentFoods,
  getPopularFoods,
  getFoodDaysForMonth,
  searchFoodCatalog,
  getMealTypeForCurrentTime,
  getMealConfig,
} from '../foodDatabase';
import {
  DailySupplementSummary,
  SupplementGoals,
  SupplementEntry,
  getDailySupplementSummary,
  getSupplementGoals,
  saveSupplementEntry,
  deleteSupplementEntry,
} from '../supplementDatabase';
import { updateNutritionLeaderboard } from '../friendsDatabase';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';

// --- Helpers ---

const formatDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDisplayDate = (dateStr: string): string => {
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime12 = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = (h || 0) >= 12 ? 'PM' : 'AM';
  const hour12 = (h || 0) % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`;
};

const formatTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const getProgressColor = (progress: number): string => {
  if (progress > 1.1) return '#FF3B30';
  if (progress > 1) return '#FF9500';
  return '#34C759';
};

// --- Circular Progress ---

const CircularProgress = ({
  size, strokeWidth, progress, color, children,
}: {
  size: number; strokeWidth: number; progress: number; color: string; children?: React.ReactNode;
}) => {
  const { colors } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const offset = circumference * (1 - clamped);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={`${circumference}`} strokeDashoffset={offset}
          strokeLinecap="round" rotation="-90" origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
};

// --- Wave Circle ---

const WaveCircle = ({
  size, progress, color, children,
}: {
  size: number; progress: number; color: string; children?: React.ReactNode;
}) => {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(progress, 0), 1);
  const r = size / 2;
  const [wavePath, setWavePath] = useState('');
  const startTime = useRef(Date.now());
  const rafId = useRef<number>(0);

  useEffect(() => {
    const waterY = size * (1 - clamped);
    const amp = size * 0.025;
    const period = 2500; // ms per full cycle

    const animate = () => {
      const elapsed = Date.now() - startTime.current;
      const phaseOffset = (elapsed / period) * 2 * Math.PI;
      const pts: string[] = [];
      for (let x = 0; x <= size; x += 2) {
        const y = waterY + Math.sin((x / size) * 2 * Math.PI + phaseOffset) * amp;
        pts.push(`${x},${y}`);
      }
      setWavePath(`M${pts[0]} ${pts.slice(1).map((p) => `L${p}`).join(' ')} L${size},${size} L0,${size} Z`);
      rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [size, clamped]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', position: 'absolute' }}>
        <Svg width={size} height={size}>
          <Circle cx={r} cy={r} r={r} fill={colors.card} />
          {wavePath ? <Path d={wavePath} fill={color} opacity={0.35} /> : null}
        </Svg>
      </View>
      {clamped >= 1 && (
        <View style={{ position: 'absolute', width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle cx={r} cy={r} r={r - 1.5} stroke={color} strokeWidth={3} fill="none" opacity={0.6} />
          </Svg>
        </View>
      )}
      {children}
    </View>
  );
};

// --- Swipeable Entry ---

const SwipeableFoodEntry = ({
  entry, expanded, onToggle, onDelete, onDuplicate, onEdit,
}: {
  entry: FoodEntry; expanded: boolean;
  onToggle: () => void; onDelete: () => void; onDuplicate: () => void;
  onEdit: () => void;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(0)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => true,
      onPanResponderMove: (_, g) => { if (g.dx < 0) { translateX.setValue(g.dx); bgAnim.setValue(g.dx); } },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -100) {
          Animated.timing(translateX, { toValue: -400, duration: 200, useNativeDriver: true }).start(() => {
            onDelete(); translateX.setValue(0); bgAnim.setValue(0);
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          Animated.spring(bgAnim, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const bgColor = bgAnim.interpolate({ inputRange: [-100, 0], outputRange: ['#FF3B30', colors.card], extrapolate: 'clamp' });

  return (
    <View style={styles.entryContainer}>
      <Animated.View style={[styles.entrySwipeBg, { backgroundColor: bgColor }]}>
        <Ionicons name="trash-outline" size={s(18)} color="#fff" style={{ marginRight: s(20) }} />
      </Animated.View>
      <Animated.View style={[styles.entryCard, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <TouchableOpacity activeOpacity={0.7} onPress={onToggle}>
          {/* Main row */}
          <View style={styles.entryRow}>
            <View style={[styles.entryTimeCol, { alignItems: 'center' }]}>
              <Text style={styles.entryTime}>{formatTime(entry.created_at).replace(/ (AM|PM)/, '')}</Text>
              <Text style={{ fontSize: s(9), color: colors.textMuted, fontFamily: 'Inter_500Medium' }}>{formatTime(entry.created_at).includes('AM') ? 'AM' : 'PM'}</Text>
            </View>
            <View style={styles.entryInfo}>
              <Text style={styles.entryName}>{entry.name}</Text>
              <Text style={styles.entryQuick}>
                {entry.calories} CAL
              </Text>
            </View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={s(16)} color={colors.textSecondary} />
          </View>
          {/* Expanded */}
          {expanded && (
            <View style={styles.entryExpanded}>
              <View style={styles.entryMacroRow}>
                <View style={[styles.entryMacroChip, { backgroundColor: colors.accent + '18' }]}>
                  <Text style={[styles.entryMacroText, { color: colors.accent }]}>{Number(entry.protein).toFixed(1)}G</Text>
                </View>
                <View style={[styles.entryMacroChip, { backgroundColor: '#FF9500' + '18' }]}>
                  <Text style={[styles.entryMacroText, { color: '#FF9500' }]}>{Number(entry.carbs).toFixed(1)}G</Text>
                </View>
                <View style={[styles.entryMacroChip, { backgroundColor: '#AF52DE' + '18' }]}>
                  <Text style={[styles.entryMacroText, { color: '#AF52DE' }]}>{Number(entry.fat).toFixed(1)}G</Text>
                </View>
              </View>
              <View style={styles.entryActions}>
                <TouchableOpacity style={styles.entryActionBtn} onPress={onEdit}>
                  <Ionicons name="create-outline" size={s(16)} color={colors.accent} />
                  <Text style={styles.entryActionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.entryActionBtn} onPress={onDuplicate}>
                  <Ionicons name="copy-outline" size={s(16)} color={colors.accent} />
                  <Text style={styles.entryActionText}>Duplicate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.entryActionBtn} onPress={onDelete}>
                  <Ionicons name="trash-outline" size={s(16)} color="#FF3B30" />
                  <Text style={[styles.entryActionText, { color: '#FF3B30' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// --- Animated Pie Chart (isolated to avoid re-rendering parent) ---

const PIE_SIZE = 160;
const PIE_RADIUS = 60;
const PIE_INNER = 38;
const PIE_CX = PIE_SIZE / 2;
const PIE_CY = PIE_SIZE / 2;

const pieArcPath = (startAngle: number, endAngle: number, outer: number, inner: number) => {
  const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x1 = PIE_CX + outer * Math.cos(toRad(startAngle));
  const y1 = PIE_CY + outer * Math.sin(toRad(startAngle));
  const x2 = PIE_CX + outer * Math.cos(toRad(endAngle));
  const y2 = PIE_CY + outer * Math.sin(toRad(endAngle));
  const x3 = PIE_CX + inner * Math.cos(toRad(endAngle));
  const y3 = PIE_CY + inner * Math.sin(toRad(endAngle));
  const x4 = PIE_CX + inner * Math.cos(toRad(startAngle));
  const y4 = PIE_CY + inner * Math.sin(toRad(startAngle));
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M${x1},${y1} A${outer},${outer} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${inner},${inner} 0 ${large} 0 ${x4},${y4} Z`;
};

interface PieSlice {
  label: string;
  grams: number;
  calPerGram: number;
  color: string;
}

const AnimatedPieChart = React.memo(({ slices, calories, visible }: { slices: PieSlice[]; calories: number; visible: boolean }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [progress, setProgress] = useState(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      setProgress(0);
      const start = Date.now();
      const duration = 900;
      const tick = () => {
        const t = Math.min((Date.now() - start) / duration, 1);
        setProgress(1 - Math.pow(1 - t, 3));
        if (t < 1) rafId.current = requestAnimationFrame(tick);
      };
      rafId.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId.current);
    } else {
      setProgress(0);
    }
  }, [visible]);

  const totalCals = slices.reduce((s, sl) => s + sl.grams * sl.calPerGram, 0) || 1;
  const animatedTotal = 360 * progress;

  let angle = 0;
  const paths: { label: string; color: string; d: string }[] = [];
  for (const sl of slices) {
    if (sl.grams <= 0) continue;
    const fullSweep = ((sl.grams * sl.calPerGram) / totalCals) * 360;
    const start = angle;
    angle += fullSweep;
    if (start >= animatedTotal) continue;
    const clampedSweep = Math.min(fullSweep, animatedTotal - start);
    if (clampedSweep < 0.1) continue;
    const gap = clampedSweep >= fullSweep ? 0.5 : 0;
    paths.push({ label: sl.label, color: sl.color, d: pieArcPath(start, start + Math.max(clampedSweep - gap, 0.1), PIE_RADIUS, PIE_INNER) });
  }

  return (
    <View style={styles.ndPieRow}>
      <View style={{ width: PIE_SIZE, height: PIE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={PIE_SIZE} height={PIE_SIZE}>
          {paths.map((p) => (
            <Path key={p.label} d={p.d} fill={p.color} />
          ))}
        </Svg>
        <View style={styles.ndPieCenter}>
          <Text style={styles.ndPieCenterCal}>{calories}</Text>
          <Text style={styles.ndPieCenterLabel}>CAL</Text>
        </View>
      </View>
      <View style={styles.ndPieLegend}>
        {slices.map((sl) => {
          const pct = totalCals > 0 ? Math.round(((sl.grams * sl.calPerGram) / totalCals) * 100) : 0;
          return (
            <View key={sl.label} style={styles.ndPieLegendRow}>
              <View style={[styles.ndPieLegendDot, { backgroundColor: sl.color }]} />
              <Text style={styles.ndPieLegendLabel}>{sl.label}</Text>
              <Text style={styles.ndPieLegendValue}>{Math.round(sl.grams)}G</Text>
              <Text style={styles.ndPieLegendPct}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

// --- Meal type config ---

// Helper to resolve an entry's meal_type to the correct slot key (handles legacy values)
const resolveEntrySlot = (mealType: MealType): MealType => {
  if (mealType in LEGACY_MEAL_MAP) return LEGACY_MEAL_MAP[mealType];
  return mealType;
};

// --- Main Component ---

export const FoodLogger: React.FC<{ refreshKey?: number; onSupplementChange?: () => void }> = ({ refreshKey, onSupplementChange }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const isToday = selectedDate === formatDate(new Date());

  // Data
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<NutritionGoals>({ calorie_goal: 2000, protein_goal: 150, carbs_goal: 250, fat_goal: 65 });
  const [defaultFoodList, setDefaultFoodList] = useState<{ item: FoodCatalogItem | FoodEntryInput; type: 'history' | 'popular' }[]>([]);

  // Supplements
  const [supplementSummary, setSupplementSummary] = useState<DailySupplementSummary>({ totalWater: 0, totalCreatine: 0, waterEntries: [], creatineEntries: [] });
  const [supplementGoals, setSupplementGoals] = useState<SupplementGoals>({ water_goal: 2500, creatine_goal: 5 });
  const [showSupplementsExpanded, setShowSupplementsExpanded] = useState(true);

  // Meal config
  const [mealConfig, setMealConfig] = useState<MealSlotConfig[]>([]);
  const activeMeals = useMemo(() => {
    const enabled = mealConfig.filter((s) => s.enabled).sort((a, b) => a.sort_order - b.sort_order);
    return enabled.map((s) => ({ key: s.slot, label: s.label, icon: s.icon as keyof typeof Ionicons.glyphMap, time_start: s.time_start }));
  }, [mealConfig]);

  // UI
  const [expandedMeals, setExpandedMeals] = useState<Set<MealType>>(new Set());
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [pendingQuickAdd, setPendingQuickAdd] = useState<FoodEntryInput | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [foodDays, setFoodDays] = useState<{ date: string; calories: number }[]>([]);
  const [showNutritionDetails, setShowNutritionDetails] = useState(false);
  type NdView = 'daily' | 'meals';
  const [ndView, setNdView] = useState<NdView>('daily');

  // Add Food Modal state
  type AddFoodView = 'search' | 'custom' | 'detail';
  const [addFoodView, setAddFoodView] = useState<AddFoodView>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodCatalogItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<FoodCatalogItem | null>(null);
  const [detailQuantity, setDetailQuantity] = useState('1');
  const [detailServingSize, setDetailServingSize] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);

  // Form
  const [selectedMealType, setSelectedMealType] = useState<MealType>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);


  // Drag to dismiss logic
  const panY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10 && gestureState.dy > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) {
          Animated.timing(panY, {
            toValue: Dimensions.get('window').height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowAddModal(false);
            panY.setValue(0);
          });
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  // Drag to dismiss for nutrition details modal
  const ndPanY = useRef(new Animated.Value(0)).current;
  const ndPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10 && gestureState.dy > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          ndPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) {
          Animated.timing(ndPanY, {
            toValue: Dimensions.get('window').height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowNutritionDetails(false);
            ndPanY.setValue(0);
          });
        } else {
          Animated.spring(ndPanY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (showNutritionDetails) {
      ndPanY.setValue(0);
    }
  }, [showNutritionDetails]);

  useEffect(() => {
    if (showAddModal) {
      panY.setValue(0);
    }
  }, [showAddModal]);

  // Load data
  const loadEntries = useCallback(async () => {
    const data = await getFoodEntriesForDate(selectedDate);
    setEntries(data);
  }, [selectedDate]);

  const loadSupplements = useCallback(async () => {
    const data = await getDailySupplementSummary(selectedDate);
    setSupplementSummary(data);
  }, [selectedDate]);

  useEffect(() => { loadEntries(); loadSupplements(); }, [loadEntries, loadSupplements, refreshKey]);
  useEffect(() => {
    getNutritionGoals().then(setGoals);
    getSupplementGoals().then(setSupplementGoals);
    getMealConfig().then((config) => {
      setMealConfig(config);
      setExpandedMeals(new Set(config.filter((s) => s.enabled).map((s) => s.slot)));
    });
  }, []);

  const handleAddSupplement = (type: 'water' | 'creatine', amount: number) => {
    // Optimistic UI update
    setSupplementSummary(prev => ({
      ...prev,
      totalWater: type === 'water' ? prev.totalWater + amount : prev.totalWater,
      totalCreatine: type === 'creatine' ? prev.totalCreatine + amount : prev.totalCreatine,
    }));
    // Persist in background
    saveSupplementEntry(type, amount, selectedDate).then(result => {
      if (result) {
        loadSupplements();
        if (isToday) onSupplementChange?.();
      } else {
        loadSupplements(); // Revert on failure
      }
    });
  };

  const handleDeleteSupplement = async (id: string) => {
    const success = await deleteSupplementEntry(id);
    if (success) {
      loadSupplements();
      onSupplementChange?.();
    }
  };

  // CALendar data
  useEffect(() => {
    if (showCalendar) {
      getFoodDaysForMonth(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1).then(setFoodDays);
    }
  }, [showCalendar, calendarMonth]);

  // Computed
  const totals = entries.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const remaining = {
    calories: Math.max(0, goals.calorie_goal - totals.calories),
    protein: Math.max(0, goals.protein_goal - totals.protein),
  };

  const groupedEntries = activeMeals.map((m) => ({
    ...m,
    entries: entries.filter((e) => resolveEntrySlot(e.meal_type) === m.key),
    totalCal: entries.filter((e) => resolveEntrySlot(e.meal_type) === m.key).reduce((s, e) => s + e.calories, 0),
  }));

  // Handlers
  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatDate(d));
    setExpandedEntries(new Set());
  };

  const toggleMeal = (key: MealType) => {
    const next = new Set(expandedMeals);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpandedMeals(next);
  };

  const toggleEntry = (id: string) => {
    const next = new Set(expandedEntries);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedEntries(next);
  };

  const resetForm = () => {
    setFoodName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
    setSelectedMealType(getMealTypeForCurrentTime(mealConfig));
  };

  const openAddModal = (mealType?: MealType) => {
    resetForm();
    setEditingEntryId(null);
    if (mealType) setSelectedMealType(mealType);
    setAddFoodView('search');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCatalogItem(null);
    setDetailQuantity('1');
    setDetailServingSize('');
    setShowAddModal(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);

    // Load default list in background
    Promise.all([
      getRecentFoods(),
      getFrequentFoods(10),
      getPopularFoods(20),
    ]).then(([recent, frequent, popular]) => {
      const seen = new Set<string>();
      const combined: { item: FoodCatalogItem | FoodEntryInput; type: 'history' | 'popular' }[] = [];

      const historyItems: FoodEntryInput[] = [];
      for (const r of recent) {
        if (!seen.has(r.name.toLowerCase())) {
          seen.add(r.name.toLowerCase());
          historyItems.push(r);
        }
      }
      for (const f of frequent) {
        if (!seen.has(f.name.toLowerCase())) {
          seen.add(f.name.toLowerCase());
          historyItems.push(f);
        }
      }
      for (const h of historyItems.slice(0, 10)) {
        combined.push({ item: h, type: 'history' });
      }

      for (const p of popular) {
        if (combined.length >= 20) break;
        if (!seen.has(p.name.toLowerCase())) {
          seen.add(p.name.toLowerCase());
          combined.push({ item: p, type: 'popular' });
        }
      }

      setDefaultFoodList(combined);
    });
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchFoodCatalog(text);
      setSearchResults(results);
      setSearchLoading(false);
    }, 300);
  };

  const selectCatalogItem = (item: FoodCatalogItem) => {
    setSelectedCatalogItem(item);
    setDetailQuantity('1');
    setDetailServingSize(String(item.serving_size));
    setAddFoodView('detail');
  };

  const getDetailNutrition = () => {
    if (!selectedCatalogItem) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
    const qty = parseFloat(detailQuantity) || 1;
    const servSize = parseFloat(detailServingSize) || selectedCatalogItem.serving_size;
    const ratio = (qty * servSize) / selectedCatalogItem.serving_size;
    return {
      calories: Math.round(selectedCatalogItem.calories * ratio),
      protein: Math.round(selectedCatalogItem.protein * ratio * 10) / 10,
      carbs: Math.round(selectedCatalogItem.carbs * ratio * 10) / 10,
      fat: Math.round(selectedCatalogItem.fat * ratio * 10) / 10,
      fiber: Math.round(selectedCatalogItem.fiber * ratio * 10) / 10,
      sugar: Math.round(selectedCatalogItem.sugar * ratio * 10) / 10,
    };
  };

  const handleSaveFromDetail = async () => {
    if (!selectedCatalogItem) return;
    setSaving(true);
    const nutrition = getDetailNutrition();
    const qty = parseFloat(detailQuantity) || 1;
    const servSize = parseFloat(detailServingSize) || selectedCatalogItem.serving_size;
    const ratio = (qty * servSize) / selectedCatalogItem.serving_size;

    // Build micronutrient data from catalog item
    const microData: Record<string, number> = {};
    for (const key of MICRONUTRIENT_FIELDS) {
      const val = (selectedCatalogItem as any)[key];
      if (val != null && val > 0) {
        microData[key] = Math.round(val * ratio * 100) / 100;
      }
    }

    if (editingEntryId) {
      const success = await updateFoodEntry(editingEntryId, {
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        quantity: qty,
      });
      if (success) {
        setShowAddModal(false);
        setEditingEntryId(null);
        loadEntries();
      } else {
        Alert.alert('Error', 'Failed to update food entry.');
      }
    } else {
      const result = await saveFoodEntryExtended({
        name: selectedCatalogItem.name,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        meal_type: selectedMealType,
        brand: selectedCatalogItem.brand || undefined,
        food_catalog_id: selectedCatalogItem.id,
        serving_size: servSize,
        serving_unit: selectedCatalogItem.serving_unit,
        quantity: qty,
        fiber: nutrition.fiber,
        sugar: nutrition.sugar,
        ...microData,
      } as any);

      if (result) {
        setShowAddModal(false);
        loadEntries();
        updateNutritionLeaderboard(nutrition.calories, nutrition.protein).catch(() => {});
      } else {
        Alert.alert('Error', 'Failed to save food entry.');
      }
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!calories.trim()) { Alert.alert('Missing Info', 'Please enter calories.'); return; }
    setSaving(true);
    const result = await saveFoodEntry({
      name: foodName.trim() || 'Quick Add',
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      meal_type: selectedMealType,
    });
    if (result) {
      setShowAddModal(false);
      loadEntries();
      updateNutritionLeaderboard(parseFloat(calories) || 0, parseFloat(protein) || 0).catch(() => {});
    } else {
      Alert.alert('Error', 'Failed to save food entry.');
    }
    setSaving(false);
  };

  const handleQuickAdd = async (food: FoodEntryInput) => {
    await saveFoodEntry({ ...food, meal_type: selectedMealType });
    setShowAddModal(false);
    loadEntries();
    updateNutritionLeaderboard(food.calories, food.protein).catch(() => {});
  };

  const handleEditEntry = (entry: FoodEntry) => {
    const fakeCatalog: FoodCatalogItem = {
      id: entry.food_catalog_id || entry.id,
      name: entry.name,
      brand: entry.brand || null,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      fiber: (entry as any).fiber || 0,
      sugar: (entry as any).sugar || 0,
      serving_size: entry.serving_size || 100,
      serving_unit: entry.serving_unit || 'g',
      confidence: 'verified',
      popularity: 0,
      category: null,
    };
    setEditingEntryId(entry.id);
    setSelectedCatalogItem(fakeCatalog);
    setDetailQuantity(String(entry.quantity || 1));
    setDetailServingSize(String(entry.serving_size || 100));
    setSelectedMealType(resolveEntrySlot(entry.meal_type));
    setAddFoodView('detail');
    setShowAddModal(true);
  };

  const confirmQuickAdd = async (mealType: MealType) => {
    if (!pendingQuickAdd) return;
    await saveFoodEntry({ ...pendingQuickAdd, meal_type: mealType });
    setPendingQuickAdd(null);
    setShowAddModal(false);
    loadEntries();
    updateNutritionLeaderboard(pendingQuickAdd.calories, pendingQuickAdd.protein).catch(() => {});
  };

  const getConfidenceIcon = (confidence: string): { name: keyof typeof Ionicons.glyphMap; color: string; label: string } => {
    switch (confidence) {
      case 'verified': return { name: 'checkmark-circle', color: '#34C759', label: 'Verified' };
      case 'user_submitted': return { name: 'person-circle-outline', color: '#007AFF', label: 'Community' };
      default: return { name: 'help-circle-outline', color: '#8e8e93', label: 'Estimated' };
    }
  };

  const handleDelete = async (id: string) => {
    await deleteFoodEntry(id);
    loadEntries();
  };

  const handleDuplicate = async (entry: FoodEntry) => {
    await duplicateFoodEntry(entry);
    loadEntries();
  };

  // CALendar helpers
  const calendarDays = (() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  })();

  const getCalendarDayColor = (day: number): string | null => {
    const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const match = foodDays.find((d) => d.date === dateStr);
    if (!match) return null;
    const ratio = goals.calorie_goal > 0 ? match.calories / goals.calorie_goal : 0;
    if (ratio > 1.15) return '#FF3B30';
    if (ratio >= 0.8) return '#34C759';
    if (ratio > 0) return '#FF9500';
    return null;
  };

  // --- Per-meal nutrition and micronutrient totals ---

  const mealNutrition = useMemo(() => {
    const result: Record<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number }> = {};
    for (const m of activeMeals) {
      result[m.key] = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
    }
    for (const e of entries) {
      const slot = resolveEntrySlot(e.meal_type);
      const m = result[slot];
      if (!m) continue;
      m.calories += e.calories;
      m.protein += e.protein;
      m.carbs += e.carbs;
      m.fat += e.fat;
      m.fiber += (e as any).fiber || 0;
      m.sugar += (e as any).sugar || 0;
    }
    return result;
  }, [entries, activeMeals]);

  const dailyMicros = useMemo(() => {
    const totals: Record<MicronutrientKey, number> = {} as any;
    let hasAny = false;
    for (const key of MICRONUTRIENT_FIELDS) {
      totals[key] = 0;
    }
    for (const e of entries) {
      for (const key of MICRONUTRIENT_FIELDS) {
        const val = (e as any)[key];
        if (val != null && val > 0) {
          totals[key] += val;
          hasAny = true;
        }
      }
    }
    return { totals, hasAny };
  }, [entries]);

  const dailyFiberSugar = useMemo(() => {
    let fiber = 0, sugar = 0;
    for (const e of entries) {
      fiber += (e as any).fiber || 0;
      sugar += (e as any).sugar || 0;
    }
    return { fiber, sugar };
  }, [entries]);

  const mealMicros = useMemo(() => {
    const result: Record<string, { totals: Record<MicronutrientKey, number>; hasAny: boolean }> = {};
    for (const meal of activeMeals) {
      const totals: Record<MicronutrientKey, number> = {} as any;
      let hasAny = false;
      for (const key of MICRONUTRIENT_FIELDS) totals[key] = 0;
      for (const e of entries) {
        if (resolveEntrySlot(e.meal_type) !== meal.key) continue;
        for (const key of MICRONUTRIENT_FIELDS) {
          const val = (e as any)[key];
          if (val != null && val > 0) {
            totals[key] += val;
            hasAny = true;
          }
        }
      }
      result[meal.key] = { totals, hasAny };
    }
    return result;
  }, [entries, activeMeals]);

  const renderMicronutrientBars = (keys: MicronutrientKey[], overrideTotals?: Record<MicronutrientKey, number>) => {
    const src = overrideTotals || dailyMicros.totals;
    return keys.map((key) => {
      const meta = MICRONUTRIENT_META[key];
      const value = src[key];
      const pct = meta.dv > 0 ? Math.min((value / meta.dv) * 100, 100) : 0;
      return (
        <View key={key} style={styles.ndMicroRow}>
          <View style={styles.ndMicroLabelRow}>
            <Text style={styles.ndMicroLabel}>{meta.label}</Text>
            <Text style={styles.ndMicroValue}>
              {value > 0 ? `${Math.round(value * 10) / 10} ${meta.unit}` : '—'}
            </Text>
            <Text style={styles.ndMicroPct}>
              {value > 0 ? `${Math.round(pct)}%` : ''}
            </Text>
          </View>
          <View style={styles.ndMicroBarTrack}>
            <View style={[styles.ndMicroBarFill, { width: `${pct}%`, backgroundColor: pct >= 100 ? '#34C759' : pct >= 50 ? '#FF9500' : colors.accent }]} />
          </View>
        </View>
      );
    });
  };

  // --- Render ---

  const calProgress = goals.calorie_goal > 0 ? totals.calories / goals.calorie_goal : 0;
  const protProgress = goals.protein_goal > 0 ? totals.protein / goals.protein_goal : 0;
  const carbProgress = goals.carbs_goal > 0 ? totals.carbs / goals.carbs_goal : 0;
  const fatProgress = goals.fat_goal > 0 ? totals.fat / goals.fat_goal : 0;

  const calBarAnim = useRef(new Animated.Value(0)).current;
  const calShimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    calBarAnim.setValue(0);
    Animated.timing(calBarAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [totals.calories, goals.calorie_goal]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(calShimmer, { toValue: 1, duration: 2200, useNativeDriver: false }),
        Animated.timing(calShimmer, { toValue: 0, duration: 2200, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const animatedBarWidth = calBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.min(calProgress * 100, 100)}%`],
  });
  const animatedGoalWidth = calBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${calProgress > 1 ? (goals.calorie_goal / totals.calories) * 100 : 0}%`],
  });
  const shimmerOpacity = calShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 1],
  });

  return (
    <View style={styles.container}>
      {/* Date Navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => navigateDate(-1)} style={styles.dateNavBtn}>
          <Ionicons name="chevron-back" size={s(22)} color={colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowCalendar(true)} style={styles.dateNavCenter}>
          <Text style={styles.dateNavText}>{formatDisplayDate(selectedDate)}</Text>
          <Ionicons name="calendar-outline" size={s(16)} color={colors.accent} style={{ marginLeft: s(6) }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => !isToday && navigateDate(1)} style={styles.dateNavBtn}>
          <Ionicons name="chevron-forward" size={s(22)} color={isToday ? colors.textSecondary : colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Macro Summary - Pinned */}
      <TouchableOpacity activeOpacity={0.7} onPress={() => setShowNutritionDetails(true)}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Progress</Text>
        <View style={styles.calorieRow}>
          <Text style={styles.calorieEaten}>{totals.calories}</Text>
          <Text style={styles.calorieGoal}> / {goals.calorie_goal} CAL</Text>
          {calProgress > 1 ? (
            <Animated.Text style={[styles.calorieRemaining, { color: '#FF9500', opacity: shimmerOpacity }]}>
              {totals.calories - goals.calorie_goal} over
            </Animated.Text>
          ) : (
            <Text style={styles.calorieRemaining}>
              {remaining.calories} remaining
            </Text>
          )}
        </View>
        <View style={[styles.calorieBarTrack, calProgress >= 1 && { shadowColor: getProgressColor(calProgress), shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: s(4), elevation: 3 }]}>
          {calProgress > 1 ? (
            <>
              <Animated.View style={[styles.calorieBarFill, { width: animatedBarWidth, backgroundColor: getProgressColor(calProgress), position: 'absolute', zIndex: -1, opacity: shimmerOpacity }]} />
              <Animated.View style={[styles.calorieBarFill, { width: animatedGoalWidth, backgroundColor: '#34C759' }]} />
              <View style={[styles.calorieBarGoalMarker, { left: `${(goals.calorie_goal / totals.calories) * 100}%` }]} />
            </>
          ) : (
            <Animated.View style={[styles.calorieBarFill, { width: animatedBarWidth, backgroundColor: getProgressColor(calProgress), opacity: shimmerOpacity }]} />
          )}
        </View>
        <View style={styles.macroCirclesRow}>
          {[
            { label: 'Protein', value: totals.protein, goal: goals.protein_goal, progress: protProgress, color: '#7AB8F5', iconColor: colors.accent, icon: 'food-steak' as const, iconLib: 'mci' as const },
            { label: 'Carbs', value: totals.carbs, goal: goals.carbs_goal, progress: carbProgress, color: '#FFc875', iconColor: '#FF9500', icon: 'leaf-outline' as const, iconLib: 'ion' as const },
            { label: 'Fat', value: totals.fat, goal: goals.fat_goal, progress: fatProgress, color: '#CFA0E8', iconColor: '#AF52DE', icon: 'water-outline' as const, iconLib: 'ion' as const },
          ].map((m) => (
            <View key={m.label} style={[styles.macroCircleItem, m.progress >= 1 && { shadowColor: m.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: s(4), elevation: 3 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(3), width: s(80) }}>
                {m.iconLib === 'mci' ? (
                  <MaterialCommunityIcons name={m.icon as any} size={s(13)} color={m.iconColor} />
                ) : (
                  <Ionicons name={m.icon as any} size={s(13)} color={m.iconColor} />
                )}
                <Text style={styles.macroCircleLabel}>{m.label.toUpperCase()}</Text>
              </View>
              <WaveCircle size={s(80)} progress={Math.min(m.progress, 1)} color={m.color}>
                <Text style={styles.macroCircleValue}>{Number(m.value).toFixed(1)}</Text>
                <View style={styles.macroCircleDivider} />
                <Text style={styles.macroCircleGoal}>{m.goal}G</Text>
              </WaveCircle>
            </View>
          ))}
        </View>
      </View>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} style={{ flex: 1 }}>

        {/* Meal Sections */}
        {groupedEntries.map((meal) => (
          <View key={meal.key} style={styles.mealSection}>
            <TouchableOpacity style={styles.mealHeader} onPress={() => toggleMeal(meal.key)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.mealTitle, { flex: 0 }]}>{meal.label}</Text>
                <Text style={{ fontSize: s(11), color: colors.text, fontFamily: 'Inter_400Regular', marginTop: s(1) }}>{formatTime12(meal.time_start)}</Text>
              </View>
              {meal.entries.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                    <View style={{ backgroundColor: colors.accent + '18', paddingHorizontal: s(6), paddingVertical: s(3), borderRadius: s(8) }}>
                      <Text style={{ fontSize: s(10), color: colors.accent, fontFamily: 'Inter_500Medium' }}>{(mealNutrition[meal.key]?.protein || 0).toFixed(1)}G</Text>
                    </View>
                    <View style={{ backgroundColor: '#FF9500' + '18', paddingHorizontal: s(6), paddingVertical: s(3), borderRadius: s(8) }}>
                      <Text style={{ fontSize: s(10), color: '#FF9500', fontFamily: 'Inter_500Medium' }}>{(mealNutrition[meal.key]?.carbs || 0).toFixed(1)}G</Text>
                    </View>
                    <View style={{ backgroundColor: '#AF52DE' + '18', paddingHorizontal: s(6), paddingVertical: s(3), borderRadius: s(8) }}>
                      <Text style={{ fontSize: s(10), color: '#AF52DE', fontFamily: 'Inter_500Medium' }}>{(mealNutrition[meal.key]?.fat || 0).toFixed(1)}G</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: colors.border, paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(8) }}>
                    <Text style={[styles.mealCal, { color: colors.text }]}>{meal.totalCal} CAL</Text>
                  </View>
                </View>
              )}
              <Ionicons name={expandedMeals.has(meal.key) ? 'chevron-up' : 'chevron-down'} size={s(16)} color={colors.textSecondary} style={{ marginLeft: s(4) }} />
            </TouchableOpacity>

            {expandedMeals.has(meal.key) && (
              meal.entries.length === 0 ? (
                <TouchableOpacity style={styles.addFoodRow} onPress={() => openAddModal(meal.key)}>
                  <Ionicons name="add-circle" size={s(18)} color={colors.accent} />
                  <Text style={styles.addFoodText}>Add food</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {meal.entries.map((entry) => (
                    <SwipeableFoodEntry
                      key={entry.id}
                      entry={entry}
                      expanded={expandedEntries.has(entry.id)}
                      onToggle={() => toggleEntry(entry.id)}
                      onDelete={() => handleDelete(entry.id)}
                      onDuplicate={() => handleDuplicate(entry)}
                      onEdit={() => handleEditEntry(entry)}
                    />
                  ))}
                  <TouchableOpacity style={styles.addFoodRow} onPress={() => openAddModal(meal.key)}>
                    <Ionicons name="add-circle" size={s(18)} color={colors.accent} />
                    <Text style={styles.addFoodText}>Add food</Text>
                  </TouchableOpacity>
                </>
              )
            )}
          </View>
        ))}

        {/* Supplements Section */}
        <View style={styles.supplementsSection}>
          <TouchableOpacity
            style={styles.mealHeader}
            onPress={() => setShowSupplementsExpanded(!showSupplementsExpanded)}
            activeOpacity={0.7}
          >
            <Ionicons name="flask-outline" size={s(18)} color={colors.textMuted} />
            <Text style={styles.mealTitle}>Supplements</Text>
            <Ionicons name={showSupplementsExpanded ? 'chevron-up' : 'chevron-down'} size={s(16)} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {showSupplementsExpanded && (
            <View style={styles.supplementsContent}>
              {/* Water */}
              <View style={styles.supplementRow}>
                <View style={styles.supplementInfo}>
                  <Ionicons name="water" size={s(20)} color="#5AC8FA" />
                  <Text style={styles.supplementLabel}>Water</Text>
                  <Text style={styles.supplementValue}>
                    {supplementSummary.totalWater} / {supplementGoals.water_goal} ml
                  </Text>
                </View>
                <View style={styles.supplementButtons}>
                  <TouchableOpacity style={styles.supplementBtn} onPress={() => handleAddSupplement('water', 250)}>
                    <Text style={styles.supplementBtnText}>+250</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.supplementBtn} onPress={() => handleAddSupplement('water', 500)}>
                    <Text style={styles.supplementBtnText}>+500</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {supplementSummary.waterEntries.length > 0 && (
                <View style={styles.supplementEntries}>
                  {supplementSummary.waterEntries.map((entry) => (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.supplementEntry}
                      onLongPress={() => {
                        Alert.alert('Delete Entry', `Delete ${entry.amount}ml water entry?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteSupplement(entry.id) },
                        ]);
                      }}
                    >
                      <Text style={styles.supplementEntryText}>{entry.amount}ml</Text>
                      <Text style={styles.supplementEntryTime}>{formatTime(entry.created_at)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Creatine */}
              <View style={[styles.supplementRow, { marginTop: s(12) }]}>
                <View style={styles.supplementInfo}>
                  <Ionicons name="flash" size={s(20)} color="#FFCC00" />
                  <Text style={styles.supplementLabel}>Creatine</Text>
                  <Text style={styles.supplementValue}>
                    {supplementSummary.totalCreatine} / {supplementGoals.creatine_goal} g
                  </Text>
                </View>
                <View style={styles.supplementButtons}>
                  <TouchableOpacity style={styles.supplementBtn} onPress={() => handleAddSupplement('creatine', 5)}>
                    <Text style={styles.supplementBtnText}>+5g</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.supplementBtn} onPress={() => handleAddSupplement('creatine', 1)}>
                    <Text style={styles.supplementBtnText}>+1g</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {supplementSummary.creatineEntries.length > 0 && (
                <View style={styles.supplementEntries}>
                  {supplementSummary.creatineEntries.map((entry) => (
                    <TouchableOpacity
                      key={entry.id}
                      style={styles.supplementEntry}
                      onLongPress={() => {
                        Alert.alert('Delete Entry', `Delete ${entry.amount}g creatine entry?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteSupplement(entry.id) },
                        ]);
                      }}
                    >
                      <Text style={styles.supplementEntryText}>{entry.amount}G</Text>
                      <Text style={styles.supplementEntryTime}>{formatTime(entry.created_at)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ height: s(140) }} />
      </ScrollView>

      {/* Sticky Footer */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity style={styles.footerAddBtn} onPress={openAddModal}>
          <Ionicons name="add" size={s(22)} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Add Food Modal - Full Screen Search */}
      <Modal animationType="slide" transparent={true} visible={showAddModal} onRequestClose={() => setShowAddModal(false)}>
        <Animated.View style={[{ flex: 1 }, { transform: [{ translateY: panY }] }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.addModalContainer}>
            {/* Header */}
            <View style={styles.addModalHeader} {...panResponder.panHandlers}>
              <View style={styles.modalGrabBar} />
            <TouchableOpacity onPress={() => {
              if (addFoodView === 'detail' && !editingEntryId) { setAddFoodView('search'); }
              else { setShowAddModal(false); setEditingEntryId(null); }
            }} style={styles.addModalCloseBtn}>
              <Ionicons name={addFoodView === 'detail' && !editingEntryId ? 'arrow-back' : 'close'} size={s(24)} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.addModalTitle}>{addFoodView === 'detail' ? 'Food Detail' : 'Add Food'}</Text>
            <View style={{ width: s(32) }} />
          </View>

          {addFoodView === 'detail' && selectedCatalogItem ? (
            /* ========== DETAIL VIEW ========== */
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Food info header */}
              <View style={styles.detailHeader}>
                <Text style={styles.detailName}>{selectedCatalogItem.name}</Text>
                {selectedCatalogItem.brand && (
                  <Text style={styles.detailBrand}>{selectedCatalogItem.brand}</Text>
                )}
                <View style={styles.detailConfidence}>
                  {(() => {
                    const conf = getConfidenceIcon(selectedCatalogItem.confidence);
                    return (
                      <>
                        <Ionicons name={conf.name} size={s(16)} color={conf.color} />
                        <Text style={[styles.detailConfidenceText, { color: conf.color }]}>{conf.label}</Text>
                      </>
                    );
                  })()}
                </View>
              </View>

              {/* Meal type selector */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>Meal</Text>
                <View style={[styles.mealTypeRow, { flexWrap: 'wrap' }]}>
                  {activeMeals.map((m) => (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.mealTypeBtn, selectedMealType === m.key && styles.mealTypeBtnActive]}
                      onPress={() => setSelectedMealType(m.key)}
                    >
                      <Text style={[styles.mealTypeBtnText, selectedMealType === m.key && styles.mealTypeBtnTextActive]} numberOfLines={1} adjustsFontSizeToFit>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Serving controls */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>Serving</Text>
                <View style={styles.servingRow}>
                  <View style={styles.servingControl}>
                    <Text style={styles.servingLabel}>Quantity</Text>
                    <View style={styles.quantityControl}>
                      <TouchableOpacity
                        style={styles.quantityBtn}
                        onPress={() => {
                          const q = Math.max(0.5, (parseFloat(detailQuantity) || 1) - 0.5);
                          setDetailQuantity(String(q));
                        }}
                      >
                        <Ionicons name="remove" size={s(18)} color={colors.accent} />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.quantityInput}
                        value={detailQuantity}
                        onChangeText={setDetailQuantity}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.quantityBtn}
                        onPress={() => {
                          const q = (parseFloat(detailQuantity) || 1) + 0.5;
                          setDetailQuantity(String(q));
                        }}
                      >
                        <Ionicons name="add" size={s(18)} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.servingControl}>
                    <Text style={styles.servingLabel}>Size</Text>
                    <View style={styles.servingSizeRow}>
                      <TextInput
                        style={styles.servingSizeInput}
                        value={detailServingSize}
                        onChangeText={setDetailServingSize}
                        keyboardType="numeric"

                      />
                      <Text style={styles.servingUnit}>{selectedCatalogItem.serving_unit}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Nutrition display */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>Nutrition</Text>
                <View style={styles.nutritionGrid}>
                  {(() => {
                    const n = getDetailNutrition();
                    return [
                      { label: 'Calories', value: `${n.calories}`, bold: true },
                      { label: 'Protein', value: `${n.protein.toFixed(1)}g` },
                      { label: 'Carbs', value: `${n.carbs.toFixed(1)}g` },
                      { label: 'Fat', value: `${n.fat.toFixed(1)}g` },
                      { label: 'Fiber', value: `${n.fiber.toFixed(1)}g` },
                      { label: 'Sugar', value: `${n.sugar.toFixed(1)}g` },
                    ].map((row) => (
                      <View key={row.label} style={styles.nutritionRow}>
                        <Text style={[styles.nutritionLabel, row.bold && { fontFamily: 'Inter_600SemiBold' }]}>{row.label}</Text>
                        <Text style={[styles.nutritionValue, row.bold && { fontSize: s(18) }]}>{row.value}</Text>
                      </View>
                    ));
                  })()}
                </View>
              </View>

              {/* Log button */}
              <TouchableOpacity
                style={[styles.logFoodBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveFromDetail}
                disabled={saving}
              >
                <Text style={styles.logFoodBtnText}>{saving ? 'Saving...' : editingEntryId ? 'Update' : 'Log Food'}</Text>
              </TouchableOpacity>

              <View style={{ height: s(40) }} />
            </ScrollView>
          ) : (
            /* ========== SEARCH / TABS VIEW ========== */
            <>
              {/* Search bar */}
              <View style={styles.searchBarContainer}>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={s(18)} color={colors.textMuted} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchBarInput}
                    placeholder="Search foods..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    onFocus={() => setAddFoodView('search')}
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} style={styles.searchBarClear}>
                      <Ionicons name="close-circle" size={s(18)} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Tab pills */}
              <View style={styles.tabPillsRow}>
                {([
                  { key: 'search' as AddFoodView, label: 'Search' },
                  { key: 'custom' as AddFoodView, label: 'Custom' },
                ]).map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tabPill, addFoodView === tab.key && styles.tabPillActive]}
                    onPress={() => setAddFoodView(tab.key)}
                  >
                    <Text style={[styles.tabPillText, addFoodView === tab.key && styles.tabPillTextActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Content area */}
              <View style={{ flex: 1 }}>
                {addFoodView === 'search' && (
                  searchLoading ? (
                    <View style={styles.emptyState}>
                      <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                  ) : searchQuery.trim() !== '' && searchResults.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="restaurant-outline" size={s(48)} color={colors.textSecondary} />
                      <Text style={styles.emptyStateText}>No results for "{searchQuery}"</Text>
                      <TouchableOpacity
                        style={styles.emptyStateAction}
                        onPress={() => {
                          setFoodName(searchQuery);
                          setAddFoodView('custom');
                        }}
                      >
                        <Text style={styles.emptyStateActionText}>Create Custom Food</Text>
                      </TouchableOpacity>
                    </View>
                  ) : searchQuery.trim() !== '' ? (
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.id}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => {
                        const conf = getConfidenceIcon(item.confidence);
                        return (
                          <TouchableOpacity style={styles.searchResultItem} onPress={() => selectCatalogItem(item)}>
                            <Ionicons name={conf.name} size={s(20)} color={conf.color} style={styles.confidenceBadge} />
                            <View style={styles.searchResultInfo}>
                              <Text style={styles.searchResultName}>{item.name}</Text>
                              {item.brand && <Text style={styles.searchResultBrand}>{item.brand}</Text>}
                              <Text style={styles.searchResultMacros}>
                                P {Number(item.protein).toFixed(1)}g · C {Number(item.carbs).toFixed(1)}g · F {Number(item.fat).toFixed(1)}g
                              </Text>
                            </View>
                            <View style={styles.searchResultCalCol}>
                              <Text style={styles.searchResultCal}>{item.calories}</Text>
                              <Text style={styles.searchResultCalUnit}>kcal</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={s(16)} color={colors.textSecondary} />
                          </TouchableOpacity>
                        );
                      }}
                    />
                  ) : (
                    /* Default list: recent/frequent + popular */
                    <FlatList
                      data={defaultFoodList}
                      keyExtractor={(_, i) => String(i)}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item: entry }) => {
                        const isHistory = entry.type === 'history';
                        const food = entry.item;
                        const isCatalog = 'id' in food && 'confidence' in food;
                        return (
                          <TouchableOpacity
                            style={styles.searchResultItem}
                            onPress={() => {
                              if (isCatalog) {
                                selectCatalogItem(food as FoodCatalogItem);
                              } else {
                                handleQuickAdd(food as FoodEntryInput);
                              }
                            }}
                          >
                            <Ionicons
                              name={isHistory ? 'time-outline' : 'flame-outline'}
                              size={s(20)}
                              color={isHistory ? colors.accent : colors.textMuted}
                              style={styles.confidenceBadge}
                            />
                            <View style={styles.searchResultInfo}>
                              <Text style={styles.searchResultName}>{food.name}</Text>
                              {'brand' in food && food.brand ? <Text style={styles.searchResultBrand}>{food.brand}</Text> : null}
                              <Text style={styles.searchResultMacros}>
                                P {Number(food.protein).toFixed(1)}g · C {Number(food.carbs).toFixed(1)}g · F {Number(food.fat).toFixed(1)}g
                              </Text>
                            </View>
                            <View style={styles.searchResultCalCol}>
                              <Text style={styles.searchResultCal}>{food.calories}</Text>
                              <Text style={styles.searchResultCalUnit}>kcal</Text>
                            </View>
                            <Ionicons name={isHistory ? 'add-circle-outline' : 'chevron-forward'} size={isHistory ? s(22) : s(16)} color={isHistory ? colors.accent : colors.textSecondary} />
                          </TouchableOpacity>
                        );
                      }}
                    />
                  )
                )}

                {addFoodView === 'custom' && (
                  <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ padding: s(16) }}>
                    <View style={[styles.mealTypeRow, { flexWrap: 'wrap' }]}>
                      {activeMeals.map((m) => (
                        <TouchableOpacity
                          key={m.key}
                          style={[styles.mealTypeBtn, selectedMealType === m.key && styles.mealTypeBtnActive]}
                          onPress={() => setSelectedMealType(m.key)}
                        >
                          <Text style={[styles.mealTypeBtnText, selectedMealType === m.key && styles.mealTypeBtnTextActive]} numberOfLines={1} adjustsFontSizeToFit>{m.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput style={styles.input} placeholder="Food name (optional)" placeholderTextColor={colors.textMuted} value={foodName} onChangeText={setFoodName} />
                    <TextInput style={styles.input} placeholder="Calories" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={calories} onChangeText={setCalories} />

                    <View style={styles.macroInputRow}>
                      {[
                        { label: 'Protein (g)', val: protein, set: setProtein },
                        { label: 'Carbs (g)', val: carbs, set: setCarbs },
                        { label: 'Fat (g)', val: fat, set: setFat },
                      ].map((m) => (
                        <View key={m.label} style={styles.macroInputCol}>
                          <Text style={styles.macroInputLabel} numberOfLines={1} adjustsFontSizeToFit>{m.label}</Text>
                          <TextInput style={styles.macroInput} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={m.val} onChangeText={m.set} />
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                      <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </>
          )}

        </KeyboardAvoidingView>
        </Animated.View>
      </Modal>

      {/* Quick Add Meal Type Picker */}
      {pendingQuickAdd && (
        <Modal animationType="fade" transparent visible={true} onRequestClose={() => setPendingQuickAdd(null)}>
          <TouchableOpacity style={styles.calOverlay} activeOpacity={1} onPress={() => setPendingQuickAdd(null)}>
            <TouchableOpacity activeOpacity={1} style={styles.quickAddPicker}>
              <Text style={styles.quickAddPickerTitle}>{pendingQuickAdd.name}</Text>
              <Text style={styles.quickAddPickerSub}>{pendingQuickAdd.calories} CAL · {Number(pendingQuickAdd.protein).toFixed(1)}G · {Number(pendingQuickAdd.carbs).toFixed(1)}G · {Number(pendingQuickAdd.fat).toFixed(1)}G</Text>
              <View style={[styles.quickAddPickerBtns, { flexWrap: 'wrap' }]}>
                {activeMeals.map((m) => (
                  <TouchableOpacity key={m.key} style={styles.quickAddPickerBtn} onPress={() => confirmQuickAdd(m.key)}>
                    <Ionicons name={m.icon} size={s(20)} color={colors.text} />
                    <Text style={styles.quickAddPickerBtnText}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Nutrition Details Modal */}
      <Modal animationType="slide" transparent={true} visible={showNutritionDetails} onRequestClose={() => setShowNutritionDetails(false)}>
        <Animated.View style={[{ flex: 1 }, { transform: [{ translateY: ndPanY }] }]}>
          <View style={styles.addModalContainer}>
            {/* Header */}
            <View style={styles.addModalHeader} {...ndPanResponder.panHandlers}>
              <View style={styles.modalGrabBar} />
              <TouchableOpacity onPress={() => setShowNutritionDetails(false)} style={styles.addModalCloseBtn}>
                <Ionicons name="close" size={s(24)} color={colors.accent} />
              </TouchableOpacity>
              <Text style={styles.addModalTitle}>Nutrition Details</Text>
              <View style={{ width: s(32) }} />
            </View>

            {/* Tab pills */}
            <View style={styles.ndTabRow}>
              {([
                { key: 'daily' as NdView, label: 'Daily Total' },
                { key: 'meals' as NdView, label: 'By Meal' },
              ]).map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabPill, ndView === tab.key && styles.tabPillActive]}
                  onPress={() => setNdView(tab.key)}
                >
                  <Text style={[styles.tabPillText, ndView === tab.key && styles.tabPillTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: s(16), paddingBottom: s(60) }}>
              {ndView === 'daily' ? (
                <>
                  {/* Daily Overview - Pie Chart */}
                  <Text style={styles.ndSectionTitle}>Macros</Text>
                  <View style={styles.ndPieCard}>
                    {entries.length === 0 ? (
                      <Text style={styles.ndEmptyMeal}>No entries logged</Text>
                    ) : (
                      <AnimatedPieChart
                        slices={[
                          { label: 'Protein', grams: totals.protein, calPerGram: 4, color: '#7AB8F5' },
                          { label: 'Carbs', grams: totals.carbs, calPerGram: 4, color: '#FFc875' },
                          { label: 'Fat', grams: totals.fat, calPerGram: 9, color: '#CFA0E8' },
                        ]}
                        calories={totals.calories}
                        visible={showNutritionDetails && ndView === 'daily'}
                      />
                    )}
                  </View>

                  {/* Vitamins Section */}
                  <Text style={[styles.ndSectionTitle, { marginTop: s(20) }]}>Vitamins</Text>
                  {dailyMicros.hasAny ? (
                    renderMicronutrientBars([
                      'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e',
                      'vitamin_k', 'vitamin_b6', 'vitamin_b12', 'folate',
                    ])
                  ) : (
                    <View style={styles.ndEmptyMicros}>
                      <Ionicons name="flask-outline" size={s(32)} color={colors.textMuted} />
                      <Text style={styles.ndEmptyMicrosText}>No vitamin data available</Text>
                    </View>
                  )}

                  {/* Minerals Section */}
                  <Text style={[styles.ndSectionTitle, { marginTop: s(20) }]}>Minerals</Text>
                  {dailyMicros.hasAny ? (
                    renderMicronutrientBars([
                      'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'sodium',
                    ])
                  ) : (
                    <View style={styles.ndEmptyMicros}>
                      <Ionicons name="nutrition-outline" size={s(32)} color={colors.textMuted} />
                      <Text style={styles.ndEmptyMicrosText}>No mineral data available</Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  {/* Meal-by-Meal Breakdown */}
                  {activeMeals.map((meal) => {
                    const n = mealNutrition[meal.key];
                    const mm = mealMicros[meal.key];
                    const mealEntries = entries.filter((e) => resolveEntrySlot(e.meal_type) === meal.key);
                    if (!n || !mm) return null;
                    return (
                      <View key={meal.key} style={{ marginBottom: s(16) }}>
                        <View style={styles.ndMealCard}>
                          <View style={styles.ndMealHeader}>
                            <Ionicons name={meal.icon} size={s(16)} color={colors.textMuted} />
                            <Text style={styles.ndMealName}>{meal.label}</Text>
                            <Text style={styles.ndMealCal}>{n.calories} CAL</Text>
                          </View>
                          {mealEntries.length === 0 ? (
                            <Text style={styles.ndEmptyMeal}>No entries</Text>
                          ) : (
                            <>
                              <View style={styles.ndMacroRow}>
                                <View style={[styles.ndMacroChip, { backgroundColor: colors.accent + '18' }]}>
                                  <Text style={[styles.ndMacroText, { color: colors.accent }]}>{n.protein.toFixed(1)}G</Text>
                                </View>
                                <View style={[styles.ndMacroChip, { backgroundColor: '#FF9500' + '18' }]}>
                                  <Text style={[styles.ndMacroText, { color: '#FF9500' }]}>{n.carbs.toFixed(1)}G</Text>
                                </View>
                                <View style={[styles.ndMacroChip, { backgroundColor: '#AF52DE' + '18' }]}>
                                  <Text style={[styles.ndMacroText, { color: '#AF52DE' }]}>{n.fat.toFixed(1)}G</Text>
                                </View>
                                <View style={[styles.ndMacroChip, { backgroundColor: '#34C759' + '18' }]}>
                                  <Text style={[styles.ndMacroText, { color: '#34C759' }]}>{n.fiber.toFixed(1)}G</Text>
                                </View>
                                <View style={[styles.ndMacroChip, { backgroundColor: '#FF3B30' + '18' }]}>
                                  <Text style={[styles.ndMacroText, { color: '#FF3B30' }]}>{n.sugar.toFixed(1)}G</Text>
                                </View>
                              </View>
                              {/* Individual entries in this meal */}
                              <View style={styles.ndEntryList}>
                                {mealEntries.map((entry) => (
                                  <View key={entry.id} style={styles.ndEntryRow}>
                                    <Text style={styles.ndEntryName} numberOfLines={1}>{entry.name}</Text>
                                    <Text style={styles.ndEntryCal}>{entry.calories} CAL</Text>
                                  </View>
                                ))}
                              </View>
                            </>
                          )}
                        </View>

                        {/* Per-meal Vitamins & Minerals */}
                        {mealEntries.length > 0 && (
                          <View style={styles.ndMealMicrosCard}>
                            {mm.hasAny ? (
                              <>
                                <Text style={styles.ndMealMicrosTitle}>Vitamins</Text>
                                {renderMicronutrientBars([
                                  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e',
                                  'vitamin_k', 'vitamin_b6', 'vitamin_b12', 'folate',
                                ], mm.totals)}
                                <Text style={[styles.ndMealMicrosTitle, { marginTop: s(10) }]}>Minerals</Text>
                                {renderMicronutrientBars([
                                  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'sodium',
                                ], mm.totals)}
                              </>
                            ) : (
                              <Text style={styles.ndEmptyMeal}>No micronutrient data</Text>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </Modal>

      {/* CALendar Modal */}
      <Modal animationType="fade" transparent visible={showCalendar} onRequestClose={() => setShowCalendar(false)}>
        <TouchableOpacity style={styles.calOverlay} activeOpacity={1} onPress={() => setShowCalendar(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.calContainer}>
            {/* Month nav */}
            <View style={styles.calMonthNav}>
              <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                <Ionicons name="chevron-back" size={s(22)} color={colors.accent} />
              </TouchableOpacity>
              <Text style={styles.calMonthText}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                <Ionicons name="chevron-forward" size={s(22)} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.calWeekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={i} style={styles.calWeekDay}>{d}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calGrid}>
              {calendarDays.map((day, i) => {
                if (day === null) return <View key={i} style={styles.calDayCell} />;
                const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dotColor = getCalendarDayColor(day);
                const isSelected = dateStr === selectedDate;
                const isTodayDate = dateStr === formatDate(new Date());
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.calDayCell, isSelected && styles.calDayCellSelected]}
                    onPress={() => { setSelectedDate(dateStr); setShowCalendar(false); }}
                  >
                    <Text style={[styles.calDayText, isTodayDate && styles.calDayToday, isSelected && styles.calDayTextSelected]}>{day}</Text>
                    {dotColor && <View style={[styles.calDot, { backgroundColor: dotColor }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.calLegend}>
              <View style={styles.calLegendItem}><View style={[styles.calLegendDot, { backgroundColor: '#34C759' }]} /><Text style={styles.calLegendText}>On track</Text></View>
              <View style={styles.calLegendItem}><View style={[styles.calLegendDot, { backgroundColor: '#FF9500' }]} /><Text style={styles.calLegendText}>Under</Text></View>
              <View style={styles.calLegendItem}><View style={[styles.calLegendDot, { backgroundColor: '#FF3B30' }]} /><Text style={styles.calLegendText}>Over</Text></View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// --- Styles ---

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },

  // Date nav
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(20), paddingVertical: s(8), backgroundColor: 'transparent' },
  dateNavBtn: { padding: s(4) },
  dateNavCenter: { flexDirection: 'row', alignItems: 'center' },
  dateNavText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: c.text, letterSpacing: -0.5 },

  scrollContent: { paddingHorizontal: s(16), paddingTop: s(8) },

  // Summary card
  summaryCard: {
    backgroundColor: c.card, borderRadius: s(10), paddingVertical: s(12), paddingHorizontal: s(14), marginBottom: s(10),
  },
  summaryTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: s(10), textAlign: 'center',
  },
  calorieRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', marginBottom: s(6) },
  calorieBarTrack: { height: s(6), borderRadius: s(3), backgroundColor: c.border, marginBottom: s(12), overflow: 'hidden' as const },
  calorieBarFill: { height: '100%', borderRadius: s(3) },
  calorieBarGoalMarker: { position: 'absolute', top: s(-3), width: s(2), height: s(12), borderRadius: 1, backgroundColor: '#34C759', marginLeft: -1 },
  calorieEaten: { fontSize: 28, fontFamily: 'Inter_800ExtraBold', color: c.text, letterSpacing: -0.5 },
  calorieGoal: { fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text },
  calorieRemaining: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.text, width: '100%', textAlign: 'center', marginTop: s(2) },
  macroCirclesRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: s(14) },
  macroCircleItem: { alignItems: 'center', gap: s(4) },
  macroCircleLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.text, letterSpacing: 1 },
  macroCircleValue: { fontSize: 16, fontFamily: 'Inter_800ExtraBold', color: c.text, textAlign: 'center', letterSpacing: -0.3 },
  macroCircleDivider: { width: s(24), height: 0.5, backgroundColor: c.text, marginVertical: s(2), opacity: 0.3 },
  macroCircleGoal: { fontSize: 10, fontFamily: 'Inter_500Medium', color: c.text, textAlign: 'center' },

  // Supplements section
  supplementsSection: { marginBottom: s(12) },
  supplementsContent: { paddingHorizontal: s(6), paddingVertical: s(8) },
  supplementRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.card, borderRadius: s(12), padding: s(12), gap: s(12),
  },
  supplementInfo: { flexDirection: 'row', alignItems: 'center', gap: s(10), flex: 1 },
  supplementLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: c.text },
  supplementValue: { fontSize: 13, color: c.textSecondary, fontFamily: 'Inter_500Medium', marginLeft: s(8) },
  supplementButtons: { flexDirection: 'row', gap: s(8) },
  supplementBtn: {
    backgroundColor: c.border, minWidth: s(52), height: s(34), borderRadius: s(8),
    alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: s(10),
  },
  supplementBtnText: { fontSize: s(13), color: c.text, fontFamily: 'Inter_700Bold' },
  supplementEntries: {
    flexDirection: 'row', flexWrap: 'wrap', gap: s(6), marginTop: s(8), marginLeft: s(6),
  },
  supplementEntry: {
    backgroundColor: c.border, paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: s(8),
    flexDirection: 'row', alignItems: 'center', gap: s(6),
  },
  supplementEntryText: { fontSize: 12, color: c.text, fontFamily: 'Inter_600SemiBold' },
  supplementEntryTime: { fontSize: 10, color: c.textMuted, fontFamily: 'Inter_500Medium' },

  // Meal sections
  mealSection: { marginBottom: s(20) },
  mealHeader: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: s(8), paddingHorizontal: s(6), gap: s(8),
  },
  mealTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: c.text, flex: 1, letterSpacing: -0.3 },
  mealCal: { fontSize: 12, color: c.textSecondary, fontFamily: 'Inter_600SemiBold' },
  addFoodRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(6), paddingVertical: s(10),
    borderRadius: s(10), marginTop: s(4), marginBottom: s(4), backgroundColor: c.accent + '12',
  },
  addFoodText: { fontSize: 13, color: c.accent, fontFamily: 'Inter_600SemiBold' },

  // Entry
  entryContainer: { position: 'relative', marginBottom: s(6), borderRadius: s(12), overflow: 'hidden' },
  entrySwipeBg: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'flex-end', borderRadius: s(12), paddingRight: s(16) },
  entryCard: { backgroundColor: c.card, borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(10) },
  entryRow: { flexDirection: 'row', alignItems: 'center' },
  entryTimeCol: { width: s(48) },
  entryTime: { fontSize: 11, color: c.textSecondary, fontFamily: 'Inter_600SemiBold' },
  entryInfo: { flex: 1 },
  entryName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: c.text },
  entryQuick: { fontSize: 11, color: c.textSecondary, marginTop: s(1), fontFamily: 'Inter_500Medium' },
  entryExpanded: { marginTop: s(8), paddingTop: s(8), borderTopWidth: 1, borderTopColor: c.border },
  entryMacroRow: { flexDirection: 'row', gap: s(12), marginBottom: s(8) },
  entryMacroChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: s(8) },
  entryMacroText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  entryActions: { flexDirection: 'row', gap: s(16) },
  entryActionBtn: { flexDirection: 'row', alignItems: 'center', gap: s(4), paddingVertical: s(4) },
  entryActionText: { fontSize: 12, color: '#38BDF8', fontFamily: 'Inter_600SemiBold' },

  // Sticky footer
  stickyFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingVertical: s(8), paddingBottom: s(28),
  },
  footerAddBtn: {
    width: s(48), height: s(48), borderRadius: s(24), backgroundColor: '#38BDF8',
    justifyContent: 'center', alignItems: 'center',
  },

  // Add Food Modal - full screen
  addModalContainer: { flex: 1, backgroundColor: c.bg },
  modalGrabBar: {
    position: 'absolute', top: s(8), left: '50%', marginLeft: s(-20),
    width: s(40), height: s(4), borderRadius: s(2), backgroundColor: c.textMuted,
  },
  addModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: s(16), paddingTop: s(50), paddingBottom: s(10),
    borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.card,
  },
  addModalTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: c.text },
  addModalCloseBtn: { padding: s(4) },

  // Search bar
  searchBarContainer: { paddingHorizontal: s(16), paddingVertical: s(8), backgroundColor: c.card },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.border,
    borderRadius: s(10), paddingHorizontal: s(10), height: s(38),
  },
  searchBarInput: { flex: 1, fontSize: 15, color: c.text, marginLeft: s(6), paddingVertical: 0, fontFamily: 'Inter_500Medium' },
  searchBarClear: { padding: s(4) },

  // Tab pills
  tabPillsRow: { flexDirection: 'row', paddingHorizontal: s(16), paddingBottom: s(8), gap: s(8), backgroundColor: c.card },
  tabPill: { paddingHorizontal: s(14), paddingVertical: s(6), borderRadius: s(10), backgroundColor: c.border },
  tabPillActive: { backgroundColor: '#38BDF8' },
  tabPillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  tabPillTextActive: { color: c.bg },

  // Search result row
  searchResultItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(16), paddingVertical: s(10),
    borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.card,
  },
  searchResultInfo: { flex: 1 },
  searchResultName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: c.text },
  searchResultBrand: { fontSize: 11, color: c.textSecondary, marginTop: s(1) },
  searchResultMacros: { fontSize: 11, color: c.textSecondary, marginTop: s(1), fontFamily: 'Inter_500Medium' },
  searchResultCalCol: { alignItems: 'flex-end', marginRight: s(8) },
  searchResultCal: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text },
  searchResultCalUnit: { fontSize: 10, color: c.textMuted, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  confidenceBadge: { marginRight: s(12) },

  // Frequent
  frequentCount: { fontSize: 11, color: '#FB923C', marginTop: s(1), fontFamily: 'Inter_600SemiBold' },

  // Empty states
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: s(60) },
  emptyStateText: { fontSize: 14, color: c.textMuted, textAlign: 'center', marginTop: s(12), fontFamily: 'Inter_500Medium' },
  emptyStateAction: { marginTop: s(16), paddingHorizontal: s(20), paddingVertical: s(10), borderRadius: s(10), backgroundColor: '#38BDF8' },
  emptyStateActionText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.bg },

  // Detail view
  detailHeader: { padding: s(16), borderBottomWidth: 1, borderBottomColor: c.border },
  detailName: { fontSize: 20, fontFamily: 'Inter_800ExtraBold', color: c.text, marginBottom: s(2) },
  detailBrand: { fontSize: 13, color: c.textSecondary, marginTop: s(1), fontFamily: 'Inter_500Medium' },
  detailConfidence: { flexDirection: 'row', alignItems: 'center', marginTop: s(6), gap: s(4) },
  detailConfidenceText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  detailSection: { paddingHorizontal: s(16), paddingTop: s(14) },
  detailSectionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: c.textSecondary, marginBottom: s(8), textTransform: 'uppercase', letterSpacing: 1 },
  servingRow: { flexDirection: 'row', gap: s(14) },
  servingControl: { flex: 1 },
  servingLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text, marginBottom: s(6) },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  quantityBtn: {
    width: s(34), height: s(34), borderRadius: s(17), backgroundColor: c.border,
    justifyContent: 'center', alignItems: 'center',
  },
  quantityInput: {
    fontSize: 16, fontFamily: 'Inter_700Bold', color: c.text, minWidth: s(40), textAlign: 'center',
    backgroundColor: c.border, borderRadius: s(8), paddingHorizontal: s(8), paddingVertical: s(6),
  },
  servingSizeRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
  servingSizeInput: {
    fontSize: 16, fontFamily: 'Inter_700Bold', color: c.text, minWidth: s(56), textAlign: 'center',
    backgroundColor: c.border, borderRadius: s(8), paddingHorizontal: s(8), paddingVertical: s(6),
  },
  servingUnit: { fontSize: 14, color: c.textSecondary, fontFamily: 'Inter_600SemiBold' },
  nutritionGrid: { marginTop: s(2) },
  nutritionRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: s(8),
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  nutritionLabel: { fontSize: 14, color: c.text, fontFamily: 'Inter_500Medium' },
  nutritionValue: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text },
  logFoodBtn: {
    backgroundColor: '#4ADE80', borderRadius: s(8), paddingVertical: s(12),
    alignItems: 'center', marginHorizontal: s(16), marginTop: s(20),
  },
  logFoodBtnText: { color: c.bg, fontSize: 15, fontFamily: 'Inter_700Bold' },

  // Meal type selector
  mealTypeRow: { flexDirection: 'row', gap: s(8), marginBottom: s(12) },
  mealTypeBtn: { flex: 1, minWidth: s(70), paddingVertical: s(8), borderRadius: s(10), backgroundColor: c.border, alignItems: 'center' },
  mealTypeBtnActive: { backgroundColor: '#38BDF8' },
  mealTypeBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  mealTypeBtnTextActive: { color: c.bg },

  // Inputs (custom tab)
  input: { backgroundColor: c.border, borderRadius: s(10), paddingHorizontal: s(14), paddingVertical: s(10), fontSize: 15, color: c.text, marginBottom: s(10), fontFamily: 'Inter_500Medium' },
  macroInputRow: { flexDirection: 'row', gap: s(10), marginBottom: s(14) },
  macroInputCol: { flex: 1 },
  macroInputLabel: { fontSize: 11, color: c.textSecondary, marginBottom: s(4), fontFamily: 'Inter_600SemiBold' },
  macroInput: { backgroundColor: c.border, borderRadius: s(10), paddingHorizontal: s(12), paddingVertical: s(8), fontSize: 15, color: c.text, textAlign: 'center', fontFamily: 'Inter_600SemiBold' },

  saveBtn: { backgroundColor: '#38BDF8', borderRadius: s(8), paddingVertical: s(12), alignItems: 'center', marginTop: s(8) },
  saveBtnText: { color: c.bg, fontSize: 15, fontFamily: 'Inter_700Bold' },

  // Calendar
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: s(20) },
  calContainer: { backgroundColor: c.card, borderRadius: s(10), padding: s(16) },
  calMonthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(12) },
  calMonthText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: c.text },
  calWeekRow: { flexDirection: 'row', marginBottom: s(8) },
  calWeekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_700Bold', color: c.textSecondary, textTransform: 'uppercase' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: '14.28%', alignItems: 'center', paddingVertical: s(7) },
  calDayCellSelected: { backgroundColor: '#38BDF8', borderRadius: s(10) },
  calDayText: { fontSize: 14, color: c.text, fontFamily: 'Inter_600SemiBold' },
  calDayToday: { color: '#38BDF8', fontFamily: 'Inter_800ExtraBold' },
  calDayTextSelected: { color: c.bg },
  calDot: { width: s(5), height: s(5), borderRadius: s(3), marginTop: s(3) },
  calLegend: { flexDirection: 'row', justifyContent: 'center', gap: s(16), marginTop: s(12), paddingTop: s(10), borderTopWidth: 1, borderTopColor: c.border },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: s(6) },
  calLegendDot: { width: s(6), height: s(6), borderRadius: s(3) },
  calLegendText: { fontSize: 11, color: c.textSecondary, fontFamily: 'Inter_500Medium' },

  // Quick add meal type picker
  quickAddPicker: {
    backgroundColor: c.card, borderRadius: s(10), padding: s(20), marginHorizontal: s(20),
  },
  quickAddPickerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: c.text, textAlign: 'center' },
  quickAddPickerSub: { fontSize: 12, color: c.textSecondary, textAlign: 'center', marginTop: s(4), fontFamily: 'Inter_500Medium' },
  quickAddPickerBtns: { flexDirection: 'row', gap: s(8), marginTop: s(16) },
  quickAddPickerBtn: {
    flex: 1, alignItems: 'center', paddingVertical: s(12), borderRadius: s(12),
    backgroundColor: c.border, gap: s(4),
  },
  quickAddPickerBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },

  // Nutrition Details Modal
  ndTabRow: {
    flexDirection: 'row', paddingHorizontal: s(16), paddingVertical: s(8), gap: s(8), backgroundColor: c.card,
    borderBottomWidth: 1, borderBottomColor: c.border,
  },
  ndPieCard: {
    backgroundColor: c.card, borderRadius: s(12), padding: s(16), marginBottom: s(4),
  },
  ndPieRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(16),
  },
  ndPieCenter: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
  },
  ndPieCenterCal: {
    fontSize: 22, fontFamily: 'Inter_800ExtraBold', color: c.text, letterSpacing: -0.5,
  },
  ndPieCenterLabel: {
    fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textSecondary, marginTop: s(-2),
  },
  ndPieLegend: {
    flex: 1, gap: s(6),
  },
  ndPieLegendRow: {
    flexDirection: 'row', alignItems: 'center', gap: s(6),
  },
  ndPieLegendDot: {
    width: s(10), height: s(10), borderRadius: s(5),
  },
  ndPieLegendLabel: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text,
  },
  ndPieLegendValue: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textSecondary, width: s(40), textAlign: 'right',
  },
  ndPieLegendPct: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text, width: s(34), textAlign: 'right',
  },
  ndEntryList: {
    marginTop: s(8), paddingTop: s(8), borderTopWidth: 1, borderTopColor: c.border,
  },
  ndEntryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: s(4),
  },
  ndEntryName: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: c.textSecondary, marginRight: s(8),
  },
  ndEntryCal: {
    fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textSecondary,
  },
  ndMealMicrosCard: {
    backgroundColor: c.card, borderRadius: s(12), padding: s(12), marginTop: s(6),
  },
  ndMealMicrosTitle: {
    fontSize: 10, fontFamily: 'Inter_700Bold', color: c.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: s(6),
  },
  ndSectionTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: c.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: s(10),
  },
  ndMealCard: {
    backgroundColor: c.card, borderRadius: s(12), padding: s(12), marginBottom: s(8),
  },
  ndMealHeader: {
    flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: s(6),
  },
  ndMealName: {
    flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text,
  },
  ndMealCal: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textSecondary,
  },
  ndMacroRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: s(8),
  },
  ndMacroChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: s(8),
  },
  ndMacroText: {
    fontSize: 12, fontFamily: 'Inter_500Medium',
  },
  ndEmptyMeal: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textMuted, fontStyle: 'italic',
  },
  ndMicroRow: {
    marginBottom: s(10),
  },
  ndMicroLabelRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: s(4),
  },
  ndMicroLabel: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text,
  },
  ndMicroValue: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textSecondary, marginRight: s(8),
  },
  ndMicroPct: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: c.text, width: s(38), textAlign: 'right',
  },
  ndMicroBarTrack: {
    height: s(6), borderRadius: s(3), backgroundColor: c.border, overflow: 'hidden' as const,
  },
  ndMicroBarFill: {
    height: '100%', borderRadius: s(3),
  },
  ndEmptyMicros: {
    alignItems: 'center', paddingVertical: s(24), backgroundColor: c.card, borderRadius: s(12),
  },
  ndEmptyMicrosText: {
    fontSize: 13, fontFamily: 'Inter_500Medium', color: c.textMuted, marginTop: s(8),
  },
});
