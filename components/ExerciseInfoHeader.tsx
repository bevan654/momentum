import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';
import { EXERCISE_FORM_CUES } from '../exerciseFormCues';
import { EXERCISE_MUSCLE_MAP, MUSCLE_DISPLAY_NAMES } from '../muscleMapping';

interface ExerciseInfoHeaderProps {
  exerciseName: string;
}

export const ExerciseInfoHeader: React.FC<ExerciseInfoHeaderProps> = ({ exerciseName }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const muscleData = EXERCISE_MUSCLE_MAP[exerciseName];
  const muscles = muscleData
    ? [...muscleData.primary, ...muscleData.secondary]
        .map(m => MUSCLE_DISPLAY_NAMES[m])
        .filter(Boolean)
    : [];

  const cues = EXERCISE_FORM_CUES[exerciseName] || [];

  if (!muscles.length && !cues.length) return null;

  return (
    <View style={styles.container}>
      {muscles.length > 0 && (
        <Text style={styles.muscleText} numberOfLines={1}>{muscles.join(', ')}</Text>
      )}
      {cues.length > 0 && (
        <Text style={styles.cueText} numberOfLines={2}>
          {cues.join(' · ')}
        </Text>
      )}
    </View>
  );
};

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    paddingHorizontal: s(16),
    paddingVertical: s(6),
    gap: s(3),
  },
  muscleText: {
    fontSize: s(11),
    fontFamily: 'Inter_400Regular',
    color: c.textMuted,
  },
  cueText: {
    fontSize: s(10),
    fontFamily: 'Inter_400Regular',
    color: c.textSecondary,
  },
});
