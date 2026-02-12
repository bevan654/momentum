import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useDragDismiss } from '../../hooks/useDragDismiss';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../../responsive';
import {
  removeFriend,
  blockUser,
  getFriendStreak,
  getLastActivityForUser,
  getFriendActivity,
  Friendship,
  ActivityEntry,
} from '../../friendsDatabase';
import { FriendVolumeChart } from './FriendVolumeChart';
import { subscribeToPresence, getOnlineUsers, getLastSeen, PresenceState } from '../../presenceManager';
import { useTheme, Colors } from '../../theme';

interface FriendProfileModalProps {
  visible: boolean;
  friendship: Friendship | null;
  onClose: () => void;
  onFriendRemoved: () => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export const FriendProfileModal: React.FC<FriendProfileModalProps> = ({
  visible,
  friendship,
  onClose,
  onFriendRemoved,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onClose);

  const [streak, setStreak] = useState<number | null>(null);
  const [streakHidden, setStreakHidden] = useState(false);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceState>>(getOnlineUsers());

  useEffect(() => {
    return subscribeToPresence(setPresenceMap);
  }, []);

  const friendProfile = friendship?.profile;
  const friendUserId = friendProfile?.id;
  const friendEmail = friendProfile?.email || 'Unknown';
  const friendDisplayName = friendProfile?.username || friendEmail;

  useEffect(() => {
    if (visible && friendUserId) {
      setLoading(true);
      Promise.all([
        getFriendStreak(friendUserId),
        getLastActivityForUser(friendUserId),
        getFriendActivity(friendUserId),
      ]).then(([streakResult, activityResult, friendActivityResult]) => {
        setStreak(streakResult.streak);
        setStreakHidden(streakResult.hidden || false);
        setLastActivity(activityResult.lastActivity);
        setActivities(friendActivityResult.data || []);
      }).finally(() => setLoading(false));
    } else {
      setActivities([]);
      setLastActivity(null);
      setStreak(null);
    }
  }, [visible, friendUserId]);

  // 14-day calendar data
  const calendarDays = useMemo(() => {
    const days: { date: Date; dayLabel: string; dateNum: number; hasWorkout: boolean }[] = [];
    const activityDates = new Set(
      activities.map(a => new Date(a.created_at).toISOString().split('T')[0])
    );
    const now = new Date();
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();
      const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0
      days.push({
        date: d,
        dayLabel: DAY_LABELS[dayIdx],
        dateNum: d.getDate(),
        hasWorkout: activityDates.has(dateStr),
      });
    }
    return days;
  }, [activities]);

  // Volume chart data (6 months, grouped by week)
  const volumeData = useMemo(() => {
    const weekMap = new Map<string, number>();
    activities.forEach(a => {
      const ws = getWeekStart(new Date(a.created_at));
      weekMap.set(ws, (weekMap.get(ws) || 0) + (a.total_volume || 0));
    });

    // Generate last 24 weeks
    const weeks: { week: string; volume: number }[] = [];
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const ws = getWeekStart(d);
      if (!weeks.some(w => w.week === ws)) {
        weeks.push({ week: ws, volume: weekMap.get(ws) || 0 });
      }
    }
    return weeks;
  }, [activities]);

  // Top exercises
  const topExercises = useMemo(() => {
    const counts = new Map<string, number>();
    activities.forEach(a => {
      (a.exercise_names || []).forEach(name => {
        counts.set(name, (counts.get(name) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [activities]);

  const presence = friendUserId ? presenceMap.get(friendUserId) : undefined;
  const isOnline = !!presence;
  const isWorkingOut = presence?.working_out ?? false;

  const handleRemove = () => {
    if (!friendship) return;
    Alert.alert(
      'Remove Friend',
      `Remove ${friendEmail} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            const result = await removeFriend(friendship.id);
            setProcessing(false);
            if (result.success) {
              onFriendRemoved();
              onClose();
            }
          },
        },
      ]
    );
  };

  const handleBlock = () => {
    if (!friendUserId) return;
    Alert.alert(
      'Block User',
      `Block ${friendEmail}? They won't be able to find you or see your activity.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            const result = await blockUser(friendUserId);
            setProcessing(false);
            if (result.success) {
              onFriendRemoved();
              onClose();
            }
          },
        },
      ]
    );
  };

  if (!friendship || !friendProfile) return null;

  const initial = friendDisplayName[0]?.toUpperCase() || '?';

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, animatedStyle]}>
          {/* Handle bar */}
          <View style={styles.handleBar} {...panHandlers} />

          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => {
                Alert.alert(
                  friendDisplayName,
                  undefined,
                  [
                    { text: 'Remove Friend', style: 'destructive', onPress: handleRemove },
                    { text: 'Block User', style: 'destructive', onPress: handleBlock },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-horizontal" size={s(22)} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={[
                  styles.statusDot,
                  isWorkingOut ? styles.statusWorkout : isOnline ? styles.statusOnline : styles.statusOffline,
                ]} />
              </View>
              <Text style={styles.nameText}>{friendDisplayName}</Text>
              <Text style={[styles.lastActiveText, isWorkingOut && styles.workoutText]}>
                {isWorkingOut ? 'Working out' : isOnline ? 'Online' : (() => {
                  const lastSeenTime = friendUserId ? getLastSeen(friendUserId) : undefined;
                  const offlineTimeStr = lastSeenTime || lastActivity;
                  return offlineTimeStr ? `Active ${timeAgo(offlineTimeStr)}` : 'Offline';
                })()}
              </Text>

              <Text style={styles.friendsSinceText}>
                Friends since {new Date(friendship.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>

              {/* Streak badges */}
              {!streakHidden && streak !== null && streak > 0 && (
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={s(14)} color="#FF9500" />
                  <Text style={styles.streakBadgeText}>{streak} day streak</Text>
                </View>
              )}
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#38BDF8" style={{ marginVertical: s(40) }} />
            ) : (
              <>
                {/* 14-Day Calendar */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Last 10 Days</Text>
                  <View style={styles.calendarGrid}>
                    {calendarDays.map((day, i) => (
                      <View key={i} style={styles.calendarDay}>
                        <Text style={styles.calDayLabel}>{day.dayLabel}</Text>
                        <View style={[
                          styles.calDot,
                          day.hasWorkout && styles.calDotActive,
                        ]}>
                          <Text style={[
                            styles.calDateNum,
                            day.hasWorkout && styles.calDateNumActive,
                          ]}>
                            {day.dateNum}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Volume Chart */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Volume (6 months)</Text>
                  <FriendVolumeChart data={volumeData} />
                </View>

                {/* Top Exercises */}
                {topExercises.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Top Exercises</Text>
                    {topExercises.map((ex, i) => (
                      <View key={ex.name} style={styles.exerciseRow}>
                        <Text style={styles.exerciseRank}>#{i + 1}</Text>
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        <Text style={styles.exerciseCount}>{ex.count}x</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

          </ScrollView>
        </Animated.View>
      </View>

    </Modal>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    height: '90%',
  },
  handleBar: {
    width: s(36),
    height: s(4),
    backgroundColor: c.textMuted,
    borderRadius: s(2),
    alignSelf: 'center',
    marginTop: s(10),
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    paddingTop: s(8),
  },
  moreButton: {
    padding: s(4),
  },
  closeButton: {
    padding: s(4),
  },
  closeText: {
    fontSize: s(16),
    color: '#38BDF8',
    fontFamily: 'Inter_600SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: s(40),
  },
  headerSection: {
    alignItems: 'center',
    paddingBottom: s(20),
    paddingHorizontal: s(24),
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: s(12),
  },
  avatar: {
    width: s(72),
    height: s(72),
    borderRadius: s(36),
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: s(28),
    fontFamily: 'Inter_700Bold',
  },
  statusDot: {
    position: 'absolute',
    bottom: s(2),
    right: s(2),
    width: s(16),
    height: s(16),
    borderRadius: s(8),
    borderWidth: s(3),
    borderColor: c.card,
  },
  statusOnline: {
    backgroundColor: '#34C759',
  },
  statusWorkout: {
    backgroundColor: '#FF9500',
  },
  statusOffline: {
    backgroundColor: c.textMuted,
  },
  nameText: {
    fontSize: s(18),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  lastActiveText: {
    fontSize: s(13),
    color: c.textMuted,
    marginTop: s(4),
  },
  workoutText: {
    color: '#FF9500',
    fontFamily: 'Inter_600SemiBold',
  },
  friendsSinceText: {
    fontSize: s(12),
    color: c.textMuted,
    marginTop: s(4),
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,149,0,0.15)',
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    borderRadius: s(12),
    marginTop: s(10),
    gap: s(4),
  },
  streakBadgeText: {
    fontSize: s(13),
    color: '#FF9500',
    fontFamily: 'Inter_600SemiBold',
  },
  section: {
    paddingHorizontal: s(24),
    marginBottom: s(24),
  },
  sectionTitle: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
    marginBottom: s(12),
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
  },
  // 14-day calendar
  calendarGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarDay: {
    alignItems: 'center',
    gap: s(4),
  },
  calDayLabel: {
    fontSize: s(10),
    color: c.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  calDot: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calDotActive: {
    backgroundColor: '#34C759',
  },
  calDateNum: {
    fontSize: s(10),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
  },
  calDateNumActive: {
    color: '#fff',
  },
  // Top exercises
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(8),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
  },
  exerciseRank: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: '#38BDF8',
    width: s(28),
  },
  exerciseName: {
    flex: 1,
    fontSize: s(14),
    color: c.text,
  },
  exerciseCount: {
    fontSize: s(13),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
  },
});
