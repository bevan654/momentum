// Static form cues for common exercises
// 2-3 short cues per exercise to display during workout

export const EXERCISE_FORM_CUES: Record<string, string[]> = {
  // Chest
  'Bench Press': ['Retract shoulder blades', 'Feet flat on floor', 'Touch chest, drive up explosively'],
  'Incline Bench Press': ['30-45 degree angle', 'Squeeze at the top', 'Control the negative'],
  'Decline Bench Press': ['Grip slightly wider than shoulder width', 'Lower to lower chest', 'Keep elbows at 45 degrees'],
  'Dumbbell Bench Press': ['Press up and slightly inward', 'Full range of motion', 'Keep wrists stacked over elbows'],
  'Incline Dumbbell Press': ['Squeeze chest at the top', 'Don\'t flare elbows past 60 degrees', 'Slow eccentric'],
  'Cable Fly': ['Slight bend in elbows throughout', 'Squeeze chest at the center', 'Control the stretch'],
  'Dumbbell Fly': ['Arms slightly bent throughout', 'Feel the stretch at the bottom', 'Don\'t go too heavy'],
  'Chest Dips': ['Lean forward slightly', 'Go to 90 degree elbow bend', 'Squeeze chest at top'],
  'Push-ups': ['Body in a straight line', 'Elbows at 45 degrees', 'Full lockout at top'],
  'Machine Chest Press': ['Set seat so handles are at mid-chest', 'Don\'t lock elbows fully', 'Squeeze at the end'],
  'Pec Deck': ['Keep slight bend in elbows', 'Squeeze at the center', 'Slow negative'],

  // Back
  'Barbell Row': ['Hinge at hips, flat back', 'Pull to lower chest', 'Squeeze shoulder blades together'],
  'Dumbbell Row': ['Support with other hand', 'Pull elbow past torso', 'Don\'t rotate torso'],
  'Lat Pulldown': ['Pull to upper chest', 'Lean back slightly', 'Squeeze lats at the bottom'],
  'Pull-ups': ['Full dead hang start', 'Drive elbows down', 'Chin over bar'],
  'Chin-ups': ['Supinated grip, shoulder width', 'Pull chest to bar', 'Control the descent'],
  'Seated Cable Row': ['Sit tall, chest up', 'Pull to lower chest', 'Squeeze shoulder blades'],
  'T-Bar Row': ['Keep back flat', 'Drive elbows back', 'Don\'t use momentum'],
  'Face Pull': ['Pull to face level', 'Externally rotate at the end', 'Pause at peak contraction'],
  'Straight Arm Pulldown': ['Keep arms nearly straight', 'Hinge slightly at hips', 'Feel the lats stretch'],
  'Machine Row': ['Chest against pad', 'Full stretch forward', 'Squeeze back at the end'],

  // Legs
  'Squat': ['Chest up, brace core', 'Knees track over toes', 'Break parallel'],
  'Front Squat': ['Elbows high, chest up', 'Sit straight down', 'Drive knees out'],
  'Leg Press': ['Feet shoulder width on platform', 'Don\'t lock knees at top', 'Full depth without butt lift'],
  'Romanian Deadlift': ['Slight knee bend, hinge at hips', 'Bar stays close to legs', 'Feel hamstring stretch'],
  'Leg Curl': ['Control the negative', 'Full range of motion', 'Don\'t lift hips off pad'],
  'Leg Extension': ['Don\'t hyperextend knees', 'Squeeze quads at the top', 'Slow eccentric'],
  'Bulgarian Split Squat': ['Rear foot elevated', 'Front knee tracks over toes', 'Stay upright'],
  'Lunges': ['Step far enough forward', 'Both knees at 90 degrees', 'Push through front heel'],
  'Hip Thrust': ['Drive through heels', 'Squeeze glutes at top', 'Chin tucked'],
  'Calf Raise': ['Full stretch at bottom', 'Pause at top', 'Don\'t bounce'],
  'Hack Squat': ['Feet shoulder width', 'Push through heels', 'Control the descent'],
  'Goblet Squat': ['Hold weight at chest', 'Elbows inside knees', 'Sit between legs'],

  // Shoulders
  'Overhead Press': ['Brace core tight', 'Press straight up', 'Full lockout overhead'],
  'Dumbbell Shoulder Press': ['Start at ear level', 'Press up and slightly in', 'Don\'t arch lower back'],
  'Lateral Raise': ['Slight bend in elbows', 'Lead with elbows', 'Don\'t go above shoulder height'],
  'Front Raise': ['Slight bend in elbows', 'Raise to eye level', 'Alternate arms or together'],
  'Reverse Fly': ['Bent over or on incline bench', 'Squeeze rear delts', 'Keep elbows slightly bent'],
  'Arnold Press': ['Start palms facing you', 'Rotate as you press', 'Full lockout at top'],
  'Upright Row': ['Pull to chin level', 'Lead with elbows', 'Keep bar close to body'],
  'Shrugs': ['Straight up, not rolling', 'Hold at the top', 'Full stretch at bottom'],

  // Arms
  'Bicep Curl': ['Keep elbows pinned', 'Full extension at bottom', 'Squeeze at the top'],
  'Hammer Curl': ['Neutral grip throughout', 'Don\'t swing', 'Control the negative'],
  'Preacher Curl': ['Armpits on pad', 'Don\'t fully extend at bottom', 'Squeeze at top'],
  'Concentration Curl': ['Elbow on inner thigh', 'Slow and controlled', 'Full supination'],
  'Cable Curl': ['Keep elbows at sides', 'Constant tension', 'Squeeze at the top'],
  'Tricep Extension': ['Keep elbows close to head', 'Full stretch at bottom', 'Lock out at top'],
  'Tricep Pushdown': ['Elbows pinned at sides', 'Full lockout', 'Slow negative'],
  'Overhead Tricep Extension': ['Keep elbows pointed up', 'Full stretch behind head', 'Don\'t flare elbows'],
  'Skull Crushers': ['Lower to forehead or behind head', 'Keep elbows in', 'Control the weight'],
  'Dips': ['Upright torso for triceps', 'Full lockout at top', 'Go to 90 degrees'],

  // Compound
  'Deadlift': ['Flat back, brace core', 'Push floor away', 'Lockout hips and knees together'],
  'Sumo Deadlift': ['Wide stance, toes out', 'Push knees out', 'Keep chest up'],
  'Clean and Press': ['Explosive hip drive', 'Catch at shoulders', 'Press overhead to lockout'],
  'Farmers Walk': ['Stand tall, shoulders back', 'Tight grip', 'Short quick steps'],

  // Core
  'Plank': ['Straight line head to heels', 'Brace abs tight', 'Don\'t let hips sag'],
  'Cable Crunch': ['Hinge at the waist', 'Round upper back', 'Hold at bottom'],
  'Hanging Leg Raise': ['Control the swing', 'Lift knees past 90 degrees', 'Slow descent'],
  'Ab Wheel Rollout': ['Start on knees', 'Keep core braced', 'Don\'t arch lower back'],

  // Other
  'Battle Ropes': ['Alternate arms rhythmically', 'Slight squat stance', 'Keep core engaged'],
  'Box Jump': ['Swing arms for momentum', 'Land softly with bent knees', 'Step down, don\'t jump'],
  'Kettlebell Swing': ['Hinge at hips', 'Snap hips forward', 'Arms are just along for the ride'],
};
