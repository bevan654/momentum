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
import { getPendingRequests, acceptFriendRequest, declineFriendRequest, cancelFriendRequest } from '../../friendsDatabase';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

export const PendingRequests: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeSubTab, setActiveSubTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    const result = await getPendingRequests();
    if (result.success && result.data) {
      setIncoming(result.data.incoming);
      setOutgoing(result.data.outgoing);
    }
  }, []);

  useEffect(() => {
    loadRequests().finally(() => setLoading(false));
  }, [loadRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
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

  const handleCancel = async (friendshipId: string) => {
    setProcessingId(friendshipId);
    const result = await cancelFriendRequest(friendshipId);
    if (result.success) {
      setOutgoing(prev => prev.filter(r => r.id !== friendshipId));
    }
    setProcessingId(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  const data = activeSubTab === 'incoming' ? incoming : outgoing;

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeSubTab === 'incoming' && styles.tabActive]}
          onPress={() => setActiveSubTab('incoming')}
        >
          <Text style={[styles.tabText, activeSubTab === 'incoming' && styles.tabTextActive]}>
            Incoming {incoming.length > 0 ? `(${incoming.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeSubTab === 'outgoing' && styles.tabActive]}
          onPress={() => setActiveSubTab('outgoing')}
        >
          <Text style={[styles.tabText, activeSubTab === 'outgoing' && styles.tabTextActive]}>
            Outgoing {outgoing.length > 0 ? `(${outgoing.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />
        }
        renderItem={({ item }) => {
          const displayName = item.profile?.username || item.profile?.email || 'Unknown';
          const initial = displayName[0]?.toUpperCase() || '?';
          const isProcessing = processingId === item.id;

          return (
            <View style={styles.requestItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.email}>{displayName}</Text>
              </View>
              {activeSubTab === 'incoming' ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAccept(item.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.declineButton}
                    onPress={() => handleDecline(item.id)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancel(item.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FF3B30" />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {activeSubTab === 'incoming'
                ? 'No incoming friend requests.'
                : 'No outgoing friend requests.'}
            </Text>
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: s(16),
    paddingTop: s(12),
    gap: s(8),
  },
  tab: {
    flex: 1,
    paddingVertical: s(8),
    alignItems: 'center',
    borderRadius: s(8),
    backgroundColor: c.border,
  },
  tabActive: {
    backgroundColor: '#38BDF8',
  },
  tabText: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  tabTextActive: {
    color: c.bg,
  },
  list: {
    padding: s(16),
    paddingBottom: s(32),
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    padding: s(14),
    borderRadius: s(10),
    marginBottom: s(8),
    borderWidth: s(1),
    borderColor: c.border,
  },
  avatar: {
    width: s(40),
    height: s(40),
    borderRadius: s(10),
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
  },
  info: {
    flex: 1,
    marginLeft: s(12),
  },
  email: {
    fontSize: s(15),
    fontFamily: 'Inter_500Medium',
    color: c.text,
  },
  actions: {
    flexDirection: 'row',
    gap: s(8),
  },
  acceptButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: s(14),
    paddingVertical: s(8),
    borderRadius: s(8),
    minWidth: s(64),
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
  },
  declineButton: {
    backgroundColor: c.border,
    paddingHorizontal: s(14),
    paddingVertical: s(8),
    borderRadius: s(8),
  },
  declineButtonText: {
    color: c.textSecondary,
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
  },
  cancelButton: {
    borderWidth: s(1),
    borderColor: '#FF3B30',
    paddingHorizontal: s(14),
    paddingVertical: s(8),
    borderRadius: s(8),
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
  },
  empty: {
    alignItems: 'center',
    paddingTop: s(40),
  },
  emptyText: {
    fontSize: s(14),
    color: c.textMuted,
  },
});
