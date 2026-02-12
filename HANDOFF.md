# Momentum - Fitness App Handoff Document

**Last updated:** 2026-02-08
**Tech stack:** Expo (React Native) + Supabase + TypeScript
**Package:** `com.momentum.fitnessapp`

---

## Quick Start

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

---

## App Overview

Momentum is a comprehensive fitness tracking app with 5 main tabs: **Home**, **Workout**, **Quick Add (+)**, **Food**, and **Friends**.

---

## Architecture

### Entry Point
- `index.ts` → registers `App.tsx`
- `App.tsx` is the monolithic main file (~37k tokens) containing all navigation, screens, state, and modals

### State Management
- React `useState`/`useEffect` hooks throughout (no Redux/Context)
- All database modules implement in-memory TTL caches (2-5 min)
- Optimistic UI updates for supplements

### Auth Flow
- Supabase email/password auth (`components/Auth.tsx`)
- 3-step signup: Account → Body stats → Nutrition goals
- Profile auto-created via Supabase DB trigger

### Backend
- **Supabase** for everything: auth, database (Postgres), realtime presence
- Client initialized in `supabase.ts`

---

## Features & Where to Find Them

| Feature | Primary File(s) | Database Module |
|---------|-----------------|-----------------|
| Workout tracking | `App.tsx` (modal), `components/WorkoutStartPage.tsx` | `database.ts` |
| Food logging | `components/FoodLogger.tsx` | `foodDatabase.ts` |
| Supplement tracking | `App.tsx` (home tab) | `supplementDatabase.ts` |
| Weight tracking | `App.tsx` + `components/WeightHistoryModal.tsx` | `weightDatabase.ts` |
| Streaks | `App.tsx` (header) | `streakDatabase.ts` |
| Routines | `components/WorkoutStartPage.tsx` | `routineDatabase.ts` |
| Calendar | `components/Calendar.tsx` | `database.ts` |
| Friends/Social | `components/friends/FriendsTab.tsx` + sub-components | `friendsDatabase.ts` |
| Leaderboards | `components/friends/Leaderboards.tsx` | `friendsDatabase.ts` |
| Notifications | `components/friends/NotificationList.tsx` | `friendsDatabase.ts` |
| Live presence | `presenceManager.ts` | Supabase Realtime |
| Exercise catalog | `exerciseDatabase.ts` | `exerciseDatabase.ts` |
| Muscle heat map | `components/MuscleVolumeChart.tsx`, `components/BodyGraph.tsx` | `muscleMapping.ts` |

---

## File Structure (Non-node_modules)

```
/
├── App.tsx                          # Main app (all tabs, modals, state)
├── index.ts                         # Expo entry point
├── supabase.ts                      # Supabase client init
├── package.json                     # Dependencies
├── app.json                         # Expo config
├── eas.json                         # EAS Build config
├── metro.config.js                  # Metro bundler config
├── tsconfig.json                    # TypeScript config
│
├── # Database Modules
├── database.ts                      # Workouts CRUD, stats, 14-day summary
├── foodDatabase.ts                  # Food entries, catalog search, nutrition goals
├── supplementDatabase.ts            # Water/creatine tracking & goals
├── weightDatabase.ts                # Weight entries, EMA trend calculation
├── friendsDatabase.ts               # Social: friends, reactions, leaderboards, notifications
├── routineDatabase.ts               # Routine templates CRUD
├── streakDatabase.ts                # Gym/nutrition/combined streak logic
├── exerciseDatabase.ts              # Exercise catalog + custom exercises
├── muscleMapping.ts                 # Exercise → muscle group mapping
├── presenceManager.ts               # Supabase Realtime presence
│
├── # Components
├── components/
│   ├── Auth.tsx                     # Login + 3-step signup
│   ├── Logo.tsx                     # SVG app logo
│   ├── Calendar.tsx                 # Monthly calendar with workout indicators
│   ├── FoodLogger.tsx               # Full food logging UI
│   ├── WorkoutStartPage.tsx         # Routine selection + blank workout start
│   ├── WorkoutSummaryModal.tsx      # Detailed workout review
│   ├── WorkoutListModal.tsx         # Multiple workouts per day picker
│   ├── WeightHistoryModal.tsx       # Weight history list + chart
│   ├── MuscleVolumeChart.tsx        # Body heat map visualization
│   ├── BodyGraph.tsx                # Muscle group SVG diagram
│   └── friends/
│       ├── FriendsTab.tsx           # Main container (Feed/Friends/Leaderboards/Inbox)
│       ├── ActivityFeed.tsx         # Friends' workout feed
│       ├── ActivityCard.tsx         # Single workout card
│       ├── ReactionBar.tsx          # Like/clap/fire reactions
│       ├── FriendList.tsx           # Friends list
│       ├── FriendSearch.tsx         # Search users by email/username
│       ├── FriendProfileModal.tsx   # Friend profile details
│       ├── PendingRequests.tsx      # Accept/decline friend requests
│       ├── Leaderboards.tsx         # Leaderboard tab container
│       ├── LeaderboardList.tsx      # Individual leaderboard view
│       ├── NotificationBell.tsx     # Bell icon + unread badge
│       ├── NotificationList.tsx     # Notification feed
│       ├── NudgeModal.tsx           # Send nudge to friend
│       ├── FriendVolumeChart.tsx    # Friend's workout volume chart
│       ├── SettingsSection.tsx      # Privacy & profile settings
│       └── InboxTab.tsx             # Notifications + pending requests
│
├── # SQL Migrations (Supabase)
├── supabase_exercises_migration.sql
├── supabase_food_migration.sql
├── supabase_food_catalog_migration.sql
├── supabase_routines_migration.sql
├── supabase_social_migration.sql
├── supabase_supplement_migration.sql
├── supabase_username_migration.sql
├── supabase_weight_migration.sql
├── supabase_profile_stats_migration.sql
│
├── # Data/Utility Files
├── deduplicated_nutrition.csv       # Food nutrition data
├── unique_foods_nutrition.csv       # Unique foods list
├── mfp-diaries.tsv                  # MyFitnessPal import data
├── clean.py, clean2.py, generate.py # Data processing scripts
└── Modelfile                        # Ollama model config
```

---

## Key Data Types

```typescript
// Workout
interface Exercise {
  id: string; name: string; sets: Set[];
  prevKg: number; prevReps: number;
}
interface Set {
  kg: string; reps: string;
  type: 'warmup' | 'working' | 'drop';
  completed: boolean;
}

// Food
interface NutritionGoals {
  calorie_goal: number; protein_goal: number;
  carbs_goal: number; fat_goal: number;
}

// Social
interface Profile {
  id: string; email: string; username?: string;
  share_workouts: boolean; show_streak: boolean;
  leaderboard_opt_in: boolean;
  starting_weight?: number;
}
```

---

## Database Schema (Supabase Postgres)

### Workout Tables
- **workouts** (id, user_id, duration, total_exercises, total_sets, created_at)
- **exercises** (id, workout_id, name, exercise_order, created_at)
- **sets** (id, exercise_id, set_number, kg, reps, completed, set_type)
- **exercises_catalog** (id, name, category, muscle_groups[])
- **user_exercises** (id, user_id, name, category)
- **routines** (id, user_id, name, created_at)
- **routine_exercises** (id, routine_id, name, exercise_order, default_sets)

### Nutrition Tables
- **food_entries** (id, user_id, name, calories, protein, carbs, fat, meal_type, brand, food_catalog_id, serving_size, quantity, created_at)
- **food_catalog** (id, name, brand, calories, protein, carbs, fat, serving_size, serving_unit, confidence, popularity, category)
- **nutrition_goals** (id, user_id, calorie/protein/carbs/fat_goal)

### Body Tracking Tables
- **weight_entries** (id, user_id, weight, date) — unique per user+date
- **supplement_entries** (id, user_id, type[water|creatine], amount, date)
- **supplement_goals** (id, user_id, water_goal, creatine_goal)

### Social Tables
- **profiles** (id, email, username, share_workouts, show_streak, notifications_enabled, leaderboard_opt_in, starting_weight, height, age, gender)
- **friendships** (id, user_id, friend_id, status[pending|accepted|declined|blocked|removed])
- **activity_feed** (id, user_id, workout_id, duration, total_volume, exercise_names[], total_exercises, total_sets)
- **reactions** (id, activity_id, user_id, type[like|clap|fire]) — unique per user+activity
- **nudges** (id, sender_id, receiver_id, message, read)
- **notifications** (id, user_id, type, title, body, data, read)
- **leaderboard_entries** (id, user_id, type, value, week_start)

### Leaderboard Types
weekly_volume, workout_streak, nutrition_streak, combined_streak, total_workouts, weekly_calories, weekly_protein, weekly_water, weekly_creatine

---

## Streak Rules

| Streak | Rule | Rest Days |
|--------|------|-----------|
| Gym | Max 2 consecutive rest days | 2 allowed |
| Nutrition | Must hit calorie goal every day | None |
| Combined | Must workout AND hit calories daily | None |

---

## Caching Strategy

All database modules use in-memory caches with TTL:
- Workout data: 5-min cache
- Food entries: 2-min cache
- Supplements: 2-min cache
- Weight: 5-min cache
- Streaks: 5-min cache with manual invalidation
- Friends/profiles: 2-min cache

---

## Known Architecture Notes

1. **App.tsx is very large** (~37k tokens) — contains all tab rendering, workout modal, home screen, supplement tracking, weight tracking, and all state management
2. **No navigation library** — tabs are managed with `activeTab` state; modals used for overlays
3. **No global state** — each component fetches its own data; parent passes callbacks
4. **RLS enabled** — Supabase Row Level Security on all tables scoped to authenticated user
5. **Swipe gestures** — workout sets use PanResponder for swipe-to-complete/delete
6. **SVG charts** — weight chart and muscle heat maps rendered with react-native-svg

---

## Common Modification Patterns

**Adding a new screen/tab:**
1. Add tab icon + label in bottom tab bar (in `App.tsx`)
2. Add conditional rendering in tab content area
3. Create component file in `components/`

**Adding a new database table:**
1. Create SQL migration file (`supabase_*_migration.sql`)
2. Run migration on Supabase
3. Create database module (`*Database.ts`) with cache pattern
4. Import and use in relevant components

**Adding a new leaderboard:**
1. Add type to `leaderboard_entries` type enum
2. Update `friendsDatabase.ts` with new update function
3. Add tab in `Leaderboards.tsx`

---

*This file should be updated whenever significant changes are made to the app structure, new features are added, or database schema changes.*
