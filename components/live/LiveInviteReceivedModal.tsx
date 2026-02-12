import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDragDismiss } from '../../hooks/useDragDismiss';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';
import type { BuddySyncMode } from '../../liveSessionManager';

interface LiveInviteReceivedModalProps {
  visible: boolean;
  hostName: string;
  routineName?: string | null;
  routineExercises?: { name: string; sets: number }[] | null;
  syncMode?: BuddySyncMode | null;
  hasActiveWorkout?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const LiveInviteReceivedModal: React.FC<LiveInviteReceivedModalProps> = ({
  visible,
  hostName,
  routineName,
  routineExercises,
  syncMode,
  hasActiveWorkout,
  onAccept,
  onDecline,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onDecline);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const initial = hostName[0]?.toUpperCase() || '?';
  const hasRoutine = !!routineName && routineExercises && routineExercises.length > 0;

  // Pulsing ring around avatar
  useEffect(() => {
    if (visible) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [visible]);

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.dragHandleContainer} {...panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {/* Avatar with pulsing ring */}
            <View style={styles.avatarContainer}>
              <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
            </View>

            <Text style={styles.hostName}>{hostName}</Text>
            <Text style={styles.message}>
              {hasRoutine
                ? `wants to do ${routineName} together!`
                : 'wants to work out together!'}
            </Text>

            {hasRoutine && (
              <View style={styles.routineCard}>
                <Text style={styles.routineTitle}>{routineName}</Text>
                {routineExercises!.map((ex, idx) => (
                  <View key={idx} style={styles.exerciseItem}>
                    <Text style={styles.exerciseIndex}>{idx + 1}.</Text>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseSets}>{ex.sets} sets</Text>
                  </View>
                ))}
                {syncMode && (
                  <View style={styles.syncBadge}>
                    <Ionicons
                      name={syncMode === 'strict' ? 'link' : 'git-branch-outline'}
                      size={s(12)}
                      color={colors.accent}
                    />
                    <Text style={styles.syncBadgeText}>
                      {syncMode === 'strict' ? 'Strict Sync — wait for both' : 'Soft Sync — independent pace'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {hasActiveWorkout && (
              <View style={styles.activeWorkoutBanner}>
                <Ionicons name="barbell-outline" size={s(14)} color={colors.accent} />
                <Text style={styles.activeWorkoutText}>Your current workout will continue in the live session</Text>
              </View>
            )}

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
                <Ionicons name="people" size={s(16)} color="#fff" />
                <Text style={styles.acceptBtnText}>Join</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hintText}>{hasActiveWorkout ? 'Your workout stays — just adds live tracking' : 'Tap Join to start!'}</Text>
          </ScrollView>
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
    paddingBottom: s(40),
    maxHeight: '75%',
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
  body: {
    alignItems: 'center',
    padding: s(24),
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: s(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    position: 'absolute',
    width: s(76),
    height: s(76),
    borderRadius: s(38),
    borderWidth: s(2.5),
    borderColor: c.success,
    opacity: 0.4,
  },
  avatar: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    backgroundColor: c.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: s(24),
    fontFamily: 'Inter_700Bold',
    color: c.accent,
  },
  hostName: {
    fontSize: s(20),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    marginBottom: s(4),
  },
  message: {
    fontSize: s(15),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    marginBottom: s(16),
    textAlign: 'center',
  },
  routineCard: {
    width: '100%',
    backgroundColor: c.bg,
    borderRadius: s(12),
    padding: s(16),
    marginBottom: s(20),
  },
  routineTitle: {
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    marginBottom: s(10),
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(4),
    gap: s(6),
  },
  exerciseIndex: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    width: s(18),
  },
  exerciseName: {
    fontSize: s(13),
    fontFamily: 'Inter_500Medium',
    color: c.text,
    flex: 1,
  },
  exerciseSets: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginTop: s(10),
    paddingTop: s(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  syncBadgeText: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.accent,
  },
  activeWorkoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    width: '100%',
    backgroundColor: c.accent + '10',
    borderRadius: s(10),
    paddingVertical: s(10),
    paddingHorizontal: s(14),
    marginBottom: s(16),
    borderWidth: 1,
    borderColor: c.accent + '20',
  },
  activeWorkoutText: {
    fontSize: s(12),
    fontFamily: 'Inter_500Medium',
    color: c.accent,
    flex: 1,
  },
  buttons: {
    flexDirection: 'row',
    gap: s(12),
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: c.border,
    paddingVertical: s(14),
    borderRadius: s(12),
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: c.success,
    paddingVertical: s(14),
    borderRadius: s(12),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(6),
  },
  acceptBtnText: {
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  hintText: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    marginTop: s(12),
  },
});
