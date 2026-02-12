import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../../responsive';
import { getFriends, getFriendStreak, getLastActivityForUser, Friendship, sendJoinRequest } from '../../friendsDatabase';
import { subscribeToPresence, getOnlineUsers, getLastSeen, PresenceState } from '../../presenceManager';
import { useTheme, Colors } from '../../theme';
import { NudgeModal } from './NudgeModal';

interface FriendListProps {
  onPressFriend: (friendship: Friendship) => void;
}

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

export const FriendList: React.FC<FriendListProps> = ({ onPressFriend }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceState>>(getOnlineUsers());
  const [nudgeTarget, setNudgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [joinSentId, setJoinSentId] = useState<string | null>(null);

  // Force a re-render every 60s so "Active X mins ago" stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return subscribeToPresence(setPresenceMap);
  }, []);

  const loadFriends = useCallback(async () => {
    const result = await getFriends();
    if (result.success && result.data) {
      // Fetch streaks and last activity for each friend
      const enriched = await Promise.all(
        result.data.map(async (f: any) => {
          const friendUserId = f.profile?.id;
          if (friendUserId) {
            const [streakResult, activityResult] = await Promise.all([
              getFriendStreak(friendUserId),
              getLastActivityForUser(friendUserId),
            ]);
            return {
              ...f,
              streak: streakResult.streak,
              streakHidden: streakResult.hidden,
              lastActivity: activityResult.lastActivity,
            };
          }
          return { ...f, streak: 0, streakHidden: false, lastActivity: null };
        })
      );
      setFriends(enriched);
    }
  }, []);

  useEffect(() => {
    loadFriends().finally(() => setLoading(false));
  }, [loadFriends]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFriends();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  return (
    <>
    <FlatList
      data={friends}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />
      }
      renderItem={({ item }) => {
        const displayName = item.profile?.username || item.profile?.email || 'Unknown';
        const initial = displayName[0]?.toUpperCase() || '?';
        const friendId = item.profile?.id;
        const presence = friendId ? presenceMap.get(friendId) : undefined;
        const isOnline = !!presence;
        const isWorkingOut = presence?.working_out ?? false;
        const isInLiveSession = !!presence?.live_session;
        // For offline friends, show when they were last seen (presence leave) or last activity (DB)
        const lastSeen = friendId ? getLastSeen(friendId) : undefined;
        const offlineTimeStr = lastSeen || item.lastActivity;

        return (
          <TouchableOpacity style={styles.friendItem} onPress={() => onPressFriend(item)}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={[
                styles.statusDot,
                isWorkingOut ? styles.statusWorkout : isOnline ? styles.statusOnline : styles.statusOffline,
              ]} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{displayName}</Text>
              {isInLiveSession ? (
                <Text style={styles.statusOrange}>In a Live Session</Text>
              ) : isWorkingOut ? (
                <Text style={styles.statusOrange}>Working out</Text>
              ) : isOnline ? (
                <Text style={styles.statusGreen}>Online</Text>
              ) : offlineTimeStr ? (
                <Text style={styles.statusMuted}>Active {timeAgo(offlineTimeStr)}</Text>
              ) : null}
            </View>
            {friendId && (
              <TouchableOpacity
                style={styles.messageButton}
                onPress={() => setNudgeTarget({ id: friendId, name: displayName })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chatbubble-outline" size={s(18)} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            {friendId && (
              <TouchableOpacity
                style={styles.joinButton}
                onPress={async () => {
                  if (!isWorkingOut) {
                    Alert.alert('Not Available', `${displayName} isn't working out right now.`);
                    return;
                  }
                  setJoinSentId(friendId);
                  await sendJoinRequest(friendId, presence?.live_session || undefined);
                }}
                disabled={joinSentId === friendId}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={joinSentId === friendId ? 'checkmark-circle' : 'enter-outline'}
                  size={s(18)}
                  color={joinSentId === friendId ? '#34C759' : isWorkingOut ? '#FF9500' : colors.border}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      }}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Friends Yet</Text>
          <Text style={styles.emptyText}>Search for friends by email to get started.</Text>
        </View>
      }
    />
    {nudgeTarget && (
      <NudgeModal
        visible={!!nudgeTarget}
        friendId={nudgeTarget.id}
        friendEmail={nudgeTarget.name}
        onClose={() => setNudgeTarget(null)}
      />
    )}
    </>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingBottom: s(32),
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(12),
    paddingHorizontal: s(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    borderWidth: s(2),
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
  info: {
    flex: 1,
    marginLeft: s(12),
  },
  name: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  statusOrange: {
    fontSize: s(11),
    color: '#FF9500',
    fontFamily: 'Inter_500Medium',
    marginTop: s(2),
  },
  statusGreen: {
    fontSize: s(11),
    color: '#34C759',
    fontFamily: 'Inter_400Regular',
    marginTop: s(2),
  },
  statusMuted: {
    fontSize: s(11),
    color: c.textMuted,
    fontFamily: 'Inter_400Regular',
    marginTop: s(2),
  },
  joinButton: {
    padding: s(6),
  },
  messageButton: {
    padding: s(6),
  },
  empty: {
    alignItems: 'center',
    paddingTop: s(60),
  },
  emptyTitle: {
    fontSize: s(18),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    marginBottom: s(8),
  },
  emptyText: {
    fontSize: s(14),
    color: c.textMuted,
  },
});
