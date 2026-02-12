import { supabase } from './supabase';

export interface WeightEntry {
  id: string;
  user_id: string;
  weight: number;
  date: string;
  created_at: string;
}

export interface WeightStats {
  current: number | null;
  trend: number | null;
  startingWeight: number | null;
  change: number | null;
  entries: WeightEntry[];
  trendLine: { date: string; value: number }[];
}

// --- In-memory cache ---
let weightCache: { data: WeightEntry[]; ts: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function invalidateWeightCache() {
  weightCache = null;
}

export function clearWeightCaches() {
  weightCache = null;
}

/**
 * Calculate Exponential Moving Average trend from weight entries
 * @param entries - Array of weight entries
 * @param alpha - Smoothing factor (0.1 = very smooth/14-day feel, 0.2 = more responsive/7-day feel)
 * @returns The EMA trend value or null if no entries
 */
export function calculateEMATrend(entries: WeightEntry[], alpha: number = 0.2): number | null {
  if (entries.length === 0) return null;

  // Sort by date ascending (oldest first)
  const sorted = [...entries].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Initialize trend with first weight
  let trend = sorted[0].weight;

  // Apply EMA formula: Trend_today = (Weight_today × α) + (Trend_yesterday × (1 − α))
  for (let i = 1; i < sorted.length; i++) {
    trend = (sorted[i].weight * alpha) + (trend * (1 - alpha));
  }

  // Round to 1 decimal place
  return Math.round(trend * 10) / 10;
}

/**
 * Calculate EMA trend line - returns trend value for each entry date
 */
export function calculateEMATrendLine(entries: WeightEntry[], alpha: number = 0.2): { date: string; value: number }[] {
  if (entries.length === 0) return [];

  // Sort by date ascending (oldest first)
  const sorted = [...entries].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const trendLine: { date: string; value: number }[] = [];
  let trend = sorted[0].weight;

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      trend = (sorted[i].weight * alpha) + (trend * (1 - alpha));
    }
    trendLine.push({
      date: sorted[i].date,
      value: Math.round(trend * 10) / 10,
    });
  }

  return trendLine;
}

/**
 * Save or update a weight entry for a specific date
 */
export async function saveWeightEntry(weight: number, date?: string): Promise<WeightEntry | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const entryDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('weight_entries')
      .upsert({
        user_id: user.id,
        weight,
        date: entryDate,
      }, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) throw error;
    invalidateWeightCache();
    return data;
  } catch (error) {
    console.error('Error saving weight entry:', error);
    return null;
  }
}

/**
 * Get weight entries for the last N days
 */
export async function getWeightEntries(days: number = 30): Promise<WeightEntry[]> {
  // Check cache
  if (weightCache && Date.now() - weightCache.ts < CACHE_TTL) {
    return weightCache.data;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;

    const entries = data || [];
    weightCache = { data: entries, ts: Date.now() };
    return entries;
  } catch (error) {
    console.error('Error fetching weight entries:', error);
    return [];
  }
}

/**
 * Get the most recent weight entry
 */
export async function getLatestWeight(): Promise<WeightEntry | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching latest weight:', error);
    return null;
  }
}

/**
 * Get starting weight from user profile
 */
export async function getStartingWeight(): Promise<number | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('starting_weight')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data?.starting_weight ?? null;
  } catch (error) {
    console.error('Error fetching starting weight:', error);
    return null;
  }
}

/**
 * Save starting weight to user profile
 */
export async function saveStartingWeight(weight: number | null): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('profiles')
      .update({ starting_weight: weight, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving starting weight:', error);
    return false;
  }
}

/**
 * Get comprehensive weight stats including current, trend, change, and chart data
 */
export async function getWeightStats(): Promise<WeightStats> {
  try {
    const [entries, startingWeight] = await Promise.all([
      getWeightEntries(30), // Get last 30 days for EMA calculation
      getStartingWeight(),
    ]);

    const current = entries.length > 0 ? entries[0].weight : null; // entries are sorted desc
    const trend = calculateEMATrend(entries, 0.2); // α = 0.2 for 7-day feel
    const trendLine = calculateEMATrendLine(entries, 0.2);

    let change: number | null = null;
    if (startingWeight !== null && trend !== null) {
      change = Math.round((trend - startingWeight) * 10) / 10;
    }

    return {
      current,
      trend,
      startingWeight,
      change,
      entries,
      trendLine,
    };
  } catch (error) {
    console.error('Error getting weight stats:', error);
    return { current: null, trend: null, startingWeight: null, change: null, entries: [], trendLine: [] };
  }
}

/**
 * Delete a weight entry
 */
export async function deleteWeightEntry(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('weight_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
    invalidateWeightCache();
    return true;
  } catch (error) {
    console.error('Error deleting weight entry:', error);
    return false;
  }
}
