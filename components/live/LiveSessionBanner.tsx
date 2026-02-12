import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Modal, Pressable, FlatList, LayoutAnimation, UIManager, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';
import type { LiveUserState, LiveReactionType, ConnectionStatus } from '../../liveSessionManager';
import type { BuddySyncState } from '../../buddyWorkoutSync';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Props ───

interface InvitedFriend {
  userId: string;
  name: string;
  status: 'pending' | 'joined' | 'declined';
}

interface LiveSessionBannerProps {
  participantStates: Map<string, LiveUserState>;
  connectionStatus: ConnectionStatus;
  onSendReaction: (type: LiveReactionType, targetUserId?: string) => void;
  buddySyncState?: BuddySyncState | null;
  participantFinished: Map<string, boolean>;
  participantWaiting: Map<string, boolean>;
  isLeader?: boolean;
  leaderId?: string;
  onKickParticipant?: (userId: string) => void;
  onTransferLeadership?: (userId: string) => void;
  invitedFriends?: InvitedFriend[];
}

interface MiniLiveSessionBannerProps {
  participantStates: Map<string, LiveUserState>;
  connectionStatus: ConnectionStatus;
  onSendReaction: (type: LiveReactionType, targetUserId?: string) => void;
  buddySyncState?: BuddySyncState | null;
  participantFinished: Map<string, boolean>;
  participantWaiting: Map<string, boolean>;
  onPress?: () => void;
}

// ─── Constants ───

const REACTIONS: { type: LiveReactionType; emoji: string }[] = [
  { type: 'fire', emoji: '\uD83D\uDD25' },
  { type: 'skull', emoji: '\uD83D\uDC80' },
  { type: 'eyes', emoji: '\uD83D\uDC40' },
  { type: 'hurry', emoji: '\u23F1\uFE0F' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = s(10);

// ─── Helpers ───

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const formatRestTime = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// ─── ParticipantCard (internal) ───

interface ParticipantCardProps {
  participantUserId: string;
  participantState: LiveUserState;
  isFinished: boolean;
  isWaitingForYou: boolean;
  connectionStatus: ConnectionStatus;
  buddySyncState?: BuddySyncState | null;
  onSendReaction: (type: LiveReactionType, targetUserId?: string) => void;
  cardStyle?: object;
  colors: Colors;
  compact?: boolean;
  isLeader?: boolean;
  isParticipantLeader?: boolean;
  onKickParticipant?: (userId: string) => void;
  onTransferLeadership?: (userId: string) => void;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participantUserId,
  participantState,
  isFinished,
  isWaitingForYou,
  connectionStatus,
  buddySyncState,
  onSendReaction,
  cardStyle,
  colors,
  compact,
  isLeader,
  isParticipantLeader,
  onKickParticipant,
  onTransferLeadership,
}) => {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cs = useMemo(() => makeCompactStyles(colors), [colors]);
  const dotPulse = useRef(new Animated.Value(0.4)).current;
  const waitingScale = useRef(new Animated.Value(1)).current;
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [nudgeOpen, setNudgeOpen] = useState(false);

  // Pulsing status dot
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // "Buddy is waiting" pulse
  const shouldPulse = buddySyncState?.buddyWaitingForMe ?? false;
  useEffect(() => {
    if (shouldPulse) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(waitingScale, { toValue: 0.95, duration: 400, useNativeDriver: true }),
          Animated.timing(waitingScale, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      waitingScale.setValue(1);
    }
  }, [shouldPulse]);

  const handleReaction = (type: LiveReactionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSendReaction(type, participantUserId);
    setNudgeOpen(false);
  };

  // Nudge button + modal (shared across compact/full)
  const nudgeButton = (small?: boolean) => (
    <TouchableOpacity
      style={small ? cs.nudgeBtn : styles.nudgeBtn}
      onPress={() => setNudgeOpen(true)}
      activeOpacity={0.7}
    >
      <Ionicons name="megaphone-outline" size={small ? s(14) : s(16)} color={colors.accent} />
      {!small && <Text style={styles.nudgeBtnText}>Nudge</Text>}
    </TouchableOpacity>
  );

  const nudgeModal = (
    <Modal visible={nudgeOpen} transparent animationType="fade" onRequestClose={() => setNudgeOpen(false)}>
      <Pressable style={styles.nudgeOverlay} onPress={() => setNudgeOpen(false)}>
        <View style={styles.nudgeSheet}>
          <Text style={styles.nudgeTitle}>Send a nudge</Text>
          <View style={styles.nudgeOptions}>
            {REACTIONS.map(r => (
              <TouchableOpacity
                key={r.type}
                style={styles.nudgeOption}
                onPress={() => handleReaction(r.type)}
                activeOpacity={0.7}
              >
                <Text style={styles.nudgeEmoji}>{r.emoji}</Text>
                <Text style={styles.nudgeLabel}>{r.type === 'fire' ? 'Fire' : r.type === 'skull' ? 'Dead' : r.type === 'eyes' ? 'Watching' : 'Hurry'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // Shared derived state
  const isResting = participantState.status === 'resting';
  const isLifting = participantState.status === 'lifting';
  const statusColor = isFinished
    ? (isWaitingForYou ? colors.success : colors.textMuted)
    : isLifting ? colors.accent : isResting ? colors.warning : colors.error;

  const total = participantState.totalSetsInExercise;
  const done = participantState.completedSetsInExercise ?? 0;
  const progressPct = total > 0 ? Math.min((done / total) * 100, 100) : 0;

  // ────────────────────────────────────────────
  // COMPACT CARD (for multi-participant layout)
  // ────────────────────────────────────────────
  if (compact) {
    const summary = participantState.exerciseSummary ?? [];
    const completedExercises = summary.filter(
      ex => ex.name !== participantState.currentExercise && ex.completedSets > 0,
    );
    const username = participantState.username || 'Participant';

    // Expandable exercise row
    const renderCompactExercise = (entry: typeof summary[0], idx: number) => {
      const isExpanded = expandedExercise === entry.name;
      const doneSets = (entry.sets ?? []).filter(st => st.completed);
      return (
        <TouchableOpacity
          key={idx}
          style={cs.exerciseRow}
          onPress={() => setExpandedExercise(isExpanded ? null : entry.name)}
          activeOpacity={0.6}
        >
          <View style={cs.exerciseRowHeader}>
            <Ionicons name="checkmark" size={s(10)} color={colors.success} style={{ marginRight: s(4) }} />
            <Text style={cs.exerciseRowName} numberOfLines={1}>{entry.name}</Text>
            <View style={cs.exerciseRowRight}>
              <Text style={cs.exerciseRowSets}>{entry.completedSets}/{entry.totalSets}</Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={s(10)}
                color={colors.textMuted}
              />
            </View>
          </View>
          {isExpanded && doneSets.length > 0 && (
            <View style={cs.expandedSets}>
              {doneSets.map((st, si) => (
                <View key={si} style={cs.expandedSetRow}>
                  <Text style={cs.expandedSetLabel}>Set {si + 1}</Text>
                  <Text style={cs.expandedSetValue}>
                    {st.kg}<Text style={cs.expandedSetUnit}>kg</Text>
                    {' \u00D7 '}
                    {st.reps}<Text style={cs.expandedSetUnit}>reps</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      );
    };

    if (isFinished) {
      const finishedExercises = summary.filter(ex => ex.completedSets > 0);
      const totalSets = summary.reduce((sum, ex) => sum + ex.completedSets, 0);

      return (
        <View style={[cs.card, cardStyle]}>
          {/* ─── Header ─── */}
          <View style={cs.header}>
            <View style={[cs.avatar, { borderColor: statusColor, backgroundColor: statusColor + '18' }]}>
              <Text style={[cs.avatarText, { color: statusColor }]}>{getInitials(username)}</Text>
            </View>
            <View style={cs.headerInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Text style={cs.name} numberOfLines={1}>{username}</Text>
                {isParticipantLeader && (
                  <Ionicons name="shield" size={s(12)} color={colors.warning} />
                )}
              </View>
              <Text style={cs.headerMeta}>{formatTime(participantState.workoutDuration)}</Text>
            </View>
          </View>

          {/* ─── Finished badge ─── */}
          <View style={[cs.statusBanner, isWaitingForYou ? { backgroundColor: colors.accent + '10', borderColor: colors.accent + '25' } : { backgroundColor: colors.textMuted + '10', borderColor: colors.textMuted + '20' }]}>
            <Ionicons
              name={isWaitingForYou ? 'hourglass-outline' : 'checkmark-circle'}
              size={s(14)}
              color={isWaitingForYou ? colors.accent : colors.success}
            />
            <Text style={[cs.statusBannerText, { color: isWaitingForYou ? colors.accent : colors.success }]}>
              {isWaitingForYou ? 'Waiting for you!' : 'Workout complete'}
            </Text>
          </View>

          {/* ─── Exercise list ─── */}
          {finishedExercises.length > 0 && (
            <View style={cs.exerciseList}>
              {finishedExercises.map((entry, idx) => renderCompactExercise(entry, idx))}
            </View>
          )}

          {/* ─── Stats ─── */}
          <View style={cs.statsBar}>
            <View style={cs.stat}>
              <Text style={cs.statValue}>{finishedExercises.length}</Text>
              <Text style={cs.statLabel}>exercises</Text>
            </View>
            <View style={cs.statDivider} />
            <View style={cs.stat}>
              <Text style={cs.statValue}>{totalSets}</Text>
              <Text style={cs.statLabel}>sets</Text>
            </View>
            <View style={cs.statDivider} />
            <View style={cs.stat}>
              <Text style={cs.statValue}>{formatTime(participantState.workoutDuration)}</Text>
              <Text style={cs.statLabel}>duration</Text>
            </View>
          </View>

          {/* ─── Actions ─── */}
          {(isWaitingForYou || (isLeader && !isParticipantLeader)) && (
            <View style={cs.bottomBar}>
              {isWaitingForYou ? nudgeButton(true) : <View />}
              {isLeader && !isParticipantLeader && (
                <View style={cs.leaderActions}>
                  <TouchableOpacity
                    onPress={() => onTransferLeadership?.(participantUserId)}
                    style={cs.leaderActionBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="swap-horizontal" size={s(13)} color={colors.warning} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onKickParticipant?.(participantUserId)}
                    style={[cs.leaderActionBtn, cs.leaderActionBtnDanger]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="person-remove-outline" size={s(12)} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          {nudgeModal}
        </View>
      );
    }

    // ─── Compact active state ───
    const statusLabel = isResting ? 'Resting' : isLifting ? 'Lifting' : 'Paused';
    const setProgressText = total > 0 ? `Set ${done}/${total}` : '';

    return (
      <View style={[cs.card, cardStyle]}>
        {/* ─── Header ─── */}
        <View style={cs.header}>
          <View style={[cs.avatar, { borderColor: statusColor, backgroundColor: statusColor + '18' }]}>
            <Animated.Text style={[cs.avatarText, { color: statusColor, opacity: dotPulse }]}>{getInitials(username)}</Animated.Text>
          </View>
          <View style={cs.headerInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
              <Text style={cs.name} numberOfLines={1}>{username}</Text>
              {isParticipantLeader && (
                <Ionicons name="shield" size={s(12)} color={colors.warning} />
              )}
            </View>
            <View style={cs.headerMetaRow}>
              <View style={[cs.statusPill, { backgroundColor: statusColor + '18' }]}>
                <View style={[cs.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[cs.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <Text style={cs.headerMeta}>{formatTime(participantState.workoutDuration)}</Text>
            </View>
          </View>
        </View>

        {/* ─── Completed exercises ─── */}
        {completedExercises.length > 0 && (
          <View style={cs.exerciseList}>
            {completedExercises.map((entry, idx) => renderCompactExercise(entry, idx))}
          </View>
        )}

        {/* ─── Current exercise ─── */}
        <View style={cs.currentSection}>
          <View style={cs.currentHeader}>
            <Ionicons name="barbell-outline" size={s(12)} color={colors.accent} />
            <Text style={cs.currentLabel}>NOW</Text>
          </View>
          <Text style={cs.exerciseName} numberOfLines={1}>
            {participantState.currentExercise || 'No exercise'}
          </Text>

          {/* Progress bar */}
          {total > 0 && (
            <View style={cs.progressTrack}>
              <View style={[cs.progressFill, { width: `${progressPct}%`, backgroundColor: colors.accent }]} />
            </View>
          )}

          {/* Set info + last set */}
          <View style={cs.infoRow}>
            {setProgressText ? (
              <Text style={cs.setInfo}>{setProgressText}</Text>
            ) : (
              <Text style={[cs.setInfo, { color: colors.textMuted }]}>{participantState.setsCompleted} sets</Text>
            )}
            {isResting && participantState.restTimeRemaining ? (
              <View style={cs.restPill}>
                <Ionicons name="timer-outline" size={s(10)} color={colors.warning} />
                <Text style={cs.restPillText}>{formatRestTime(participantState.restTimeRemaining)}</Text>
              </View>
            ) : participantState.lastSetWeight > 0 ? (
              <Text style={cs.lastSet}>{participantState.lastSetWeight}kg {'\u00D7'} {participantState.lastSetReps}</Text>
            ) : null}
          </View>
        </View>

        {/* ─── Bottom bar ─── */}
        <View style={cs.bottomBar}>
          <View style={cs.setsCount}>
            <Ionicons name="fitness-outline" size={s(11)} color={colors.accent} />
            <Text style={cs.setsCountText}>{participantState.setsCompleted}</Text>
          </View>
          <View style={cs.bottomBarRight}>
            {nudgeButton(true)}
            {isLeader && !isParticipantLeader && (
              <View style={cs.leaderActions}>
                <TouchableOpacity
                  onPress={() => onTransferLeadership?.(participantUserId)}
                  style={cs.leaderActionBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal" size={s(13)} color={colors.warning} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onKickParticipant?.(participantUserId)}
                  style={[cs.leaderActionBtn, cs.leaderActionBtnDanger]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-remove-outline" size={s(12)} color={colors.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        {nudgeModal}
      </View>
    );
  }

  // ────────────────────────────────────────────
  // FULL CARD (single participant — unchanged)
  // ────────────────────────────────────────────

  // ─── Finished state ───
  if (isFinished) {
    const finishedSummary = participantState.exerciseSummary ?? [];
    const totalSets = finishedSummary.reduce((sum, ex) => sum + ex.completedSets, 0);
    const totalExercises = finishedSummary.filter(ex => ex.completedSets > 0).length;

    return (
      <View style={[styles.card, cardStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <View>
              <Text style={styles.buddyName} numberOfLines={1}>
                {participantState.username || 'Participant'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.statusLabel, { color: statusColor }]}>Finished</Text>
            <Text style={styles.sessionTime}>
              Session: {formatTime(participantState.workoutDuration)}
            </Text>
          </View>
        </View>

        {/* Finished Badge */}
        <View style={[styles.finishedBadgeRow, !isWaitingForYou && { backgroundColor: colors.textMuted + '12', borderColor: colors.textMuted + '25' }]}>
          <Ionicons
            name={isWaitingForYou ? 'hourglass-outline' : 'checkmark-circle'}
            size={s(20)}
            color={isWaitingForYou ? colors.accent : colors.success}
          />
          <Text style={[styles.finishedBadgeText, { color: isWaitingForYou ? colors.accent : colors.success }]}>
            {isWaitingForYou ? 'Waiting for you to finish!' : 'Session Ended'}
          </Text>
        </View>

        {/* Exercise Summary */}
        {finishedSummary.filter(ex => ex.completedSets > 0).map((entry, idx) => {
          const isExpanded = expandedExercise === entry.name;
          const doneSets = (entry.sets ?? []).filter(st => st.completed);
          return (
            <TouchableOpacity
              key={idx}
              style={styles.finishedExercise}
              onPress={() => setExpandedExercise(isExpanded ? null : entry.name)}
              activeOpacity={0.6}
            >
              <View style={styles.finishedExRow}>
                <Text style={styles.finishedExName} numberOfLines={1}>
                  {idx + 1}. {entry.name}
                </Text>
                <View style={styles.completedRowRight}>
                  <Text style={styles.finishedExSets}>{entry.completedSets} sets</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={s(12)}
                    color={colors.textMuted}
                  />
                </View>
              </View>
              {isExpanded && doneSets.length > 0 && (
                <View style={styles.completedSets}>
                  {doneSets.map((st, si) => (
                    <View key={si} style={styles.completedSetRow}>
                      <Text style={styles.completedSetLabel}>Set {si + 1}</Text>
                      <View style={styles.completedSetValues}>
                        <Text style={styles.completedSetKg}>{st.kg}<Text style={styles.completedSetUnit}>kg</Text></Text>
                        <Text style={styles.completedSetX}>{'\u00D7'}</Text>
                        <Text style={styles.completedSetReps}>{st.reps}<Text style={styles.completedSetUnit}>reps</Text></Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Stats Row */}
        <View style={styles.divider} />
        <View style={styles.finishedStatsRow}>
          <View style={styles.finishedStat}>
            <Text style={styles.finishedStatValue}>{totalExercises}</Text>
            <Text style={styles.finishedStatLabel}>Exercises</Text>
          </View>
          <View style={styles.finishedStat}>
            <Text style={styles.finishedStatValue}>{totalSets}</Text>
            <Text style={styles.finishedStatLabel}>Sets</Text>
          </View>
          <View style={styles.finishedStat}>
            <Text style={styles.finishedStatValue}>{formatTime(participantState.workoutDuration)}</Text>
            <Text style={styles.finishedStatLabel}>Duration</Text>
          </View>
        </View>

        {/* Nudge */}
        {isWaitingForYou && nudgeButton()}
        {nudgeModal}
      </View>
    );
  }

  // ─── Connected with data ───
  const statusLabel = isResting ? 'Resting' : isLifting ? 'Lifting' : 'Paused';

  const isSynced = buddySyncState?.isActive ?? false;
  const syncModeLabel = isSynced
    ? buddySyncState!.syncMode === 'strict' ? 'STRICT SYNC' : 'SOFT SYNC'
    : null;

  const setProgressText = total > 0
    ? `Set ${done}/${total}`
    : done > 0
      ? `Set ${done}`
      : '';

  // Sync waiting
  const pName = participantState.username || 'Participant';
  const syncWaitingText =
    buddySyncState?.waitingForBuddy ? `Waiting for ${pName}...` :
    buddySyncState?.buddyWaitingForMe ? `${pName} is waiting!` :
    null;

  // Completed exercises from broadcast (excludes current exercise)
  const summary = participantState.exerciseSummary ?? [];
  const completedExercises = summary.filter(
    ex => ex.name !== participantState.currentExercise && ex.completedSets > 0,
  );

  return (
    <View style={[styles.card, cardStyle]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Animated.View style={[styles.dot, { backgroundColor: statusColor, opacity: dotPulse }]} />
          <View>
            <Text style={styles.buddyName} numberOfLines={1}>
              {participantState.username || 'Participant'}
            </Text>
            {syncModeLabel && (
              <Text style={styles.syncBadge}>{syncModeLabel}</Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
          {isResting && participantState.restTimeRemaining ? (
            <Text style={[styles.sessionTime, { color: colors.warning }]}>
              Rest: {formatRestTime(participantState.restTimeRemaining)}
            </Text>
          ) : (
            <Text style={styles.sessionTime}>
              Session: {formatTime(participantState.workoutDuration)}
            </Text>
          )}
        </View>
      </View>

      {/* ─── Completed Exercises ─── */}
      {completedExercises.map((entry, idx) => {
        const isExpanded = expandedExercise === entry.name;
        const allDone = entry.completedSets >= entry.totalSets;
        const doneSets = (entry.sets ?? []).filter(st => st.completed);
        return (
          <TouchableOpacity
            key={idx}
            style={styles.completedExercise}
            onPress={() => setExpandedExercise(isExpanded ? null : entry.name)}
            activeOpacity={0.6}
          >
            <View style={styles.completedLine} />
            <View style={{ flex: 1 }}>
              <View style={styles.completedRow}>
                <Text style={styles.completedName} numberOfLines={1}>
                  {idx + 1}. {entry.name}
                </Text>
                <View style={styles.completedRowRight}>
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>{allDone ? 'COMPLETED' : `${entry.completedSets}/${entry.totalSets}`}</Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={s(12)}
                    color={colors.textMuted}
                  />
                </View>
              </View>
              {isExpanded && doneSets.length > 0 && (
                <View style={styles.completedSets}>
                  {doneSets.map((st, si) => (
                    <View key={si} style={styles.completedSetRow}>
                      <Text style={styles.completedSetLabel}>Set {si + 1}</Text>
                      <View style={styles.completedSetValues}>
                        <Text style={styles.completedSetKg}>{st.kg}<Text style={styles.completedSetUnit}>kg</Text></Text>
                        <Text style={styles.completedSetX}>{'\u00D7'}</Text>
                        <Text style={styles.completedSetReps}>{st.reps}<Text style={styles.completedSetUnit}>reps</Text></Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* ─── Current Exercise ─── */}
      <View style={styles.exerciseSection}>
        <View style={styles.exerciseRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {isSynced ? `${buddySyncState!.buddyExerciseIndex + 1}. ` : ''}
              {participantState.currentExercise || 'No exercise'}
            </Text>
            {setProgressText ? (
              <Text style={[styles.setProgress, { color: colors.accent }]}>{setProgressText}</Text>
            ) : null}
          </View>
          <Ionicons name="person" size={s(28)} color={colors.accent} style={{ opacity: 0.4 }} />
        </View>

        {/* Progress Bar */}
        {participantState.totalSetsInExercise > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: colors.accent }]} />
          </View>
        )}

        {/* Last Set Info */}
        <View style={styles.setInfoRow}>
          {participantState.lastSetWeight > 0 ? (
            <Text style={styles.lastSetText}>
              Last set: <Text style={styles.lastSetHighlight}>
                {participantState.lastSetWeight}kg {'\u00D7'} {participantState.lastSetReps}
              </Text>
            </Text>
          ) : (
            <Text style={styles.lastSetText}>Starting...</Text>
          )}
        </View>
      </View>

      {/* ─── Divider ─── */}
      <View style={styles.divider} />

      {/* ─── Bottom: Actions ─── */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomRowLeft}>
          {nudgeButton()}
          {isLeader && !isParticipantLeader && (
            <>
              <TouchableOpacity
                onPress={() => onTransferLeadership?.(participantUserId)}
                style={styles.leaderActionBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-horizontal" size={s(14)} color={colors.warning} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onKickParticipant?.(participantUserId)}
                style={[styles.leaderActionBtn, styles.leaderActionBtnDanger]}
                activeOpacity={0.7}
              >
                <Ionicons name="person-remove-outline" size={s(13)} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.actionBtns}>
          <View style={styles.setsPill}>
            <Ionicons name="barbell-outline" size={s(11)} color={colors.accent} />
            <Text style={styles.setsPillText}>{participantState.setsCompleted}</Text>
          </View>
        </View>
      </View>
      {nudgeModal}

      {/* ─── Sync Waiting Pill ─── */}
      {syncWaitingText && (
        <View style={styles.waitingPillWrapper}>
          <Animated.View style={[
            styles.waitingPill,
            buddySyncState?.buddyWaitingForMe ? styles.waitingPillUrgent : styles.waitingPillWaiting,
            { transform: [{ scale: waitingScale }] },
          ]}>
            <Text style={[
              styles.waitingPillText,
              buddySyncState?.buddyWaitingForMe && styles.waitingPillTextUrgent,
            ]}>
              {syncWaitingText}
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

// ─── LiveSessionBanner ───

export const LiveSessionBanner: React.FC<LiveSessionBannerProps> = ({
  participantStates,
  connectionStatus,
  onSendReaction,
  buddySyncState,
  participantFinished,
  participantWaiting,
  isLeader,
  leaderId,
  onKickParticipant,
  onTransferLeadership,
  invitedFriends,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dotPulse = useRef(new Animated.Value(0.4)).current;
  const [multiExpanded, setMultiExpanded] = useState(false);

  // Staggered idle animations for collapsed avatars (up to 4 participants)
  const avatarAnims = useRef(
    Array.from({ length: 4 }, () => ({
      scale: new Animated.Value(1),
      translateY: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const loops = avatarAnims.map((anim, idx) => {
      const delay = idx * 400; // stagger each avatar
      const scaleLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim.scale, { toValue: 1.1, duration: 1400, useNativeDriver: true }),
          Animated.timing(anim.scale, { toValue: 1, duration: 1400, useNativeDriver: true }),
        ]),
      );
      const floatLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim.translateY, { toValue: -s(4), duration: 1600, useNativeDriver: true }),
          Animated.timing(anim.translateY, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ]),
      );
      scaleLoop.start();
      floatLoop.start();
      return { scaleLoop, floatLoop };
    });
    return () => loops.forEach(l => { l.scaleLoop.stop(); l.floatLoop.stop(); });
  }, []);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMultiExpanded(prev => !prev);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const participantEntries = useMemo(
    () => Array.from(participantStates.entries()),
    [participantStates],
  );
  const participantCount = participantEntries.length;

  const allFinished = useMemo(() => {
    if (participantFinished.size === 0) return false;
    for (const [, finished] of participantFinished) {
      if (!finished) return false;
    }
    return true;
  }, [participantFinished]);

  const anyWaitingForYou = useMemo(() => {
    for (const [, waiting] of participantWaiting) {
      if (waiting) return true;
    }
    return false;
  }, [participantWaiting]);

  // Pulsing dot for early states
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Card dimensions for multi-participant layout
  const cardWidth = (SCREEN_WIDTH - s(16) * 2 - CARD_GAP) / 2;

  // ─── Early return states (consider ALL participants) ───

  if (connectionStatus !== 'connected' && participantCount === 0) {
    const pendingInvites = invitedFriends?.filter(f => f.status !== 'joined') || [];
    return (
      <View style={styles.banner}>
        {pendingInvites.length > 0 ? (
          <View style={styles.inviteStatusList}>
            {pendingInvites.map(f => (
              <View key={f.userId} style={styles.inviteStatusRow}>
                <View style={[styles.inviteAvatar, f.status === 'declined' && { backgroundColor: colors.error + '20' }]}>
                  <Text style={[styles.inviteAvatarText, f.status === 'declined' && { color: colors.error }]}>{f.name[0]?.toUpperCase() || '?'}</Text>
                </View>
                <Text style={styles.inviteStatusName} numberOfLines={1}>{f.name}</Text>
                {f.status === 'pending' ? (
                  <View style={styles.inviteStatusBadge}>
                    <Animated.View style={[styles.inviteStatusDot, { backgroundColor: colors.accent, opacity: dotPulse }]} />
                    <Text style={[styles.inviteStatusText, { color: colors.textMuted }]}>Pending</Text>
                  </View>
                ) : (
                  <View style={[styles.inviteStatusBadge, { backgroundColor: colors.error + '12' }]}>
                    <Ionicons name="close-circle" size={s(10)} color={colors.error} />
                    <Text style={[styles.inviteStatusText, { color: colors.error }]}>Declined</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.earlyState}>
            <Animated.View style={[styles.dot, { backgroundColor: colors.accent, opacity: dotPulse }]} />
            <Text style={styles.earlyText}>Waiting for others to join...</Text>
          </View>
        )}
        {isLeader && (
          <View style={styles.leaderPill}>
            <Ionicons name="shield" size={s(10)} color={colors.warning} />
            <Text style={styles.leaderPillText}>Session Leader</Text>
          </View>
        )}
      </View>
    );
  }

  if (connectionStatus === 'reconnecting' && participantCount > 0 && !allFinished) {
    const firstName = participantEntries[0]?.[1]?.username || 'Participant';
    return (
      <View style={styles.banner}>
        <View style={styles.earlyState}>
          <View style={[styles.dot, { backgroundColor: colors.warning }]} />
          <Text style={[styles.earlyText, { color: colors.warning }]}>{participantCount > 1 ? 'Participants reconnecting...' : `${firstName} reconnecting...`}</Text>
        </View>
      </View>
    );
  }

  if (connectionStatus === 'disconnected' && participantCount > 0 && !allFinished) {
    const firstName = participantEntries[0]?.[1]?.username || 'Participant';
    return (
      <View style={styles.banner}>
        <View style={styles.earlyState}>
          <View style={[styles.dot, { backgroundColor: colors.error }]} />
          <Text style={[styles.earlyText, { color: colors.error }]}>{participantCount > 1 ? 'Participants disconnected' : `${firstName} disconnected`}</Text>
        </View>
      </View>
    );
  }

  if (participantCount === 0) {
    return (
      <View style={styles.banner}>
        <View style={styles.earlyState}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={styles.earlyText}>Connected {'\u2014'} loading workout...</Text>
        </View>
      </View>
    );
  }


  // ─── Participants: collapsible avatar row / expanded cards ───
  const snapInterval = cardWidth + CARD_GAP;

  if (!multiExpanded) {
    // ─── Collapsed state: floating avatar circles ───
    return (
      <View style={styles.multiContainer}>
        <TouchableOpacity
          style={styles.collapsedRow}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          {participantEntries.map(([uid, state], idx) => {
            const pFinished = participantFinished.get(uid) ?? false;
            const pWaiting = participantWaiting.get(uid) ?? false;
            const pLifting = state.status === 'lifting';
            const pResting = state.status === 'resting';
            const avatarColor = pFinished
              ? (pWaiting ? colors.success : colors.textMuted)
              : pLifting ? colors.accent : pResting ? colors.warning : colors.error;
            const anim = avatarAnims[idx] ?? avatarAnims[0];
            return (
              <Animated.View
                key={uid}
                style={[
                  styles.collapsedAvatar,
                  {
                    backgroundColor: avatarColor + '20',
                    borderColor: avatarColor,
                    shadowColor: avatarColor,
                    transform: [
                      { scale: anim.scale },
                      { translateY: anim.translateY },
                    ],
                  },
                ]}
              >
                <Text style={[styles.collapsedAvatarText, { color: avatarColor }]}>
                  {getInitials(state.username || 'P')}
                </Text>
                {uid === leaderId && (
                  <View style={{ position: 'absolute', top: -s(3), right: -s(3), backgroundColor: colors.warning, borderRadius: s(7), width: s(14), height: s(14), alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="shield" size={s(8)} color="#fff" />
                  </View>
                )}
              </Animated.View>
            );
          })}

          {participantCount > 5 && (
            <Text style={styles.collapsedParticipantCount}>
              {participantCount}
            </Text>
          )}

          {isLeader && (
            <View style={styles.collapsedLeaderBadge}>
              <Ionicons name="shield" size={s(10)} color={colors.warning} />
            </View>
          )}

          {anyWaitingForYou && (
            <Text style={styles.collapsedWaitingBadge}>WAITING!</Text>
          )}

          <Animated.View style={{ opacity: dotPulse }}>
            <Ionicons name="chevron-down" size={s(18)} color={colors.accent} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Expanded state: collapse header + FlatList of compact cards ───
  return (
    <View style={styles.multiContainer}>
      {/* Collapse header */}
      <TouchableOpacity
        style={styles.collapseHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.collapseHeaderLeft}>
          <Ionicons name={participantCount === 1 ? 'person' : 'people'} size={s(14)} color={colors.accent} />
          <Text style={styles.collapseHeaderText}>
            {participantCount === 1
              ? (participantEntries[0]?.[1]?.username || 'Participant')
              : `${participantCount} participants`}
          </Text>
          {isLeader && (
            <View style={styles.leaderPill}>
              <Ionicons name="shield" size={s(10)} color={colors.warning} />
              <Text style={styles.leaderPillText}>Leader</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-up" size={s(16)} color={colors.textMuted} />
      </TouchableOpacity>

      {participantCount === 1 ? (
        <View style={styles.banner}>
          <ParticipantCard
            participantUserId={participantEntries[0][0]}
            participantState={participantEntries[0][1]}
            isFinished={participantFinished.get(participantEntries[0][0]) ?? false}
            isWaitingForYou={participantWaiting.get(participantEntries[0][0]) ?? false}
            connectionStatus={connectionStatus}
            buddySyncState={buddySyncState}
            onSendReaction={onSendReaction}
            colors={colors}
            isLeader={isLeader}
            isParticipantLeader={participantEntries[0][0] === leaderId}
            onKickParticipant={onKickParticipant}
            onTransferLeadership={onTransferLeadership}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={participantEntries}
            keyExtractor={([userId]) => userId}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={snapInterval}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: s(16) }}
            ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
            renderItem={({ item: [userId, state] }) => (
              <ParticipantCard
                participantUserId={userId}
                participantState={state}
                isFinished={participantFinished.get(userId) ?? false}
                isWaitingForYou={participantWaiting.get(userId) ?? false}
                connectionStatus={connectionStatus}
                buddySyncState={buddySyncState}
                onSendReaction={onSendReaction}
                    cardStyle={{ width: cardWidth }}
                colors={colors}
                compact
                isLeader={isLeader}
                isParticipantLeader={userId === leaderId}
                onKickParticipant={onKickParticipant}
                onTransferLeadership={onTransferLeadership}
              />
            )}
          />
          {participantCount > 2 && (
            <View style={styles.pageIndicator}>
              {participantEntries.map(([userId], i) => (
                <View key={userId} style={[styles.pageDot, i < 2 && styles.pageDotActive]} />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
};

// ─── Mini Collapsed Banner ───

export const MiniLiveSessionBanner: React.FC<MiniLiveSessionBannerProps> = ({
  participantStates,
  connectionStatus,
  onSendReaction,
  buddySyncState,
  participantFinished,
  participantWaiting,
  onPress,
}) => {
  const { colors } = useTheme();
  const ms = useMemo(() => makeMiniStyles(colors), [colors]);
  const dotPulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const participantEntries = useMemo(
    () => Array.from(participantStates.entries()),
    [participantStates],
  );
  const participantCount = participantEntries.length;

  const allFinished = useMemo(() => {
    if (participantFinished.size === 0) return false;
    for (const [, finished] of participantFinished) {
      if (!finished) return false;
    }
    return true;
  }, [participantFinished]);

  const anyFinished = useMemo(() => {
    for (const [, finished] of participantFinished) {
      if (finished) return true;
    }
    return false;
  }, [participantFinished]);

  const anyWaitingForYou = useMemo(() => {
    for (const [, waiting] of participantWaiting) {
      if (waiting) return true;
    }
    return false;
  }, [participantWaiting]);

  if (participantCount === 0 || (connectionStatus === 'disconnected' && !allFinished && !anyFinished)) return null;

  // ─── Single participant: unchanged behaviour ───
  if (participantCount === 1) {
    const [userId, buddyState] = participantEntries[0];
    const buddyFinished = participantFinished.get(userId) ?? false;
    const buddyWaitingForYou = participantWaiting.get(userId) ?? false;

    // Mini finished state
    if (buddyFinished) {
      const pillColor = buddyWaitingForYou ? colors.accent : colors.textMuted;
      return (
        <TouchableOpacity style={[ms.container, { borderColor: buddyWaitingForYou ? colors.accent + '40' : colors.border }]} onPress={onPress} activeOpacity={0.7}>
          <View style={ms.topRow}>
            <View style={[ms.dot, { backgroundColor: buddyWaitingForYou ? colors.success : colors.textMuted }]} />
            <Text style={ms.name} numberOfLines={1}>{buddyState.username || 'Participant'}</Text>
            <View style={[ms.statusPill, { backgroundColor: pillColor + '20' }]}>
              <Text style={[ms.statusText, { color: pillColor }]}>{buddyWaitingForYou ? 'DONE' : 'ENDED'}</Text>
            </View>
            <Text style={ms.exercise} numberOfLines={1}>{buddyWaitingForYou ? 'Waiting for you' : 'Session Ended'}</Text>
            {buddyWaitingForYou && (
              <View style={ms.miniReactions}>
                {REACTIONS.slice(0, 2).map(r => (
                  <TouchableOpacity
                    key={r.type}
                    style={ms.miniReactionBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onSendReaction(r.type, userId);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={ms.miniReactionEmoji}>{r.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    const isResting = buddyState.status === 'resting';
    const isLifting = buddyState.status === 'lifting';
    const statusColor = isLifting ? colors.accent : isResting ? colors.warning : colors.error;
    const statusLabel = isResting ? 'REST' : isLifting ? 'LIFT' : 'PAUSE';

    const setProgressText = buddyState.totalSetsInExercise > 0
      ? `${buddyState.currentSetIndex}/${buddyState.totalSetsInExercise}`
      : '';

    const buddyWaiting = buddySyncState?.buddyWaitingForMe ?? false;

    const hasLastSet = buddyState.lastSetWeight > 0;

    return (
      <TouchableOpacity style={[ms.container, buddyWaiting && { borderColor: colors.accent }]} onPress={onPress} activeOpacity={0.7}>
        <View style={ms.topRow}>
          <Animated.View style={[ms.dot, { backgroundColor: statusColor, opacity: dotPulse }]} />
          <Text style={ms.name} numberOfLines={1}>{buddyState.username || 'Participant'}</Text>
          <View style={[ms.statusPill, { backgroundColor: statusColor + '20' }]}>
            <Text style={[ms.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={ms.exercise} numberOfLines={1}>{buddyState.currentExercise || '\u2014'}</Text>
          {setProgressText ? <Text style={ms.setInfo}>S{setProgressText}</Text> : null}
          {buddyWaiting && <Text style={ms.waitingBadge}>WAITING!</Text>}
          <View style={ms.miniReactions}>
            {REACTIONS.slice(0, 2).map(r => (
              <TouchableOpacity
                key={r.type}
                style={ms.miniReactionBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSendReaction(r.type, userId);
                }}
                activeOpacity={0.7}
              >
                <Text style={ms.miniReactionEmoji}>{r.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {hasLastSet && (
          <Text style={ms.lastSet}>
            Last: {buddyState.lastSetWeight}kg {'\u00D7'} {buddyState.lastSetReps}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // ─── Multiple participants: avatars row + first participant's exercise info ───
  const [firstUserId, firstState] = participantEntries[0];
  const firstFinished = participantFinished.get(firstUserId) ?? false;

  const firstIsResting = firstState.status === 'resting';
  const firstIsLifting = firstState.status === 'lifting';
  const firstStatusColor = firstFinished
    ? colors.textMuted
    : firstIsLifting ? colors.accent : firstIsResting ? colors.warning : colors.error;
  const firstStatusLabel = firstFinished
    ? 'DONE'
    : firstIsResting ? 'REST' : firstIsLifting ? 'LIFT' : 'PAUSE';

  return (
    <TouchableOpacity style={[ms.container, anyWaitingForYou && { borderColor: colors.accent }]} onPress={onPress} activeOpacity={0.7}>
      <View style={ms.topRow}>
        {/* Participant initials/avatars row */}
        <View style={ms.avatarsRow}>
          {participantEntries.map(([uid, state], idx) => {
            const pFinished = participantFinished.get(uid) ?? false;
            const pLifting = state.status === 'lifting';
            const pResting = state.status === 'resting';
            const avatarColor = pFinished
              ? colors.textMuted
              : pLifting ? colors.accent : pResting ? colors.warning : colors.error;
            return (
              <View
                key={uid}
                style={[
                  ms.avatarCircle,
                  { backgroundColor: avatarColor + '25', borderColor: avatarColor },
                  idx > 0 && { marginLeft: s(4) },
                ]}
              >
                <Text style={[ms.avatarText, { color: avatarColor }]}>
                  {getInitials(state.username || 'P')}
                </Text>
              </View>
            );
          })}
        </View>

        {/* First participant's info */}
        <View style={[ms.statusPill, { backgroundColor: firstStatusColor + '20' }]}>
          <Text style={[ms.statusText, { color: firstStatusColor }]}>{firstStatusLabel}</Text>
        </View>
        <Text style={ms.exercise} numberOfLines={1}>
          {firstFinished ? 'Finished' : (firstState.currentExercise || '\u2014')}
        </Text>

        {/* Participant count badge */}
        <View style={ms.countBadge}>
          <Ionicons name="people" size={s(10)} color={colors.textMuted} />
          <Text style={ms.countText}>{participantCount}</Text>
        </View>

        {anyWaitingForYou && <Text style={ms.waitingBadge}>WAITING!</Text>}

        <View style={ms.miniReactions}>
          {REACTIONS.slice(0, 2).map(r => (
            <TouchableOpacity
              key={r.type}
              style={ms.miniReactionBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSendReaction(r.type);
              }}
              activeOpacity={0.7}
            >
              <Text style={ms.miniReactionEmoji}>{r.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Mini Styles ───

const makeMiniStyles = (c: Colors) => StyleSheet.create({
  container: {
    backgroundColor: c.card,
    marginHorizontal: s(8),
    marginBottom: s(4),
    paddingHorizontal: s(12),
    paddingVertical: s(8),
    borderRadius: s(10),
    borderWidth: 1,
    borderColor: c.border,
    gap: s(3),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  dot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
  },
  name: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    textTransform: 'uppercase',
    maxWidth: s(70),
  },
  statusPill: {
    paddingHorizontal: s(5),
    paddingVertical: s(1),
    borderRadius: s(4),
  },
  statusText: {
    fontSize: s(9),
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  exercise: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textSecondary,
    flex: 1,
  },
  setInfo: {
    fontSize: s(10),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },
  waitingBadge: {
    fontSize: s(8),
    fontFamily: 'Inter_800ExtraBold',
    color: '#fff',
    backgroundColor: c.accent,
    paddingHorizontal: s(5),
    paddingVertical: s(2),
    borderRadius: s(4),
    overflow: 'hidden',
  },
  miniReactions: {
    flexDirection: 'row',
    gap: s(3),
  },
  miniReactionBtn: {
    width: s(26),
    height: s(26),
    borderRadius: s(13),
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniReactionEmoji: {
    fontSize: s(12),
  },
  lastSet: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    paddingLeft: s(14),
  },
  // ─── Multi-participant avatar styles ───
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: s(8),
    fontFamily: 'Inter_700Bold',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(2),
    paddingHorizontal: s(5),
    paddingVertical: s(1),
    borderRadius: s(4),
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
  },
  countText: {
    fontSize: s(9),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
  },
});

// ─── Compact Card Styles (multi-participant) ───

const makeCompactStyles = (c: Colors) => StyleSheet.create({
  // ─── Card Container ───
  card: {
    backgroundColor: c.card,
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: c.border,
    padding: s(14),
    gap: s(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  avatar: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: s(12),
    fontFamily: 'Inter_800ExtraBold',
  },
  headerInfo: {
    flex: 1,
    gap: s(2),
  },
  name: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  headerMeta: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(6),
  },
  statusDot: {
    width: s(5),
    height: s(5),
    borderRadius: s(3),
  },
  statusPillText: {
    fontSize: s(9),
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Status Banner (finished) ───
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    borderRadius: s(8),
    borderWidth: 1,
  },
  statusBannerText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
  },

  // ─── Exercise List ───
  exerciseList: {
    gap: s(4),
  },
  exerciseRow: {
    backgroundColor: c.bg,
    borderRadius: s(8),
    paddingVertical: s(7),
    paddingHorizontal: s(10),
  },
  exerciseRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseRowName: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    flex: 1,
  },
  exerciseRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    marginLeft: s(6),
  },
  exerciseRowSets: {
    fontSize: s(10),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
  },
  expandedSets: {
    marginTop: s(6),
    gap: s(4),
    paddingTop: s(6),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  expandedSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expandedSetLabel: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  expandedSetValue: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  expandedSetUnit: {
    fontSize: s(9),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },

  // ─── Current Exercise ───
  currentSection: {
    gap: s(6),
    backgroundColor: c.accent + '08',
    borderRadius: s(10),
    padding: s(10),
    borderWidth: 1,
    borderColor: c.accent + '12',
  },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  currentLabel: {
    fontSize: s(9),
    fontFamily: 'Inter_800ExtraBold',
    color: c.accent,
    letterSpacing: 1,
  },
  exerciseName: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  progressTrack: {
    height: s(4),
    backgroundColor: c.border,
    borderRadius: s(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: s(2),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setInfo: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },
  restPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(6),
    backgroundColor: c.warning + '15',
  },
  restPillText: {
    fontSize: s(10),
    fontFamily: 'Inter_700Bold',
    color: c.warning,
  },
  lastSet: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },

  // ─── Stats Bar (finished) ───
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: c.bg,
    borderRadius: s(10),
    paddingVertical: s(8),
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  statLabel: {
    fontSize: s(8),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: s(1),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: s(20),
    backgroundColor: c.border,
  },

  // ─── Bottom Bar ───
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: s(2),
  },
  bottomBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  setsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  setsCountText: {
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
  },

  // ─── Leader Actions ───
  leaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  leaderActionBtn: {
    width: s(30),
    height: s(30),
    borderRadius: s(10),
    backgroundColor: c.warning + '12',
    borderWidth: 1,
    borderColor: c.warning + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderActionBtnDanger: {
    backgroundColor: c.error + '10',
    borderColor: c.error + '20',
  },

  // ─── Nudge Button ───
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(4),
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    borderRadius: s(8),
    backgroundColor: c.accent + '10',
  },
});

// ─── Main Styles ───

const makeStyles = (c: Colors) => StyleSheet.create({
  // ─── Banner Container ───
  banner: {
    backgroundColor: c.card,
    borderRadius: s(16),
    borderWidth: 1,
    borderColor: c.border,
    marginHorizontal: s(16),
    marginBottom: s(8),
    padding: s(20),
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },

  // ─── Card (single participant rendered inside banner) ───
  card: {
    // No extra styling when single; cardStyle override supplies width for multi
  },

  // ─── Multi-participant container (no background box, just layout) ───
  multiContainer: {
    marginBottom: s(8),
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(4),
    marginTop: s(6),
  },
  pageDot: {
    width: s(5),
    height: s(5),
    borderRadius: s(3),
    backgroundColor: c.border,
  },
  pageDotActive: {
    backgroundColor: c.accent,
  },

  // ─── Collapsed Multi-Participant Row ───
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(12),
    paddingVertical: s(10),
    marginHorizontal: s(16),
  },
  collapsedAvatar: {
    width: s(42),
    height: s(42),
    borderRadius: s(21),
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  collapsedAvatarText: {
    fontSize: s(14),
    fontFamily: 'Inter_800ExtraBold',
  },
  collapsedParticipantCount: {
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  collapsedLeaderBadge: {
    backgroundColor: c.warning + '20',
    borderWidth: 1,
    borderColor: c.warning + '40',
    borderRadius: s(10),
    paddingHorizontal: s(6),
    paddingVertical: s(2),
  },
  collapsedWaitingBadge: {
    fontSize: s(8),
    fontFamily: 'Inter_800ExtraBold',
    color: '#fff',
    backgroundColor: c.accent,
    paddingHorizontal: s(5),
    paddingVertical: s(2),
    borderRadius: s(4),
    overflow: 'hidden',
  },

  // ─── Collapse Header (expanded state) ───
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: s(16),
    marginBottom: s(8),
    paddingHorizontal: s(4),
  },
  collapseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  collapseHeaderText: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },

  // ─── Early States ───
  earlyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    paddingVertical: s(8),
  },
  earlyText: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  inviteStatusList: {
    gap: s(8),
    width: '100%',
  },
  inviteStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  inviteAvatar: {
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    backgroundColor: c.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteAvatarText: {
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
  },
  inviteStatusName: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    flex: 1,
  },
  inviteStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(8),
    paddingVertical: s(3),
    borderRadius: s(8),
    backgroundColor: c.accent + '10',
  },
  inviteStatusDot: {
    width: s(6),
    height: s(6),
    borderRadius: s(3),
  },
  inviteStatusText: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
  },
  leaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: c.warning + '15',
    borderWidth: 1,
    borderColor: c.warning + '30',
    borderRadius: s(8),
    paddingHorizontal: s(8),
    paddingVertical: s(3),
  },
  leaderPillText: {
    fontSize: s(10),
    fontFamily: 'Inter_700Bold',
    color: c.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ─── Status Dot ───
  dot: {
    width: s(12),
    height: s(12),
    borderRadius: s(6),
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(16),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
    flex: 1,
  },
  buddyName: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  syncBadge: {
    fontSize: s(10),
    fontFamily: 'Inter_800ExtraBold',
    color: c.accent,
    letterSpacing: 1.2,
    marginTop: s(1),
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  statusLabel: {
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
  },
  sessionTime: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    textTransform: 'uppercase',
    marginTop: s(1),
  },

  // ─── Completed Exercises ───
  completedExercise: {
    opacity: 0.4,
    marginBottom: s(10),
    paddingLeft: s(14),
    flexDirection: 'row',
  },
  completedLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: s(2),
    backgroundColor: c.border,
    borderRadius: s(1),
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedName: {
    fontSize: s(13),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    textDecorationLine: 'line-through',
    flex: 1,
  },
  completedRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  completedSets: {
    marginTop: s(8),
    gap: s(4),
  },
  completedSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedSetLabel: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  completedSetValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  completedSetKg: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  completedSetX: {
    fontSize: s(10),
    color: c.textMuted,
  },
  completedSetReps: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  completedSetUnit: {
    fontSize: s(9),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },

  completedBadge: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: s(3),
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    marginLeft: s(8),
  },
  completedBadgeText: {
    fontSize: s(9),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    textTransform: 'uppercase',
  },

  // ─── Buddy Finished ───
  finishedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    marginBottom: s(16),
    paddingVertical: s(8),
    paddingHorizontal: s(12),
    backgroundColor: c.success + '12',
    borderRadius: s(10),
    borderWidth: 1,
    borderColor: c.success + '25',
  },
  finishedBadgeText: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.success,
  },
  finishedExercise: {
    marginBottom: s(8),
    paddingVertical: s(6),
    paddingHorizontal: s(10),
    backgroundColor: c.bg,
    borderRadius: s(8),
  },
  finishedExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  finishedExName: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    flex: 1,
  },
  finishedExSets: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
  },
  finishedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: s(16),
  },
  finishedStat: {
    alignItems: 'center',
  },
  finishedStatValue: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  finishedStatLabel: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: s(2),
  },

  // ─── Current Exercise ───
  exerciseSection: {
    marginBottom: s(20),
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  exerciseName: {
    fontSize: s(18),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    flexShrink: 1,
  },
  setProgress: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    marginTop: s(3),
  },

  // ─── Progress Bar ───
  progressTrack: {
    height: s(6),
    backgroundColor: c.border,
    borderRadius: s(3),
    overflow: 'hidden',
    marginTop: s(14),
  },
  progressFill: {
    height: '100%',
    borderRadius: s(3),
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },

  // ─── Set Info ───
  setInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: s(10),
  },
  lastSetText: {
    fontSize: s(13),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    fontStyle: 'italic',
  },
  lastSetHighlight: {
    color: c.text,
    fontStyle: 'normal',
  },

  // ─── Divider ───
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border + '80',
    marginBottom: s(16),
  },

  // ─── Bottom Row ───
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  leaderActionBtn: {
    width: s(36),
    height: s(36),
    borderRadius: s(12),
    backgroundColor: c.warning + '12',
    borderWidth: 1,
    borderColor: c.warning + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderActionBtnDanger: {
    backgroundColor: c.error + '10',
    borderColor: c.error + '20',
  },
  // ─── Nudge Button ───
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    paddingHorizontal: s(12),
    paddingVertical: s(8),
    borderRadius: s(10),
    backgroundColor: c.accent + '12',
    borderWidth: 1,
    borderColor: c.accent + '20',
  },
  nudgeBtnText: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },

  // ─── Nudge Modal ───
  nudgeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nudgeSheet: {
    backgroundColor: c.card,
    borderRadius: s(20),
    paddingVertical: s(24),
    paddingHorizontal: s(20),
    width: s(280),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  nudgeTitle: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    marginBottom: s(20),
  },
  nudgeOptions: {
    flexDirection: 'row',
    gap: s(10),
  },
  nudgeOption: {
    alignItems: 'center',
    gap: s(6),
    width: s(56),
    paddingVertical: s(10),
    borderRadius: s(12),
    backgroundColor: c.bg,
  },
  nudgeEmoji: {
    fontSize: s(26),
  },
  nudgeLabel: {
    fontSize: s(9),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ─── Action Buttons ───
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  setsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    backgroundColor: c.accent + '12',
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    borderRadius: s(10),
  },
  setsPillText: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
  },

  // ─── Waiting Pill ───
  waitingPillWrapper: {
    position: 'absolute',
    bottom: -s(2),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  waitingPill: {
    paddingHorizontal: s(24),
    paddingVertical: s(4),
    borderTopLeftRadius: s(10),
    borderTopRightRadius: s(10),
  },
  waitingPillWaiting: {
    backgroundColor: c.warning + '25',
  },
  waitingPillUrgent: {
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  waitingPillText: {
    fontSize: s(10),
    fontFamily: 'Inter_800ExtraBold',
    color: c.warning,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  waitingPillTextUrgent: {
    color: '#fff',
  },
});
