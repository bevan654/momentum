import { supabase } from './supabase';
import { ExerciseType } from './database';

export interface RoutineExercise {
  id: string;
  routine_id: string;
  name: string;
  exercise_order: number;
  default_sets: number;
  exercise_type?: string;
}

export interface Routine {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  routine_exercises: RoutineExercise[];
}

/**
 * Fetch all routines for the current user, with their exercises
 */
export async function getRoutines() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: routines, error } = await supabase
      .from('routines')
      .select(`
        *,
        routine_exercises (*)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Sort exercises within each routine by exercise_order
    const sorted = (routines || []).map((r: any) => ({
      ...r,
      routine_exercises: (r.routine_exercises || []).sort(
        (a: RoutineExercise, b: RoutineExercise) => a.exercise_order - b.exercise_order
      ),
    }));

    return { success: true, routines: sorted as Routine[] };
  } catch (error) {
    console.error('Error fetching routines:', error);
    return { success: false, error };
  }
}

/**
 * Fetch a single routine by ID with its exercises
 */
export async function getRoutineById(routineId: string) {
  try {
    const { data: routine, error } = await supabase
      .from('routines')
      .select(`
        *,
        routine_exercises (*)
      `)
      .eq('id', routineId)
      .single();

    if (error) throw error;

    routine.routine_exercises = (routine.routine_exercises || []).sort(
      (a: RoutineExercise, b: RoutineExercise) => a.exercise_order - b.exercise_order
    );

    return { success: true, routine: routine as Routine };
  } catch (error) {
    console.error('Error fetching routine:', error);
    return { success: false, error };
  }
}

/**
 * Save a new routine with exercises
 */
export async function saveRoutine(
  name: string,
  exercises: { name: string; defaultSets: number; exerciseType?: ExerciseType }[]
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create the routine
    const { data: routine, error: routineError } = await supabase
      .from('routines')
      .insert({ user_id: user.id, name })
      .select()
      .single();

    if (routineError) throw routineError;

    // Create the exercises
    if (exercises.length > 0) {
      const exerciseRows = exercises.map((ex, i) => ({
        routine_id: routine.id,
        name: ex.name,
        exercise_order: i + 1,
        default_sets: ex.defaultSets,
        exercise_type: ex.exerciseType || 'weighted',
      }));

      const { error: exError } = await supabase
        .from('routine_exercises')
        .insert(exerciseRows);

      if (exError) throw exError;
    }

    return { success: true, routineId: routine.id };
  } catch (error) {
    console.error('Error saving routine:', error);
    return { success: false, error };
  }
}

/**
 * Delete a routine (cascade deletes exercises)
 */
export async function deleteRoutine(routineId: string) {
  try {
    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', routineId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting routine:', error);
    return { success: false, error };
  }
}

/**
 * Rename a routine
 */
export async function renameRoutine(routineId: string, name: string) {
  try {
    const { error } = await supabase
      .from('routines')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', routineId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error renaming routine:', error);
    return { success: false, error };
  }
}
