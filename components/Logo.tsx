import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme, Colors } from '../theme';

interface LogoProps {
  size?: number;
}

export function Logo({ size = 64 }: LogoProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const radius = size * (120 / 512);
  const iconSize = size * 0.55;

  return (
    <View style={[styles.shadow, { width: size, height: size, borderRadius: radius }]}>
      <LinearGradient
        colors={['#007AFF', '#0055D4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { width: size, height: size, borderRadius: radius }]}
      >
        <Svg width={iconSize} height={iconSize} viewBox="70 120 330 270">
          <Path
            d="M360 152H200M360 152V312M360 152L152 360L100 308L240 168"
            stroke="white"
            strokeWidth={48}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </LinearGradient>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  shadow: {
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
