-- ============================================================
-- Food Catalog Migration
-- Adds a global food catalog with fuzzy search, serving info,
-- and confidence scoring. Also extends food_entries with
-- catalog references and serving metadata.
-- ============================================================

-- Enable trigram extension for fuzzy/partial text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. food_catalog table
-- ============================================================
CREATE TABLE IF NOT EXISTS food_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  fiber NUMERIC NOT NULL DEFAULT 0,
  sugar NUMERIC NOT NULL DEFAULT 0,
  serving_size NUMERIC NOT NULL DEFAULT 100,
  serving_unit TEXT NOT NULL DEFAULT 'g',
  confidence TEXT NOT NULL DEFAULT 'verified'
    CHECK (confidence IN ('verified', 'user_submitted', 'estimated')),
  popularity INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE food_catalog ENABLE ROW LEVEL SECURITY;

-- Globally readable, no user mutations
CREATE POLICY "Anyone can view food catalog"
  ON food_catalog FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_food_catalog_name_trgm
  ON food_catalog USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_food_catalog_popularity
  ON food_catalog (popularity DESC);
CREATE INDEX IF NOT EXISTS idx_food_catalog_category
  ON food_catalog (category, popularity DESC);

-- ============================================================
-- 2. Extend food_entries with catalog link + serving info
-- ============================================================
ALTER TABLE food_entries
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS food_catalog_id UUID REFERENCES food_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS serving_size NUMERIC,
  ADD COLUMN IF NOT EXISTS serving_unit TEXT,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 1;

-- ============================================================
-- 3. Ranked search function
-- ============================================================
CREATE OR REPLACE FUNCTION search_food_catalog(
  search_query TEXT,
  user_id_param UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fat NUMERIC,
  fiber NUMERIC,
  sugar NUMERIC,
  serving_size NUMERIC,
  serving_unit TEXT,
  confidence TEXT,
  popularity INTEGER,
  category TEXT,
  user_frequency BIGINT,
  rank_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.name,
    fc.brand,
    fc.calories,
    fc.protein,
    fc.carbs,
    fc.fat,
    fc.fiber,
    fc.sugar,
    fc.serving_size,
    fc.serving_unit,
    fc.confidence,
    fc.popularity,
    fc.category,
    COALESCE(uf.freq, 0)::BIGINT AS user_frequency,
    (
      similarity(fc.name, search_query) * 40
      + COALESCE(uf.freq, 0) * 10
      + CASE fc.confidence
          WHEN 'verified' THEN 10
          WHEN 'user_submitted' THEN 5
          ELSE 0
        END
      + LEAST(fc.popularity::DOUBLE PRECISION / 100.0, 10)
    ) AS rank_score
  FROM food_catalog fc
  LEFT JOIN (
    SELECT fe.name AS food_name, COUNT(*) AS freq
    FROM food_entries fe
    WHERE fe.user_id = user_id_param
    GROUP BY fe.name
  ) uf ON LOWER(uf.food_name) = LOWER(fc.name)
  WHERE fc.name ILIKE '%' || search_query || '%'
     OR similarity(fc.name, search_query) > 0.15
     OR (fc.brand IS NOT NULL AND fc.brand ILIKE '%' || search_query || '%')
  ORDER BY rank_score DESC
  LIMIT result_limit;
END;
$$;

-- ============================================================
-- 4. Popularity increment helper
-- ============================================================
CREATE OR REPLACE FUNCTION increment_food_popularity(food_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE food_catalog SET popularity = popularity + 1 WHERE id = food_id;
$$;

-- ============================================================
-- 5. Seed data: 200+ common foods
-- ============================================================
INSERT INTO food_catalog (name, brand, calories, protein, carbs, fat, fiber, sugar, serving_size, serving_unit, confidence, popularity, category) VALUES
-- PROTEINS
('Chicken Breast', NULL, 165, 31, 0, 3.6, 0, 0, 100, 'g', 'verified', 500, 'protein'),
('Chicken Thigh', NULL, 209, 26, 0, 10.9, 0, 0, 100, 'g', 'verified', 350, 'protein'),
('Chicken Wings', NULL, 203, 30, 0, 8.1, 0, 0, 100, 'g', 'verified', 250, 'protein'),
('Chicken Drumstick', NULL, 172, 28, 0, 5.7, 0, 0, 100, 'g', 'verified', 200, 'protein'),
('Ground Beef (85% lean)', NULL, 215, 26, 0, 11.7, 0, 0, 100, 'g', 'verified', 400, 'protein'),
('Ground Beef (93% lean)', NULL, 172, 26, 0, 7.2, 0, 0, 100, 'g', 'verified', 300, 'protein'),
('Steak (Sirloin)', NULL, 183, 28, 0, 7.3, 0, 0, 100, 'g', 'verified', 350, 'protein'),
('Steak (Ribeye)', NULL, 291, 24, 0, 21, 0, 0, 100, 'g', 'verified', 300, 'protein'),
('Salmon Fillet', NULL, 208, 20, 0, 13, 0, 0, 100, 'g', 'verified', 350, 'protein'),
('Tuna (canned in water)', NULL, 116, 26, 0, 0.8, 0, 0, 100, 'g', 'verified', 300, 'protein'),
('Shrimp', NULL, 85, 20, 0.2, 0.5, 0, 0, 100, 'g', 'verified', 250, 'protein'),
('Cod', NULL, 82, 18, 0, 0.7, 0, 0, 100, 'g', 'verified', 180, 'protein'),
('Tilapia', NULL, 96, 20, 0, 1.7, 0, 0, 100, 'g', 'verified', 200, 'protein'),
('Pork Loin', NULL, 143, 26, 0, 3.5, 0, 0, 100, 'g', 'verified', 200, 'protein'),
('Pork Chop', NULL, 231, 25, 0, 14, 0, 0, 100, 'g', 'verified', 180, 'protein'),
('Turkey Breast', NULL, 135, 30, 0, 0.7, 0, 0, 100, 'g', 'verified', 250, 'protein'),
('Ground Turkey', NULL, 170, 21, 0, 9.4, 0, 0, 100, 'g', 'verified', 200, 'protein'),
('Bacon', NULL, 541, 37, 1.4, 42, 0, 0, 100, 'g', 'verified', 300, 'protein'),
('Eggs (large)', NULL, 72, 6, 0.4, 5, 0, 0.2, 1, 'piece', 'verified', 600, 'protein'),
('Egg Whites', NULL, 17, 3.6, 0.2, 0.1, 0, 0.2, 1, 'piece', 'verified', 300, 'protein'),
('Tofu (firm)', NULL, 144, 17, 3, 8, 2, 0, 100, 'g', 'verified', 200, 'protein'),
('Tempeh', NULL, 192, 20, 8, 11, 0, 0, 100, 'g', 'verified', 150, 'protein'),
('Lamb Chop', NULL, 258, 25, 0, 17, 0, 0, 100, 'g', 'verified', 150, 'protein'),
('Bison (ground)', NULL, 146, 20, 0, 7, 0, 0, 100, 'g', 'verified', 100, 'protein'),

-- DAIRY
('Whole Milk', NULL, 61, 3.2, 4.8, 3.3, 0, 5, 100, 'ml', 'verified', 400, 'dairy'),
('Skim Milk', NULL, 34, 3.4, 5, 0.1, 0, 5, 100, 'ml', 'verified', 300, 'dairy'),
('2% Milk', NULL, 50, 3.3, 4.8, 2, 0, 5, 100, 'ml', 'verified', 350, 'dairy'),
('Greek Yogurt (plain, nonfat)', NULL, 59, 10, 3.6, 0.4, 0, 3.2, 100, 'g', 'verified', 450, 'dairy'),
('Greek Yogurt (plain, whole)', NULL, 97, 9, 3.5, 5, 0, 3.5, 100, 'g', 'verified', 350, 'dairy'),
('Regular Yogurt (plain)', NULL, 61, 3.5, 4.7, 3.3, 0, 4.7, 100, 'g', 'verified', 200, 'dairy'),
('Cheddar Cheese', NULL, 403, 25, 1.3, 33, 0, 0.5, 100, 'g', 'verified', 350, 'dairy'),
('Mozzarella Cheese', NULL, 280, 28, 3.1, 17, 0, 1, 100, 'g', 'verified', 300, 'dairy'),
('Parmesan Cheese', NULL, 431, 38, 4.1, 29, 0, 0.9, 100, 'g', 'verified', 200, 'dairy'),
('Cottage Cheese (2%)', NULL, 81, 12, 3.4, 2.3, 0, 3, 100, 'g', 'verified', 300, 'dairy'),
('Cream Cheese', NULL, 342, 6, 4.1, 34, 0, 3.8, 100, 'g', 'verified', 200, 'dairy'),
('Butter', NULL, 102, 0.1, 0, 11.5, 0, 0, 1, 'tbsp', 'verified', 300, 'dairy'),
('Heavy Cream', NULL, 340, 2.1, 2.8, 36, 0, 0, 100, 'ml', 'verified', 150, 'dairy'),
('Whey Protein Powder', NULL, 120, 24, 3, 1.5, 0, 1, 1, 'scoop', 'verified', 500, 'dairy'),

-- GRAINS & CARBS
('White Rice (cooked)', NULL, 130, 2.7, 28, 0.3, 0.4, 0, 100, 'g', 'verified', 500, 'grain'),
('Brown Rice (cooked)', NULL, 112, 2.3, 24, 0.8, 1.8, 0, 100, 'g', 'verified', 400, 'grain'),
('Oats (dry)', NULL, 379, 13, 67, 7, 10, 1, 100, 'g', 'verified', 450, 'grain'),
('Oatmeal (cooked)', NULL, 71, 2.5, 12, 1.5, 1.7, 0.3, 100, 'g', 'verified', 400, 'grain'),
('White Bread', NULL, 75, 2.7, 14, 1, 0.6, 1.5, 1, 'slice', 'verified', 350, 'grain'),
('Whole Wheat Bread', NULL, 81, 4, 14, 1.1, 1.9, 1.4, 1, 'slice', 'verified', 350, 'grain'),
('Pasta (cooked)', NULL, 131, 5, 25, 1.1, 1.8, 0.6, 100, 'g', 'verified', 400, 'grain'),
('Whole Wheat Pasta (cooked)', NULL, 124, 5.3, 25, 0.5, 3.2, 0.6, 100, 'g', 'verified', 250, 'grain'),
('Quinoa (cooked)', NULL, 120, 4.4, 21, 1.9, 2.8, 0.9, 100, 'g', 'verified', 300, 'grain'),
('Tortilla (flour, large)', NULL, 290, 7, 48, 7, 2, 2, 1, 'piece', 'verified', 300, 'grain'),
('Tortilla (corn)', NULL, 52, 1.4, 11, 0.7, 1.5, 0.2, 1, 'piece', 'verified', 200, 'grain'),
('Bagel (plain)', NULL, 270, 10, 53, 1.5, 2, 6, 1, 'piece', 'verified', 250, 'grain'),
('English Muffin', NULL, 134, 4.4, 26, 1, 1.5, 2, 1, 'piece', 'verified', 200, 'grain'),
('Pancake', NULL, 86, 2.4, 11, 3.7, 0.4, 3, 1, 'piece', 'verified', 200, 'grain'),
('Waffle', NULL, 82, 2.1, 10, 3.7, 0.4, 1.5, 1, 'piece', 'verified', 180, 'grain'),
('Granola', NULL, 471, 10, 64, 20, 5, 25, 100, 'g', 'verified', 250, 'grain'),
('Cereal (corn flakes)', NULL, 357, 7, 84, 0.4, 3, 8, 100, 'g', 'verified', 200, 'grain'),
('Couscous (cooked)', NULL, 112, 3.8, 23, 0.2, 1.4, 0.1, 100, 'g', 'verified', 150, 'grain'),
('Naan Bread', NULL, 262, 9, 45, 5, 2, 3, 1, 'piece', 'verified', 200, 'grain'),
('Pita Bread', NULL, 165, 5.5, 33, 1.2, 1.3, 0.7, 1, 'piece', 'verified', 200, 'grain'),
('Croissant', NULL, 406, 8, 46, 21, 2.4, 7, 1, 'piece', 'verified', 200, 'grain'),
('Rice Cakes', NULL, 35, 0.7, 7.3, 0.3, 0.4, 0, 1, 'piece', 'verified', 200, 'grain'),
('Potato (baked)', NULL, 93, 2.5, 21, 0.1, 2.2, 1.2, 100, 'g', 'verified', 350, 'grain'),
('Sweet Potato (baked)', NULL, 90, 2, 21, 0.1, 3.3, 6.5, 100, 'g', 'verified', 350, 'grain'),

-- FRUITS
('Apple', NULL, 52, 0.3, 14, 0.2, 2.4, 10, 100, 'g', 'verified', 400, 'fruit'),
('Banana', NULL, 89, 1.1, 23, 0.3, 2.6, 12, 100, 'g', 'verified', 500, 'fruit'),
('Orange', NULL, 47, 0.9, 12, 0.1, 2.4, 9, 100, 'g', 'verified', 350, 'fruit'),
('Strawberries', NULL, 32, 0.7, 7.7, 0.3, 2, 4.9, 100, 'g', 'verified', 300, 'fruit'),
('Blueberries', NULL, 57, 0.7, 14, 0.3, 2.4, 10, 100, 'g', 'verified', 300, 'fruit'),
('Raspberries', NULL, 52, 1.2, 12, 0.7, 6.5, 4.4, 100, 'g', 'verified', 200, 'fruit'),
('Grapes', NULL, 69, 0.7, 18, 0.2, 0.9, 16, 100, 'g', 'verified', 250, 'fruit'),
('Watermelon', NULL, 30, 0.6, 7.6, 0.2, 0.4, 6.2, 100, 'g', 'verified', 250, 'fruit'),
('Mango', NULL, 60, 0.8, 15, 0.4, 1.6, 14, 100, 'g', 'verified', 250, 'fruit'),
('Pineapple', NULL, 50, 0.5, 13, 0.1, 1.4, 10, 100, 'g', 'verified', 200, 'fruit'),
('Avocado', NULL, 160, 2, 8.5, 15, 6.7, 0.7, 100, 'g', 'verified', 450, 'fruit'),
('Peach', NULL, 39, 0.9, 10, 0.3, 1.5, 8.4, 100, 'g', 'verified', 150, 'fruit'),
('Pear', NULL, 57, 0.4, 15, 0.1, 3.1, 10, 100, 'g', 'verified', 150, 'fruit'),
('Kiwi', NULL, 61, 1.1, 15, 0.5, 3, 9, 100, 'g', 'verified', 200, 'fruit'),
('Cherries', NULL, 50, 1, 12, 0.3, 1.6, 8, 100, 'g', 'verified', 150, 'fruit'),
('Grapefruit', NULL, 42, 0.8, 11, 0.1, 1.6, 7, 100, 'g', 'verified', 150, 'fruit'),
('Cantaloupe', NULL, 34, 0.8, 8.2, 0.2, 0.9, 7.9, 100, 'g', 'verified', 150, 'fruit'),
('Dried Dates', NULL, 277, 1.8, 75, 0.2, 6.7, 66, 100, 'g', 'verified', 200, 'fruit'),
('Raisins', NULL, 299, 3.1, 79, 0.5, 3.7, 59, 100, 'g', 'verified', 200, 'fruit'),
('Coconut (fresh)', NULL, 354, 3.3, 15, 33, 9, 6.2, 100, 'g', 'verified', 100, 'fruit'),
('Lemon', NULL, 29, 1.1, 9, 0.3, 2.8, 2.5, 100, 'g', 'verified', 100, 'fruit'),
('Pomegranate', NULL, 83, 1.7, 19, 1.2, 4, 14, 100, 'g', 'verified', 150, 'fruit'),
('Passion Fruit', NULL, 97, 2.2, 23, 0.7, 10, 11, 100, 'g', 'verified', 100, 'fruit'),
('Frozen Mixed Berries', NULL, 48, 0.7, 11, 0.3, 3, 7, 100, 'g', 'verified', 200, 'fruit'),

-- VEGETABLES
('Broccoli', NULL, 34, 2.8, 7, 0.4, 2.6, 1.7, 100, 'g', 'verified', 350, 'vegetable'),
('Spinach (raw)', NULL, 23, 2.9, 3.6, 0.4, 2.2, 0.4, 100, 'g', 'verified', 350, 'vegetable'),
('Kale', NULL, 49, 4.3, 9, 0.9, 3.6, 2.3, 100, 'g', 'verified', 200, 'vegetable'),
('Carrots', NULL, 41, 0.9, 10, 0.2, 2.8, 4.7, 100, 'g', 'verified', 300, 'vegetable'),
('Tomato', NULL, 18, 0.9, 3.9, 0.2, 1.2, 2.6, 100, 'g', 'verified', 300, 'vegetable'),
('Bell Pepper', NULL, 31, 1, 6, 0.3, 2.1, 4.2, 100, 'g', 'verified', 250, 'vegetable'),
('Cucumber', NULL, 16, 0.7, 3.6, 0.1, 0.5, 1.7, 100, 'g', 'verified', 250, 'vegetable'),
('Onion', NULL, 40, 1.1, 9, 0.1, 1.7, 4.2, 100, 'g', 'verified', 300, 'vegetable'),
('Mushrooms', NULL, 22, 3.1, 3.3, 0.3, 1, 2, 100, 'g', 'verified', 250, 'vegetable'),
('Zucchini', NULL, 17, 1.2, 3.1, 0.3, 1, 2.5, 100, 'g', 'verified', 200, 'vegetable'),
('Cauliflower', NULL, 25, 1.9, 5, 0.3, 2, 1.9, 100, 'g', 'verified', 250, 'vegetable'),
('Green Beans', NULL, 31, 1.8, 7, 0.1, 3.4, 3.3, 100, 'g', 'verified', 200, 'vegetable'),
('Asparagus', NULL, 20, 2.2, 3.9, 0.1, 2.1, 1.9, 100, 'g', 'verified', 200, 'vegetable'),
('Corn (sweet)', NULL, 86, 3.3, 19, 1.4, 2.7, 6.3, 100, 'g', 'verified', 250, 'vegetable'),
('Lettuce (romaine)', NULL, 17, 1.2, 3.3, 0.3, 2.1, 1.2, 100, 'g', 'verified', 200, 'vegetable'),
('Celery', NULL, 14, 0.7, 3, 0.2, 1.6, 1.3, 100, 'g', 'verified', 150, 'vegetable'),
('Peas', NULL, 81, 5.4, 14, 0.4, 5.7, 5.7, 100, 'g', 'verified', 200, 'vegetable'),
('Brussels Sprouts', NULL, 43, 3.4, 9, 0.3, 3.8, 2.2, 100, 'g', 'verified', 150, 'vegetable'),
('Cabbage', NULL, 25, 1.3, 5.8, 0.1, 2.5, 3.2, 100, 'g', 'verified', 150, 'vegetable'),
('Eggplant', NULL, 25, 1, 6, 0.2, 3, 3.5, 100, 'g', 'verified', 150, 'vegetable'),
('Beets', NULL, 43, 1.6, 10, 0.2, 2.8, 6.8, 100, 'g', 'verified', 100, 'vegetable'),
('Radish', NULL, 16, 0.7, 3.4, 0.1, 1.6, 1.9, 100, 'g', 'verified', 100, 'vegetable'),
('Artichoke', NULL, 47, 3.3, 11, 0.2, 5.4, 1, 100, 'g', 'verified', 100, 'vegetable'),
('Mixed Salad Greens', NULL, 20, 1.5, 3.5, 0.3, 1.8, 0.8, 100, 'g', 'verified', 200, 'vegetable'),

-- LEGUMES
('Black Beans (cooked)', NULL, 132, 8.9, 24, 0.5, 8.7, 0.3, 100, 'g', 'verified', 250, 'legume'),
('Lentils (cooked)', NULL, 116, 9, 20, 0.4, 7.9, 1.8, 100, 'g', 'verified', 250, 'legume'),
('Chickpeas (cooked)', NULL, 164, 8.9, 27, 2.6, 7.6, 4.8, 100, 'g', 'verified', 300, 'legume'),
('Kidney Beans (cooked)', NULL, 127, 8.7, 23, 0.5, 6.4, 2, 100, 'g', 'verified', 200, 'legume'),
('Pinto Beans (cooked)', NULL, 143, 9, 26, 0.7, 9, 0.3, 100, 'g', 'verified', 150, 'legume'),
('Edamame', NULL, 122, 11, 9, 5.2, 5.2, 2.2, 100, 'g', 'verified', 200, 'legume'),
('Hummus', NULL, 166, 8, 14, 10, 6, 0.3, 100, 'g', 'verified', 300, 'legume'),
('Refried Beans', NULL, 101, 5.4, 16, 1.6, 5, 0.5, 100, 'g', 'verified', 150, 'legume'),
('Baked Beans', NULL, 155, 5.5, 27, 2, 5, 11, 100, 'g', 'verified', 150, 'legume'),
('Soybeans (cooked)', NULL, 173, 17, 10, 9, 6, 3, 100, 'g', 'verified', 100, 'legume'),

-- FATS & OILS
('Olive Oil', NULL, 119, 0, 0, 13.5, 0, 0, 1, 'tbsp', 'verified', 350, 'fat_oil'),
('Coconut Oil', NULL, 121, 0, 0, 13.5, 0, 0, 1, 'tbsp', 'verified', 200, 'fat_oil'),
('Peanut Butter', NULL, 94, 4, 3.5, 8, 0.8, 1.5, 1, 'tbsp', 'verified', 400, 'fat_oil'),
('Almond Butter', NULL, 98, 3.4, 3, 9, 1.6, 1, 1, 'tbsp', 'verified', 250, 'fat_oil'),
('Mayonnaise', NULL, 94, 0.1, 0.1, 10, 0, 0.1, 1, 'tbsp', 'verified', 200, 'fat_oil'),
('Almonds', NULL, 579, 21, 22, 50, 12, 4.4, 100, 'g', 'verified', 300, 'fat_oil'),
('Walnuts', NULL, 654, 15, 14, 65, 6.7, 2.6, 100, 'g', 'verified', 200, 'fat_oil'),
('Cashews', NULL, 553, 18, 30, 44, 3.3, 5.9, 100, 'g', 'verified', 200, 'fat_oil'),
('Peanuts', NULL, 567, 26, 16, 49, 8.5, 4, 100, 'g', 'verified', 250, 'fat_oil'),
('Mixed Nuts', NULL, 607, 20, 21, 54, 7, 4, 100, 'g', 'verified', 250, 'fat_oil'),
('Sunflower Seeds', NULL, 584, 21, 20, 51, 8.6, 2.6, 100, 'g', 'verified', 150, 'fat_oil'),
('Chia Seeds', NULL, 486, 17, 42, 31, 34, 0, 100, 'g', 'verified', 250, 'fat_oil'),
('Flax Seeds', NULL, 534, 18, 29, 42, 27, 1.6, 100, 'g', 'verified', 150, 'fat_oil'),

-- SNACKS
('Protein Bar', NULL, 210, 20, 22, 7, 3, 6, 1, 'piece', 'verified', 400, 'snack'),
('Dark Chocolate (70%)', NULL, 598, 8, 46, 43, 11, 24, 100, 'g', 'verified', 250, 'snack'),
('Milk Chocolate', NULL, 535, 8, 60, 30, 3, 52, 100, 'g', 'verified', 200, 'snack'),
('Popcorn (air-popped)', NULL, 375, 12, 74, 4.3, 15, 0.9, 100, 'g', 'verified', 200, 'snack'),
('Potato Chips', NULL, 536, 7, 53, 35, 4.4, 0.3, 100, 'g', 'verified', 250, 'snack'),
('Tortilla Chips', NULL, 489, 7, 63, 24, 4.3, 0.7, 100, 'g', 'verified', 200, 'snack'),
('Pretzels', NULL, 380, 10, 80, 3.5, 3, 2.8, 100, 'g', 'verified', 150, 'snack'),
('Granola Bar', NULL, 193, 4, 29, 7, 2, 12, 1, 'piece', 'verified', 250, 'snack'),
('Trail Mix', NULL, 462, 14, 44, 28, 4, 26, 100, 'g', 'verified', 200, 'snack'),
('Beef Jerky', NULL, 116, 9.4, 3.1, 7.3, 0.5, 2.5, 1, 'oz', 'verified', 200, 'snack'),
('Crackers (saltine)', NULL, 421, 9, 74, 9, 3, 3, 100, 'g', 'verified', 150, 'snack'),
('Cheese Stick (string)', NULL, 80, 7, 1, 5, 0, 0, 1, 'piece', 'verified', 200, 'snack'),

-- DRINKS
('Coffee (black)', NULL, 2, 0.3, 0, 0, 0, 0, 240, 'ml', 'verified', 500, 'drink'),
('Latte (whole milk)', NULL, 150, 8, 12, 8, 0, 12, 1, 'cup', 'verified', 350, 'drink'),
('Cappuccino', NULL, 80, 4, 6, 4, 0, 6, 1, 'cup', 'verified', 250, 'drink'),
('Orange Juice', NULL, 45, 0.7, 10, 0.2, 0.2, 8.4, 100, 'ml', 'verified', 300, 'drink'),
('Apple Juice', NULL, 46, 0.1, 11, 0.1, 0.1, 10, 100, 'ml', 'verified', 200, 'drink'),
('Coca-Cola', 'Coca-Cola', 42, 0, 11, 0, 0, 11, 100, 'ml', 'verified', 300, 'drink'),
('Coca-Cola Zero', 'Coca-Cola', 0, 0, 0, 0, 0, 0, 100, 'ml', 'verified', 250, 'drink'),
('Beer (regular)', NULL, 43, 0.5, 3.6, 0, 0, 0, 100, 'ml', 'verified', 200, 'drink'),
('Red Wine', NULL, 85, 0.1, 2.6, 0, 0, 0.6, 150, 'ml', 'verified', 200, 'drink'),
('White Wine', NULL, 82, 0.1, 2.6, 0, 0, 1, 150, 'ml', 'verified', 150, 'drink'),
('Protein Shake (whey + water)', NULL, 130, 25, 4, 1.5, 0, 2, 1, 'cup', 'verified', 400, 'drink'),
('Smoothie (fruit)', NULL, 68, 1, 16, 0.3, 1.5, 12, 100, 'ml', 'estimated', 250, 'drink'),
('Coconut Water', NULL, 19, 0.7, 3.7, 0.2, 1.1, 2.6, 100, 'ml', 'verified', 150, 'drink'),
('Hot Chocolate', NULL, 77, 3.5, 10, 2.5, 1, 8, 100, 'ml', 'verified', 150, 'drink'),
('Green Tea', NULL, 1, 0, 0.2, 0, 0, 0, 240, 'ml', 'verified', 200, 'drink'),
('Energy Drink', 'Monster', 45, 0, 11, 0, 0, 11, 100, 'ml', 'verified', 200, 'drink'),

-- CONDIMENTS & SAUCES
('Ketchup', NULL, 15, 0.1, 3.7, 0, 0, 3.2, 1, 'tbsp', 'verified', 250, 'condiment'),
('Mustard', NULL, 3, 0.2, 0.3, 0.2, 0.1, 0.1, 1, 'tbsp', 'verified', 200, 'condiment'),
('Soy Sauce', NULL, 9, 0.8, 1, 0, 0.1, 0.4, 1, 'tbsp', 'verified', 250, 'condiment'),
('Hot Sauce', NULL, 1, 0.1, 0.1, 0, 0.1, 0.1, 1, 'tsp', 'verified', 200, 'condiment'),
('BBQ Sauce', NULL, 29, 0.1, 7, 0.1, 0.1, 5.7, 1, 'tbsp', 'verified', 200, 'condiment'),
('Ranch Dressing', NULL, 73, 0.1, 1, 7.7, 0, 0.7, 1, 'tbsp', 'verified', 200, 'condiment'),
('Honey', NULL, 64, 0.1, 17, 0, 0, 17, 1, 'tbsp', 'verified', 250, 'condiment'),
('Maple Syrup', NULL, 52, 0, 13, 0, 0, 12, 1, 'tbsp', 'verified', 200, 'condiment'),
('Salsa', NULL, 36, 2, 7, 0.2, 2, 4, 100, 'g', 'verified', 200, 'condiment'),
('Guacamole', NULL, 160, 2, 9, 15, 7, 0.7, 100, 'g', 'verified', 200, 'condiment'),
('Jam / Jelly', NULL, 56, 0.1, 14, 0, 0.2, 10, 1, 'tbsp', 'verified', 150, 'condiment'),
('Teriyaki Sauce', NULL, 16, 1, 3, 0, 0, 2.5, 1, 'tbsp', 'verified', 150, 'condiment'),

-- COMMON MEALS / PREPARED FOODS
('Pizza Slice (cheese)', NULL, 266, 11, 33, 10, 2, 3.6, 1, 'slice', 'verified', 400, 'meal'),
('Pizza Slice (pepperoni)', NULL, 298, 13, 34, 13, 2, 3.8, 1, 'slice', 'verified', 350, 'meal'),
('Hamburger (single patty)', NULL, 354, 20, 29, 17, 1, 5, 1, 'piece', 'verified', 350, 'meal'),
('Cheeseburger', NULL, 400, 22, 30, 21, 1, 6, 1, 'piece', 'verified', 350, 'meal'),
('Burrito (chicken)', NULL, 450, 25, 50, 15, 5, 3, 1, 'piece', 'estimated', 300, 'meal'),
('Burrito (beef)', NULL, 500, 22, 52, 20, 5, 3, 1, 'piece', 'estimated', 250, 'meal'),
('Taco (beef)', NULL, 210, 10, 21, 10, 2, 1, 1, 'piece', 'verified', 250, 'meal'),
('Chicken Wrap', NULL, 380, 24, 35, 14, 3, 2, 1, 'piece', 'estimated', 200, 'meal'),
('Sushi Roll (California)', NULL, 255, 9, 38, 7, 3.6, 5, 1, 'piece', 'verified', 250, 'meal'),
('Sushi Roll (Salmon)', NULL, 304, 13, 42, 8, 2, 6, 1, 'piece', 'verified', 200, 'meal'),
('Fried Rice', NULL, 163, 4.3, 20, 7, 1, 0.5, 100, 'g', 'verified', 300, 'meal'),
('Caesar Salad', NULL, 180, 8, 12, 12, 2, 2, 100, 'g', 'estimated', 200, 'meal'),
('Grilled Cheese Sandwich', NULL, 366, 14, 28, 22, 1, 4, 1, 'piece', 'verified', 200, 'meal'),
('Mac and Cheese', NULL, 164, 7, 17, 7, 1, 3, 100, 'g', 'verified', 250, 'meal'),
('French Fries', NULL, 312, 3.4, 41, 15, 3.8, 0.3, 100, 'g', 'verified', 350, 'meal'),
('Chicken Nuggets', NULL, 296, 15, 18, 18, 1, 0.5, 100, 'g', 'verified', 300, 'meal'),
('Hot Dog', NULL, 290, 10, 24, 17, 1, 4, 1, 'piece', 'verified', 200, 'meal'),
('Ramen (instant)', NULL, 188, 4.6, 27, 7, 0.9, 0.7, 100, 'g', 'verified', 250, 'meal'),
('Chicken Stir Fry', NULL, 135, 14, 10, 5, 2, 3, 100, 'g', 'estimated', 200, 'meal'),
('Pad Thai', NULL, 192, 8, 24, 7, 1, 5, 100, 'g', 'estimated', 200, 'meal'),
('Fried Egg', NULL, 90, 6.3, 0.4, 7, 0, 0.2, 1, 'piece', 'verified', 400, 'meal'),
('Scrambled Eggs (2)', NULL, 182, 12, 2, 14, 0, 1, 1, 'piece', 'verified', 350, 'meal'),
('Omelette (2 egg, cheese)', NULL, 250, 16, 2, 20, 0, 1, 1, 'piece', 'estimated', 250, 'meal'),
('BLT Sandwich', NULL, 344, 12, 30, 20, 2, 4, 1, 'piece', 'verified', 200, 'meal'),
('Chicken Caesar Wrap', NULL, 410, 28, 34, 18, 3, 2, 1, 'piece', 'estimated', 200, 'meal'),
('Fish and Chips', NULL, 320, 16, 28, 16, 2, 1, 100, 'g', 'estimated', 200, 'meal'),
('Soup (chicken noodle)', NULL, 62, 3.2, 7, 2.4, 0.5, 0.8, 100, 'g', 'verified', 200, 'meal'),
('Soup (tomato)', NULL, 74, 1.2, 12, 2.4, 1.4, 7, 100, 'g', 'verified', 200, 'meal'),
('Meatballs', NULL, 194, 14, 7, 12, 0.5, 1.5, 100, 'g', 'verified', 200, 'meal'),
('Lasagna', NULL, 135, 8, 13, 5, 1, 3, 100, 'g', 'estimated', 200, 'meal'),

-- BRANDED / RESTAURANT (common items)
('Big Mac', 'McDonald''s', 550, 25, 45, 30, 3, 9, 1, 'piece', 'verified', 350, 'meal'),
('Quarter Pounder w/ Cheese', 'McDonald''s', 520, 30, 42, 26, 2, 10, 1, 'piece', 'verified', 300, 'meal'),
('Chicken McNuggets (6pc)', 'McDonald''s', 250, 15, 15, 15, 1, 0, 1, 'piece', 'verified', 300, 'meal'),
('McChicken', 'McDonald''s', 400, 14, 40, 21, 2, 5, 1, 'piece', 'verified', 250, 'meal'),
('Egg McMuffin', 'McDonald''s', 300, 17, 30, 12, 2, 3, 1, 'piece', 'verified', 250, 'meal'),
('Whopper', 'Burger King', 657, 28, 49, 40, 2, 11, 1, 'piece', 'verified', 250, 'meal'),
('Chicken Sandwich', 'Chick-fil-A', 440, 28, 40, 19, 1, 6, 1, 'piece', 'verified', 250, 'meal'),
('Footlong Sub (Turkey)', 'Subway', 560, 28, 82, 10, 6, 10, 1, 'piece', 'verified', 200, 'meal'),
('Footlong Sub (Italian BMT)', 'Subway', 760, 34, 84, 30, 6, 10, 1, 'piece', 'verified', 200, 'meal'),
('Crunchy Taco', 'Taco Bell', 170, 8, 13, 10, 3, 1, 1, 'piece', 'verified', 200, 'meal'),
('Burrito Bowl (chicken)', 'Chipotle', 665, 40, 56, 30, 10, 5, 1, 'piece', 'estimated', 250, 'meal');
