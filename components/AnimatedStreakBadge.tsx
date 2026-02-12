import React, { useEffect, useRef, useState } from 'react';
import { Animated, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { s } from '../responsive';

interface Props {
  value: number;
  color: string;
  bgColor: string;
  borderColor: string;
  atRisk?: boolean;
}

const MICRO_TEXTS = ["Keep it going!", "Don't break it!"];

export function AnimatedStreakBadge({ value, color, bgColor, borderColor, atRisk = false }: Props) {
  // --- Animated values ---
  const glowOpacity = useRef(new Animated.Value(0.05)).current;
  const glowBright = useRef(new Animated.Value(0)).current;
  const flickerScale = useRef(new Animated.Value(1)).current;
  const shimmerOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const tapScale = useRef(new Animated.Value(1)).current;
  const microTextOpacity = useRef(new Animated.Value(0)).current;

  const [showMicroText, setShowMicroText] = useState(false);
  const prevValue = useRef(value);
  const glowLoop = useRef<Animated.CompositeAnimation | null>(null);
  const flickerLoop = useRef<Animated.CompositeAnimation | null>(null);
  const shimmerLoop = useRef<Animated.CompositeAnimation | null>(null);

  // --- Ambient glow pulse (cycles every ~5s) ---
  useEffect(() => {
    glowLoop.current?.stop();
    const highOpacity = atRisk ? 0.03 : 0.10;
    const lowOpacity = atRisk ? 0.01 : 0.05;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: highOpacity, duration: 2500, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: lowOpacity, duration: 2500, useNativeDriver: true }),
      ])
    );
    glowLoop.current = loop;
    loop.start();
    return () => loop.stop();
  }, [atRisk]);

  // --- Flame flicker (every ~4-6s) ---
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(4000 + Math.random() * 2000),
        Animated.timing(flickerScale, { toValue: 1.12, duration: 150, useNativeDriver: true }),
        Animated.timing(flickerScale, { toValue: 0.90, duration: 100, useNativeDriver: true }),
        Animated.timing(flickerScale, { toValue: 1.06, duration: 100, useNativeDriver: true }),
        Animated.spring(flickerScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ])
    );
    flickerLoop.current = loop;
    loop.start();
    return () => loop.stop();
  }, []);

  // --- Dot shimmer (every ~6-9s, offset from glow) ---
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(3000 + Math.random() * 3000),
        Animated.timing(shimmerOpacity, { toValue: 0.6, duration: 400, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.delay(2000 + Math.random() * 4000),
      ])
    );
    shimmerLoop.current = loop;
    loop.start();
    return () => loop.stop();
  }, []);

  // --- Streak increase detection ---
  useEffect(() => {
    if (value > prevValue.current && prevValue.current >= 0) {
      // Scale pulse
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.spring(pulseScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      ]).start();

      // Bright glow flash for 300ms
      glowBright.setValue(0.4);
      Animated.timing(glowBright, { toValue: 0, duration: 300, useNativeDriver: true }).start();

      // Light haptic
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    prevValue.current = value;
  }, [value]);

  // --- Tap handler ---
  const handleTap = () => {
    // Scale spring
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 1.15, duration: 100, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();

    // Glow intensify
    glowBright.setValue(0.25);
    Animated.timing(glowBright, { toValue: 0, duration: 400, useNativeDriver: true }).start();

    // Micro text
    setShowMicroText(true);
    microTextOpacity.setValue(1);
    Animated.timing(microTextOpacity, { toValue: 0, duration: 1500, useNativeDriver: true }).start(() => {
      setShowMicroText(false);
    });
  };

  const combinedScale = Animated.multiply(pulseScale, tapScale);
  const combinedGlow = Animated.add(glowOpacity, glowBright);

  return (
    <TouchableOpacity onPress={handleTap} activeOpacity={1}>
      <Animated.View style={{ transform: [{ scale: combinedScale }] }}>
        {/* Glow layer behind badge */}
        <Animated.View
          style={[
            styles.glow,
            {
              backgroundColor: color,
              opacity: combinedGlow,
              borderRadius: s(14),
            },
          ]}
        />
        {/* Badge */}
        <View
          style={[
            styles.badge,
            {
              backgroundColor: bgColor,
              borderColor,
              opacity: atRisk ? 0.65 : 1,
            },
          ]}
        >
          {/* Flame with flicker */}
          <Animated.View style={{ transform: [{ scale: flickerScale }] }}>
            <Ionicons name="flame" size={s(16)} color={color} />
            {/* Shimmer dot */}
            <Animated.View
              style={[
                styles.shimmerDot,
                {
                  backgroundColor: color,
                  opacity: shimmerOpacity,
                },
              ]}
            />
          </Animated.View>
          <Text style={[styles.text, { color }]}>{value}</Text>
        </View>
      </Animated.View>
      {/* Micro text tooltip */}
      {showMicroText && (
        <Animated.View style={[styles.microTextContainer, { opacity: microTextOpacity }]}>
          <Text style={[styles.microTextLabel, { color }]}>
            {atRisk ? MICRO_TEXTS[1] : MICRO_TEXTS[0]}
          </Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -s(3),
    left: -s(3),
    right: -s(3),
    bottom: -s(3),
    borderRadius: s(14),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(7),
    paddingVertical: s(4),
    borderRadius: s(12),
    gap: s(3),
    borderWidth: 1,
  },
  text: {
    fontSize: s(15),
    fontFamily: 'Inter_700Bold',
  },
  shimmerDot: {
    position: 'absolute',
    top: s(1),
    right: -s(1),
    width: s(3),
    height: s(3),
    borderRadius: s(1.5),
  },
  microTextContainer: {
    position: 'absolute',
    top: s(32),
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: s(4),
  },
  microTextLabel: {
    fontSize: s(9),
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
});
