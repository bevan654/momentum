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
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications, acceptFriendRequest, declineFriendRequest, inviteToExistingSession, createNotification, updateLiveSessionStatus, Notification } from '../../friendsDatabase';
import { createLiveSession, joinSessionChannel } from '../../liveSessionManager';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface NotificationListProps {
  onUnreadCountChange?: (count: number) => void;
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
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  friend_request: { icon: 'person-add', color: '#3B82F6' },
  friend_accepted: { icon: 'people', color: '#22C55E' },
  reaction: { icon: 'heart', color: '#EF4444' },
  nudge: { icon: 'flash', color: '#F59E0B' },
  leaderboard_weekly: { icon: 'trophy', color: '#F59E0B' },
  live_invite: { icon: 'fitness', color: '#8B5CF6' },
  live_accepted: { icon: 'checkmark-circle', color: '#22C55E' },
  join_request: { icon: 'fitness', color: '#FF9500' },
};

const DEFAULT_CONFIG = { icon: 'notifications', color: '#6B7280' };

export const NotificationList: React.FC<NotificationListProps> = ({ onUnreadCountChange }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const result = await getNotifications();
    if (result.success && result.data) {
      setNotifications(result.data);
      const unread = result.data.filter((n: any) => !n.read).length;
      onUnreadCountChange?.(unread);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    loadNotifications().finally(() => setLoading(false));
  }, [loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handlePress = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
      const unread = notifications.filter(n => !n.read && n.id !== notification.id).length;
      onUnreadCountChange?.(unread);
    }
  };

  const handleAccept = async (notification: Notification) => {
    const friendshipId = notification.data?.friendship_id;
    if (!friendshipId) return;
    setProcessingId(notification.id);
    const result = await acceptFriendRequest(friendshipId);
    if (result.success) {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }
    setProcessingId(null);
  };

  const handleDecline = async (notification: Notification) => {
    const friendshipId = notification.data?.friendship_id;
    if (!friendshipId) return;
    setProcessingId(notification.id);
    const result = await declineFriendRequest(friendshipId);
    if (result.success) {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }
    setProcessingId(null);
  };

  const handleAcceptJoin = async (notification: Notification) => {
    const senderId = notification.data?.sender_id;
    if (!senderId) return;
    setProcessingId(notification.id);
    try {
      let sessionId = notification.data?.session_id;
      if (sessionId) {
        await inviteToExistingSession(sessionId, [senderId]);
      } else {
        const newSessionId = await createLiveSession([senderId]);
        if (newSessionId) {
          sessionId = newSessionId;
          await updateLiveSessionStatus(newSessionId, 'active', {
            started_at: new Date().toISOString(),
          });
          await joinSessionChannel(newSessionId);
        }
      }
      // Notify the requester so they auto-join
      if (sessionId) {
        await createNotification(senderId, 'live_accepted', 'Join Request Accepted',
          'You\'ve been added to the workout!',
          { session_id: sessionId, accepted_join: true });
      }
      await markNotificationRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    } catch (e) {
      console.error('Error accepting join request:', e);
    }
    setProcessingId(null);
  };

  const handleDeclineJoin = async (notification: Notification) => {
    const senderId = notification.data?.sender_id;
    setProcessingId(notification.id);
    await markNotificationRead(notification.id);
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );
    if (senderId) {
      await createNotification(
        senderId,
        'join_request',
        'Join request declined',
        `Your request to join was declined.`,
        { declined: true }
      );
    }
    setProcessingId(null);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onUnreadCountChange?.(0);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Notifications',
      'Delete all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllNotifications();
            setNotifications([]);
            onUnreadCountChange?.(0);
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const hasUnread = notifications.some(n => !n.read);
  const hasNotifications = notifications.length > 0;

  return (
    <View style={styles.container}>
      {/* Action bar */}
      {hasNotifications && (
        <View style={styles.actionBar}>
          {hasUnread && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleMarkAllRead} activeOpacity={0.7}>
              <Ionicons name="checkmark-done" size={s(18)} color={colors.accent} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.actionBtn} onPress={handleClearAll} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={s(18)} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderItem={({ item }) => {
          const config = TYPE_CONFIG[item.type] || DEFAULT_CONFIG;
          return (
            <TouchableOpacity
              style={[styles.notifItem, !item.read && styles.notifUnread]}
              onPress={() => handlePress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: config.color + '18' }]}>
                <Ionicons name={config.icon as any} size={s(18)} color={config.color} />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifHeader}>
                  <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                </View>
                {item.body && (
                  <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
                )}
                {item.type === 'friend_request' && item.data?.friendship_id && (
                  <View style={styles.notifActions}>
                    <TouchableOpacity
                      style={styles.notifAcceptBtn}
                      onPress={() => handleAccept(item)}
                      disabled={processingId === item.id}
                    >
                      {processingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={s(14)} color="#fff" />
                          <Text style={styles.notifAcceptText}>Accept</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.notifDeclineBtn}
                      onPress={() => handleDecline(item)}
                      disabled={processingId === item.id}
                    >
                      <Ionicons name="close" size={s(14)} color={colors.textSecondary} />
                      <Text style={styles.notifDeclineText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {item.type === 'join_request' && !item.read && item.data?.sender_id && (
                  <View style={styles.notifActions}>
                    <TouchableOpacity
                      style={[styles.notifAcceptBtn, { backgroundColor: '#FF9500' }]}
                      onPress={() => handleAcceptJoin(item)}
                      disabled={processingId === item.id}
                    >
                      {processingId === item.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={s(14)} color="#fff" />
                          <Text style={styles.notifAcceptText}>Accept</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.notifDeclineBtn}
                      onPress={() => handleDeclineJoin(item)}
                      disabled={processingId === item.id}
                    >
                      <Ionicons name="close" size={s(14)} color={colors.textSecondary} />
                      <Text style={styles.notifDeclineText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={s(48)} color={colors.border} />
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Action bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(16),
    paddingVertical: s(8),
  },
  actionBtn: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // List
  list: {
    paddingHorizontal: s(16),
    paddingBottom: s(32),
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(16),
  },
  // Notification item
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: c.card,
    padding: s(14),
    borderRadius: s(14),
    marginBottom: s(8),
    gap: s(12),
  },
  notifUnread: {
    backgroundColor: c.accent + '0A',
    borderLeftWidth: s(3),
    borderLeftColor: c.accent,
  },
  iconWrap: {
    width: s(38),
    height: s(38),
    borderRadius: s(12),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(1),
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(8),
  },
  notifTitle: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    color: c.text,
    flex: 1,
  },
  notifTitleUnread: {
    fontFamily: 'Inter_700Bold',
  },
  notifBody: {
    fontSize: s(13),
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
    marginTop: s(3),
    lineHeight: s(18),
  },
  notifTime: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
  unreadDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: c.accent,
    marginTop: s(8),
  },
  // Friend request actions
  notifActions: {
    flexDirection: 'row',
    gap: s(8),
    marginTop: s(10),
  },
  notifAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: c.accent,
    paddingHorizontal: s(14),
    paddingVertical: s(7),
    borderRadius: s(10),
  },
  notifAcceptText: {
    color: '#fff',
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
  },
  notifDeclineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: c.bg,
    paddingHorizontal: s(14),
    paddingVertical: s(7),
    borderRadius: s(10),
  },
  notifDeclineText: {
    color: c.textSecondary,
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
  },
  // Empty state
  empty: {
    alignItems: 'center',
    gap: s(8),
  },
  emptyTitle: {
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    marginTop: s(8),
  },
  emptyText: {
    fontSize: s(13),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
});
