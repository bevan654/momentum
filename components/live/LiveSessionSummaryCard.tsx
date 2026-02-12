import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';
import type { LiveSessionSummary, ParticipantSummary } from '../../liveSessionManager';

interface LiveSessionSummaryCardProps {
  summary: LiveSessionSummary;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  return m > 0 ? `${m} min` : `${seconds}s`;
};

const formatVolume = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k kg`;
  return `${Math.round(v)} kg`;
};

const isGroupSession = (summary: LiveSessionSummary): boolean =>
  !!summary.participants && summary.participants.length >= 3;

// --- Group Leaderboard Sub-component ---

const GroupLeaderboard: React.FC<{
  participants: ParticipantSummary[];
  timeTogether: number;
  colors: Colors;
}> = ({ participants, timeTogether, colors }) => {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const leaderboardStyles = useMemo(() => makeLeaderboardStyles(colors), [colors]);

  // Sort descending by total volume
  const ranked = useMemo(
    () => [...participants].sort((a, b) => b.totalVolume - a.totalVolume),
    [participants],
  );

  // Shared exercises: count exercises that appear in every participant's list
  const sharedCount = useMemo(() => {
    if (ranked.length === 0) return 0;
    const lowered = ranked.map(p => new Set(p.exerciseNames.map(n => n.toLowerCase())));
    const first = lowered[0];
    let count = 0;
    first.forEach(name => {
      if (lowered.every(set => set.has(name))) count++;
    });
    return count;
  }, [ranked]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="people" size={s(16)} color={colors.accent} />
        <Text style={styles.headerText}>Group Workout</Text>
        <Text style={styles.duration}>{formatDuration(timeTogether)}</Text>
      </View>

      {/* Winner banner */}
      {ranked.length > 0 && (
        <View style={styles.winnerBanner}>
          <Ionicons name="trophy" size={s(14)} color={colors.accent} style={{ marginRight: s(4) }} />
          <Text style={styles.winnerText}>
            {ranked[0].username} leads with {formatVolume(ranked[0].totalVolume)}!
          </Text>
        </View>
      )}

      {/* Leaderboard rows */}
      <View style={leaderboardStyles.listContainer}>
        {ranked.map((participant, index) => {
          const rank = index + 1;
          const isWinner = rank === 1;

          return (
            <View
              key={participant.userId}
              style={[
                leaderboardStyles.row,
                isWinner && leaderboardStyles.rowWinner,
                index < ranked.length - 1 && leaderboardStyles.rowBorder,
              ]}
            >
              {/* Rank */}
              <View style={leaderboardStyles.rankBadge}>
                {isWinner ? (
                  <Ionicons name="trophy" size={s(14)} color={colors.accent} />
                ) : (
                  <Text style={[leaderboardStyles.rankText, isWinner && leaderboardStyles.rankTextWinner]}>
                    #{rank}
                  </Text>
                )}
              </View>

              {/* Name */}
              <Text
                style={[leaderboardStyles.username, isWinner && leaderboardStyles.usernameWinner]}
                numberOfLines={1}
              >
                {participant.username}
              </Text>

              {/* Stats */}
              <View style={leaderboardStyles.statsContainer}>
                <Text style={[leaderboardStyles.volumeText, isWinner && leaderboardStyles.volumeTextWinner]}>
                  {formatVolume(participant.totalVolume)}
                </Text>
                <Text style={leaderboardStyles.setsText}>
                  {participant.setsCompleted} set{participant.setsCompleted !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Shared exercises */}
      {sharedCount > 0 && (
        <View style={styles.sharedRow}>
          <Ionicons name="git-compare-outline" size={s(12)} color={colors.textMuted} />
          <Text style={styles.sharedText}>
            {sharedCount} exercise{sharedCount > 1 ? 's' : ''} in common across all {ranked.length} participants
          </Text>
        </View>
      )}
    </View>
  );
};

// --- Duo Comparison Sub-component (original layout) ---

const DuoComparison: React.FC<{
  summary: LiveSessionSummary;
  colors: Colors;
}> = ({ summary, colors }) => {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const rows = [
    { label: 'Volume', host: formatVolume(summary.host.totalVolume), buddy: formatVolume(summary.buddy.totalVolume), hostWins: summary.host.totalVolume > summary.buddy.totalVolume, buddyWins: summary.buddy.totalVolume > summary.host.totalVolume },
    { label: 'Sets', host: `${summary.host.setsCompleted}`, buddy: `${summary.buddy.setsCompleted}`, hostWins: summary.host.setsCompleted > summary.buddy.setsCompleted, buddyWins: summary.buddy.setsCompleted > summary.host.setsCompleted },
    { label: 'Exercises', host: `${summary.host.exerciseNames.length}`, buddy: `${summary.buddy.exerciseNames.length}`, hostWins: summary.host.exerciseNames.length > summary.buddy.exerciseNames.length, buddyWins: summary.buddy.exerciseNames.length > summary.host.exerciseNames.length },
  ];

  // Count wins
  const hostWins = rows.filter(r => r.hostWins).length;
  const buddyWins = rows.filter(r => r.buddyWins).length;

  // Shared exercises
  const hostExSet = new Set(summary.host.exerciseNames.map(n => n.toLowerCase()));
  const sharedCount = summary.buddy.exerciseNames.filter(n => hostExSet.has(n.toLowerCase())).length;

  const winnerLine =
    hostWins > buddyWins ? `${summary.host.username || 'You'} won ${hostWins}-${buddyWins}!` :
    buddyWins > hostWins ? `${summary.buddy.username || 'Buddy'} won ${buddyWins}-${hostWins}!` :
    `Tied ${hostWins}-${buddyWins}!`;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="people" size={s(16)} color={colors.accent} />
        <Text style={styles.headerText}>Worked Out Together</Text>
        <Text style={styles.duration}>{formatDuration(summary.timeTogether)}</Text>
      </View>

      {/* Winner banner */}
      <View style={styles.winnerBanner}>
        <Text style={styles.winnerText}>{winnerLine}</Text>
      </View>

      {/* Names */}
      <View style={styles.namesRow}>
        <Text style={[styles.nameLabel, styles.nameLeft]}>{summary.host.username || 'You'}</Text>
        <Text style={styles.vsLabel}>vs</Text>
        <Text style={[styles.nameLabel, styles.nameRight]}>{summary.buddy.username || 'Buddy'}</Text>
      </View>

      {/* Stat rows */}
      {rows.map(row => (
        <View key={row.label} style={styles.statRow}>
          <View style={styles.statValueRow}>
            {row.hostWins && <Ionicons name="trophy" size={s(12)} color={colors.accent} style={{ marginRight: s(4) }} />}
            <Text style={[styles.statValue, styles.statLeft, row.hostWins && styles.statWinner]}>{row.host}</Text>
          </View>
          <Text style={styles.statLabel}>{row.label}</Text>
          <View style={[styles.statValueRow, { justifyContent: 'flex-end' }]}>
            <Text style={[styles.statValue, styles.statRight, row.buddyWins && styles.statWinner]}>{row.buddy}</Text>
            {row.buddyWins && <Ionicons name="trophy" size={s(12)} color={colors.accent} style={{ marginLeft: s(4) }} />}
          </View>
        </View>
      ))}

      {/* Shared exercises */}
      {sharedCount > 0 && (
        <View style={styles.sharedRow}>
          <Ionicons name="git-compare-outline" size={s(12)} color={colors.textMuted} />
          <Text style={styles.sharedText}>{sharedCount} exercise{sharedCount > 1 ? 's' : ''} in common</Text>
        </View>
      )}
    </View>
  );
};

// --- Main exported component ---

export const LiveSessionSummaryCard: React.FC<LiveSessionSummaryCardProps> = ({ summary }) => {
  const { colors } = useTheme();

  if (isGroupSession(summary)) {
    return (
      <GroupLeaderboard
        participants={summary.participants!}
        timeTogether={summary.timeTogether}
        colors={colors}
      />
    );
  }

  return <DuoComparison summary={summary} colors={colors} />;
};

// --- Shared styles (card, header, winner banner, shared row) ---

const makeStyles = (c: Colors) => StyleSheet.create({
  card: {
    backgroundColor: c.accent + '10',
    borderRadius: s(14),
    padding: s(16),
    marginBottom: s(16),
    borderWidth: s(1),
    borderColor: c.accent + '25',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginBottom: s(10),
  },
  headerText: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    flex: 1,
  },
  duration: {
    fontSize: s(13),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  winnerBanner: {
    backgroundColor: c.accent + '15',
    borderRadius: s(8),
    paddingVertical: s(8),
    paddingHorizontal: s(12),
    alignItems: 'center',
    marginBottom: s(12),
    flexDirection: 'row',
    justifyContent: 'center',
  },
  winnerText: {
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
  },
  namesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(8),
    paddingBottom: s(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  nameLabel: {
    flex: 1,
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  nameLeft: {
    textAlign: 'left',
  },
  nameRight: {
    textAlign: 'right',
  },
  vsLabel: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    marginHorizontal: s(12),
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(7),
  },
  statValueRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  statLeft: {
    textAlign: 'left',
  },
  statRight: {
    textAlign: 'right',
    flex: 1,
  },
  statWinner: {
    color: c.accent,
  },
  statLabel: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    textAlign: 'center',
    width: s(72),
  },
  sharedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginTop: s(8),
    paddingTop: s(8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    justifyContent: 'center',
  },
  sharedText: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
});

// --- Leaderboard-specific styles ---

const makeLeaderboardStyles = (c: Colors) => StyleSheet.create({
  listContainer: {
    marginBottom: s(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(10),
    paddingHorizontal: s(8),
  },
  rowWinner: {
    backgroundColor: c.accent + '10',
    borderRadius: s(8),
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rankBadge: {
    width: s(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
  },
  rankTextWinner: {
    color: c.accent,
  },
  username: {
    flex: 1,
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    color: c.text,
    marginLeft: s(6),
  },
  usernameWinner: {
    fontFamily: 'Inter_700Bold',
    color: c.accent,
  },
  statsContainer: {
    alignItems: 'flex-end',
    marginLeft: s(8),
  },
  volumeText: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  volumeTextWinner: {
    color: c.accent,
  },
  setsText: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    marginTop: s(1),
  },
});
