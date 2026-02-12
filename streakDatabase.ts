import { supabase } from './supabase';

// --- Types ---

export interface StreakResult {
  current: number;
  best: number;
  atRisk: boolean;
}

export function invalidateStreakCaches() {
  // No-op: caching removed for instant updates
}

// --- Helpers ---

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}


// --- Gym Streak ---
// Rules: streak continues as long as user doesn't exceed 2 consecutive rest days.
// 3 rest days in a row = streak broken.
// Streak value = calendar days from streak start to last workout day (inclusive).
// Rest days don't increase the number — only completing a workout does.

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

export async function getGymStreak(): Promise<StreakResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { current: 0, best: 0, atRisk: false };

    // Get distinct workout dates for the last 2 years
    const since = new Date();
    since.setFullYear(since.getFullYear() - 2);

    const { data, error } = await supabase
      .from('workouts')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      return { current: 0, best: 0, atRisk: false };
    }

    // Build set of unique workout dates
    const workoutDates = new Set<string>();
    for (const row of data) {
      const d = new Date(row.created_at);
      workoutDates.add(formatDate(d));
    }

    const today = formatDate(new Date());

    const current = calcGymStreak(workoutDates, today);
    const best = calcBestGymStreak(workoutDates);

    // atRisk: streak > 0, today is not a workout day, and we're on rest day 2
    let atRisk = false;
    if (current > 0 && !workoutDates.has(today)) {
      const yesterday = formatDate(new Date(Date.now() - 86400000));
      if (!workoutDates.has(yesterday)) {
        atRisk = true;
      }
    }

    return { current, best: Math.max(current, best), atRisk };
  } catch (error) {
    console.error('Error calculating gym streak:', error);
    return { current: 0, best: 0, atRisk: false };
  }
}

function calcGymStreak(workoutDates: Set<string>, fromDate: string): number {
  let restDays = 0;
  let lastWorkoutDate: string | null = null;
  let streakStartDate: string | null = null;
  const d = new Date(fromDate + 'T00:00:00');

  // Walk backwards from today
  for (let i = 0; i < 730; i++) {
    const dateStr = formatDate(d);

    if (workoutDates.has(dateStr)) {
      restDays = 0;
      if (!lastWorkoutDate) lastWorkoutDate = dateStr;
      streakStartDate = dateStr;
    } else {
      restDays++;
      if (restDays > 2) {
        break;
      }
    }

    d.setDate(d.getDate() - 1);
  }

  if (!lastWorkoutDate || !streakStartDate) return 0;

  // Calendar days from streak start to last workout (inclusive)
  return daysBetween(lastWorkoutDate, streakStartDate) + 1;
}

function calcBestGymStreak(workoutDates: Set<string>): number {
  if (workoutDates.size === 0) return 0;

  const sorted = Array.from(workoutDates).sort();
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];

  let best = 0;
  let streakStart: string | null = null;
  let lastWorkout: string | null = null;
  let restDays = 0;
  const d = new Date(earliest + 'T00:00:00');
  const end = new Date(latest + 'T00:00:00');
  end.setDate(end.getDate() + 1);

  while (d <= end) {
    const dateStr = formatDate(d);

    if (workoutDates.has(dateStr)) {
      if (streakStart === null) streakStart = dateStr;
      lastWorkout = dateStr;
      restDays = 0;
      // Update best: calendar days from start to this workout
      best = Math.max(best, daysBetween(lastWorkout, streakStart) + 1);
    } else {
      restDays++;
      if (restDays > 2) {
        streakStart = null;
        lastWorkout = null;
        restDays = 0;
      }
    }

    d.setDate(d.getDate() + 1);
  }

  return best;
}

// --- Nutrition Streak ---
// Rules: user must hit daily calorie goal every day. Missing one day = streak broken.

export async function getNutritionStreak(): Promise<StreakResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { current: 0, best: 0, atRisk: false };

    // Get calorie goal
    const { data: goalsData } = await supabase
      .from('nutrition_goals')
      .select('calorie_goal')
      .eq('user_id', user.id)
      .single();

    const calorieGoal = goalsData?.calorie_goal || 2000;

    // Get daily calorie totals for last 2 years
    const since = new Date();
    since.setFullYear(since.getFullYear() - 2);

    const { data, error } = await supabase
      .from('food_entries')
      .select('calories, created_at')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) {
      return { current: 0, best: 0, atRisk: false };
    }

    // Build map of date → total calories
    const dailyCals = new Map<string, number>();
    for (const entry of data) {
      const dateStr = formatDate(new Date(entry.created_at));
      dailyCals.set(dateStr, (dailyCals.get(dateStr) || 0) + entry.calories);
    }

    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));

    // Calculate current streak (walk backwards from yesterday since today is incomplete)
    let current = 0;
    const d = new Date(yesterday + 'T00:00:00');
    for (let i = 0; i < 730; i++) {
      const dateStr = formatDate(d);
      const cals = dailyCals.get(dateStr) || 0;
      if (cals >= calorieGoal) {
        current++;
      } else {
        break;
      }
      d.setDate(d.getDate() - 1);
    }

    // If today already meets goal, count it too
    const todayCals = dailyCals.get(today) || 0;
    if (todayCals >= calorieGoal) {
      current++;
    }

    // Calculate best streak
    const best = calcBestNutritionStreak(dailyCals, calorieGoal);

    // atRisk: streak > 0 but today's calories haven't hit the goal yet
    const atRisk = current > 0 && todayCals < calorieGoal;

    return { current, best: Math.max(current, best), atRisk };
  } catch (error) {
    console.error('Error calculating nutrition streak:', error);
    return { current: 0, best: 0, atRisk: false };
  }
}

function calcBestNutritionStreak(dailyCals: Map<string, number>, goal: number): number {
  if (dailyCals.size === 0) return 0;

  const dates = Array.from(dailyCals.keys()).sort();
  const earliest = dates[0];
  const latest = dates[dates.length - 1];

  let best = 0;
  let streak = 0;
  const d = new Date(earliest + 'T00:00:00');
  const end = new Date(latest + 'T00:00:00');

  while (d <= end) {
    const dateStr = formatDate(d);
    const cals = dailyCals.get(dateStr) || 0;

    if (cals >= goal) {
      streak++;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }

    d.setDate(d.getDate() + 1);
  }

  return best;
}

// --- Combined Streak ---
// Rules: a day counts only if BOTH a workout was logged AND the calorie goal was met.
// Missing either one breaks the streak (no rest-day allowance).

export async function getCombinedStreak(): Promise<StreakResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { current: 0, best: 0, atRisk: false };

    const since = new Date();
    since.setFullYear(since.getFullYear() - 2);

    // Fetch workout dates
    const { data: workoutData, error: workoutError } = await supabase
      .from('workouts')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString());

    if (workoutError) throw workoutError;

    const workoutDates = new Set<string>();
    for (const row of (workoutData || [])) {
      workoutDates.add(formatDate(new Date(row.created_at)));
    }

    // Fetch calorie goal
    const { data: goalsData } = await supabase
      .from('nutrition_goals')
      .select('calorie_goal')
      .eq('user_id', user.id)
      .single();

    const calorieGoal = goalsData?.calorie_goal || 2000;

    // Fetch food entries
    const { data: foodData, error: foodError } = await supabase
      .from('food_entries')
      .select('calories, created_at')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString());

    if (foodError) throw foodError;

    const dailyCals = new Map<string, number>();
    for (const entry of (foodData || [])) {
      const dateStr = formatDate(new Date(entry.created_at));
      dailyCals.set(dateStr, (dailyCals.get(dateStr) || 0) + entry.calories);
    }

    // Build set of dates where BOTH conditions are met
    const bothDates = new Set<string>();
    for (const dateStr of workoutDates) {
      if ((dailyCals.get(dateStr) || 0) >= calorieGoal) {
        bothDates.add(dateStr);
      }
    }

    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));

    // Current streak: walk backwards from yesterday (today may be incomplete)
    let current = 0;
    const d = new Date(yesterday + 'T00:00:00');
    for (let i = 0; i < 730; i++) {
      const dateStr = formatDate(d);
      if (bothDates.has(dateStr)) {
        current++;
      } else {
        break;
      }
      d.setDate(d.getDate() - 1);
    }

    // If today already meets both, count it
    if (bothDates.has(today)) {
      current++;
    }

    // Best streak
    let best = 0;
    if (bothDates.size > 0) {
      const sorted = Array.from(bothDates).sort();
      const earliest = sorted[0];
      const latest = sorted[sorted.length - 1];
      let streak = 0;
      const bd = new Date(earliest + 'T00:00:00');
      const end = new Date(latest + 'T00:00:00');

      while (bd <= end) {
        const dateStr = formatDate(bd);
        if (bothDates.has(dateStr)) {
          streak++;
          best = Math.max(best, streak);
        } else {
          streak = 0;
        }
        bd.setDate(bd.getDate() + 1);
      }
    }

    // atRisk: streak > 0 but today hasn't met both conditions yet
    const atRisk = current > 0 && !bothDates.has(today);

    return { current, best: Math.max(current, best), atRisk };
  } catch (error) {
    console.error('Error calculating combined streak:', error);
    return { current: 0, best: 0, atRisk: false };
  }
}
