import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, Text, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getActivityFeed, getFriendsActivityFeed, toggleReaction, ActivityEntry } from '../../friendsDatabase';
import { ActivityCard } from './ActivityCard';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

type FeedMode = 'friends' | 'global';

interface ActivityFeedProps {
  currentUserId: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ currentUserId }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [feedMode, setFeedMode] = useState<FeedMode>('friends');
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async (mode: FeedMode, pageNum: number) => {
    return mode === 'friends'
      ? getFriendsActivityFeed(pageNum)
      : getActivityFeed(pageNum);
  }, []);

  const loadFeed = useCallback(async (pageNum = 0, append = false, mode = feedMode) => {
    const result = await fetchFeed(mode, pageNum);
    if (result.success && result.data) {
      if (append) {
        setActivities(prev => [...prev, ...result.data!]);
      } else {
        setActivities(result.data);
      }
      setHasMore(result.data.length >= 20);
    }
  }, [feedMode, fetchFeed]);

  useEffect(() => {
    setLoading(true);
    setActivities([]);
    setPage(0);
    setHasMore(true);
    loadFeed(0, false, feedMode).finally(() => setLoading(false));
  }, [feedMode]);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    await loadFeed(0, false, feedMode);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await loadFeed(nextPage, true, feedMode);
    setLoadingMore(false);
  };

  const handleToggleReaction = async (activityId: string, type: 'like' | 'clap' | 'fire') => {
    const result = await toggleReaction(activityId, type);
    if (result.success) {
      setActivities(prev =>
        prev.map(a => {
          if (a.id !== activityId) return a;
          let reactions = [...(a.reactions || [])];
          if (result.action === 'removed') {
            reactions = reactions.filter(r => r.user_id !== currentUserId);
          } else if (result.action === 'updated' && result.data) {
            reactions = reactions.map(r => r.user_id === currentUserId ? result.data! : r);
          } else if (result.action === 'added' && result.data) {
            reactions.push(result.data);
          }
          return { ...a, reactions };
        })
      );
    }
  };

  const handleModeChange = (mode: FeedMode) => {
    if (mode === feedMode) return;
    setFeedMode(mode);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Segmented toggle */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, feedMode === 'friends' && styles.toggleButtonActive]}
            onPress={() => handleModeChange('friends')}
          >
            <Text style={[styles.toggleText, feedMode === 'friends' && styles.toggleTextActive]}>
              Friends
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, feedMode === 'global' && styles.toggleButtonActive]}
            onPress={() => handleModeChange('global')}
          >
            <Text style={[styles.toggleText, feedMode === 'global' && styles.toggleTextActive]}>
              Global
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityCard
            activity={item}
            currentUserId={currentUserId}
            onToggleReaction={handleToggleReaction}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: s(16) }} color={colors.accent} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No Activity Yet</Text>
            <Text style={styles.emptyText}>
              {feedMode === 'friends'
                ? 'Add friends and work out to see activity here.'
                : 'No one has shared a workout yet.'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  list: {
    padding: s(16),
    paddingBottom: s(32),
    backgroundColor: c.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.bg,
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
    color: c.textSecondary,
  },
  toggleRow: {
    paddingHorizontal: s(16),
    paddingTop: s(12),
    paddingBottom: s(4),
    backgroundColor: c.bg,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: s(4),
  },
  toggleButton: {
    paddingHorizontal: s(10),
    paddingVertical: s(7),
    borderRadius: s(8),
  },
  toggleButtonActive: {
    backgroundColor: '#38BDF8',
  },
  toggleText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  toggleTextActive: {
    color: c.bg,
  },
});
