import { supabase } from './supabase';
import { ExerciseType } from './database';

export interface ExerciseListItem {
  name: string;
  exerciseType: ExerciseType;
  category: string;
}

// Default type mapping for known exercises
export const EXERCISE_TYPE_DEFAULTS: Record<string, ExerciseType> = {
  // Bodyweight (reps only)
  'Push-ups': 'bodyweight',
  'Pull-ups': 'bodyweight',
  'Chin-ups': 'bodyweight',
  'Hanging Leg Raise': 'bodyweight',
  'Ab Wheel Rollout': 'bodyweight',
  'Box Jump': 'bodyweight',
  // Duration (seconds)
  'Plank': 'duration',
  'Battle Ropes': 'duration',
  // Weighted bodyweight (+KG)
  'Chest Dips': 'weighted_bodyweight',
  'Dips': 'weighted_bodyweight',
};

// Category mapping for fallback exercises (derived from comment groupings)
export const FALLBACK_CATEGORY_MAP: Record<string, string> = {
  // Chest
  'Bench Press': 'Chest', 'Incline Bench Press': 'Chest', 'Decline Bench Press': 'Chest',
  'Dumbbell Bench Press': 'Chest', 'Incline Dumbbell Press': 'Chest', 'Cable Fly': 'Chest',
  'Dumbbell Fly': 'Chest', 'Chest Dips': 'Chest', 'Push-ups': 'Chest',
  'Machine Chest Press': 'Chest', 'Pec Deck': 'Chest',
  // Back
  'Barbell Row': 'Back', 'Dumbbell Row': 'Back', 'Lat Pulldown': 'Back',
  'Pull-ups': 'Back', 'Chin-ups': 'Back', 'Seated Cable Row': 'Back',
  'T-Bar Row': 'Back', 'Face Pull': 'Back', 'Straight Arm Pulldown': 'Back',
  'Machine Row': 'Back',
  // Legs
  'Squat': 'Legs', 'Front Squat': 'Legs', 'Leg Press': 'Legs',
  'Romanian Deadlift': 'Legs', 'Leg Curl': 'Legs', 'Leg Extension': 'Legs',
  'Bulgarian Split Squat': 'Legs', 'Lunges': 'Legs', 'Hip Thrust': 'Legs',
  'Calf Raise': 'Legs', 'Seated Calf Raise': 'Legs', 'Hack Squat': 'Legs',
  'Goblet Squat': 'Legs',
  // Shoulders
  'Overhead Press': 'Shoulders', 'Dumbbell Shoulder Press': 'Shoulders',
  'Lateral Raise': 'Shoulders', 'Front Raise': 'Shoulders', 'Reverse Fly': 'Shoulders',
  'Arnold Press': 'Shoulders', 'Upright Row': 'Shoulders', 'Shrugs': 'Shoulders',
  // Arms
  'Bicep Curl': 'Arms', 'Hammer Curl': 'Arms', 'Preacher Curl': 'Arms',
  'Concentration Curl': 'Arms', 'Cable Curl': 'Arms', 'Tricep Extension': 'Arms',
  'Tricep Pushdown': 'Arms', 'Overhead Tricep Extension': 'Arms',
  'Skull Crushers': 'Arms', 'Dips': 'Arms',
  // Compound
  'Deadlift': 'Compound', 'Sumo Deadlift': 'Compound', 'Clean and Press': 'Compound',
  'Farmers Walk': 'Compound',
  // Core
  'Plank': 'Core', 'Cable Crunch': 'Core', 'Hanging Leg Raise': 'Core',
  'Ab Wheel Rollout': 'Core',
  // Cardio
  'Battle Ropes': 'Cardio', 'Box Jump': 'Cardio', 'Kettlebell Swing': 'Cardio',
};

export const FALLBACK_EXERCISES = [
  // Chest
  'Bench Press',
  'Incline Bench Press',
  'Decline Bench Press',
  'Dumbbell Bench Press',
  'Incline Dumbbell Press',
  'Cable Fly',
  'Dumbbell Fly',
  'Chest Dips',
  'Push-ups',
  'Machine Chest Press',
  'Pec Deck',
  // Back
  'Barbell Row',
  'Dumbbell Row',
  'Lat Pulldown',
  'Pull-ups',
  'Chin-ups',
  'Seated Cable Row',
  'T-Bar Row',
  'Face Pull',
  'Straight Arm Pulldown',
  'Machine Row',
  // Legs
  'Squat',
  'Front Squat',
  'Leg Press',
  'Romanian Deadlift',
  'Leg Curl',
  'Leg Extension',
  'Bulgarian Split Squat',
  'Lunges',
  'Hip Thrust',
  'Calf Raise',
  'Seated Calf Raise',
  'Hack Squat',
  'Goblet Squat',
  // Shoulders
  'Overhead Press',
  'Dumbbell Shoulder Press',
  'Lateral Raise',
  'Front Raise',
  'Reverse Fly',
  'Arnold Press',
  'Upright Row',
  'Shrugs',
  // Arms
  'Bicep Curl',
  'Hammer Curl',
  'Preacher Curl',
  'Concentration Curl',
  'Cable Curl',
  'Tricep Extension',
  'Tricep Pushdown',
  'Overhead Tricep Extension',
  'Skull Crushers',
  'Dips',
  // Compound
  'Deadlift',
  'Sumo Deadlift',
  'Clean and Press',
  'Farmers Walk',
  // Core
  'Plank',
  'Cable Crunch',
  'Hanging Leg Raise',
  'Ab Wheel Rollout',
  // Cardio/Other
  'Battle Ropes',
  'Box Jump',
  'Kettlebell Swing',
];

// In-memory cache
let cachedExercises: ExerciseListItem[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function invalidateExerciseCache() {
  cachedExercises = null;
  cacheTimestamp = 0;
}

export async function getExerciseList(): Promise<ExerciseListItem[]> {
  // Return cache if fresh
  if (cachedExercises && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedExercises;
  }

  try {
    // Fetch global catalog with exercise type and category
    const { data: catalogData, error: catalogError } = await supabase
      .from('exercises_catalog')
      .select('name, exercise_type, category');

    if (catalogError) throw catalogError;

    // Fetch user custom exercises with exercise type
    const { data: { user } } = await supabase.auth.getUser();
    let userItems: ExerciseListItem[] = [];
    if (user) {
      const { data: userData, error: userError } = await supabase
        .from('user_exercises')
        .select('name, exercise_type, category')
        .eq('user_id', user.id);

      if (userError) throw userError;
      userItems = (userData || []).map(e => ({
        name: e.name,
        exerciseType: (e.exercise_type || 'weighted') as ExerciseType,
        category: e.category || 'Custom',
      }));
    }

    // Build map (user exercises override catalog if same name)
    const exerciseMap = new Map<string, { exerciseType: ExerciseType; category: string }>();
    (catalogData || []).forEach(e => {
      exerciseMap.set(e.name, {
        exerciseType: (e.exercise_type || 'weighted') as ExerciseType,
        category: e.category || FALLBACK_CATEGORY_MAP[e.name] || 'Other',
      });
    });
    userItems.forEach(e => {
      exerciseMap.set(e.name, { exerciseType: e.exerciseType, category: e.category });
    });

    // Convert to sorted array
    const items: ExerciseListItem[] = Array.from(exerciseMap.entries())
      .map(([name, { exerciseType, category }]) => ({ name, exerciseType, category }))
      .sort((a, b) => a.name.localeCompare(b.name));

    cachedExercises = items;
    cacheTimestamp = Date.now();
    return items;
  } catch (error) {
    console.warn('Failed to fetch exercises from DB, using fallback:', error);
    return FALLBACK_EXERCISES.map(name => ({
      name,
      exerciseType: EXERCISE_TYPE_DEFAULTS[name] || 'weighted',
      category: FALLBACK_CATEGORY_MAP[name] || 'Other',
    }));
  }
}

export async function addCustomExercise(name: string, exerciseType: ExerciseType = 'weighted'): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('user_exercises')
      .insert({ user_id: user.id, name: name.trim(), category: 'Custom', exercise_type: exerciseType });

    if (error) throw error;

    invalidateExerciseCache();
    return true;
  } catch (error) {
    console.error('Failed to add custom exercise:', error);
    return false;
  }
}

export async function deleteCustomExercise(name: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('user_exercises')
      .delete()
      .eq('user_id', user.id)
      .eq('name', name.trim());

    if (error) throw error;

    invalidateExerciseCache();
    return true;
  } catch (error) {
    console.error('Failed to delete custom exercise:', error);
    return false;
  }
}
