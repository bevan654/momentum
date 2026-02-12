import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { s } from '../../responsive';
import type { LiveReaction } from '../../liveSessionManager';

interface LiveReactionToastProps {
  reaction: LiveReaction | null;
}

const EMOJI_MAP: Record<string, string> = {
  fire: '\uD83D\uDD25',
  skull: '\uD83D\uDC80',
  eyes: '\uD83D\uDC40',
  hurry: '\u23F1\uFE0F',
};

const LABEL_MAP: Record<string, string> = {
  fire: 'Nice set!',
  skull: 'Dead!',
  eyes: 'Watching',
  hurry: 'Hurry up!',
};

const GLOW_COLORS: Record<string, string> = {
  fire: '#FF9500',
  skull: '#EF4444',
  eyes: '#3B82F6',
  hurry: '#EAB308',
};

export const LiveReactionToast: React.FC<LiveReactionToastProps> = ({ reaction }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reaction) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      opacity.setValue(1);
      scale.setValue(0.5);
      glowOpacity.setValue(0.6);

      Animated.sequence([
        // Overshoot spring: 0.5 → 1.15 → 1.0
        Animated.spring(scale, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }),
        // Hold for 1.5s
        Animated.delay(1500),
        // Fade out
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [reaction?.timestamp]);

  if (!reaction) return null;

  const glowColor = GLOW_COLORS[reaction.type] || '#888';

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ scale }] }]} pointerEvents="none">
      <Animated.View style={[styles.glow, { backgroundColor: glowColor, opacity: glowOpacity }]} />
      <Animated.Text style={styles.emoji}>{EMOJI_MAP[reaction.type] || ''}</Animated.Text>
      <Animated.Text style={styles.label}>{LABEL_MAP[reaction.type] || ''}</Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: s(24),
    paddingHorizontal: s(28),
    paddingVertical: s(20),
    zIndex: 999,
  },
  glow: {
    position: 'absolute',
    top: -s(8),
    left: -s(8),
    right: -s(8),
    bottom: -s(8),
    borderRadius: s(32),
  },
  emoji: {
    fontSize: s(44),
  },
  label: {
    fontSize: s(15),
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    marginTop: s(8),
  },
});
