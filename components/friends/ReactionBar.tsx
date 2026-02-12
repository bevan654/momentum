import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Reaction } from '../../friendsDatabase';
import { useTheme, Colors } from '../../theme';
import { s } from '../../responsive';

interface ReactionBarProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (type: 'like' | 'clap' | 'fire') => void;
}

const REACTION_EMOJIS = {
  like: '👍',
  clap: '👏',
  fire: '🔥',
};

export const ReactionBar: React.FC<ReactionBarProps> = ({ reactions, currentUserId, onToggle }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const counts = { like: 0, clap: 0, fire: 0 };
  const myReaction = reactions.find(r => r.user_id === currentUserId);

  reactions.forEach(r => {
    if (counts[r.type] !== undefined) counts[r.type]++;
  });

  return (
    <View style={styles.container}>
      {(['like', 'clap', 'fire'] as const).map(type => {
        const isActive = myReaction?.type === type;
        return (
          <TouchableOpacity
            key={type}
            style={[styles.button, isActive && styles.buttonActive]}
            onPress={() => onToggle(type)}
          >
            <Text style={styles.emoji}>{REACTION_EMOJIS[type]}</Text>
            {counts[type] > 0 && (
              <Text style={[styles.count, isActive && styles.countActive]}>{counts[type]}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: s(8),
    marginTop: s(8),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.border,
    paddingHorizontal: s(10),
    paddingVertical: s(6),
    borderRadius: s(10),
    gap: s(4),
  },
  buttonActive: {
    backgroundColor: '#1E3A5F',
    borderWidth: s(1),
    borderColor: '#38BDF8',
  },
  emoji: {
    fontSize: s(16),
  },
  count: {
    fontSize: s(13),
    color: c.textSecondary,
    fontFamily: 'Inter_600SemiBold',
  },
  countActive: {
    color: '#38BDF8',
  },
});
