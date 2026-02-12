import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDragDismiss } from '../../hooks/useDragDismiss';
import { joinByInviteCode, getCurrentSession } from '../../liveSessionManager';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface JoinByCodeModalProps {
  visible: boolean;
  onClose: () => void;
  onJoined: (sessionId: string) => void;
}

export const JoinByCodeModal: React.FC<JoinByCodeModalProps> = ({ visible, onClose, onJoined }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onClose);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCode('');
      setLoading(false);
      setError(null);
      // Auto-focus the input after a brief delay for the modal animation
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleChangeText = (text: string) => {
    // Only allow alphanumeric, force uppercase, max 6 characters
    const sanitized = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    setCode(sanitized);
    if (error) setError(null);
  };

  const handleJoin = async () => {
    if (code.length !== 6) {
      setError('Code must be 6 characters');
      triggerShake();
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setError(null);

    try {
      const result = await joinByInviteCode(code);

      if (result.success) {
        const session = getCurrentSession();
        const sessionId = session?.sessionId ?? '';
        onJoined(sessionId);
        onClose();
      } else {
        setError(result.error || 'Invalid code or session is full');
        triggerShake();
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const isCodeComplete = code.length === 6;

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.dragHandleContainer} {...panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Join by Code</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.iconContainer}>
              <Ionicons name="key-outline" size={s(32)} color={colors.accent} />
            </View>

            <Text style={styles.description}>
              Enter the 6-character invite code shared by your workout buddy.
            </Text>

            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <TextInput
                ref={inputRef}
                style={[styles.codeInput, error ? styles.codeInputError : isCodeComplete ? styles.codeInputValid : null]}
                value={code}
                onChangeText={handleChangeText}
                placeholder="ABC123"
                placeholderTextColor={colors.textMuted}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="off"
                keyboardType="default"
                editable={!loading}
                returnKeyType="go"
                onSubmitEditing={handleJoin}
              />
            </Animated.View>

            {error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={s(14)} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.joinBtn, (!isCodeComplete || loading) && styles.joinBtnDisabled]}
              onPress={handleJoin}
              disabled={!isCodeComplete || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="people" size={s(16)} color="#fff" />
                  <Text style={styles.joinBtnText}>Join Session</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hintText}>
              Codes are case-insensitive and expire when the session ends.
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
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
  body: {
    alignItems: 'center',
    padding: s(24),
  },
  iconContainer: {
    width: s(64),
    height: s(64),
    borderRadius: s(32),
    backgroundColor: c.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(16),
  },
  description: {
    fontSize: s(14),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: s(20),
    lineHeight: s(20),
  },
  codeInput: {
    width: s(220),
    fontSize: s(28),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    textAlign: 'center',
    letterSpacing: s(8),
    backgroundColor: c.bg,
    borderRadius: s(12),
    borderWidth: 2,
    borderColor: c.border,
    paddingVertical: s(14),
    paddingHorizontal: s(16),
  },
  codeInputError: {
    borderColor: c.error,
  },
  codeInputValid: {
    borderColor: c.accent,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginTop: s(10),
  },
  errorText: {
    fontSize: s(13),
    fontFamily: 'Inter_500Medium',
    color: c.error,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(8),
    backgroundColor: c.accent,
    paddingVertical: s(14),
    paddingHorizontal: s(48),
    borderRadius: s(12),
    marginTop: s(24),
    width: '100%',
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },
  joinBtnText: {
    fontSize: s(16),
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  hintText: {
    fontSize: s(12),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
    marginTop: s(14),
    textAlign: 'center',
  },
});
