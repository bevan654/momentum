export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export interface MuscleVolumeData {
  volume: number;
  normalizedIntensity: number;
  exercises: string[];
  lastTrained: string | null;
}

export const MUSCLE_DISPLAY_NAMES: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

interface MuscleContribution {
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
}

export const EXERCISE_MUSCLE_MAP: Record<string, MuscleContribution> = {
  'Bench Press': { primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  'Squat': { primary: ['quads', 'glutes'], secondary: ['hamstrings', 'abs'] },
  'Deadlift': { primary: ['back', 'hamstrings', 'glutes'], secondary: ['forearms', 'quads'] },
  'Overhead Press': { primary: ['shoulders'], secondary: ['triceps', 'abs'] },
  'Barbell Row': { primary: ['back'], secondary: ['biceps', 'forearms'] },
  'Pull-ups': { primary: ['back'], secondary: ['biceps', 'forearms'] },
  'Dips': { primary: ['triceps'], secondary: ['chest', 'shoulders'] },
  'Lat Pulldown': { primary: ['back'], secondary: ['biceps'] },
  'Leg Press': { primary: ['quads'], secondary: ['glutes'] },
  'Romanian Deadlift': { primary: ['hamstrings', 'glutes'], secondary: ['back'] },
  'Incline Bench Press': { primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  'Cable Fly': { primary: ['chest'], secondary: [] },
  'Bicep Curl': { primary: ['biceps'], secondary: ['forearms'] },
  'Tricep Extension': { primary: ['triceps'], secondary: [] },
  'Leg Curl': { primary: ['hamstrings'], secondary: [] },
  'Leg Extension': { primary: ['quads'], secondary: [] },
  'Calf Raise': { primary: ['calves'], secondary: [] },
  'Face Pull': { primary: ['shoulders'], secondary: ['back'] },
  'Lateral Raise': { primary: ['shoulders'], secondary: [] },
  'Shrugs': { primary: [], secondary: ['shoulders', 'back', 'forearms'] },
};

export function calculateMuscleVolumes(
  workouts: any[]
): Record<MuscleGroup, MuscleVolumeData> {
  const allMuscles: MuscleGroup[] = [
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
    'abs', 'quads', 'hamstrings', 'glutes', 'calves',
  ];

  const result: Record<string, MuscleVolumeData> = {};
  for (const m of allMuscles) {
    result[m] = { volume: 0, normalizedIntensity: 0, exercises: [], lastTrained: null };
  }

  for (const workout of workouts) {
    const workoutDate = workout.created_at;
    for (const exercise of workout.exercises || []) {
      const mapping = EXERCISE_MUSCLE_MAP[exercise.name];
      if (!mapping) continue;

      // Calculate exercise volume (kg * reps for all sets)
      let exerciseVolume = 0;
      for (const set of exercise.sets || []) {
        exerciseVolume += (set.kg || 0) * (set.reps || 0);
      }

      const addVolume = (muscle: MuscleGroup, weight: number) => {
        const entry = result[muscle];
        entry.volume += exerciseVolume * weight;
        if (!entry.exercises.includes(exercise.name)) {
          entry.exercises.push(exercise.name);
        }
        if (!entry.lastTrained || workoutDate > entry.lastTrained) {
          entry.lastTrained = workoutDate;
        }
      };

      for (const m of mapping.primary) addVolume(m, 1.0);
      for (const m of mapping.secondary) addVolume(m, 0.5);
    }
  }

  // Normalize intensities 0-1
  let maxVolume = 0;
  for (const m of allMuscles) {
    if (result[m].volume > maxVolume) maxVolume = result[m].volume;
  }

  if (maxVolume > 0) {
    for (const m of allMuscles) {
      result[m].normalizedIntensity = result[m].volume / maxVolume;
    }
  }

  return result as Record<MuscleGroup, MuscleVolumeData>;
}
