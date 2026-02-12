import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface WeekData {
  week: string; // ISO date string of week start
  volume: number;
}

interface FriendVolumeChartProps {
  data: WeekData[];
}

const BAR_MAX_HEIGHT = s(120);
const BAR_WIDTH = s(10);
const BAR_GAP = s(3);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const FriendVolumeChart: React.FC<FriendVolumeChartProps> = ({ data }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No volume data yet</Text>
      </View>
    );
  }

  const maxVolume = Math.max(...data.map(d => d.volume), 1);
  const now = new Date();
  const currentWeekStart = getWeekStart(now);

  // Determine which months to label
  let lastMonth = -1;
  const monthLabels: { index: number; label: string }[] = [];
  data.forEach((d, i) => {
    const date = new Date(d.week);
    const month = date.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ index: i, label: MONTH_NAMES[month] });
      lastMonth = month;
    }
  });

  return (
    <View style={styles.container}>
      <View style={styles.yAxis}>
        <Text style={styles.yLabel}>{formatVolume(maxVolume)}</Text>
        <Text style={styles.yLabel}>{formatVolume(Math.round(maxVolume / 2))}</Text>
        <Text style={styles.yLabel}>0</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartContent}
      >
        <View style={styles.barsContainer}>
          {data.map((d, i) => {
            const height = (d.volume / maxVolume) * BAR_MAX_HEIGHT;
            const isCurrentWeek = d.week === currentWeekStart;
            return (
              <View key={d.week} style={styles.barColumn}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(height, s(2)),
                      },
                      isCurrentWeek && styles.barCurrent,
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.monthRow}>
          {data.map((d, i) => {
            const monthLabel = monthLabels.find(m => m.index === i);
            return (
              <View key={d.week + '_label'} style={styles.barColumn}>
                <Text style={styles.monthLabel}>
                  {monthLabel ? monthLabel.label : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return `${v}`;
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  yAxis: {
    justifyContent: 'space-between',
    height: BAR_MAX_HEIGHT,
    marginRight: s(6),
    paddingBottom: 0,
  },
  yLabel: {
    fontSize: s(10),
    color: c.textMuted,
    textAlign: 'right',
    minWidth: s(28),
  },
  chartContent: {
    flexDirection: 'column',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_MAX_HEIGHT,
  },
  barColumn: {
    width: BAR_WIDTH + BAR_GAP,
    alignItems: 'center',
  },
  barWrapper: {
    justifyContent: 'flex-end',
    height: BAR_MAX_HEIGHT,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: s(3),
    backgroundColor: '#38BDF8',
  },
  barCurrent: {
    backgroundColor: '#34C759',
  },
  monthRow: {
    flexDirection: 'row',
    marginTop: s(4),
  },
  monthLabel: {
    fontSize: s(9),
    color: c.textMuted,
    textAlign: 'center',
  },
  emptyContainer: {
    height: s(80),
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: c.textMuted,
    fontSize: s(13),
  },
});
