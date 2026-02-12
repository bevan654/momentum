-- Add micronutrient columns to food_catalog
ALTER TABLE food_catalog
  ADD COLUMN IF NOT EXISTS vitamin_a real,
  ADD COLUMN IF NOT EXISTS vitamin_c real,
  ADD COLUMN IF NOT EXISTS vitamin_d real,
  ADD COLUMN IF NOT EXISTS vitamin_e real,
  ADD COLUMN IF NOT EXISTS vitamin_k real,
  ADD COLUMN IF NOT EXISTS vitamin_b6 real,
  ADD COLUMN IF NOT EXISTS vitamin_b12 real,
  ADD COLUMN IF NOT EXISTS folate real,
  ADD COLUMN IF NOT EXISTS calcium real,
  ADD COLUMN IF NOT EXISTS iron real,
  ADD COLUMN IF NOT EXISTS magnesium real,
  ADD COLUMN IF NOT EXISTS potassium real,
  ADD COLUMN IF NOT EXISTS zinc real,
  ADD COLUMN IF NOT EXISTS sodium real;

-- Add micronutrient columns to food_entries (includes fiber + sugar + 14 micros)
ALTER TABLE food_entries
  ADD COLUMN IF NOT EXISTS fiber real,
  ADD COLUMN IF NOT EXISTS sugar real,
  ADD COLUMN IF NOT EXISTS vitamin_a real,
  ADD COLUMN IF NOT EXISTS vitamin_c real,
  ADD COLUMN IF NOT EXISTS vitamin_d real,
  ADD COLUMN IF NOT EXISTS vitamin_e real,
  ADD COLUMN IF NOT EXISTS vitamin_k real,
  ADD COLUMN IF NOT EXISTS vitamin_b6 real,
  ADD COLUMN IF NOT EXISTS vitamin_b12 real,
  ADD COLUMN IF NOT EXISTS folate real,
  ADD COLUMN IF NOT EXISTS calcium real,
  ADD COLUMN IF NOT EXISTS iron real,
  ADD COLUMN IF NOT EXISTS magnesium real,
  ADD COLUMN IF NOT EXISTS potassium real,
  ADD COLUMN IF NOT EXISTS zinc real,
  ADD COLUMN IF NOT EXISTS sodium real;
