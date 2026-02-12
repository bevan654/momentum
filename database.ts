import { supabase } from './supabase';

export type ExerciseType = 'weighted' | 'bodyweight' | 'duration' | 'weighted_bodyweight';

export interface WorkoutData {
  duration: number;
  exercises: ExerciseData[];
}

export interface ExerciseData {
  name: string;
  exerciseType?: ExerciseType;
  sets: SetData[];
}

export interface SetData {
  kg: string;
  reps: string;
  completed: boolean;
  type: 'warmup' | 'working' | 'drop';
  drops?: { kg: string; reps: string }[];
}

export interface SavedWorkout {
  id: string;
  created_at: string;
  duration: number;
  total_exercises: number;
  total_sets: number;
  exercises: SavedExercise[];
}

export interface SavedExercise {
  id: string;
  name: string;
  exercise_order: number;
  exercise_type?: string;
  sets: SavedSet[];
}

export interface SavedSet {
  id: string;
  set_number: number;
  kg: number;
  reps: number;
  completed: boolean;
  set_type: string;
  parent_set_number?: number | null;
}

export interface ExerciseHistorySession {
  workout_id: string;
  created_at: string;
  exercise_type?: string;
  sets: { kg: number; reps: number; completed: boolean; set_type: string; set_number: number }[];
}

// --- In-memory cache ---
let workoutsCache: { data: any[]; limit: number; ts: number } | null = null;
let statsCache: { data: any; ts: number } | null = null;
const monthCache = new Map<string, { data: any[]; ts: number }>();
const exerciseHistoryCache = new Map<string, { data: ExerciseHistorySession[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function invalidateWorkoutCaches() {
  workoutsCache = null;
  statsCache = null;
  monthCache.clear();
}

export function clearWorkoutCaches() {
  workoutsCache = null;
  statsCache = null;
  monthCache.clear();
  exerciseHistoryCache.clear();
}

/**
 * Save a workout to the database
 */
export async function saveWorkout(workoutData: WorkoutData) {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Create the workout
    const { data: workout, error: workoutError } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        duration: workoutData.duration,
        total_exercises: workoutData.exercises.length,
        total_sets: workoutData.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
      })
      .select()
      .single();

    if (workoutError) throw workoutError;

    // 2. Create exercises
    for (let i = 0; i < workoutData.exercises.length; i++) {
      const exercise = workoutData.exercises[i];

      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          workout_id: workout.id,
          name: exercise.name,
          exercise_order: i + 1,
          exercise_type: exercise.exerciseType || 'weighted',
        })
        .select()
        .single();

      if (exerciseError) throw exerciseError;

      // 3. Create sets for this exercise (including drop sub-rows)
      const setsToInsert: any[] = [];
      exercise.sets.forEach((set, setIndex) => {
        const setNumber = setIndex + 1;
        setsToInsert.push({
          exercise_id: exerciseData.id,
          set_number: setNumber,
          kg: parseFloat(set.kg) || 0,
          reps: parseInt(set.reps) || 0,
          completed: set.completed,
          set_type: set.type,
          parent_set_number: null,
        });
        // Save drops as additional rows linked to parent set
        if (set.type === 'drop' && set.drops && set.drops.length > 0) {
          set.drops.forEach((drop) => {
            setsToInsert.push({
              exercise_id: exerciseData.id,
              set_number: setNumber,
              kg: parseFloat(drop.kg) || 0,
              reps: parseInt(drop.reps) || 0,
              completed: set.completed,
              set_type: 'drop',
              parent_set_number: setNumber,
            });
          });
        }
      });

      const { error: setsError } = await supabase
        .from('sets')
        .insert(setsToInsert);

      if (setsError) throw setsError;
    }

    invalidateWorkoutCaches();
    return { success: true, workoutId: workout.id };
  } catch (error) {
    console.error('Error saving workout:', error);
    return { success: false, error };
  }
}

/**
 * Get all workouts (most recent first)
 */
export async function getWorkouts(limit = 20) {
  if (workoutsCache && workoutsCache.limit === limit && Date.now() - workoutsCache.ts < CACHE_TTL) {
    return { success: true, workouts: workoutsCache.data };
  }

  try {
    const { data: workouts, error } = await supabase
      .from('workouts')
      .select(`
        *,
        exercises (
          *,
          sets (*)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    workoutsCache = { data: workouts || [], limit, ts: Date.now() };
    return { success: true, workouts };
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return { success: false, error };
  }
}

/**
 * Get a single workout by ID
 */
export async function getWorkoutById(workoutId: string) {
  try {
    const { data: workout, error } = await supabase
      .from('workouts')
      .select(`
        *,
        exercises (
          *,
          sets (*)
        )
      `)
      .eq('id', workoutId)
      .single();

    if (error) throw error;

    return { success: true, workout };
  } catch (error) {
    console.error('Error fetching workout:', error);
    return { success: false, error };
  }
}

/**
 * Delete a workout
 */
export async function deleteWorkout(workoutId: string) {
  try {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', workoutId);

    if (error) throw error;

    invalidateWorkoutCaches();
    return { success: true };
  } catch (error) {
    console.error('Error deleting workout:', error);
    return { success: false, error };
  }
}

/**
 * Get the last set data for a specific exercise (for showing "previous" values)
 */
export async function getLastSetForExercise(exerciseName: string) {
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select(`
        sets (kg, reps, completed)
      `)
      .eq('name', exerciseName)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0 && data[0].sets && data[0].sets.length > 0) {
      // Get the last completed set
      const completedSets = data[0].sets.filter((s: any) => s.completed);
      if (completedSets.length > 0) {
        const lastSet = completedSets[completedSets.length - 1];
        return { success: true, kg: lastSet.kg, reps: lastSet.reps };
      }
    }

    return { success: true, kg: 0, reps: 0 };
  } catch (error) {
    console.error('Error fetching last set:', error);
    return { success: false, kg: 0, reps: 0, error };
  }
}

/**
 * Get workouts for a specific month (for calendar view)
 */
export async function getWorkoutsForMonth(year: number, month: number) {
  const cacheKey = `${year}-${month}`;
  const cached = monthCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { success: true, workouts: cached.data };
  }

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { data: workouts, error } = await supabase
      .from('workouts')
      .select(`
        *,
        exercises (
          *,
          sets (*)
        )
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    monthCache.set(cacheKey, { data: workouts || [], ts: Date.now() });
    return { success: true, workouts };
  } catch (error) {
    console.error('Error fetching workouts for month:', error);
    return { success: false, error };
  }
}

/**
 * Get workouts for a specific date (can be multiple per day)
 */
export async function getWorkoutsByDate(date: string) {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: workouts, error } = await supabase
      .from('workouts')
      .select(`
        *,
        exercises (
          *,
          sets (*)
        )
      `)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, workouts: workouts || [] };
  } catch (error) {
    console.error('Error fetching workouts by date:', error);
    return { success: false, error };
  }
}

/**
 * Get workouts within a date range (for muscle heat map)
 */
export async function getWorkoutsForDateRange(startDate: string, endDate: string) {
  try {
    const { data: workouts, error } = await supabase
      .from('workouts')
      .select(`
        *,
        exercises (
          *,
          sets (*)
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { success: true, workouts: workouts || [] };
  } catch (error) {
    console.error('Error fetching workouts for date range:', error);
    return { success: false, error, workouts: [] };
  }
}

/**
 * Get 14-day workout statistics
 */
export async function get14DayStats() {
  if (statsCache && Date.now() - statsCache.ts < CACHE_TTL) {
    return { success: true, stats: statsCache.data };
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);

    const { data: workouts, error } = await supabase
      .from('workouts')
      .select(`
        *,
        exercises (
          *,
          sets (*)
        )
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!workouts || workouts.length === 0) {
      return {
        success: true,
        stats: {
          totalVolume: 0,
          totalDuration: 0,
          totalWorkouts: 0,
          avgWorkoutLength: 0,
        },
      };
    }

    // Calculate total volume (skip bodyweight/duration exercises)
    let totalVolume = 0;
    workouts.forEach((workout: any) => {
      workout.exercises.forEach((exercise: any) => {
        const exType = exercise.exercise_type || 'weighted';
        if (exType === 'duration' || exType === 'bodyweight') return;
        exercise.sets.forEach((set: any) => {
          totalVolume += set.kg * set.reps;
        });
      });
    });

    // Calculate total duration
    const totalDuration = workouts.reduce((sum: number, w: any) => sum + w.duration, 0);

    // Count workouts
    const totalWorkouts = workouts.length;

    // Calculate average workout length
    const avgWorkoutLength = totalWorkouts > 0 ? totalDuration / totalWorkouts : 0;

    const stats = {
      totalVolume: Math.round(totalVolume),
      totalDuration,
      totalWorkouts,
      avgWorkoutLength: Math.round(avgWorkoutLength),
    };
    statsCache = { data: stats, ts: Date.now() };
    return { success: true, stats };
  } catch (error) {
    console.error('Error fetching 14-day stats:', error);
    return { success: false, error };
  }
}

/**
 * Get exercise history sessions for a specific exercise name
 */
export async function getExerciseHistory(exerciseName: string, limit = 50): Promise<{ success: boolean; sessions: ExerciseHistorySession[]; error?: any }> {
  const cached = exerciseHistoryCache.get(exerciseName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { success: true, sessions: cached.data };
  }

  try {
    // Fetch workouts that contain this exercise, with all exercise+set data
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: workouts, error } = await supabase
      .from('workouts')
      .select(`
        id,
        created_at,
        exercises (
          name,
          exercise_type,
          sets (kg, reps, completed, set_type, set_number)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Filter to only workouts that contain the target exercise
    const sessions: ExerciseHistorySession[] = [];
    (workouts || []).forEach((workout: any) => {
      const matchingExercise = (workout.exercises || []).find(
        (ex: any) => ex.name === exerciseName
      );
      if (matchingExercise) {
        sessions.push({
          workout_id: workout.id,
          created_at: workout.created_at,
          exercise_type: matchingExercise.exercise_type || 'weighted',
          sets: (matchingExercise.sets || []).sort((a: any, b: any) => a.set_number - b.set_number),
        });
      }
    });

    exerciseHistoryCache.set(exerciseName, { data: sessions, ts: Date.now() });
    return { success: true, sessions };
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    return { success: false, sessions: [], error };
  }
}
