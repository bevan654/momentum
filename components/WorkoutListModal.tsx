import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useDragDismiss } from '../hooks/useDragDismiss';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';

interface WorkoutListItem {
  id: string;
  created_at: string;
  duration: number;
  total_exercises: number;
  total_sets: number;
}

interface WorkoutListModalProps {
  visible: boolean;
  date: string;
  workouts: WorkoutListItem[];
  onClose: () => void;
  onSelectWorkout: (workoutId: string) => void;
}

const CARD_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF2D55',
];

export const WorkoutListModal: React.FC<WorkoutListModalProps> = ({
  visible,
  date,
  workouts,
  onClose,
  onSelectWorkout,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onClose);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <View style={styles.dragHandle} {...panHandlers} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Workouts</Text>
              <Text style={styles.headerDate}>{formatDate(date)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={s(18)} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Workout List */}
          <ScrollView style={styles.workoutList} showsVerticalScrollIndicator={false}>
            {workouts.map((workout, index) => {
              const color = CARD_COLORS[index % CARD_COLORS.length];
              return (
                <TouchableOpacity
                  key={workout.id}
                  style={styles.workoutCard}
                  onPress={() => {
                    onSelectWorkout(workout.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.workoutCardTop}>
                    <View style={[styles.workoutIndexBadge, { backgroundColor: color }]}>
                      <Text style={styles.workoutIndexText}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workoutNumber}>Workout #{index + 1}</Text>
                      <Text style={styles.workoutTime}>{formatTime(workout.created_at)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={s(16)} color={colors.textMuted} />
                  </View>

                  <View style={styles.workoutStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="time-outline" size={s(14)} color={colors.textMuted} />
                      <Text style={styles.statValue}>{formatDuration(workout.duration)}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Ionicons name="barbell-outline" size={s(14)} color={colors.textMuted} />
                      <Text style={styles.statValue}>{workout.total_exercises}</Text>
                      <Text style={styles.statLabel}>exercises</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Ionicons name="layers-outline" size={s(14)} color={colors.textMuted} />
                      <Text style={styles.statValue}>{workout.total_sets}</Text>
                      <Text style={styles.statLabel}>sets</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: c.bg,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    maxHeight: '70%',
    paddingBottom: s(24),
  },
  dragHandle: {
    width: s(36),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: s(10),
    marginBottom: s(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(20),
    paddingBottom: s(14),
  },
  headerTitle: {
    fontSize: s(20),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  headerDate: {
    fontSize: s(13),
    color: c.textSecondary,
    marginTop: s(2),
  },
  closeButton: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    backgroundColor: c.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutList: {
    paddingHorizontal: s(16),
  },
  workoutCard: {
    backgroundColor: c.card,
    borderRadius: s(8),
    padding: s(14),
    marginBottom: s(10),
  },
  workoutCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(12),
    gap: s(12),
  },
  workoutIndexBadge: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutIndexText: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  workoutNumber: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  workoutTime: {
    fontSize: s(12),
    color: c.textSecondary,
    marginTop: s(1),
  },
  workoutStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: s(10),
    paddingVertical: s(8),
    paddingHorizontal: s(12),
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(5),
  },
  statDivider: {
    width: s(1),
    height: s(14),
    backgroundColor: c.border,
  },
  statValue: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },
  statLabel: {
    fontSize: s(12),
    color: c.textSecondary,
  },
});
