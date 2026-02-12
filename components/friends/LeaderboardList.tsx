import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface LeaderboardListProps {
  entries: any[];
  currentUserId: string;
  valueLabel: string;
  accentColor: string;
  formatValue?: (value: number) => string;
}

const MEDAL_ICONS: { name: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { name: 'trophy', color: '#FFD700' },
  { name: 'trophy', color: '#C0C0C0' },
  { name: 'trophy', color: '#CD7F32' },
];

export const LeaderboardList: React.FC<LeaderboardListProps> = ({
  entries,
  currentUserId,
  valueLabel,
  accentColor,
  formatValue,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const displayValue = (value: number) => {
    if (formatValue) return formatValue(value);
    return value.toLocaleString();
  };

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const isMe = item.user_id === currentUserId;
        const displayName = item.profile?.username || item.profile?.email || 'Unknown';
        const initial = displayName[0]?.toUpperCase() || '?';
        const isTop3 = item.rank <= 3;

        return (
          <View style={[
            styles.row,
            isMe && styles.rowHighlight,
            isMe && { borderLeftColor: accentColor },
          ]}>
            <View style={styles.rankCell}>
              {isTop3 ? (
                <Ionicons
                  name={MEDAL_ICONS[item.rank - 1].name}
                  size={s(20)}
                  color={MEDAL_ICONS[item.rank - 1].color}
                />
              ) : (
                <Text style={styles.rank}>#{item.rank}</Text>
              )}
            </View>
            <View style={[styles.avatar, isMe && styles.avatarMe]}>
              <Text style={[styles.avatarText, isTop3 && { fontSize: s(15) }]}>{initial}</Text>
            </View>
            <View style={styles.info}>
              <Text style={[styles.email, isMe && styles.emailMe]}>
                {isMe ? 'You' : displayName}
              </Text>
            </View>
            <View style={styles.valueCell}>
              <Text style={[
                styles.value,
                isMe && { color: accentColor },
                isTop3 && styles.valueTop,
              ]}>
                {displayValue(Number(item.value))}
              </Text>
              <Text style={styles.valueLabel}>{valueLabel}</Text>
            </View>
          </View>
        );
      }}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No entries yet.</Text>
        </View>
      }
    />
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  list: {
    paddingBottom: s(32),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(12),
    paddingHorizontal: s(16),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
    borderLeftWidth: s(3),
    borderLeftColor: 'transparent',
  },
  rowHighlight: {
    backgroundColor: c.border,
  },
  rankCell: {
    width: s(36),
    alignItems: 'center',
  },
  rank: {
    fontSize: s(14),
    color: c.textMuted,
    fontFamily: 'Inter_600SemiBold',
  },
  avatar: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMe: {
    backgroundColor: '#34C759',
  },
  avatarText: {
    color: '#fff',
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
  },
  info: {
    flex: 1,
    marginLeft: s(10),
  },
  email: {
    fontSize: s(14),
    color: c.text,
    fontFamily: 'Inter_500Medium',
  },
  emailMe: {
    fontFamily: 'Inter_700Bold',
  },
  valueCell: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  valueTop: {
    fontSize: s(18),
    fontFamily: 'Inter_800ExtraBold',
  },
  valueLabel: {
    fontSize: s(10),
    color: c.textMuted,
    marginTop: s(1),
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
