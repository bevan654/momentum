import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLeaderboard, getExerciseStrengthLeaderboard, getPopularExercises } from '../../friendsDatabase';
import { LeaderboardList } from './LeaderboardList';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface LeaderboardsProps {
  currentUserId: string;
}

type BoardType = 'strength_ratio' | 'workout_streak';
type Scope = 'global' | 'friends';

const BOARD_CONFIG: Record<BoardType, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  valueLabel: string;
  periodLabel: string;
  formatValue?: (v: number) => string;
}> = {
  strength_ratio: {
    label: 'Strength Ratio',
    icon: 'barbell',
    color: '#FF9500',
    valueLabel: 'x BW',
    periodLabel: 'All Time Best',
    formatValue: (v) => v.toFixed(2),
  },
  workout_streak: {
    label: 'Streak',
    icon: 'flame',
    color: '#FF3B30',
    valueLabel: 'days',
    periodLabel: 'Current Streak',
  },
};

export const Leaderboards: React.FC<LeaderboardsProps> = ({ currentUserId }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeBoard, setActiveBoard] = useState<BoardType>('strength_ratio');
  const [activeScope, setActiveScope] = useState<Scope>('global');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Exercise picker state
  const [exercises, setExercises] = useState<{ exercise_name: string; user_count: number }[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const config = BOARD_CONFIG[activeBoard];

  // Load popular exercises on mount
  useEffect(() => {
    (async () => {
      const result = await getPopularExercises(30);
      if (result.success && result.data && result.data.length > 0) {
        setExercises(result.data);
        setSelectedExercise(result.data[0].exercise_name);
      }
    })();
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    const friendsOnly = activeScope === 'friends';

    let result;
    if (activeBoard === 'strength_ratio') {
      if (!selectedExercise) {
        setEntries([]);
        setLoading(false);
        return;
      }
      result = await getExerciseStrengthLeaderboard(selectedExercise, friendsOnly);
    } else {
      result = await getLeaderboard('workout_streak', friendsOnly);
    }

    if (result.success && result.data) {
      setEntries(result.data);
    } else {
      setEntries([]);
    }
    setLoading(false);
  }, [activeBoard, activeScope, selectedExercise]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const filteredExercises = exerciseSearch
    ? exercises.filter(e => e.exercise_name.toLowerCase().includes(exerciseSearch.toLowerCase()))
    : exercises;

  return (
    <View style={styles.container}>
      {/* Board Type Toggle */}
      <View style={styles.boardRow}>
        {(Object.keys(BOARD_CONFIG) as BoardType[]).map((key) => {
          const board = BOARD_CONFIG[key];
          const isActive = activeBoard === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.boardBtn,
                isActive && { backgroundColor: board.color + '18', borderColor: board.color },
              ]}
              onPress={() => setActiveBoard(key)}
            >
              <Ionicons
                name={board.icon}
                size={s(15)}
                color={isActive ? board.color : colors.textMuted}
              />
              <Text style={[
                styles.boardText,
                isActive && { color: board.color },
              ]}>
                {board.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Exercise Picker (only for strength ratio) */}
      {activeBoard === 'strength_ratio' && (
        <TouchableOpacity
          style={[styles.exercisePicker, { borderColor: config.color + '40' }]}
          onPress={() => { setShowExercisePicker(true); setExerciseSearch(''); }}
        >
          <Ionicons name="fitness-outline" size={s(16)} color={config.color} />
          <Text style={[styles.exercisePickerText, { color: config.color }]} numberOfLines={1}>
            {selectedExercise || 'Select Exercise'}
          </Text>
          <Ionicons name="chevron-down" size={s(16)} color={config.color} />
        </TouchableOpacity>
      )}

      {/* Scope Toggle (Global / Friends) */}
      <View style={styles.scopeRow}>
        {(['global', 'friends'] as Scope[]).map((scope) => {
          const isActive = activeScope === scope;
          return (
            <TouchableOpacity
              key={scope}
              style={[
                styles.scopeBtn,
                isActive && { backgroundColor: config.color },
              ]}
              onPress={() => setActiveScope(scope)}
            >
              <Ionicons
                name={scope === 'global' ? 'globe-outline' : 'people-outline'}
                size={s(14)}
                color={isActive ? colors.bg : colors.textSecondary}
                style={{ marginRight: s(4) }}
              />
              <Text style={[
                styles.scopeText,
                isActive && styles.scopeTextActive,
              ]}>
                {scope === 'global' ? 'Global' : 'Friends'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.periodLabel}>{config.periodLabel}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={config.color} />
        </View>
      ) : (
        <LeaderboardList
          entries={entries}
          currentUserId={currentUserId}
          valueLabel={config.valueLabel}
          accentColor={config.color}
          formatValue={config.formatValue}
        />
      )}

      {/* Exercise Picker Modal */}
      <Modal visible={showExercisePicker} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Exercise</Text>
              <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
                <Ionicons name="close" size={s(24)} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchRow, { backgroundColor: colors.bg }]}>
              <Ionicons name="search" size={s(16)} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search exercises..."
                placeholderTextColor={colors.textMuted}
                value={exerciseSearch}
                onChangeText={setExerciseSearch}
                autoFocus
              />
            </View>

            <FlatList
              data={filteredExercises}
              keyExtractor={(item) => item.exercise_name}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.exercise_name === selectedExercise;
                return (
                  <TouchableOpacity
                    style={[
                      styles.exerciseOption,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: config.color + '15' },
                    ]}
                    onPress={() => {
                      setSelectedExercise(item.exercise_name);
                      setShowExercisePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.exerciseOptionText,
                      { color: colors.text },
                      isSelected && { color: config.color, fontFamily: 'Inter_700Bold' },
                    ]}>
                      {item.exercise_name}
                    </Text>
                    <Text style={[styles.exerciseUserCount, { color: colors.textMuted }]}>
                      {item.user_count} {item.user_count === 1 ? 'user' : 'users'}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptySearch, { color: colors.textMuted }]}>
                  No exercises found
                </Text>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  boardRow: {
    flexDirection: 'row',
    paddingHorizontal: s(16),
    paddingTop: s(12),
    paddingBottom: s(4),
    gap: s(10),
  },
  boardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(5),
    paddingVertical: s(8),
    borderRadius: s(10),
    backgroundColor: c.card,
    borderWidth: s(1.5),
    borderColor: c.border,
  },
  boardText: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
  },
  exercisePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: s(10),
    paddingHorizontal: s(14),
    paddingVertical: s(7),
    borderRadius: s(20),
    backgroundColor: c.card,
    borderWidth: s(1),
    borderColor: c.border,
    gap: s(6),
  },
  exercisePickerText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    maxWidth: s(200),
  },
  scopeRow: {
    flexDirection: 'row',
    paddingHorizontal: s(16),
    paddingTop: s(10),
    gap: s(8),
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s(7),
    borderRadius: s(8),
    backgroundColor: c.border,
  },
  scopeText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  scopeTextActive: {
    color: c.bg,
  },
  periodLabel: {
    fontSize: s(12),
    color: c.textMuted,
    textAlign: 'center',
    marginTop: s(10),
    marginBottom: s(4),
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: s(40),
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    paddingBottom: s(32),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    paddingTop: s(18),
    paddingBottom: s(8),
  },
  modalTitle: {
    fontSize: s(17),
    fontFamily: 'Inter_700Bold',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: s(16),
    marginBottom: s(8),
    paddingHorizontal: s(12),
    paddingVertical: s(8),
    borderRadius: s(10),
    gap: s(8),
  },
  searchInput: {
    flex: 1,
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    padding: 0,
  },
  exerciseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    paddingVertical: s(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  exerciseOptionText: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  exerciseUserCount: {
    fontSize: s(12),
    fontFamily: 'Inter_500Medium',
    marginLeft: s(12),
  },
  emptySearch: {
    textAlign: 'center',
    paddingTop: s(20),
    fontSize: s(14),
  },
});
