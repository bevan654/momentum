import { supabase } from './supabase';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'meal_1' | 'meal_2' | 'meal_3' | 'meal_4' | 'meal_5' | 'meal_6' | 'meal_7' | 'meal_8';

// --- Meal Slot Config ---

export interface MealSlotConfig {
  slot: MealType;
  label: string;
  icon: string;
  time_start: string;
  enabled: boolean;
  sort_order: number;
}

export const DEFAULT_MEAL_SLOTS: MealSlotConfig[] = [
  { slot: 'meal_1', label: 'Breakfast', icon: 'sunny-outline', time_start: '07:00', enabled: true, sort_order: 0 },
  { slot: 'meal_2', label: 'Lunch', icon: 'restaurant-outline', time_start: '12:00', enabled: true, sort_order: 1 },
  { slot: 'meal_3', label: 'Dinner', icon: 'moon-outline', time_start: '18:00', enabled: true, sort_order: 2 },
  { slot: 'meal_4', label: 'Snacks', icon: 'cafe-outline', time_start: '20:00', enabled: true, sort_order: 3 },
  { slot: 'meal_5', label: 'Meal 5', icon: 'nutrition-outline', time_start: '10:00', enabled: false, sort_order: 4 },
  { slot: 'meal_6', label: 'Meal 6', icon: 'nutrition-outline', time_start: '15:00', enabled: false, sort_order: 5 },
  { slot: 'meal_7', label: 'Meal 7', icon: 'nutrition-outline', time_start: '17:00', enabled: false, sort_order: 6 },
  { slot: 'meal_8', label: 'Meal 8', icon: 'nutrition-outline', time_start: '21:00', enabled: false, sort_order: 7 },
];

// Maps legacy meal_type values to default slot IDs
export const LEGACY_MEAL_MAP: Record<string, MealType> = {
  breakfast: 'meal_1',
  lunch: 'meal_2',
  dinner: 'meal_3',
  snack: 'meal_4',
};

// Maps slot IDs back to legacy values for DB storage
export const SLOT_TO_LEGACY: Record<string, string> = {
  meal_1: 'breakfast',
  meal_2: 'lunch',
  meal_3: 'dinner',
  meal_4: 'snack',
};

// Converts a slot ID to a DB-safe meal_type value
export function toDbMealType(slot: MealType): string {
  return SLOT_TO_LEGACY[slot] || slot;
}

// --- Micronutrient metadata ---

export const MICRONUTRIENT_FIELDS = [
  'vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
  'vitamin_b6', 'vitamin_b12', 'folate',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc', 'sodium',
] as const;

export type MicronutrientKey = typeof MICRONUTRIENT_FIELDS[number];

export const MICRONUTRIENT_META: Record<MicronutrientKey, { label: string; unit: string; dv: number }> = {
  vitamin_a: { label: 'Vitamin A', unit: 'mcg', dv: 900 },
  vitamin_c: { label: 'Vitamin C', unit: 'mg', dv: 90 },
  vitamin_d: { label: 'Vitamin D', unit: 'mcg', dv: 20 },
  vitamin_e: { label: 'Vitamin E', unit: 'mg', dv: 15 },
  vitamin_k: { label: 'Vitamin K', unit: 'mcg', dv: 120 },
  vitamin_b6: { label: 'Vitamin B6', unit: 'mg', dv: 1.7 },
  vitamin_b12: { label: 'Vitamin B12', unit: 'mcg', dv: 2.4 },
  folate: { label: 'Folate', unit: 'mcg', dv: 400 },
  calcium: { label: 'Calcium', unit: 'mg', dv: 1300 },
  iron: { label: 'Iron', unit: 'mg', dv: 18 },
  magnesium: { label: 'Magnesium', unit: 'mg', dv: 420 },
  potassium: { label: 'Potassium', unit: 'mg', dv: 4700 },
  zinc: { label: 'Zinc', unit: 'mg', dv: 11 },
  sodium: { label: 'Sodium', unit: 'mg', dv: 2300 },
};

export interface FoodEntryInput {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: MealType;
}

export interface FoodEntry extends FoodEntryInput {
  id: string;
  user_id: string;
  created_at: string;
  brand?: string;
  food_catalog_id?: string;
  serving_size?: number;
  serving_unit?: string;
  quantity?: number;
  fiber?: number;
  sugar?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_e?: number;
  vitamin_k?: number;
  vitamin_b6?: number;
  vitamin_b12?: number;
  folate?: number;
  calcium?: number;
  iron?: number;
  magnesium?: number;
  potassium?: number;
  zinc?: number;
  sodium?: number;
}

export interface FoodCatalogItem {
  id: string;
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  serving_size: number;
  serving_unit: string;
  confidence: 'verified' | 'user_submitted' | 'estimated';
  popularity: number;
  category: string | null;
  user_frequency?: number;
  rank_score?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_e?: number;
  vitamin_k?: number;
  vitamin_b6?: number;
  vitamin_b12?: number;
  folate?: number;
  calcium?: number;
  iron?: number;
  magnesium?: number;
  potassium?: number;
  zinc?: number;
  sodium?: number;
}

export interface FoodEntryInputExtended extends FoodEntryInput {
  brand?: string;
  food_catalog_id?: string;
  serving_size?: number;
  serving_unit?: string;
  quantity?: number;
  fiber?: number;
  sugar?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_e?: number;
  vitamin_k?: number;
  vitamin_b6?: number;
  vitamin_b12?: number;
  folate?: number;
  calcium?: number;
  iron?: number;
  magnesium?: number;
  potassium?: number;
  zinc?: number;
  sodium?: number;
}

export interface FrequentFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: MealType;
  brand?: string;
  food_catalog_id?: string;
  serving_size?: number;
  serving_unit?: string;
  count: number;
}

export interface DailyNutritionSummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  entryCount: number;
}

export interface NutritionGoals {
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
}

const DEFAULT_GOALS: NutritionGoals = {
  calorie_goal: 2000,
  protein_goal: 150,
  carbs_goal: 250,
  fat_goal: 65,
};

// --- In-memory cache ---
const entriesCache = new Map<string, { data: FoodEntry[]; ts: number }>();
let goalsCache: { data: NutritionGoals; ts: number } | null = null;
let mealConfigCache: { data: MealSlotConfig[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function invalidateEntriesCache(date?: string) {
  if (date) entriesCache.delete(date);
  else entriesCache.clear();
}

export function clearFoodCaches() {
  entriesCache.clear();
  goalsCache = null;
  mealConfigCache = null;
}

export async function saveFoodEntry(entry: FoodEntryInput): Promise<FoodEntry | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'meal_1', 'meal_2', 'meal_3', 'meal_4', 'meal_5', 'meal_6', 'meal_7', 'meal_8'];
    const mealType = validMealTypes.includes(entry.meal_type) ? entry.meal_type : 'snack';

    const insertData = {
      user_id: String(user.id),
      name: String(entry.name),
      calories: Number(entry.calories) || 0,
      protein: Number(entry.protein) || 0,
      carbs: Number(entry.carbs) || 0,
      fat: Number(entry.fat) || 0,
      meal_type: toDbMealType(mealType as MealType),
    };

    const { data, error } = await supabase
      .from('food_entries')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    invalidateEntriesCache();
    return data;
  } catch (error: any) {
    console.error('Error saving food entry:', error?.message || error?.code || String(error));
    return null;
  }
}

export async function getFoodEntriesForDate(date: string): Promise<FoodEntry[]> {
  const cached = entriesCache.get(date);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: true });

    if (error) throw error;
    const entries = data || [];
    entriesCache.set(date, { data: entries, ts: Date.now() });
    return entries;
  } catch (error) {
    console.error('Error fetching food entries:', error);
    return [];
  }
}

export async function updateFoodEntry(id: string, updates: { quantity?: number; calories?: number; protein?: number; carbs?: number; fat?: number }): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('food_entries')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    invalidateEntriesCache();
    return true;
  } catch (error) {
    console.error('Error updating food entry:', error);
    return false;
  }
}

export async function deleteFoodEntry(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('food_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
    invalidateEntriesCache();
    return true;
  } catch (error) {
    console.error('Error deleting food entry:', error);
    return false;
  }
}

export async function getDailyNutritionSummary(date: string): Promise<DailyNutritionSummary> {
  const entries = await getFoodEntriesForDate(date);
  return {
    totalCalories: entries.reduce((sum, e) => sum + e.calories, 0),
    totalProtein: entries.reduce((sum, e) => sum + e.protein, 0),
    totalCarbs: entries.reduce((sum, e) => sum + e.carbs, 0),
    totalFat: entries.reduce((sum, e) => sum + e.fat, 0),
    entryCount: entries.length,
  };
}

export async function getNutritionGoals(): Promise<NutritionGoals> {
  if (goalsCache && Date.now() - goalsCache.ts < CACHE_TTL) return goalsCache.data;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_GOALS;

    const { data, error } = await supabase
      .from('nutrition_goals')
      .select('calorie_goal, protein_goal, carbs_goal, fat_goal')
      .eq('user_id', user.id)
      .single();

    if (error || !data) return DEFAULT_GOALS;
    goalsCache = { data, ts: Date.now() };
    return data;
  } catch {
    return DEFAULT_GOALS;
  }
}

export async function getRecentFoods(): Promise<FoodEntryInput[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('food_entries')
      .select('name, calories, protein, carbs, fat, meal_type')
      .eq('user_id', user.id)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    // Deduplicate by name
    const seen = new Set<string>();
    const unique: FoodEntryInput[] = [];
    for (const entry of data || []) {
      const key = entry.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entry);
      }
    }
    return unique;
  } catch (error) {
    console.error('Error fetching recent foods:', error);
    return [];
  }
}

export async function duplicateFoodEntry(entry: FoodEntry): Promise<FoodEntry | null> {
  return saveFoodEntry({
    name: entry.name,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    meal_type: entry.meal_type,
  });
}

export async function getFoodDaysForMonth(year: number, month: number): Promise<{ date: string; calories: number }[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
    const endDate = new Date(year, month, 0); // last day of month
    const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('food_entries')
      .select('calories, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth)
      .lte('created_at', endOfMonth);

    if (error) throw error;

    // Group by date
    const byDate: Record<string, number> = {};
    for (const entry of data || []) {
      const d = new Date(entry.created_at);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDate[dateStr] = (byDate[dateStr] || 0) + entry.calories;
    }

    return Object.entries(byDate).map(([date, calories]) => ({ date, calories }));
  } catch (error) {
    console.error('Error fetching food days:', error);
    return [];
  }
}

export async function saveNutritionGoals(goals: NutritionGoals): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('nutrition_goals')
      .upsert({
        user_id: user.id,
        ...goals,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;
    goalsCache = { data: goals, ts: Date.now() };
    return true;
  } catch (error) {
    console.error('Error saving nutrition goals:', error);
    return false;
  }
}

// --- Food Catalog Functions ---

export function getMealTypeForCurrentTime(slots?: MealSlotConfig[]): MealType {
  if (!slots || slots.length === 0) {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 15) return 'lunch';
    if (hour < 20) return 'dinner';
    return 'snack';
  }

  const enabledSlots = slots.filter((s) => s.enabled).sort((a, b) => a.sort_order - b.sort_order);
  if (enabledSlots.length === 0) return 'meal_1';

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Find the latest slot whose time_start <= now
  let best = enabledSlots[0];
  for (const slot of enabledSlots) {
    const [h, m] = slot.time_start.split(':').map(Number);
    const slotMinutes = (h || 0) * 60 + (m || 0);
    if (slotMinutes <= nowMinutes) {
      best = slot;
    }
  }
  return best.slot;
}

// --- Meal Config CRUD ---

export async function getMealConfig(): Promise<MealSlotConfig[]> {
  if (mealConfigCache && Date.now() - mealConfigCache.ts < CACHE_TTL) return mealConfigCache.data;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_MEAL_SLOTS;

    const { data, error } = await supabase
      .from('meal_config')
      .select('slot, label, icon, time_start, enabled, sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      mealConfigCache = { data: DEFAULT_MEAL_SLOTS, ts: Date.now() };
      return DEFAULT_MEAL_SLOTS;
    }

    const result = data as MealSlotConfig[];
    mealConfigCache = { data: result, ts: Date.now() };
    return result;
  } catch {
    return DEFAULT_MEAL_SLOTS;
  }
}

export async function saveMealConfig(slots: MealSlotConfig[]): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const rows = slots.map((s) => ({
      user_id: user.id,
      slot: s.slot,
      label: s.label,
      icon: s.icon,
      time_start: s.time_start,
      enabled: s.enabled,
      sort_order: s.sort_order,
    }));

    const { error } = await supabase
      .from('meal_config')
      .upsert(rows, { onConflict: 'user_id,slot' });

    if (error) throw error;
    mealConfigCache = { data: slots, ts: Date.now() };
    return true;
  } catch (error) {
    console.error('Error saving meal config:', error);
    return false;
  }
}

export async function searchFoodCatalog(query: string, limit: number = 25): Promise<FoodCatalogItem[]> {
  try {
    if (!query.trim()) return [];

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc('search_food_catalog', {
      search_query: query.trim(),
      user_id_param: user?.id || null,
      result_limit: limit,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching food catalog:', error);
    return [];
  }
}

export async function getFrequentFoods(limit: number = 20): Promise<FrequentFood[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('food_entries')
      .select('name, calories, protein, carbs, fat, meal_type, brand, food_catalog_id, serving_size, serving_unit')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const frequencyMap = new Map<string, FrequentFood>();
    for (const entry of data || []) {
      const key = entry.name.toLowerCase();
      if (frequencyMap.has(key)) {
        frequencyMap.get(key)!.count++;
      } else {
        frequencyMap.set(key, { ...entry, count: 1 });
      }
    }

    return Array.from(frequencyMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching frequent foods:', error);
    return [];
  }
}

export async function getPopularFoods(limit: number = 10): Promise<FoodCatalogItem[]> {
  try {
    const { data, error } = await supabase
      .from('food_catalog')
      .select('*')
      .order('popularity', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching popular foods:', error);
    return [];
  }
}

export async function saveFoodEntryExtended(entry: FoodEntryInputExtended): Promise<FoodEntry | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'meal_1', 'meal_2', 'meal_3', 'meal_4', 'meal_5', 'meal_6', 'meal_7', 'meal_8'];
    const mealType = validMealTypes.includes(entry.meal_type) ? entry.meal_type : 'snack';

    const insertData: Record<string, any> = {
      user_id: String(user.id),
      name: String(entry.name),
      calories: Number(entry.calories) || 0,
      protein: Number(entry.protein) || 0,
      carbs: Number(entry.carbs) || 0,
      fat: Number(entry.fat) || 0,
      meal_type: toDbMealType(mealType as MealType),
      brand: entry.brand ? String(entry.brand) : null,
      food_catalog_id: entry.food_catalog_id ? String(entry.food_catalog_id) : null,
      serving_size: entry.serving_size ? Number(entry.serving_size) : null,
      serving_unit: entry.serving_unit ? String(entry.serving_unit) : null,
      quantity: Number(entry.quantity) || 1,
    };

    // Include fiber, sugar, and micronutrient fields if present
    if (entry.fiber != null) insertData.fiber = Number(entry.fiber);
    if (entry.sugar != null) insertData.sugar = Number(entry.sugar);
    for (const key of MICRONUTRIENT_FIELDS) {
      if (entry[key] != null) insertData[key] = Number(entry[key]);
    }

    const { data, error } = await supabase
      .from('food_entries')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    invalidateEntriesCache();

    if (entry.food_catalog_id) {
      supabase.rpc('increment_food_popularity', { food_id: entry.food_catalog_id }).then(() => {}, () => {});
    }

    return data;
  } catch (error: any) {
    console.error('Error saving food entry:', error?.message || error?.code || String(error));
    return null;
  }
}
