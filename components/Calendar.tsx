import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';

interface WorkoutDay {
  date: string; // YYYY-MM-DD format
  hasWorkout: boolean;
  workoutCount?: number;
  isRest?: boolean;
  isPR?: boolean;
  isIncomplete?: boolean;
}

interface CalendarProps {
  workoutDays: WorkoutDay[];
  onDayPress: (date: string) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ workoutDays, onDayPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          changeMonth(-1);
        } else if (gestureState.dx < -50) {
          changeMonth(1);
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const changeMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isFuture = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compare = new Date(date);
    compare.setHours(0, 0, 0, 0);
    return compare > today;
  };

  const getWorkoutDayData = (date: Date): WorkoutDay | undefined => {
    const dateStr = formatDate(date);
    return workoutDays.find(wd => wd.date === dateStr);
  };

  const days = getDaysInMonth();
  // Pad to complete final row of 7
  while (days.length % 7 !== 0) days.push(null);
  // Chunk into rows of 7
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }
  const monthLabel = currentDate.toLocaleString('default', { month: 'long' });
  const yearLabel = currentDate.getFullYear();
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Check if current month is the present month
  const now = new Date();
  const isCurrentMonth = currentDate.getMonth() === now.getMonth() && currentDate.getFullYear() === now.getFullYear();

  return (
    <View style={styles.container}>
      {/* Month Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={s(18)} color={colors.accent} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.monthText}>{monthLabel}</Text>
          <Text style={styles.yearText}>{yearLabel}</Text>
        </View>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-forward" size={s(18)} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Weekday Labels */}
      <View style={styles.weekDaysRow}>
        {weekDays.map((day, i) => (
          <View key={i} style={styles.weekDayCell}>
            <Text style={[styles.weekDayText, (i === 0 || i === 6) && styles.weekDayWeekend]}>{day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Calendar Grid */}
      <Animated.View
        style={[styles.calendarGrid, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.weekRow}>
            {row.map((date, colIndex) => {
              const index = rowIndex * 7 + colIndex;
              if (!date) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }

              const workoutData = getWorkoutDayData(date);
              const today = isToday(date);
              const future = isFuture(date);
              const hasWorkout = workoutData?.hasWorkout;
              const multipleWorkouts = (workoutData?.workoutCount || 0) > 1;

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.dayCell}
                  onPress={() => onDayPress(formatDate(date))}
                  activeOpacity={0.6}
                >
                  <View style={[
                    styles.dayInner,
                    today && styles.todayInner,
                    hasWorkout && !today && styles.workoutInner,
                    workoutData?.isIncomplete && styles.incompleteInner,
                  ]}>
                    <Text style={[
                      styles.dayText,
                      today && styles.todayText,
                      future && styles.futureText,
                      hasWorkout && !today && styles.workoutDayText,
                    ]}>
                      {date.getDate()}
                    </Text>
                  </View>

                  {/* Indicators row below the number */}
                  <View style={styles.indicatorRow}>
                    {hasWorkout && workoutData?.isPR && (
                      <Ionicons name="star" size={s(8)} color="#FACC15" />
                    )}
                    {hasWorkout && multipleWorkouts && (
                      <Text style={styles.countText}>{workoutData?.workoutCount}</Text>
                    )}
                    {hasWorkout && !multipleWorkouts && !workoutData?.isPR && (
                      <View style={[
                        styles.dot,
                        workoutData?.isRest && styles.dotRest,
                        today && styles.dotToday,
                      ]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </Animated.View>

      {/* Today shortcut */}
      {!isCurrentMonth && (
        <TouchableOpacity
          style={styles.todayButton}
          onPress={() => setCurrentDate(new Date())}
          activeOpacity={0.7}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    backgroundColor: c.card,
    borderRadius: s(16),
    padding: s(16),
    marginHorizontal: s(16),
    marginTop: s(16),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(16),
  },
  navButton: {
    width: s(32),
    height: s(32),
    borderRadius: s(8),
    backgroundColor: c.border + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: s(17),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    letterSpacing: 0.3,
  },
  yearText: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    marginTop: s(1),
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: s(6),
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: s(4),
  },
  weekDayText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekDayWeekend: {
    color: c.textMuted + '80',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginBottom: s(4),
  },
  calendarGrid: {
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: s(3),
  },
  dayInner: {
    width: s(34),
    height: s(34),
    borderRadius: s(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayInner: {
    backgroundColor: c.accent,
  },
  workoutInner: {
    backgroundColor: c.border + '60',
  },
  incompleteInner: {
    borderWidth: 1.5,
    borderColor: c.warning,
    borderStyle: 'dashed',
  },
  dayText: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    color: c.text,
  },
  todayText: {
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  futureText: {
    color: c.textMuted,
  },
  workoutDayText: {
    fontFamily: 'Inter_600SemiBold',
  },
  indicatorRow: {
    height: s(10),
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: s(2),
  },
  dot: {
    width: s(4),
    height: s(4),
    borderRadius: s(2),
    backgroundColor: c.success,
  },
  dotRest: {
    backgroundColor: c.textMuted,
  },
  dotToday: {
    backgroundColor: c.accent,
  },
  countText: {
    fontSize: s(8),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
  },
  todayButton: {
    alignSelf: 'center',
    marginTop: s(8),
    paddingVertical: s(5),
    paddingHorizontal: s(14),
    borderRadius: s(12),
    backgroundColor: c.accent + '18',
  },
  todayButtonText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },
});
