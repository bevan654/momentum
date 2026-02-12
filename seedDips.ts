import { supabase } from './supabase';

/**
 * Run with: npx ts-node seedDips.ts
 * Or paste into the app as a temp function and call it.
 *
 * Seeds 8 "Dips" workout sessions over the past ~6 weeks with progressive overload.
 */
async function seedDips() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('Not authenticated — run this while logged in');
    return;
  }

  const sessions = [
    { daysAgo: 42, sets: [{ kg: 0, reps: 8 }, { kg: 0, reps: 8 }, { kg: 0, reps: 6 }] },
    { daysAgo: 35, sets: [{ kg: 0, reps: 10 }, { kg: 0, reps: 9 }, { kg: 0, reps: 8 }] },
    { daysAgo: 28, sets: [{ kg: 5, reps: 8 }, { kg: 5, reps: 8 }, { kg: 5, reps: 7 }] },
    { daysAgo: 21, sets: [{ kg: 5, reps: 10 }, { kg: 5, reps: 9 }, { kg: 5, reps: 8 }] },
    { daysAgo: 14, sets: [{ kg: 10, reps: 8 }, { kg: 10, reps: 8 }, { kg: 10, reps: 7 }] },
    { daysAgo: 10, sets: [{ kg: 10, reps: 10 }, { kg: 10, reps: 9 }, { kg: 10, reps: 8 }] },
    { daysAgo: 5,  sets: [{ kg: 12.5, reps: 8 }, { kg: 12.5, reps: 8 }, { kg: 12.5, reps: 7 }] },
    { daysAgo: 1,  sets: [{ kg: 12.5, reps: 10 }, { kg: 12.5, reps: 9 }, { kg: 12.5, reps: 8 }, { kg: 10, reps: 10 }] },
  ];

  for (const sess of sessions) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - sess.daysAgo);
    createdAt.setHours(9, 30, 0, 0);

    // 1. Create workout
    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        duration: 1800 + Math.floor(Math.random() * 600),
        total_exercises: 1,
        total_sets: sess.sets.length,
        created_at: createdAt.toISOString(),
      })
      .select()
      .single();

    if (wErr) { console.error('Workout insert error:', wErr); continue; }

    // 2. Create exercise
    const { data: exercise, error: eErr } = await supabase
      .from('exercises')
      .insert({
        workout_id: workout.id,
        name: 'Dips',
        exercise_order: 1,
      })
      .select()
      .single();

    if (eErr) { console.error('Exercise insert error:', eErr); continue; }

    // 3. Create sets
    const setsToInsert = sess.sets.map((s, i) => ({
      exercise_id: exercise.id,
      set_number: i + 1,
      kg: s.kg,
      reps: s.reps,
      completed: true,
      set_type: 'working',
      parent_set_number: null,
    }));

    const { error: sErr } = await supabase.from('sets').insert(setsToInsert);
    if (sErr) { console.error('Sets insert error:', sErr); continue; }

    console.log(`✓ Dips session ${sess.daysAgo}d ago — ${sess.sets.length} sets`);
  }

  console.log('\nDone! 8 Dips sessions seeded.');
}

seedDips();
