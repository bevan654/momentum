import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useDragDismiss } from '../../hooks/useDragDismiss';
import { sendNudge, canNudgeFriend, NUDGE_MESSAGES } from '../../friendsDatabase';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface NudgeModalProps {
  visible: boolean;
  friendId: string;
  friendEmail: string;
  onClose: () => void;
}

export const NudgeModal: React.FC<NudgeModalProps> = ({ visible, friendId, friendEmail, onClose }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { panHandlers, animatedStyle } = useDragDismiss(onClose);
  const [canSend, setCanSend] = useState(true);
  const [sending, setSending] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(true);

  useEffect(() => {
    if (visible) {
      setCheckingLimit(true);
      canNudgeFriend(friendId).then(result => {
        setCanSend(result.canNudge);
        setCheckingLimit(false);
      });
    }
  }, [visible, friendId]);

  const handleSend = async (message: string) => {
    setSending(true);
    const result = await sendNudge(friendId, message);
    setSending(false);

    if (result.success) {
      Alert.alert('Sent!', `Nudge sent to ${friendEmail}`);
      onClose();
    } else {
      Alert.alert('Error', 'Could not send nudge. Try again later.');
    }
  };

  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.dragHandleContainer} {...panHandlers}>
            <View style={styles.dragHandle} />
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>Nudge {friendEmail}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {checkingLimit ? (
            <ActivityIndicator style={styles.loader} color={colors.accent} />
          ) : !canSend ? (
            <View style={styles.limitMessage}>
              <Text style={styles.limitTitle}>Already Nudged</Text>
              <Text style={styles.limitText}>You can only nudge each friend once per 24 hours.</Text>
            </View>
          ) : (
            <FlatList
              data={NUDGE_MESSAGES}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.messageItem}
                  onPress={() => handleSend(item)}
                  disabled={sending}
                >
                  <Text style={styles.messageText}>{item}</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.list}
            />
          )}

          {sending && (
            <View style={styles.sendingOverlay}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
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
    maxHeight: '60%',
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: s(20),
    borderBottomWidth: s(1),
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
  list: {
    padding: s(16),
  },
  messageItem: {
    backgroundColor: c.bg,
    padding: s(16),
    borderRadius: s(10),
    marginBottom: s(8),
  },
  messageText: {
    fontSize: s(16),
    color: c.text,
  },
  loader: {
    padding: s(40),
  },
  limitMessage: {
    padding: s(40),
    alignItems: 'center',
  },
  limitTitle: {
    fontSize: s(18),
    fontFamily: 'Inter_600SemiBold',
    color: c.text,
    marginBottom: s(8),
  },
  limitText: {
    fontSize: s(14),
    color: c.textMuted,
    textAlign: 'center',
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
