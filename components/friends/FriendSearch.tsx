import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { s } from '../../responsive';
import { searchUsersByEmail, sendFriendRequest } from '../../friendsDatabase';
import { useTheme, Colors } from '../../theme';

export const FriendSearch: React.FC = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (text: string) => {
    if (text.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    const result = await searchUsersByEmail(text);
    if (result.success && result.data) {
      setResults(result.data);
    }
    setLoading(false);
  }, []);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 400);
  };

  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    const result = await sendFriendRequest(userId);
    if (result.success) {
      setResults(prev =>
        prev.map(r =>
          r.id === userId
            ? { ...r, friendshipStatus: { status: 'pending' } }
            : r
        )
      );
    }
    setSendingTo(null);
  };

  const getStatusLabel = (user: any) => {
    if (!user.friendshipStatus) return null;
    const status = user.friendshipStatus.status;
    if (status === 'accepted') return 'Friends';
    if (status === 'pending') return 'Pending';
    if (status === 'blocked') return null;
    return null;
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search by email..."
        value={query}
        onChangeText={onChangeText}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={colors.textMuted}
      />

      {loading && <ActivityIndicator style={styles.loader} color="#38BDF8" />}

      <FlatList
        data={results.filter(r => !r.friendshipStatus || r.friendshipStatus.status !== 'blocked')}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const statusLabel = getStatusLabel(item);
          return (
            <View style={styles.resultItem}>
              <View style={styles.resultAvatar}>
                <Text style={styles.resultAvatarText}>
                  {(item.username || item.email)?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.resultInfo}>
                {item.username ? (
                  <>
                    <Text style={styles.resultEmail}>{item.username}</Text>
                    <Text style={{ fontSize: s(11), color: colors.textMuted, marginTop: s(2) }}>{item.maskedEmail}</Text>
                  </>
                ) : (
                  <Text style={styles.resultEmail}>{item.maskedEmail}</Text>
                )}
              </View>
              {statusLabel ? (
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleSendRequest(item.id)}
                  disabled={sendingTo === item.id}
                >
                  {sendingTo === item.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.addButtonText}>Add</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          query.length >= 3 && !loading ? (
            <Text style={styles.emptyText}>No users found.</Text>
          ) : query.length > 0 && query.length < 3 ? (
            <Text style={styles.emptyText}>Type at least 3 characters to search.</Text>
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    backgroundColor: c.border,
    borderRadius: s(12),
    padding: s(14),
    fontSize: s(16),
    color: c.text,
    marginHorizontal: s(16),
    marginTop: s(16),
    marginBottom: s(8),
    borderWidth: s(1),
    borderColor: c.textMuted,
  },
  loader: {
    marginVertical: s(12),
  },
  list: {
    paddingHorizontal: s(16),
    paddingBottom: s(32),
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    padding: s(14),
    borderRadius: s(10),
    marginBottom: s(8),
    borderWidth: s(1),
    borderColor: c.border,
  },
  resultAvatar: {
    width: s(40),
    height: s(40),
    borderRadius: s(10),
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAvatarText: {
    color: '#fff',
    fontSize: s(18),
    fontFamily: 'Inter_700Bold',
  },
  resultInfo: {
    flex: 1,
    marginLeft: s(12),
  },
  resultEmail: {
    fontSize: s(15),
    color: c.text,
    fontFamily: 'Inter_500Medium',
  },
  addButton: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: s(16),
    paddingVertical: s(8),
    borderRadius: s(8),
    minWidth: s(60),
    alignItems: 'center',
  },
  addButtonText: {
    color: c.bg,
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
  },
  statusBadge: {
    backgroundColor: c.border,
    paddingHorizontal: s(12),
    paddingVertical: s(6),
    borderRadius: s(8),
  },
  statusText: {
    fontSize: s(13),
    color: c.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  emptyText: {
    textAlign: 'center',
    color: c.textMuted,
    fontSize: s(14),
    marginTop: s(24),
  },
});
