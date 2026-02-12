import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface JoinRequestModalProps {
  visible: boolean;
  senderName: string;
  loading?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const JoinRequestModal: React.FC<JoinRequestModalProps> = ({
  visible,
  senderName,
  loading,
  onAccept,
  onDecline,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const initial = senderName[0]?.toUpperCase() || '?';

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 8, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible]);

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Accent stripe */}
          <View style={styles.stripe} />

          <View style={styles.body}>
            {/* Avatar with pulse */}
            <View style={styles.avatarWrap}>
              <Animated.View style={[styles.avatarPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.avatarBadge}>
                <Ionicons name="hand-right" size={s(10)} color="#fff" />
              </View>
            </View>

            <Text style={styles.title}>Join Request</Text>
            <Text style={styles.message}>
              <Text style={styles.senderName}>{senderName}</Text> wants to join your workout
            </Text>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={onDecline}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={s(16)} color={colors.textSecondary} />
                <Text style={styles.declineBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={onAccept}
                disabled={loading}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={s(16)} color="#fff" />
                    <Text style={styles.acceptBtnText}>Let them in</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s(28),
  },
  card: {
    width: '100%',
    backgroundColor: c.card,
    borderRadius: s(20),
    overflow: 'hidden',
  },
  stripe: {
    height: s(3),
    backgroundColor: c.warning,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: s(24),
    paddingTop: s(28),
    paddingBottom: s(24),
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: s(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPulse: {
    position: 'absolute',
    width: s(68),
    height: s(68),
    borderRadius: s(34),
    borderWidth: s(2),
    borderColor: c.warning,
    opacity: 0.3,
  },
  avatar: {
    width: s(56),
    height: s(56),
    borderRadius: s(28),
    backgroundColor: c.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: s(22),
    fontFamily: 'Inter_700Bold',
    color: c.warning,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -s(2),
    right: -s(2),
    width: s(22),
    height: s(22),
    borderRadius: s(11),
    backgroundColor: c.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: s(2),
    borderColor: c.card,
  },
  title: {
    fontSize: s(11),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: s(6),
  },
  message: {
    fontSize: s(16),
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: s(22),
    marginBottom: s(24),
  },
  senderName: {
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  buttons: {
    flexDirection: 'row',
    gap: s(10),
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(5),
    backgroundColor: c.border + '80',
    paddingVertical: s(13),
    borderRadius: s(12),
  },
  declineBtnText: {
    fontSize: s(14),
    fontFamily: 'Inter_600SemiBold',
    color: c.textSecondary,
  },
  acceptBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(5),
    backgroundColor: c.success,
    paddingVertical: s(13),
    borderRadius: s(12),
  },
  acceptBtnText: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
