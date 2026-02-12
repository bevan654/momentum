import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useDragDismiss } from '../../hooks/useDragDismiss';
import { getFriends } from '../../friendsDatabase';
import { getRoutines } from '../../routineDatabase';
import { subscribeToPresence, getOnlineUsers, PresenceState } from '../../presenceManager';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';
import type { BuddySyncMode } from '../../liveSessionManager';

interface LiveInviteModalProps {
  visible: boolean;
  onClose: () => void;
  onInvite: (friendIds: string[], routineData?: {
    routineName: string;
    exercises: { name: string; sets: number }[];
    syncMode: BuddySyncMode;
  }, groupOptions?: { generateInviteCode?: boolean }, friendNames?: Record<string, string>) => void;
  midSession?: boolean;
  inviteCode?: string;
  sessionParticipantIds?: string[];
  currentSessionId?: string;
}

type Step = 'friend' | 'routine' | 'detail';

export const LiveInviteModal: React.FC<LiveInviteModalProps> = ({ visible, onClose, onInvite, midSession, inviteCode, sessionParticipantIds, currentSessionId }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onClose);

  const [step, setStep] = useState<Step>('friend');
  const [friends, setFriends] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState<any>(null);
  const syncMode: BuddySyncMode = 'soft';
  const [presenceMap, setPresenceMap] = useState<Map<string, PresenceState>>(getOnlineUsers());
  const [codeCopied, setCodeCopied] = useState(false);
  const sendPulse = useRef(new Animated.Value(1)).current;

  const MAX_FRIENDS = 9; // host + 9 = 10 total

  useEffect(() => {
    return subscribeToPresence(setPresenceMap);
  }, []);

  useEffect(() => {
    if (visible) {
      setStep('friend');
      setLoading(true);
      setInviting(false);
      setSelectedFriendIds([]);
      setSelectedRoutine(null);
      setCodeCopied(false);
      // syncMode is always 'soft'
      getFriends().then(result => {
        if (result.success && result.data) setFriends(result.data);
        setLoading(false);
      });
    }
  }, [visible]);

  // Pulse animation for send button while inviting
  useEffect(() => {
    if (inviting) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(sendPulse, { toValue: 0.92, duration: 500, useNativeDriver: true }),
          Animated.timing(sendPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      sendPulse.setValue(1);
    }
  }, [inviting]);

  const loadRoutines = useCallback(async () => {
    const result = await getRoutines();
    if (result.success && result.routines) {
      setRoutines(result.routines);
    }
  }, []);

  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const aId = a.profile?.id;
      const bId = b.profile?.id;
      const aPresence = aId ? presenceMap.get(aId) : undefined;
      const bPresence = bId ? presenceMap.get(bId) : undefined;
      // Priority: in session (3) > working out (2) > online (1) > offline (0)
      const aPriority = aPresence?.live_session ? 3 : aPresence?.working_out ? 2 : aPresence ? 1 : 0;
      const bPriority = bPresence?.live_session ? 3 : bPresence?.working_out ? 2 : bPresence ? 1 : 0;
      return bPriority - aPriority;
    });
  }, [friends, presenceMap]);

  const buildFriendNames = useCallback((): Record<string, string> => {
    const names: Record<string, string> = {};
    for (const f of friends) {
      const id = f.profile?.id;
      if (id && selectedFriendIds.includes(id)) {
        names[id] = f.profile?.username || f.profile?.email || 'Unknown';
      }
    }
    return names;
  }, [friends, selectedFriendIds]);

  const handleToggleFriend = useCallback((friendId: string) => {
    setSelectedFriendIds(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      }
      if (prev.length >= MAX_FRIENDS) return prev;
      return [...prev, friendId];
    });
  }, []);

  const handleProceedToRoutine = useCallback(() => {
    if (selectedFriendIds.length === 0) return;
    setStep('routine');
    loadRoutines();
  }, [selectedFriendIds, loadRoutines]);

  const handleFreeWorkout = useCallback(() => {
    if (selectedFriendIds.length === 0) return;
    setInviting(true);
    onInvite(selectedFriendIds, undefined, { generateInviteCode: true }, buildFriendNames());
  }, [selectedFriendIds, onInvite, buildFriendNames]);

  const handleSelectRoutine = useCallback((routine: any) => {
    setSelectedRoutine(routine);
    setStep('detail');
  }, []);

  const handleSendInvite = useCallback(() => {
    if (selectedFriendIds.length === 0 || !selectedRoutine) return;
    setInviting(true);
    const exercises = selectedRoutine.routine_exercises.map((ex: any) => ({
      name: ex.name,
      sets: ex.default_sets,
    }));
    onInvite(selectedFriendIds, {
      routineName: selectedRoutine.name,
      exercises,
      syncMode: 'soft',
    }, { generateInviteCode: true }, buildFriendNames());
  }, [selectedFriendIds, selectedRoutine, onInvite, buildFriendNames]);

  const handleBack = useCallback(() => {
    if (step === 'detail') setStep('routine');
    else if (step === 'routine') setStep('friend');
  }, [step]);

  const renderFriend = ({ item, index: idx }: { item: any; index: number }) => {
    const friendId = item.profile?.id;
    const displayName = item.profile?.username || item.profile?.email || 'Unknown';
    const initial = displayName[0]?.toUpperCase() || '?';
    const presence = friendId ? presenceMap.get(friendId) : undefined;
    const isOnline = !!presence;
    const isWorkingOut = presence?.working_out ?? false;
    const isInSession = !!presence?.live_session;
    const isAlreadyInMySession = midSession && sessionParticipantIds?.includes(friendId);
    // If their presence shows them in OUR session but they're not in participantIds,
    // they were just kicked and presence is stale — treat them as available
    const isStalePresence = midSession && isInSession && presence?.live_session === currentSessionId && !isAlreadyInMySession;
    const isInDifferentSession = isInSession && !isAlreadyInMySession && !isStalePresence;
    const isSelected = selectedFriendIds.includes(friendId);
    const isUnavailable = isAlreadyInMySession || isInDifferentSession;
    const isDisabled = isUnavailable || (!isSelected && selectedFriendIds.length >= MAX_FRIENDS);

    const statusText = isAlreadyInMySession ? 'Already in session' : isInDifferentSession ? 'In a live session' : isWorkingOut ? 'Working out' : isOnline ? 'Online' : 'Offline';
    const statusColor = isAlreadyInMySession ? colors.textMuted : isInDifferentSession ? colors.success : isWorkingOut ? colors.warning : undefined;

    return (
      <>
        <TouchableOpacity
          style={[styles.friendRow, isSelected && styles.friendRowSelected, isDisabled && { opacity: 0.4 }]}
          onPress={() => handleToggleFriend(friendId)}
          disabled={isDisabled}
        >
          <View style={styles.avatarWrap}>
            <View style={[styles.avatar, isSelected && { borderColor: colors.accent, borderWidth: 2 }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={[
              styles.statusDot,
              isInSession ? styles.statusSession : isWorkingOut ? styles.statusWorkout : isOnline ? styles.statusOnline : styles.statusOffline,
            ]} />
          </View>
          <View style={styles.friendInfo}>
            <Text style={styles.friendName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.friendStatusRow}>
              {isAlreadyInMySession ? (
                <Ionicons name="checkmark-circle" size={s(10)} color={colors.textMuted} />
              ) : isInSession ? (
                <Ionicons name="people" size={s(10)} color={colors.success} />
              ) : null}
              <Text style={[styles.friendStatus, statusColor && { color: statusColor }]}>
                {statusText}
              </Text>
            </View>
          </View>
          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={s(14)} color="#fff" />}
          </View>
        </TouchableOpacity>
        {idx < sortedFriends.length - 1 && <View style={styles.friendDivider} />}
      </>
    );
  };

  const title = step === 'friend'
    ? (midSession ? 'Invite to Session' : 'Invite Workout Buddies')
    : step === 'routine' ? 'Choose Workout Type'
    : selectedRoutine?.name || 'Routine';

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.dragHandleContainer} {...panHandlers}>
            <View style={styles.dragHandle} />
          </View>
          <View style={styles.header}>
            {step !== 'friend' && (
              <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={s(20)} color={colors.accent} />
              </TouchableOpacity>
            )}
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Step 1: Pick friends (multi-select) */}
          {step === 'friend' && (
            <>
              {midSession && inviteCode && (
                <TouchableOpacity
                  style={styles.inviteCodeCard}
                  onPress={() => {
                    Clipboard.setStringAsync(inviteCode);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.inviteCodeLeft}>
                    <Text style={styles.inviteCodeLabel}>Session Code</Text>
                    <Text style={styles.inviteCodeValue}>{inviteCode}</Text>
                  </View>
                  <View style={styles.inviteCodeCopyBtn}>
                    <Ionicons name={codeCopied ? 'checkmark' : 'copy-outline'} size={s(16)} color={codeCopied ? colors.success : colors.accent} />
                    <Text style={[styles.inviteCodeCopyText, codeCopied && { color: colors.success }]}>{codeCopied ? 'Copied' : 'Copy'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              {loading ? (
                <ActivityIndicator style={styles.loader} color={colors.accent} />
              ) : sortedFriends.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No friends yet. Add friends to work out together!</Text>
                </View>
              ) : (
                <>
                  {selectedFriendIds.length > 0 && (
                    <View style={styles.selectionInfo}>
                      <Text style={styles.selectionText}>
                        {selectedFriendIds.length} selected
                      </Text>
                      <Text style={styles.selectionHint}>Others can still join with code</Text>
                    </View>
                  )}
                  <FlatList
                    data={sortedFriends}
                    keyExtractor={(item) => item.id}
                    renderItem={renderFriend}
                    contentContainerStyle={styles.list}
                  />
                  {selectedFriendIds.length > 0 && (
                    <View style={styles.nextBtnWrap}>
                      {midSession ? (
                        <TouchableOpacity
                          style={[styles.nextBtn, inviting && styles.sendBtnDisabled]}
                          onPress={() => {
                            setInviting(true);
                            onInvite(selectedFriendIds, undefined, undefined, buildFriendNames());
                          }}
                          disabled={inviting}
                          activeOpacity={0.8}
                        >
                          {inviting ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="send" size={s(16)} color="#fff" />
                              <Text style={styles.nextBtnText}>
                                Send Invite{selectedFriendIds.length > 1 ? `s (${selectedFriendIds.length})` : ''}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.nextBtn} onPress={handleProceedToRoutine} activeOpacity={0.8}>
                          <Text style={styles.nextBtnText}>Next</Text>
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{selectedFriendIds.length}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={s(16)} color="#fff" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          {/* Step 2: Pick free or routine */}
          {step === 'routine' && (
            <ScrollView contentContainerStyle={styles.list}>
              <View style={styles.groupInfoBadge}>
                <Ionicons name="people" size={s(14)} color={colors.accent} />
                <Text style={styles.groupInfoText}>Session for {selectedFriendIds.length + 1} — others can join with code</Text>
              </View>

              <TouchableOpacity style={styles.freeCard} onPress={handleFreeWorkout}>
                <View style={styles.freeIconWrap}>
                  <Ionicons name="flash" size={s(22)} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.freeTitle}>Free Workout</Text>
                  <Text style={styles.freeDesc}>No routine — do your own thing</Text>
                </View>
                {inviting && (
                  <ActivityIndicator size="small" color={colors.accent} />
                )}
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>My Routines</Text>

              {routines.length === 0 ? (
                <Text style={styles.emptyRoutineText}>No routines yet. Create one in the workout tab!</Text>
              ) : (
                routines.map((routine) => {
                  const exerciseNames = routine.routine_exercises
                    ?.slice(0, 3)
                    .map((ex: any) => ex.name)
                    .join(', ') || '';
                  const totalEx = routine.routine_exercises?.length || 0;
                  const preview = totalEx > 3 ? `${exerciseNames}...` : exerciseNames;

                  return (
                    <TouchableOpacity
                      key={routine.id}
                      style={styles.routineCard}
                      onPress={() => handleSelectRoutine(routine)}
                    >
                      <View style={styles.routineColorBar} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.routineName}>{routine.name}</Text>
                        <Text style={styles.routinePreview} numberOfLines={1}>{preview}</Text>
                        <Text style={styles.routineExCount}>{totalEx} exercises</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={s(18)} color={colors.textMuted} />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Step 3: Routine detail + sync mode */}
          {step === 'detail' && selectedRoutine && (
            <ScrollView contentContainerStyle={styles.list}>
              {selectedRoutine.routine_exercises?.map((ex: any, idx: number) => (
                <View key={ex.id || idx} style={styles.exerciseItem}>
                  <Text style={styles.exerciseIndex}>{idx + 1}.</Text>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseSets}>{ex.default_sets} sets</Text>
                </View>
              ))}

              <View style={[styles.groupInfoBadge, { marginTop: s(16) }]}>
                <Ionicons name="git-branch-outline" size={s(14)} color={colors.accent} />
                <Text style={styles.groupInfoText}>Independent pace — see each other's progress</Text>
              </View>

              <Animated.View style={{ transform: [{ scale: sendPulse }] }}>
                <TouchableOpacity
                  style={[styles.sendBtn, inviting && styles.sendBtnDisabled]}
                  onPress={handleSendInvite}
                  disabled={inviting}
                  activeOpacity={0.8}
                >
                  {inviting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={s(16)} color="#fff" />
                      <Text style={styles.sendBtnText}>
                        Send Invite{selectedFriendIds.length > 1 ? `s (${selectedFriendIds.length})` : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: c.card,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    maxHeight: '80%',
    paddingBottom: s(40),
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: s(10),
    paddingBottom: s(4),
  },
  dragHandle: {
    width: s(36),
    height: s(4),
    borderRadius: s(2),
    backgroundColor: c.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s(20),
    paddingTop: s(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  backBtn: {
    marginRight: s(8),
  },
  title: {
    fontSize: s(18),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    flex: 1,
  },
  closeText: {
    fontSize: s(16),
    color: c.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  list: {
    padding: s(16),
  },
  // Invite code card
  inviteCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: s(16),
    marginTop: s(12),
    padding: s(14),
    backgroundColor: c.accent + '08',
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: c.accent + '20',
  },
  inviteCodeLeft: {
    gap: s(2),
  },
  inviteCodeLabel: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inviteCodeValue: {
    fontSize: s(22),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
    letterSpacing: 3,
  },
  inviteCodeCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
    paddingHorizontal: s(12),
    paddingVertical: s(8),
    borderRadius: s(8),
    backgroundColor: c.accent + '12',
  },
  inviteCodeCopyText: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },
  // Selection info bar
  selectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(16),
    paddingVertical: s(8),
    backgroundColor: c.accent + '10',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  selectionText: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.accent,
  },
  selectionHint: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
  // Friend row
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(12),
    gap: s(12),
  },
  friendRowSelected: {
    backgroundColor: c.accent + '08',
  },
  friendDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginLeft: s(52),
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: s(42),
    height: s(42),
    borderRadius: s(21),
    backgroundColor: c.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: s(17),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
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
  statusOnline: { backgroundColor: '#34C759' },
  statusWorkout: { backgroundColor: '#FF9500' },
  statusSession: { backgroundColor: c.success },
  statusOffline: { backgroundColor: c.textMuted },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  friendStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: s(4),
    marginTop: s(2),
  },
  friendStatus: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
  // Checkbox
  checkbox: {
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  // Next button
  nextBtnWrap: {
    padding: s(16),
    paddingTop: s(8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    backgroundColor: c.accent,
    paddingVertical: s(14),
    borderRadius: s(12),
  },
  nextBtnText: {
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: s(8),
    paddingVertical: s(2),
    borderRadius: s(10),
  },
  countBadgeText: {
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  // Group info badge
  groupInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    backgroundColor: c.accent + '12',
    borderRadius: s(10),
    paddingVertical: s(10),
    paddingHorizontal: s(14),
    marginBottom: s(16),
  },
  groupInfoText: {
    fontSize: s(12),
    fontFamily: 'Inter_500Medium',
    color: c.accent,
  },
  loader: {
    padding: s(40),
  },
  empty: {
    padding: s(40),
    alignItems: 'center',
  },
  emptyText: {
    fontSize: s(14),
    color: c.textMuted,
    textAlign: 'center',
  },
  // Step 2: Routine selection
  freeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    backgroundColor: c.accent + '10',
    borderRadius: s(12),
    padding: s(16),
    marginBottom: s(20),
  },
  freeIconWrap: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    backgroundColor: c.accent + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeTitle: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  freeDesc: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    marginTop: s(2),
  },
  sectionLabel: {
    fontSize: s(12),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: s(10),
  },
  emptyRoutineText: {
    fontSize: s(13),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    textAlign: 'center',
    padding: s(16),
  },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: s(10),
    padding: s(14),
    marginBottom: s(8),
    gap: s(10),
  },
  routineColorBar: {
    width: s(4),
    height: s(36),
    borderRadius: s(2),
    backgroundColor: c.accent,
  },
  routineName: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  routinePreview: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
    marginTop: s(2),
  },
  routineExCount: {
    fontSize: s(10),
    fontFamily: 'Inter_500Medium',
    color: c.textMuted,
    marginTop: s(2),
  },
  // Step 3: Routine detail
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(8),
    gap: s(8),
  },
  exerciseIndex: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    width: s(20),
  },
  exerciseName: {
    fontSize: s(14),
    fontFamily: 'Inter_500Medium',
    color: c.text,
    flex: 1,
  },
  exerciseSets: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
  syncToggle: {
    flexDirection: 'row',
    gap: s(8),
    marginBottom: s(8),
  },
  syncOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(5),
    paddingVertical: s(12),
    borderRadius: s(10),
    borderWidth: 1.5,
    borderColor: c.border,
  },
  syncOptionActive: {
    borderColor: c.accent,
    backgroundColor: c.accent + '15',
  },
  syncOptionTitle: {
    fontSize: s(13),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
  },
  syncDesc: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: s(20),
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    backgroundColor: c.accent,
    paddingVertical: s(14),
    borderRadius: s(12),
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  sendBtnText: {
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
