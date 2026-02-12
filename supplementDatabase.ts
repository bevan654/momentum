import { supabase } from './supabase';

export type SupplementType = 'water' | 'creatine';

export interface SupplementEntry {
  id: string;
  user_id: string;
  type: SupplementType;
  amount: number;
  date: string;
  created_at: string;
}

export interface SupplementGoals {
  water_goal: number;
  creatine_goal: number;
}

export interface DailySupplementSummary {
  totalWater: number;
  totalCreatine: number;
  waterEntries: SupplementEntry[];
  creatineEntries: SupplementEntry[];
}

const DEFAULT_GOALS: SupplementGoals = {
  water_goal: 2500,
  creatine_goal: 5,
};

export function clearSupplementCaches() {
  // no-op — caching removed for reliable cross-component sync
}

/**
 * Save a supplement entry (water or creatine)
 */
export async function saveSupplementEntry(
  type: SupplementType,
  amount: number,
  date?: string
): Promise<SupplementEntry | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const d = new Date();
    const entryDate = date || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('supplement_entries')
      .insert({
        user_id: user.id,
        type,
        amount,
        date: entryDate,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving supplement entry:', error);
    return null;
  }
}

/**
 * Get all supplement entries for a specific date
 */
export async function getSupplementEntriesForDate(date: string): Promise<SupplementEntry[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('supplement_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching supplement entries:', error);
    return [];
  }
}

/**
 * Get daily supplement summary with totals
 */
export async function getDailySupplementSummary(date: string): Promise<DailySupplementSummary> {
  const entries = await getSupplementEntriesForDate(date);

  const waterEntries = entries.filter(e => e.type === 'water');
  const creatineEntries = entries.filter(e => e.type === 'creatine');

  return {
    totalWater: waterEntries.reduce((sum, e) => sum + e.amount, 0),
    totalCreatine: creatineEntries.reduce((sum, e) => sum + e.amount, 0),
    waterEntries,
    creatineEntries,
  };
}

/**
 * Delete a supplement entry
 */
export async function deleteSupplementEntry(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('supplement_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting supplement entry:', error);
    return false;
  }
}

/**
 * Get user's supplement goals
 */
export async function getSupplementGoals(): Promise<SupplementGoals> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_GOALS;

    const { data, error } = await supabase
      .from('supplement_goals')
      .select('water_goal, creatine_goal')
      .eq('user_id', user.id)
      .single();

    if (error || !data) return DEFAULT_GOALS;
    return data;
  } catch {
    return DEFAULT_GOALS;
  }
}

/**
 * Save user's supplement goals
 */
export async function saveSupplementGoals(goals: SupplementGoals): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('supplement_goals')
      .upsert({
        user_id: user.id,
        ...goals,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving supplement goals:', error);
    return false;
  }
}
