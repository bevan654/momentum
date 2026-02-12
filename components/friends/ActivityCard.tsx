import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityEntry } from '../../friendsDatabase';
import { ReactionBar } from './ReactionBar';
import { useTheme, Colors } from '../../theme';
import { useDragDismiss } from '../../hooks/useDragDismiss';
import { s } from '../../responsive';

interface ActivityCardProps {
  activity: ActivityEntry;
  currentUserId: string;
  onToggleReaction: (activityId: string, type: 'like' | 'clap' | 'fire') => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m`;
  }
  return `${mins}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ activity, currentUserId, onToggleReaction }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [modalVisible, setModalVisible] = useState(false);
  const { panHandlers, animatedStyle } = useDragDismiss(() => setModalVisible(false));
  const username = activity.profile?.username;
  const email = activity.profile?.email || 'Unknown';
  const nameOrEmail = username || email;
  const initial = nameOrEmail[0]?.toUpperCase() || '?';
  const isMe = activity.user_id === currentUserId;
  const displayName = isMe ? 'You' : username || email.split('@')[0];
  const totalSets = activity.total_sets || 0;

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => setModalVisible(true)}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, isMe && styles.avatarMe]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.time}>{timeAgo(activity.created_at)} · {formatDate(activity.created_at)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={s(16)} color={colors.textMuted} />
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={s(14)} color="#38BDF8" />
            <Text style={styles.statText}>{formatDuration(activity.duration)}</Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.statItem}>
            <Ionicons name="barbell-outline" size={s(14)} color="#FF9500" />
            <Text style={styles.statText}>{Math.round(activity.total_volume).toLocaleString()} kg</Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.statItem}>
            <Ionicons name="list-outline" size={s(14)} color="#34C759" />
            <Text style={styles.statText}>{activity.total_exercises} exercises</Text>
          </View>
        </View>

        {/* Exercise tags */}
        {activity.exercise_names && activity.exercise_names.length > 0 && (
          <View style={styles.tagRow}>
            {activity.exercise_names.slice(0, 4).map((name, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{name}</Text>
              </View>
            ))}
            {activity.exercise_names.length > 4 && (
              <View style={[styles.tag, styles.tagMore]}>
                <Text style={[styles.tagText, styles.tagMoreText]}>+{activity.exercise_names.length - 4}</Text>
              </View>
            )}
          </View>
        )}

        {/* Reactions */}
        <ReactionBar
          reactions={activity.reactions || []}
          currentUserId={currentUserId}
          onToggle={(type) => onToggleReaction(activity.id, type)}
        />
      </TouchableOpacity>

      {/* Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, animatedStyle]}>
            <View style={styles.modalHandleContainer} {...panHandlers}>
              <View style={styles.modalHandle} />
            </View>

            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalAvatar, isMe && styles.avatarMe]}>
                  <Text style={styles.modalAvatarText}>{initial}</Text>
                </View>
                <View>
                  <Text style={styles.modalName}>{displayName}</Text>
                  <Text style={styles.modalDate}>{formatDate(activity.created_at)}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={s(20)} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Stats Grid */}
            <View style={styles.modalStatsGrid}>
              <View style={styles.modalStat}>
                <Ionicons name="time-outline" size={s(20)} color="#38BDF8" />
                <Text style={styles.modalStatValue}>{formatDuration(activity.duration)}</Text>
                <Text style={styles.modalStatLabel}>Duration</Text>
              </View>
              <View style={styles.modalStat}>
                <Ionicons name="barbell-outline" size={s(20)} color="#FF9500" />
                <Text style={styles.modalStatValue}>{Math.round(activity.total_volume).toLocaleString()}</Text>
                <Text style={styles.modalStatLabel}>Volume (kg)</Text>
              </View>
              <View style={styles.modalStat}>
                <Ionicons name="list-outline" size={s(20)} color="#34C759" />
                <Text style={styles.modalStatValue}>{activity.total_exercises}</Text>
                <Text style={styles.modalStatLabel}>Exercises</Text>
              </View>
              <View style={styles.modalStat}>
                <Ionicons name="layers-outline" size={s(20)} color="#A78BFA" />
                <Text style={styles.modalStatValue}>{totalSets}</Text>
                <Text style={styles.modalStatLabel}>Sets</Text>
              </View>
            </View>

            {/* Exercise List */}
            {activity.exercise_names && activity.exercise_names.length > 0 && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Exercises</Text>
                <ScrollView style={styles.exerciseScroll} showsVerticalScrollIndicator={false}>
                  {activity.exercise_names.map((name, i) => (
                    <View key={i} style={styles.exerciseRow}>
                      <View style={styles.exerciseIndex}>
                        <Text style={styles.exerciseIndexText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.exerciseName}>{name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Reactions in modal */}
            <View style={styles.modalReactions}>
              <ReactionBar
                reactions={activity.reactions || []}
                currentUserId={currentUserId}
                onToggle={(type) => onToggleReaction(activity.id, type)}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  // Card
  card: {
    backgroundColor: c.card,
    borderRadius: s(10),
    padding: s(14),
    marginBottom: s(10),
    borderWidth: s(1),
    borderColor: c.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s(10),
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
    color: c.bg,
    fontSize: s(14),
    fontFamily: 'Inter_800ExtraBold',
  },
  headerInfo: {
    marginLeft: s(10),
    flex: 1,
  },
  name: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  time: {
    fontSize: s(11),
    color: c.textMuted,
    marginTop: s(1),
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.bg,
    borderRadius: s(10),
    paddingVertical: s(8),
    paddingHorizontal: s(12),
    marginBottom: s(10),
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(4),
  },
  statText: {
    fontSize: s(12),
    fontFamily: 'Inter_600SemiBold',
    color: '#CBD5E1',
  },
  statDot: {
    width: s(3),
    height: s(3),
    borderRadius: s(1.5),
    backgroundColor: c.textMuted,
    marginHorizontal: s(8),
  },

  // Tags
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(6),
    marginBottom: s(4),
  },
  tag: {
    backgroundColor: c.border,
    paddingHorizontal: s(8),
    paddingVertical: s(4),
    borderRadius: s(6),
  },
  tagText: {
    fontSize: s(11),
    fontFamily: 'Inter_500Medium',
    color: c.textSecondary,
  },
  tagMore: {
    backgroundColor: c.card,
    borderWidth: s(1),
    borderColor: c.textMuted,
  },
  tagMoreText: {
    color: c.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: c.card,
    borderTopLeftRadius: s(20),
    borderTopRightRadius: s(20),
    paddingHorizontal: s(20),
    paddingBottom: s(40),
    maxHeight: '80%',
  },
  modalHandleContainer: {
    alignItems: 'center',
    paddingTop: s(10),
    paddingBottom: s(4),
  },
  modalHandle: {
    width: s(36),
    height: s(4),
    borderRadius: s(2),
    backgroundColor: c.textMuted,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: s(20),
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
  },
  modalAvatar: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    color: c.bg,
    fontSize: s(18),
    fontFamily: 'Inter_800ExtraBold',
  },
  modalName: {
    fontSize: s(16),
    fontFamily: 'Inter_700Bold',
    color: c.text,
  },
  modalDate: {
    fontSize: s(12),
    color: c.textMuted,
    marginTop: s(2),
  },
  modalClose: {
    width: s(32),
    height: s(32),
    borderRadius: s(10),
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal stats grid
  modalStatsGrid: {
    flexDirection: 'row',
    gap: s(10),
    marginBottom: s(20),
  },
  modalStat: {
    flex: 1,
    backgroundColor: c.bg,
    borderRadius: s(12),
    paddingVertical: s(12),
    alignItems: 'center',
    gap: s(4),
  },
  modalStatValue: {
    fontSize: s(18),
    fontFamily: 'Inter_800ExtraBold',
    color: c.text,
  },
  modalStatLabel: {
    fontSize: s(10),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
  },

  // Modal exercise list
  modalSection: {
    marginBottom: s(16),
  },
  modalSectionTitle: {
    fontSize: s(13),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: s(0.5),
    marginBottom: s(10),
  },
  exerciseScroll: {
    maxHeight: s(240),
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s(10),
    borderBottomWidth: s(1),
    borderBottomColor: c.border,
    gap: s(12),
  },
  exerciseIndex: {
    width: s(24),
    height: s(24),
    borderRadius: s(12),
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseIndexText: {
    fontSize: s(11),
    fontFamily: 'Inter_700Bold',
    color: c.textSecondary,
  },
  exerciseName: {
    fontSize: s(15),
    fontFamily: 'Inter_500Medium',
    color: c.text,
    flex: 1,
  },

  // Modal reactions
  modalReactions: {
    paddingTop: s(8),
  },
});
