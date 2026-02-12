import React, { useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { useDragDismiss } from '../hooks/useDragDismiss';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Line, Path, Circle, Text as SvgText } from 'react-native-svg';
import { WeightEntry } from '../weightDatabase';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';

interface WeightHistoryModalProps {
  visible: boolean;
  entries: WeightEntry[];
  trendLine: { date: string; value: number }[];
  onClose: () => void;
  onDelete: (id: string) => void;
}

// Swipeable row component
const SwipeableWeightRow = ({
  entry,
  prevEntry,
  onDelete,
  colors,
  styles,
}: {
  entry: WeightEntry;
  prevEntry?: WeightEntry;
  onDelete: () => void;
  colors: Colors;
  styles: ReturnType<typeof makeStyles>;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -100) {
          Animated.timing(translateX, {
            toValue: -400,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDelete();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const change = prevEntry ? entry.weight - prevEntry.weight : null;
  const dateObj = new Date(entry.date);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.rowContainer}>
      <View style={styles.deleteBackground}>
        <Text style={styles.deleteText}>DELETE</Text>
      </View>
      <Animated.View
        style={[styles.row, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Text style={styles.rowDate}>{formattedDate}</Text>
        <Text style={styles.rowWeight}>{entry.weight} kg</Text>
        {change !== null && (
          <Text style={[
            styles.rowChange,
            change < 0 && styles.changeDown,
            change > 0 && styles.changeUp,
          ]}>
            {change > 0 ? '+' : ''}{change.toFixed(1)}
          </Text>
        )}
        {change === null && <Text style={styles.rowChange}>--</Text>}
      </Animated.View>
    </View>
  );
};

export const WeightHistoryModal: React.FC<WeightHistoryModalProps> = ({
  visible,
  entries,
  trendLine,
  onClose,
  onDelete,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onClose);

  const handleDelete = (entry: WeightEntry) => {
    Alert.alert(
      'Delete Entry',
      `Delete weight entry for ${new Date(entry.date).toLocaleDateString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
      ]
    );
  };

  // Sort entries by date descending for the list
  const sortedEntries = [...entries].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Sort entries ascending for chart
  const chartEntries = [...entries].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Chart dimensions
  const chartWidth = Dimensions.get('window').width - s(48);
  const chartHeight = s(180);
  const paddingLeft = s(40);
  const paddingRight = s(16);
  const paddingTop = s(16);
  const paddingBottom = s(24);
  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  // Calculate chart data
  let chartContent = null;
  if (chartEntries.length > 0) {
    const allWeights = chartEntries.map(e => e.weight);
    const minWeight = Math.floor(Math.min(...allWeights) - 1);
    const maxWeight = Math.ceil(Math.max(...allWeights) + 1);
    const weightRange = maxWeight - minWeight || 1;

    const barWidth = Math.min(s(14), (graphWidth / chartEntries.length) * 0.6);
    const barGap = (graphWidth - barWidth * chartEntries.length) / (chartEntries.length + 1);

    // Generate trend line path
    let trendPath = '';
    trendLine.forEach((point, i) => {
      const x = paddingLeft + barGap + (barWidth / 2) + i * (barWidth + barGap);
      const y = paddingTop + graphHeight - ((point.value - minWeight) / weightRange) * graphHeight;
      trendPath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    chartContent = (
      <Svg width={chartWidth} height={chartHeight}>
        {/* Y-axis labels */}
        <SvgText x={paddingLeft - s(8)} y={paddingTop + s(4)} fill={colors.textMuted} fontSize={s(11)} textAnchor="end">
          {maxWeight}
        </SvgText>
        <SvgText x={paddingLeft - s(8)} y={paddingTop + graphHeight / 2 + s(4)} fill={colors.textMuted} fontSize={s(11)} textAnchor="end">
          {((maxWeight + minWeight) / 2).toFixed(0)}
        </SvgText>
        <SvgText x={paddingLeft - s(8)} y={paddingTop + graphHeight + s(4)} fill={colors.textMuted} fontSize={s(11)} textAnchor="end">
          {minWeight}
        </SvgText>

        {/* Grid lines */}
        <Line x1={paddingLeft} y1={paddingTop} x2={chartWidth - paddingRight} y2={paddingTop}
          stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
        <Line x1={paddingLeft} y1={paddingTop + graphHeight / 2} x2={chartWidth - paddingRight} y2={paddingTop + graphHeight / 2}
          stroke={colors.border} strokeWidth="1" strokeDasharray="4,4" />
        <Line x1={paddingLeft} y1={paddingTop + graphHeight} x2={chartWidth - paddingRight} y2={paddingTop + graphHeight}
          stroke={colors.border} strokeWidth="1" />

        {/* Bars */}
        {chartEntries.map((entry, i) => {
          const barHeight = ((entry.weight - minWeight) / weightRange) * graphHeight;
          const x = paddingLeft + barGap + i * (barWidth + barGap);
          const y = paddingTop + graphHeight - barHeight;
          return (
            <Rect key={entry.id} x={x} y={y} width={barWidth} height={barHeight} fill={colors.border} rx={s(3)} />
          );
        })}

        {/* Trend line */}
        <Path d={trendPath} stroke="#38BDF8" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Trend dots */}
        {trendLine.map((point, i) => {
          const x = paddingLeft + barGap + (barWidth / 2) + i * (barWidth + barGap);
          const y = paddingTop + graphHeight - ((point.value - minWeight) / weightRange) * graphHeight;
          return <Circle key={point.date} cx={x} cy={y} r={s(4)} fill="#38BDF8" />;
        })}
      </Svg>
    );
  }

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
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={s(24)} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Weight History</Text>
            <View style={{ width: s(40) }} />
          </View>

          {/* Chart */}
          {entries.length > 0 ? (
            <View style={styles.chartContainer}>
              {chartContent}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
                  <Text style={styles.legendText}>Daily</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#38BDF8' }]} />
                  <Text style={styles.legendText}>EMA Trend</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>No weight entries yet</Text>
            </View>
          )}

          {/* Entry List */}
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>Date</Text>
            <Text style={styles.listHeaderText}>Weight</Text>
            <Text style={styles.listHeaderText}>Change</Text>
          </View>
          <FlatList
            data={sortedEntries}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              // Find previous entry (next in sorted desc list)
              const prevEntry = sortedEntries[index + 1];
              return (
                <SwipeableWeightRow
                  entry={item}
                  prevEntry={prevEntry}
                  onDelete={() => handleDelete(item)}
                  colors={colors}
                  styles={styles}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No entries to display</Text>
              </View>
            }
          />
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
    padding: s(20),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
  },
  backButton: {
    width: s(40),
    height: s(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: s(20),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
  },
  chartContainer: {
    backgroundColor: c.card,
    margin: s(16),
    padding: s(16),
    borderRadius: s(10),
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: s(12),
    gap: s(24),
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    marginRight: s(8),
  },
  legendText: {
    fontSize: s(12),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyChart: {
    backgroundColor: c.card,
    margin: s(16),
    padding: s(40),
    borderRadius: s(10),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: s(15),
    color: c.textMuted,
  },
  listHeader: {
    flexDirection: 'row',
    paddingHorizontal: s(20),
    paddingVertical: s(12),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
  },
  listHeaderText: {
    flex: 1,
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
  },
  listContent: {
    paddingBottom: s(40),
  },
  rowContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: s(120),
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: s(24),
  },
  deleteText: {
    color: '#fff',
    fontFamily: 'Inter_800ExtraBold',
    fontSize: s(12),
    letterSpacing: s(1),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(20),
    paddingVertical: s(16),
    backgroundColor: c.bg,
    borderBottomWidth: s(1),
    borderBottomColor: c.card,
  },
  rowDate: {
    flex: 1,
    fontSize: s(14),
    color: c.text,
    fontFamily: 'Inter_500Medium',
  },
  rowWeight: {
    flex: 1,
    fontSize: s(15),
    color: c.text,
    fontFamily: 'Inter_700Bold',
  },
  rowChange: {
    flex: 1,
    fontSize: s(14),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'right',
  },
  changeDown: {
    color: '#34C759',
  },
  changeUp: {
    color: '#FF9500',
  },
  emptyList: {
    padding: s(40),
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: s(15),
    color: c.textMuted,
  },
});
