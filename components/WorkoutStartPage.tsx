import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDragDismiss } from '../hooks/useDragDismiss';
import { Ionicons } from '@expo/vector-icons';
import { getRoutines, deleteRoutine, saveRoutine, Routine } from '../routineDatabase';
import { ExerciseListItem } from '../exerciseDatabase';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';

interface RoutineExerciseForWorkout {
  name: string;
  sets: number;
}

interface DraftExercise {
  name: string;
  defaultSets: number;
}

interface WorkoutStartPageProps {
  onStartEmpty: () => void;
  onStartFromRoutine: (exercises: RoutineExerciseForWorkout[]) => void;
  exerciseList: ExerciseListItem[];
  onJoinByCode?: () => void;
}

const ROUTINE_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00',
];

export function WorkoutStartPage({ onStartEmpty, onStartFromRoutine, exerciseList, onJoinByCode }: WorkoutStartPageProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers: createPanHandlers, animatedStyle: createAnimatedStyle } = useDragDismiss(() => setCreateModalVisible(false));
  const { panHandlers: pickerPanHandlers, animatedStyle: pickerAnimatedStyle } = useDragDismiss(() => setExercisePickerVisible(false));

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  // Create routine modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRoutines = useCallback(async () => {
    setLoading(true);
    const result = await getRoutines();
    if (result.success && result.routines) {
      setRoutines(result.routines);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRoutines();
  }, [loadRoutines]);

  const handleDelete = (routine: Routine) => {
    Alert.alert(
      'Delete Routine',
      `Delete "${routine.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteRoutine(routine.id);
            if (result.success) {
              setRoutines(prev => prev.filter(r => r.id !== routine.id));
            } else {
              Alert.alert('Error', 'Could not delete routine.');
            }
          },
        },
      ]
    );
  };

  const handleStart = (routine: Routine) => {
    const exercises = routine.routine_exercises.map(ex => ({
      name: ex.name,
      sets: ex.default_sets,
    }));
    onStartFromRoutine(exercises);
  };

  // --- Create Routine helpers ---

  const openCreateModal = () => {
    setRoutineName('');
    setDraftExercises([]);
    setCreateModalVisible(true);
  };

  const addExerciseToDraft = (item: ExerciseListItem) => {
    setDraftExercises(prev => [...prev, { name: item.name, defaultSets: 3 }]);
    setExercisePickerVisible(false);
  };

  const removeDraftExercise = (index: number) => {
    setDraftExercises(prev => prev.filter((_, i) => i !== index));
  };

  const updateDraftSets = (index: number, delta: number) => {
    setDraftExercises(prev =>
      prev.map((ex, i) => {
        if (i !== index) return ex;
        const newSets = Math.max(1, Math.min(20, ex.defaultSets + delta));
        return { ...ex, defaultSets: newSets };
      })
    );
  };

  const moveDraftExercise = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === draftExercises.length - 1) return;
    const newList = [...draftExercises];
    const target = direction === 'up' ? index - 1 : index + 1;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setDraftExercises(newList);
  };

  const handleSaveRoutine = async () => {
    const trimmed = routineName.trim();
    if (!trimmed) {
      Alert.alert('Missing Name', 'Please enter a name for the routine.');
      return;
    }
    if (draftExercises.length === 0) {
      Alert.alert('No Exercises', 'Add at least one exercise to the routine.');
      return;
    }

    setSaving(true);
    const result = await saveRoutine(trimmed, draftExercises);
    setSaving(false);

    if (result.success) {
      setCreateModalVisible(false);
      loadRoutines();
    } else {
      Alert.alert('Error', 'Could not save routine.');
    }
  };

  // --- Render ---

  const renderRoutineCard = ({ item, index }: { item: Routine; index: number }) => {
    const color = ROUTINE_COLORS[index % ROUTINE_COLORS.length];
    return (
      <View style={styles.routineCard}>
        <View style={styles.routineCardLeft}>
          <View style={[styles.routineColorBar, { backgroundColor: color }]} />
          <View style={styles.routineInfo}>
            <Text style={styles.routineName}>{item.name}</Text>
            <Text style={styles.routineDetail}>
              {item.routine_exercises.length} exercise{item.routine_exercises.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.routineActions}>
          <TouchableOpacity
            style={styles.startRoutineButton}
            onPress={() => handleStart(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={s(14)} color="#FFFFFF" />
            <Text style={styles.startRoutineButtonText} numberOfLines={1} adjustsFontSizeToFit>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteRoutineButton}
            onPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={s(16)} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.startEmptyButton} onPress={onStartEmpty} activeOpacity={0.8}>
        <View style={styles.startEmptyIconWrap}>
          <Ionicons name="flash" size={s(20)} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.startEmptyButtonText}>Start Empty Workout</Text>
          <Text style={styles.startEmptySubtext}>Begin with a blank session</Text>
        </View>
        <Ionicons name="chevron-forward" size={s(18)} color={colors.textMuted} />
      </TouchableOpacity>

      {onJoinByCode && (
        <TouchableOpacity style={[styles.startEmptyButton, { marginTop: s(8) }]} onPress={onJoinByCode} activeOpacity={0.8}>
          <View style={[styles.startEmptyIconWrap, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
            <Ionicons name="people" size={s(20)} color="#34C759" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.startEmptyButtonText}>Join Group Session</Text>
            <Text style={styles.startEmptySubtext}>Enter an invite code to join</Text>
          </View>
          <Ionicons name="chevron-forward" size={s(18)} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} numberOfLines={1} adjustsFontSizeToFit>My Routines</Text>
        <TouchableOpacity style={styles.createRoutineButton} onPress={openCreateModal} activeOpacity={0.7}>
          <Ionicons name="add" size={s(16)} color={colors.accent} />
          <Text style={styles.createRoutineButtonText} numberOfLines={1} adjustsFontSizeToFit>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      ) : routines.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="reader-outline" size={s(32)} color={colors.border} />
          </View>
          <Text style={styles.emptyStateTitle}>No routines yet</Text>
          <Text style={styles.emptyStateText}>
            Tap "New" to create a routine template
          </Text>
        </View>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id}
          renderItem={renderRoutineCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Routine Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={createModalVisible}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View style={[styles.modalContainer, createAnimatedStyle]}>
            <View style={styles.modalDragHandleContainer} {...createPanHandlers}>
              <View style={styles.modalDragHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1} adjustsFontSizeToFit>New Routine</Text>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={s(18)} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Routine Name</Text>
              <TextInput
                style={styles.nameInput}
                placeholder="e.g. Push Day, Upper Body..."
                placeholderTextColor={colors.textMuted}
                value={routineName}
                onChangeText={setRoutineName}
                autoFocus
              />

              <Text style={[styles.fieldLabel, { marginTop: s(24) }]}>Exercises</Text>

              {draftExercises.map((ex, index) => (
                <View key={index} style={styles.draftExerciseRow}>
                  <View style={styles.draftReorderButtons}>
                    {index > 0 && (
                      <TouchableOpacity onPress={() => moveDraftExercise(index, 'up')} style={styles.reorderButton}>
                        <Ionicons name="chevron-up" size={s(16)} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    {index < draftExercises.length - 1 && (
                      <TouchableOpacity onPress={() => moveDraftExercise(index, 'down')} style={styles.reorderButton}>
                        <Ionicons name="chevron-down" size={s(16)} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.draftExerciseInfo}>
                    <Text style={styles.draftExerciseName}>{ex.name}</Text>
                    <View style={styles.setsControl}>
                      <TouchableOpacity
                        style={styles.setsButton}
                        onPress={() => updateDraftSets(index, -1)}
                      >
                        <Ionicons name="remove" size={s(16)} color={colors.accent} />
                      </TouchableOpacity>
                      <Text style={styles.setsValue}>{ex.defaultSets} sets</Text>
                      <TouchableOpacity
                        style={styles.setsButton}
                        onPress={() => updateDraftSets(index, 1)}
                      >
                        <Ionicons name="add" size={s(16)} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.removeDraftButton}
                    onPress={() => removeDraftExercise(index)}
                  >
                    <Ionicons name="close" size={s(16)} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addExerciseButton}
                onPress={() => setExercisePickerVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={s(20)} color={colors.accent} />
                <Text style={styles.addExerciseButtonText} numberOfLines={1} adjustsFontSizeToFit>Add Exercise</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSaveRoutine}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Routine'}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Exercise Picker rendered inside create modal to avoid stacked Modal issues */}
            {exercisePickerVisible && (
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerDragHandleContainer} {...pickerPanHandlers}>
                    <View style={styles.pickerDragHandle} />
                  </View>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>Select Exercise</Text>
                    <TouchableOpacity
                      onPress={() => setExercisePickerVisible(false)}
                      style={styles.pickerCloseButton}
                    >
                      <Ionicons name="close" size={s(18)} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={exerciseList}
                    keyExtractor={(item) => item.name}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.pickerItem}
                        onPress={() => addExerciseToDraft(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.pickerItemText}>{item.name}</Text>
                        <Ionicons name="add-circle-outline" size={s(20)} color={colors.accent} />
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: s(16),
    paddingTop: s(16),
    backgroundColor: c.bg,
  },
  startEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    paddingVertical: s(16),
    paddingHorizontal: s(16),
    borderRadius: s(8),
    marginBottom: s(28),
    gap: s(14),
  },
  startEmptyIconWrap: {
    width: s(40),
    height: s(40),
    borderRadius: s(12),
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startEmptyButtonText: {
    color: c.text,
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 1,
  },
  startEmptySubtext: {
    color: c.textMuted,
    fontSize: s(12),
    marginTop: s(1),
    flexShrink: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(14),
  },
  sectionTitle: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: s(0.8),
    flex: 1,
  },
  createRoutineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingVertical: s(6),
    paddingHorizontal: s(12),
    borderRadius: s(10),
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  createRoutineButtonText: {
    color: c.accent,
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
  },
  loader: {
    marginTop: s(60),
  },
  emptyState: {
    marginTop: s(60),
    alignItems: 'center',
    paddingHorizontal: s(40),
  },
  emptyStateIcon: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s(14),
  },
  emptyStateTitle: {
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    marginBottom: s(4),
  },
  emptyStateText: {
    fontSize: s(14),
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: s(20),
  },
  listContent: {
    paddingBottom: s(120),
  },
  routineCard: {
    backgroundColor: c.card,
    borderRadius: s(8),
    padding: s(14),
    marginBottom: s(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: s(12),
  },
  routineColorBar: {
    width: s(4),
    height: s(36),
    borderRadius: s(2),
  },
  routineInfo: {
    flex: 1,
  },
  routineName: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    marginBottom: s(3),
    flexShrink: 1,
  },
  routineDetail: {
    fontSize: s(13),
    color: c.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  routineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  startRoutineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    backgroundColor: c.accent,
    paddingVertical: s(8),
    paddingHorizontal: s(14),
    borderRadius: s(10),
  },
  startRoutineButtonText: {
    color: '#FFFFFF',
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
  },
  deleteRoutineButton: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- Create Routine Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: c.bg,
    marginTop: s(60),
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    overflow: 'hidden',
  },
  modalDragHandleContainer: {
    alignItems: 'center',
    paddingTop: s(10),
    paddingBottom: s(4),
  },
  modalDragHandle: {
    width: s(36),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: c.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: s(20),
    paddingBottom: s(16),
  },
  modalTitle: {
    fontSize: s(20),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  modalCloseButton: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: s(20),
    paddingTop: s(8),
  },
  fieldLabel: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: s(0.8),
    marginBottom: s(8),
  },
  nameInput: {
    backgroundColor: c.card,
    borderRadius: s(12),
    paddingHorizontal: s(14),
    paddingVertical: s(13),
    fontSize: s(16),
    fontFamily: 'Inter_500Medium',
    color: c.text,
  },
  draftExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: s(12),
    padding: s(12),
    marginBottom: s(8),
  },
  draftReorderButtons: {
    width: s(28),
    marginRight: s(10),
    alignItems: 'center',
    gap: s(2),
  },
  reorderButton: {
    width: s(26),
    height: s(26),
    borderRadius: s(8),
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  draftExerciseInfo: {
    flex: 1,
  },
  draftExerciseName: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    marginBottom: s(6),
    flexShrink: 1,
  },
  setsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  setsButton: {
    width: s(30),
    height: s(30),
    borderRadius: s(10),
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setsValue: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    minWidth: s(50),
    textAlign: 'center',
  },
  removeDraftButton: {
    width: s(30),
    height: s(30),
    borderRadius: s(10),
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: s(10),
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    paddingVertical: s(14),
    borderRadius: s(12),
    marginTop: s(4),
    marginBottom: s(32),
    borderWidth: s(1.5),
    borderColor: c.border,
    borderStyle: 'dashed',
  },
  addExerciseButtonText: {
    color: c.accent,
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
  },
  modalFooter: {
    paddingHorizontal: s(20),
    paddingTop: s(14),
    paddingBottom: s(24),
    backgroundColor: c.bg,
  },
  saveButton: {
    backgroundColor: c.accent,
    paddingVertical: s(15),
    borderRadius: s(8),
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
  },

  // --- Exercise Picker ---
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 10,
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
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(14),
    paddingHorizontal: s(20),
    borderBottomWidth: s(1),
    borderBottomColor: c.card,
  },
  pickerItemText: {
    fontSize: s(16),
    color: c.text,
    fontFamily: 'Inter_500Medium',
  },
});
