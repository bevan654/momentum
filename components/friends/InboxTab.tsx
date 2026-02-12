import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getPendingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  Notification,
} from '../../friendsDatabase';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface InboxTabProps {
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
  return `${days}d ago`;
}

const TYPE_ICONS: Record<string, string> = {
  friend_request: 'person-add',
  friend_accepted: 'people',
  reaction: 'heart',
  nudge: 'fitness',
  leaderboard_weekly: 'trophy',
};

export const InboxTab: React.FC<InboxTabProps> = ({ onUnreadCountChange }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [requestsExpanded, setRequestsExpanded] = useState(true);

  const loadData = useCallback(async () => {
    const [reqResult, notifResult] = await Promise.all([
      getPendingRequests(),
      getNotifications(),
    ]);
    if (reqResult.success && reqResult.data) {
      setIncoming(reqResult.data.incoming);
    }
    if (notifResult.success && notifResult.data) {
      setNotifications(notifResult.data);
      const unread = notifResult.data.filter((n: any) => !n.read).length;
      onUnreadCountChange?.(unread);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAccept = async (friendshipId: string) => {
    setProcessingId(friendshipId);
    const result = await acceptFriendRequest(friendshipId);
    if (result.success) {
      setIncoming(prev => prev.filter(r => r.id !== friendshipId));
    }
    setProcessingId(null);
  };

  const handleDecline = async (friendshipId: string) => {
    setProcessingId(friendshipId);
    const result = await declineFriendRequest(friendshipId);
    if (result.success) {
      setIncoming(prev => prev.filter(r => r.id !== friendshipId));
    }
    setProcessingId(null);
  };

  const handleNotifPress = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationRead(notification.id);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
      const unread = notifications.filter(n => !n.read && n.id !== notification.id).length;
      onUnreadCountChange?.(unread);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onUnreadCountChange?.(0);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  const hasUnread = notifications.some(n => !n.read);

  const renderHeader = () => (
    <View>
      {/* Pending Requests Section */}
      {incoming.length > 0 && (
        <View style={styles.requestsSection}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setRequestsExpanded(!requestsExpanded)}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="person-add" size={s(18)} color="#38BDF8" />
              <Text style={styles.sectionTitle}>Friend Requests</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{incoming.length}</Text>
              </View>
            </View>
            <Ionicons
              name={requestsExpanded ? 'chevron-up' : 'chevron-down'}
              size={s(18)}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {requestsExpanded && incoming.map(item => {
            const displayName = item.profile?.username || item.profile?.email || 'Unknown';
            const initial = displayName[0]?.toUpperCase() || '?';
            const isProcessing = processingId === item.id;

            return (
              <View key={item.id} style={styles.requestItem}>
                <View style={styles.requestAvatar}>
                  <Text style={styles.requestAvatarText}>{initial}</Text>
                </View>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestEmail}>{displayName}</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(item.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="checkmark" size={s(18)} color="#fff" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => handleDecline(item.id)}
                    disabled={isProcessing}
                  >
                    <Ionicons name="close" size={s(18)} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Notifications header */}
      <View style={styles.notifHeader}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        {hasUnread && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={renderHeader}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />
      }
      renderItem={({ item }) => {
        const iconName = TYPE_ICONS[item.type] || 'notifications';
        return (
          <TouchableOpacity
            style={[styles.notifItem, !item.read && styles.notifUnread]}
            onPress={() => handleNotifPress(item)}
          >
            <View style={styles.notifIcon}>
              <Ionicons name={iconName as any} size={s(18)} color={!item.read ? '#38BDF8' : colors.textMuted} />
            </View>
            <View style={styles.notifContent}>
              <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>
                {item.title}
              </Text>
              {item.body && (
                <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
              )}
              <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        );
      }}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        incoming.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="mail-open-outline" size={s(40)} color={colors.border} />
            <Text style={styles.emptyText}>All caught up!</Text>
          </View>
        ) : null
      }
    />
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: s(16),
    paddingBottom: s(32),
  },
  requestsSection: {
    marginBottom: s(8),
    marginTop: s(12),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: s(10),
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  sectionTitle: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  countBadge: {
    backgroundColor: '#38BDF8',
    borderRadius: s(10),
    minWidth: s(20),
    height: s(20),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(6),
  },
  countBadgeText: {
    color: c.bg,
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    padding: s(12),
    borderRadius: s(10),
    marginBottom: s(6),
    borderWidth: s(1),
    borderColor: c.border,
  },
  requestAvatar: {
    width: s(36),
    height: s(36),
    borderRadius: s(10),
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestAvatarText: {
    color: '#fff',
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
  },
  requestInfo: {
    flex: 1,
    marginLeft: s(10),
  },
  requestEmail: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    color: c.text,
  },
  requestActions: {
    flexDirection: 'row',
    gap: s(6),
  },
  acceptButton: {
    backgroundColor: '#34C759',
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: c.border,
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: s(16),
    paddingBottom: s(8),
  },
  markAllText: {
    fontSize: s(13),
    color: '#38BDF8',
    fontFamily: 'Inter_600SemiBold',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: c.card,
    padding: s(14),
    borderRadius: s(10),
    marginBottom: s(6),
    borderWidth: s(1),
    borderColor: c.border,
  },
  notifUnread: {
    backgroundColor: '#1E3A5F',
    borderColor: '#2563EB',
  },
  notifIcon: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: s(10),
    marginTop: s(2),
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    color: c.text,
  },
  notifTitleUnread: {
    fontFamily: 'Inter_700Bold',
  },
  notifBody: {
    fontSize: s(13),
    color: c.textSecondary,
    marginTop: s(2),
  },
  notifTime: {
    fontSize: s(11),
    color: c.textMuted,
    marginTop: s(4),
  },
  unreadDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: '#38BDF8',
    marginTop: s(6),
    marginLeft: s(8),
  },
  empty: {
    alignItems: 'center',
    paddingTop: s(40),
    gap: s(12),
  },
  emptyText: {
    fontSize: s(14),
    color: c.textMuted,
  },
});
