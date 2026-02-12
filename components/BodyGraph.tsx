import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { getWorkoutsForDateRange } from '../database';
import {
  MuscleGroup,
  MuscleVolumeData,
  MUSCLE_DISPLAY_NAMES,
  calculateMuscleVolumes,
} from '../muscleMapping';
import { useTheme, Colors } from '../theme';
import { s } from '../responsive';

type TimeFilter = 'today' | '7days' | '30days';

interface BodyGraphProps {
  refreshKey?: number;
  embedded?: boolean;
}

function getHeatColor(intensity: number): string {
  if (intensity <= 0) return '#1E2A38';
  if (intensity < 0.1) return '#162D4A';
  if (intensity < 0.2) return '#17405E';
  if (intensity < 0.3) return '#185575';
  if (intensity < 0.4) return '#1A6B8E';
  if (intensity < 0.5) return '#1B82A8';
  if (intensity < 0.6) return '#0D9AC4';
  if (intensity < 0.7) return '#0FB5DE';
  if (intensity < 0.8) return '#2DC8EE';
  if (intensity < 0.9) return '#56D4F4';
  return '#88E3FA';
}

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return Math.round(v).toString();
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff}d ago`;
}

// ============================================================
// Panel type
// ============================================================
interface BodyPanel {
  muscle: MuscleGroup | null;
  d: string;
  fibers?: string[];
}

const INACTIVE_FILL = '#141D28';
const PANEL_FILL = '#1E2A38';
const STROKE_COLOR = '#2A3A4D';
const STROKE_WIDTH = 0.5;
const SELECTED_STROKE = '#56D4F4';
const SELECTED_WIDTH = 1.2;

// ============================================================
// FRONT PANELS — Detailed Anterior Anatomy
// ViewBox: 0 0 200 400
// Body center: x=100
// ============================================================
const FRONT_PANELS: BodyPanel[] = [
  // ===== HEAD =====
  { muscle: null,
    d: 'M100,10 C119,10 131,23 131,38 C131,53 122,62 112,64 Q100,67 88,64 C78,62 69,53 69,38 C69,23 81,10 100,10 Z' },

  // ===== NECK =====
  // Left sternocleidomastoid
  { muscle: null,
    d: 'M91,62 C89,66 88,70 87,74 L89,78 L93,76 C93,72 92,68 92,64 L91,62 Z',
    fibers: ['M92,63 C90,68 89,73 89,78'] },
  // Right sternocleidomastoid
  { muscle: null,
    d: 'M109,62 C111,66 112,70 113,74 L111,78 L107,76 C107,72 108,68 108,64 L109,62 Z',
    fibers: ['M108,63 C110,68 111,73 111,78'] },
  // Neck center
  { muscle: null,
    d: 'M93,63 Q100,66 107,63 L107,76 Q100,79 93,76 Z' },

  // ===== UPPER TRAPEZIUS (from front) =====
  // Left upper trap slope
  { muscle: 'back',
    d: 'M89,60 C85,64 79,70 73,76 L67,80 L70,82 C76,78 82,72 88,66 L91,62 L89,60 Z',
    fibers: ['M89,62 C83,68 75,76 69,80', 'M91,62 C85,68 77,76 71,82'] },
  // Right upper trap slope
  { muscle: 'back',
    d: 'M111,60 C115,64 121,70 127,76 L133,80 L130,82 C124,78 118,72 112,66 L109,62 L111,60 Z',
    fibers: ['M111,62 C117,68 125,76 131,80', 'M109,62 C115,68 123,76 129,82'] },

  // ===== DELTOIDS =====
  // Left anterior deltoid
  { muscle: 'shoulders',
    d: 'M76,80 C72,84 68,90 64,97 C61,104 59,110 59,116 L62,118 C63,112 65,104 69,97 C73,90 77,85 80,82 L76,80 Z',
    fibers: ['M78,82 C72,90 66,100 62,112', 'M76,82 C70,90 64,100 60,112', 'M74,84 C68,92 62,102 60,116'] },
  // Left lateral deltoid
  { muscle: 'shoulders',
    d: 'M67,80 C61,86 55,94 52,104 C50,112 50,118 53,122 L59,116 C59,110 61,104 64,97 C68,90 72,84 76,80 L67,80 Z',
    fibers: ['M65,82 C59,92 53,104 51,116', 'M69,80 C63,90 57,100 53,112', 'M63,84 C57,94 51,106 50,118'] },
  // Right anterior deltoid
  { muscle: 'shoulders',
    d: 'M124,80 C128,84 132,90 136,97 C139,104 141,110 141,116 L138,118 C137,112 135,104 131,97 C127,90 123,85 120,82 L124,80 Z',
    fibers: ['M122,82 C128,90 134,100 138,112', 'M124,82 C130,90 136,100 140,112', 'M126,84 C132,92 138,102 140,116'] },
  // Right lateral deltoid
  { muscle: 'shoulders',
    d: 'M133,80 C139,86 145,94 148,104 C150,112 150,118 147,122 L141,116 C141,110 139,104 136,97 C132,90 128,84 124,80 L133,80 Z',
    fibers: ['M135,82 C141,92 147,104 149,116', 'M131,80 C137,90 143,100 147,112', 'M137,84 C143,94 149,106 150,118'] },

  // ===== PECTORALS =====
  // Left pec major — clavicular head (upper fibers)
  { muscle: 'chest',
    d: 'M98,82 C92,82 84,86 78,90 C72,94 68,100 66,106 L63,114 C66,108 70,100 76,94 C82,88 90,84 98,83 Z',
    fibers: ['M96,83 C88,88 78,96 70,106', 'M94,83 C86,88 76,96 68,106', 'M92,84 C84,88 74,96 66,108'] },
  // Left pec major — sternal head (main body)
  { muscle: 'chest',
    d: 'M98,83 C90,84 82,88 76,94 C70,100 66,108 63,114 C62,122 62,130 66,136 C70,142 78,148 90,150 L98,146 L98,83 Z',
    fibers: ['M96,88 C86,96 74,110 66,126', 'M94,94 C84,102 72,116 66,132', 'M92,100 C82,108 70,122 66,138', 'M90,106 C80,114 70,128 66,142', 'M96,84 C88,92 78,104 68,118'] },
  // Right pec major — clavicular head
  { muscle: 'chest',
    d: 'M102,82 C108,82 116,86 122,90 C128,94 132,100 134,106 L137,114 C134,108 130,100 124,94 C118,88 110,84 102,83 Z',
    fibers: ['M104,83 C112,88 122,96 130,106', 'M106,83 C114,88 124,96 132,106', 'M108,84 C116,88 126,96 134,108'] },
  // Right pec major — sternal head
  { muscle: 'chest',
    d: 'M102,83 C110,84 118,88 124,94 C130,100 134,108 137,114 C138,122 138,130 134,136 C130,142 122,148 110,150 L102,146 L102,83 Z',
    fibers: ['M104,88 C114,96 126,110 134,126', 'M106,94 C116,102 128,116 134,132', 'M108,100 C118,108 130,122 134,138', 'M110,106 C120,114 130,128 134,142', 'M104,84 C112,92 122,104 132,118'] },

  // ===== SERRATUS ANTERIOR =====
  // Left serratus — saw-tooth interdigitations on ribs
  { muscle: 'chest',
    d: 'M66,122 C64,128 64,134 66,138 L70,136 C68,140 66,146 68,150 L72,148 C70,154 70,158 72,162 L78,158 C80,152 82,146 82,140 C82,134 80,128 76,124 L66,122 Z',
    fibers: ['M68,124 C70,132 72,142 74,152', 'M66,130 C68,138 70,146 72,156', 'M64,136 C66,144 68,150 70,160'] },
  // Right serratus
  { muscle: 'chest',
    d: 'M134,122 C136,128 136,134 134,138 L130,136 C132,140 134,146 132,150 L128,148 C130,154 130,158 128,162 L122,158 C120,152 118,146 118,140 C118,134 120,128 124,124 L134,122 Z',
    fibers: ['M132,124 C130,132 128,142 126,152', 'M134,130 C132,138 130,146 128,156', 'M136,136 C134,144 132,150 130,160'] },

  // ===== UPPER ARMS =====
  // Left biceps brachii (long + short head combined)
  { muscle: 'biceps',
    d: 'M60,120 C58,126 56,134 54,142 C52,150 51,158 52,164 C53,168 56,170 58,168 C60,164 62,156 62,148 C62,140 62,132 62,126 L60,120 Z',
    fibers: ['M60,122 C58,132 54,146 52,160', 'M62,124 C60,134 56,148 54,162', 'M61,122 C59,134 56,148 54,164'] },
  // Left brachialis (lateral, visible under biceps)
  { muscle: 'biceps',
    d: 'M54,138 C52,144 50,152 48,158 C47,164 48,168 50,170 L52,168 C52,162 53,154 54,146 L54,138 Z',
    fibers: ['M54,140 C52,148 50,156 49,164', 'M53,142 C51,150 49,158 48,166'] },
  // Right biceps brachii
  { muscle: 'biceps',
    d: 'M140,120 C142,126 144,134 146,142 C148,150 149,158 148,164 C147,168 144,170 142,168 C140,164 138,156 138,148 C138,140 138,132 138,126 L140,120 Z',
    fibers: ['M140,122 C142,132 146,146 148,160', 'M138,124 C140,134 144,148 146,162', 'M139,122 C141,134 144,148 146,164'] },
  // Right brachialis
  { muscle: 'biceps',
    d: 'M146,138 C148,144 150,152 152,158 C153,164 152,168 150,170 L148,168 C148,162 147,154 146,146 L146,138 Z',
    fibers: ['M146,140 C148,148 150,156 151,164', 'M147,142 C149,150 151,158 152,166'] },

  // ===== FOREARMS =====
  // Left brachioradialis
  { muscle: 'forearms',
    d: 'M50,168 C48,174 46,182 44,190 C42,198 42,206 42,212 L46,210 C46,204 46,196 48,188 C50,180 50,174 50,168 Z',
    fibers: ['M50,170 C48,180 44,194 42,208', 'M49,170 C47,180 44,194 43,210'] },
  // Left forearm flexors (medial group)
  { muscle: 'forearms',
    d: 'M56,170 C54,178 52,188 50,198 C48,208 48,216 48,224 L46,228 C44,224 44,216 44,208 C44,198 46,186 48,176 L50,168 L56,170 Z',
    fibers: ['M54,172 C52,184 50,198 48,214', 'M56,172 C54,186 52,200 50,218', 'M52,174 C50,186 48,200 46,218'] },
  // Left forearm extensors (lateral group)
  { muscle: 'forearms',
    d: 'M50,168 C48,174 46,182 44,190 C42,198 42,206 42,212 L42,220 L42,228 L46,228 L48,224 C48,216 48,208 50,198 C50,190 50,182 50,176 L50,168 Z',
    fibers: ['M50,170 C48,182 44,196 42,214', 'M48,172 C46,184 42,198 42,218'] },
  // Right brachioradialis
  { muscle: 'forearms',
    d: 'M150,168 C152,174 154,182 156,190 C158,198 158,206 158,212 L154,210 C154,204 154,196 152,188 C150,180 150,174 150,168 Z',
    fibers: ['M150,170 C152,180 156,194 158,208', 'M151,170 C153,180 156,194 157,210'] },
  // Right forearm flexors
  { muscle: 'forearms',
    d: 'M144,170 C146,178 148,188 150,198 C152,208 152,216 152,224 L154,228 C156,224 156,216 156,208 C156,198 154,186 152,176 L150,168 L144,170 Z',
    fibers: ['M146,172 C148,184 150,198 152,214', 'M144,172 C146,186 148,200 150,218', 'M148,174 C150,186 152,200 154,218'] },
  // Right forearm extensors
  { muscle: 'forearms',
    d: 'M150,168 C152,174 154,182 156,190 C158,198 158,206 158,212 L158,220 L158,228 L154,228 L152,224 C152,216 152,208 150,198 C150,190 150,182 150,176 L150,168 Z',
    fibers: ['M150,170 C152,182 156,196 158,214', 'M152,172 C154,184 158,198 158,218'] },

  // ===== HANDS =====
  { muscle: null,
    d: 'M44,228 C42,232 40,238 42,242 C44,246 48,244 50,240 L48,228 Z' },
  { muscle: null,
    d: 'M156,228 C158,232 160,238 158,242 C156,246 152,244 150,240 L152,228 Z' },

  // ===== RECTUS ABDOMINIS (6-pack segments) =====
  // Upper left
  { muscle: 'abs',
    d: 'M92,148 Q96,150 100,148 L100,162 Q96,164 92,162 Z',
    fibers: ['M94,150 L94,162', 'M98,150 L98,162'] },
  // Upper right
  { muscle: 'abs',
    d: 'M100,148 Q104,150 108,148 L108,162 Q104,164 100,162 Z',
    fibers: ['M102,150 L102,162', 'M106,150 L106,162'] },
  // Middle left
  { muscle: 'abs',
    d: 'M91,164 Q96,166 100,164 L100,182 Q96,184 91,182 Z',
    fibers: ['M93,166 L93,182', 'M97,166 L97,182'] },
  // Middle right
  { muscle: 'abs',
    d: 'M100,164 Q104,166 109,164 L109,182 Q104,184 100,182 Z',
    fibers: ['M103,166 L103,182', 'M107,166 L107,182'] },
  // Lower left
  { muscle: 'abs',
    d: 'M90,184 Q96,186 100,184 L100,214 Q96,218 90,216 Z',
    fibers: ['M92,186 L92,214', 'M96,186 L96,216', 'M90,196 Q96,198 100,196'] },
  // Lower right
  { muscle: 'abs',
    d: 'M100,184 Q104,186 110,184 L110,216 Q104,218 100,214 Z',
    fibers: ['M108,186 L108,214', 'M104,186 L104,216', 'M100,196 Q104,198 110,196'] },

  // ===== EXTERNAL OBLIQUES =====
  // Left external oblique
  { muscle: 'abs',
    d: 'M68,140 C66,152 66,166 68,182 C70,196 74,208 78,216 Q84,212 88,206 C86,192 86,178 86,164 C86,154 84,148 80,146 C76,144 72,142 68,140 Z',
    fibers: ['M70,146 C74,160 78,178 82,196', 'M68,154 C72,168 76,184 80,202', 'M68,162 C72,176 76,190 80,208', 'M70,142 C74,156 78,172 82,188'] },
  // Right external oblique
  { muscle: 'abs',
    d: 'M132,140 C134,152 134,166 132,182 C130,196 126,208 122,216 Q116,212 112,206 C114,192 114,178 114,164 C114,154 116,148 120,146 C124,144 128,142 132,140 Z',
    fibers: ['M130,146 C126,160 122,178 118,196', 'M132,154 C128,168 124,184 120,202', 'M132,162 C128,176 124,190 120,208', 'M130,142 C126,156 122,172 118,188'] },

  // ===== HIP — TFL =====
  // Left tensor fasciae latae
  { muscle: 'glutes',
    d: 'M78,216 C76,220 74,226 74,232 C74,238 76,242 80,240 C82,236 82,230 80,224 C80,220 78,218 78,216 Z',
    fibers: ['M78,218 C76,224 74,232 76,240', 'M80,218 C78,224 76,232 78,240'] },
  // Right TFL
  { muscle: 'glutes',
    d: 'M122,216 C124,220 126,226 126,232 C126,238 124,242 120,240 C118,236 118,230 120,224 C120,220 122,218 122,216 Z',
    fibers: ['M122,218 C124,224 126,232 124,240', 'M120,218 C122,224 124,232 122,240'] },

  // ===== QUADRICEPS =====
  // Left vastus lateralis (outer quad)
  { muscle: 'quads',
    d: 'M78,222 C76,232 74,248 76,266 C78,280 80,292 82,302 Q86,308 88,306 C88,298 86,286 86,274 C86,260 84,244 82,234 L78,222 Z',
    fibers: ['M80,226 C78,242 76,260 78,280 C80,294 82,302 84,306', 'M82,228 C80,244 78,262 80,282 C82,294 84,302 86,306', 'M78,230 C76,246 74,264 76,284 C78,296 80,304 82,308'] },
  // Left rectus femoris (center quad)
  { muscle: 'quads',
    d: 'M84,224 C82,234 82,248 82,264 C82,278 84,290 86,300 Q90,306 92,304 C92,294 92,280 92,266 C92,250 92,236 90,226 Q88,222 84,224 Z',
    fibers: ['M86,226 C84,242 84,260 84,280 C86,292 88,300 90,304', 'M88,224 C86,240 86,258 86,278 C88,290 90,298 92,302', 'M90,226 C88,242 88,260 88,280 C90,290 92,298 92,304'] },
  // Left vastus medialis (inner quad — teardrop)
  { muscle: 'quads',
    d: 'M94,260 C92,270 92,280 92,290 C92,298 94,304 96,306 Q98,306 100,304 C100,296 100,286 100,276 C100,266 98,258 94,260 Z',
    fibers: ['M96,262 C94,274 94,288 96,302', 'M98,260 C96,272 96,286 98,302', 'M100,264 C98,276 98,290 100,302'] },
  // Left adductor group (inner thigh)
  { muscle: 'quads',
    d: 'M94,226 C96,234 98,244 100,256 L100,276 C98,272 96,264 94,256 C92,248 90,238 90,230 L94,226 Z',
    fibers: ['M94,228 C96,242 98,258 100,272', 'M92,232 C94,246 96,260 98,274', 'M96,230 C98,244 100,258 100,268'] },
  // Right vastus lateralis
  { muscle: 'quads',
    d: 'M122,222 C124,232 126,248 124,266 C122,280 120,292 118,302 Q114,308 112,306 C112,298 114,286 114,274 C114,260 116,244 118,234 L122,222 Z',
    fibers: ['M120,226 C122,242 124,260 122,280 C120,294 118,302 116,306', 'M118,228 C120,244 122,262 120,282 C118,294 116,302 114,306', 'M122,230 C124,246 126,264 124,284 C122,296 120,304 118,308'] },
  // Right rectus femoris
  { muscle: 'quads',
    d: 'M116,224 C118,234 118,248 118,264 C118,278 116,290 114,300 Q110,306 108,304 C108,294 108,280 108,266 C108,250 108,236 110,226 Q112,222 116,224 Z',
    fibers: ['M114,226 C116,242 116,260 116,280 C114,292 112,300 110,304', 'M112,224 C114,240 114,258 114,278 C112,290 110,298 108,302', 'M110,226 C112,242 112,260 112,280 C110,290 108,298 108,304'] },
  // Right vastus medialis
  { muscle: 'quads',
    d: 'M106,260 C108,270 108,280 108,290 C108,298 106,304 104,306 Q102,306 100,304 C100,296 100,286 100,276 C100,266 102,258 106,260 Z',
    fibers: ['M104,262 C106,274 106,288 104,302', 'M102,260 C104,272 104,286 102,302', 'M100,264 C102,276 102,290 100,302'] },
  // Right adductors
  { muscle: 'quads',
    d: 'M106,226 C104,234 102,244 100,256 L100,276 C102,272 104,264 106,256 C108,248 110,238 110,230 L106,226 Z',
    fibers: ['M106,228 C104,242 102,258 100,272', 'M108,232 C106,246 104,260 102,274', 'M104,230 C102,244 100,258 100,268'] },

  // Left sartorius (thin strap crossing diagonally)
  { muscle: 'quads',
    d: 'M80,218 C82,226 84,236 86,248 C88,260 90,274 92,286 C94,298 94,306 92,310 L90,308 C90,300 88,288 86,276 C84,264 82,250 80,238 C78,228 78,222 80,218 Z',
    fibers: ['M80,220 C82,234 86,254 90,278 C92,296 92,308 92,310'] },
  // Right sartorius
  { muscle: 'quads',
    d: 'M120,218 C118,226 116,236 114,248 C112,260 110,274 108,286 C106,298 106,306 108,310 L110,308 C110,300 112,288 114,276 C116,264 118,250 120,238 C122,228 122,222 120,218 Z',
    fibers: ['M120,220 C118,234 114,254 110,278 C108,296 108,308 108,310'] },

  // ===== KNEECAPS =====
  { muscle: null,
    d: 'M84,306 C84,310 84,316 86,320 Q90,322 94,320 C94,316 94,310 92,306 Q88,304 84,306 Z' },
  { muscle: null,
    d: 'M116,306 C116,310 116,316 114,320 Q110,322 106,320 C106,316 106,310 108,306 Q112,304 116,306 Z' },

  // ===== LOWER LEG =====
  // Left tibialis anterior
  { muscle: 'calves',
    d: 'M86,322 C84,330 84,340 84,350 C84,358 86,366 88,372 L92,370 C92,364 92,354 92,344 C92,336 90,328 88,322 L86,322 Z',
    fibers: ['M88,324 C86,336 84,350 86,366', 'M90,324 C88,336 86,350 88,366'] },
  // Left gastrocnemius (medial + lateral heads visible from front)
  { muscle: 'calves',
    d: 'M88,322 C88,328 88,334 88,340 L92,344 C94,338 94,330 94,324 L92,322 L88,322 Z',
    fibers: ['M90,324 C90,332 90,340 92,344'] },
  // Left soleus / lower calf
  { muscle: 'calves',
    d: 'M86,350 C86,358 86,364 88,370 L92,374 L94,370 C94,364 94,356 92,348 L86,350 Z',
    fibers: ['M88,352 C88,360 88,368 90,374', 'M92,350 C92,358 92,366 94,372'] },
  // Right tibialis anterior
  { muscle: 'calves',
    d: 'M114,322 C116,330 116,340 116,350 C116,358 114,366 112,372 L108,370 C108,364 108,354 108,344 C108,336 110,328 112,322 L114,322 Z',
    fibers: ['M112,324 C114,336 116,350 114,366', 'M110,324 C112,336 114,350 112,366'] },
  // Right gastrocnemius from front
  { muscle: 'calves',
    d: 'M112,322 C112,328 112,334 112,340 L108,344 C106,338 106,330 106,324 L108,322 L112,322 Z',
    fibers: ['M110,324 C110,332 110,340 108,344'] },
  // Right soleus / lower calf
  { muscle: 'calves',
    d: 'M114,350 C114,358 114,364 112,370 L108,374 L106,370 C106,364 106,356 108,348 L114,350 Z',
    fibers: ['M112,352 C112,360 112,368 110,374', 'M108,350 C108,358 108,366 106,372'] },

  // ===== FEET =====
  { muscle: null,
    d: 'M86,374 C84,378 86,382 92,382 L94,378 C94,376 92,374 88,374 Z' },
  { muscle: null,
    d: 'M114,374 C116,378 114,382 108,382 L106,378 C106,376 108,374 112,374 Z' },
];

// ============================================================
// BACK PANELS — Detailed Posterior Anatomy
// ============================================================
const BACK_PANELS: BodyPanel[] = [
  // ===== HEAD =====
  { muscle: null,
    d: 'M100,10 C119,10 131,23 131,38 C131,53 122,62 112,64 Q100,67 88,64 C78,62 69,53 69,38 C69,23 81,10 100,10 Z' },

  // ===== NECK =====
  // Left splenius capitis / levator scapulae
  { muscle: null,
    d: 'M92,60 C90,64 88,68 86,74 L84,78 L88,80 C90,76 91,70 92,66 L94,62 L92,60 Z',
    fibers: ['M92,62 C90,68 88,74 86,78'] },
  // Right splenius
  { muscle: null,
    d: 'M108,60 C110,64 112,68 114,74 L116,78 L112,80 C110,76 109,70 108,66 L106,62 L108,60 Z',
    fibers: ['M108,62 C110,68 112,74 114,78'] },
  // Neck center (spinous processes)
  { muscle: null,
    d: 'M94,62 Q100,64 106,62 L106,78 Q100,80 94,78 Z' },

  // ===== TRAPEZIUS =====
  // Left upper trapezius
  { muscle: 'back',
    d: 'M92,60 C88,64 82,70 76,76 L68,82 L66,80 C72,74 80,66 86,62 L90,60 L92,60 Z',
    fibers: ['M90,62 C84,68 76,76 68,82', 'M88,62 C82,68 74,76 66,80'] },
  // Right upper trapezius
  { muscle: 'back',
    d: 'M108,60 C112,64 118,70 124,76 L132,82 L134,80 C128,74 120,66 114,62 L110,60 L108,60 Z',
    fibers: ['M110,62 C116,68 124,76 132,82', 'M112,62 C118,68 126,76 134,80'] },
  // Left middle trapezius
  { muscle: 'back',
    d: 'M98,86 C94,88 88,92 82,96 L76,100 L72,98 C78,94 86,88 94,84 L98,82 L98,86 Z',
    fibers: ['M96,84 C90,88 82,94 74,100', 'M98,86 C92,90 84,96 76,100'] },
  // Right middle trapezius
  { muscle: 'back',
    d: 'M102,86 C106,88 112,92 118,96 L124,100 L128,98 C122,94 114,88 106,84 L102,82 L102,86 Z',
    fibers: ['M104,84 C110,88 118,94 126,100', 'M102,86 C108,90 116,96 124,100'] },
  // Left lower trapezius (converges to T12)
  { muscle: 'back',
    d: 'M98,100 C94,104 86,110 80,114 L78,116 C84,116 92,112 98,108 L100,140 L98,140 L98,100 Z',
    fibers: ['M96,102 C90,108 84,114 80,116', 'M98,108 C94,114 88,118 84,120'] },
  // Right lower trapezius
  { muscle: 'back',
    d: 'M102,100 C106,104 114,110 120,114 L122,116 C116,116 108,112 102,108 L100,140 L102,140 L102,100 Z',
    fibers: ['M104,102 C110,108 116,114 120,116', 'M102,108 C106,114 112,118 116,120'] },

  // ===== POSTERIOR DELTOIDS =====
  // Left posterior deltoid
  { muscle: 'shoulders',
    d: 'M68,80 C62,86 56,94 52,104 C50,112 50,118 53,122 C58,118 62,110 66,102 C70,94 72,86 74,82 L68,80 Z',
    fibers: ['M72,82 C66,92 60,104 54,116', 'M70,84 C64,94 58,106 52,118', 'M68,82 C62,92 56,104 50,116'] },
  // Right posterior deltoid
  { muscle: 'shoulders',
    d: 'M132,80 C138,86 144,94 148,104 C150,112 150,118 147,122 C142,118 138,110 134,102 C130,94 128,86 126,82 L132,80 Z',
    fibers: ['M128,82 C134,92 140,104 146,116', 'M130,84 C136,94 142,106 148,118', 'M132,82 C138,92 144,104 150,116'] },

  // ===== ROTATOR CUFF / SCAPULAR MUSCLES =====
  // Left infraspinatus (on scapula, below spine of scapula)
  { muscle: 'back',
    d: 'M78,96 C74,100 72,106 72,112 C72,118 74,122 78,124 L84,120 C84,116 82,110 82,104 C82,100 80,98 78,96 Z',
    fibers: ['M80,98 C76,104 74,112 76,120', 'M82,100 C78,106 76,114 78,122', 'M78,98 C74,104 72,112 74,120'] },
  // Right infraspinatus
  { muscle: 'back',
    d: 'M122,96 C126,100 128,106 128,112 C128,118 126,122 122,124 L116,120 C116,116 118,110 118,104 C118,100 120,98 122,96 Z',
    fibers: ['M120,98 C124,104 126,112 124,120', 'M118,100 C122,106 124,114 122,122', 'M122,98 C126,104 128,112 126,120'] },
  // Left teres minor
  { muscle: 'back',
    d: 'M74,116 C72,118 70,120 68,122 L66,126 C68,126 72,124 76,122 L78,120 L74,116 Z',
    fibers: ['M76,118 C72,120 68,124 66,126'] },
  // Right teres minor
  { muscle: 'back',
    d: 'M126,116 C128,118 130,120 132,122 L134,126 C132,126 128,124 124,122 L122,120 L126,116 Z',
    fibers: ['M124,118 C128,120 132,124 134,126'] },
  // Left teres major
  { muscle: 'back',
    d: 'M72,122 C70,126 68,130 66,134 L64,138 C66,138 70,134 74,130 L78,126 L72,122 Z',
    fibers: ['M76,124 C72,128 68,134 64,138', 'M74,124 C70,128 66,134 64,138'] },
  // Right teres major
  { muscle: 'back',
    d: 'M128,122 C130,126 132,130 134,134 L136,138 C134,138 130,134 126,130 L122,126 L128,122 Z',
    fibers: ['M124,124 C128,128 132,134 136,138', 'M126,124 C130,128 134,134 136,138'] },

  // ===== RHOMBOIDS (deep, between scapula and spine) =====
  // Left rhomboid
  { muscle: 'back',
    d: 'M96,88 C94,92 92,98 90,104 C88,110 88,116 88,120 L84,118 C84,112 86,104 88,96 C90,92 92,88 96,86 Z',
    fibers: ['M94,90 C92,96 90,104 88,114', 'M96,88 C94,94 92,102 90,112'] },
  // Right rhomboid
  { muscle: 'back',
    d: 'M104,88 C106,92 108,98 110,104 C112,110 112,116 112,120 L116,118 C116,112 114,104 112,96 C110,92 108,88 104,86 Z',
    fibers: ['M106,90 C108,96 110,104 112,114', 'M104,88 C106,94 108,102 110,112'] },

  // ===== LATISSIMUS DORSI =====
  // Left lat (large, from armpit down to lower back)
  { muscle: 'back',
    d: 'M66,126 C64,134 64,144 66,156 C68,168 72,178 78,186 L88,180 C84,172 80,162 78,150 C76,140 76,132 78,126 L72,122 L66,126 Z',
    fibers: ['M68,128 C66,142 68,160 76,178', 'M70,126 C68,140 70,158 78,176', 'M72,124 C70,138 72,156 80,174', 'M66,134 C66,148 68,164 76,182'] },
  // Right lat
  { muscle: 'back',
    d: 'M134,126 C136,134 136,144 134,156 C132,168 128,178 122,186 L112,180 C116,172 120,162 122,150 C124,140 124,132 122,126 L128,122 L134,126 Z',
    fibers: ['M132,128 C134,142 132,160 124,178', 'M130,126 C132,140 130,158 122,176', 'M128,124 C130,138 128,156 120,174', 'M134,134 C134,148 132,164 124,182'] },

  // ===== ERECTOR SPINAE & LOWER BACK =====
  // Center spinal erectors (left)
  { muscle: 'back',
    d: 'M96,86 Q98,90 100,86 L100,180 Q98,182 96,180 L94,130 Z',
    fibers: ['M96,90 L96,178', 'M98,88 L98,180'] },
  // Center spinal erectors (right)
  { muscle: 'back',
    d: 'M100,86 Q102,90 104,86 L106,130 L104,180 Q102,182 100,180 Z',
    fibers: ['M104,90 L104,178', 'M102,88 L102,180'] },
  // Lower back left erector / multifidus
  { muscle: 'back',
    d: 'M90,180 Q96,186 100,180 L100,218 Q96,222 90,218 C88,210 88,196 90,180 Z',
    fibers: ['M92,184 C92,196 92,208 92,218', 'M96,186 C96,198 96,210 96,220', 'M90,188 C90,200 90,210 90,218'] },
  // Lower back right erector
  { muscle: 'back',
    d: 'M100,180 Q104,186 110,180 C112,196 112,210 110,218 Q104,222 100,218 Z',
    fibers: ['M108,184 C108,196 108,208 108,218', 'M104,186 C104,198 104,210 104,220', 'M110,188 C110,200 110,210 110,218'] },

  // ===== TRICEPS =====
  // Left triceps long head (inner/medial)
  { muscle: 'triceps',
    d: 'M60,120 C58,128 56,138 54,148 C52,156 52,162 54,168 C56,170 58,168 60,162 C62,154 62,146 62,138 C62,130 62,126 60,120 Z',
    fibers: ['M60,122 C58,134 56,148 54,162', 'M62,124 C60,136 58,150 56,164'] },
  // Left triceps lateral head (outer)
  { muscle: 'triceps',
    d: 'M54,112 C52,118 50,128 48,138 C46,148 46,156 48,164 C50,168 52,166 54,158 C54,148 54,138 54,128 C54,120 54,116 54,112 Z',
    fibers: ['M54,114 C52,126 50,140 48,156', 'M52,116 C50,128 48,142 46,158'] },
  // Right triceps long head
  { muscle: 'triceps',
    d: 'M140,120 C142,128 144,138 146,148 C148,156 148,162 146,168 C144,170 142,168 140,162 C138,154 138,146 138,138 C138,130 138,126 140,120 Z',
    fibers: ['M140,122 C142,134 144,148 146,162', 'M138,124 C140,136 142,150 144,164'] },
  // Right triceps lateral head
  { muscle: 'triceps',
    d: 'M146,112 C148,118 150,128 152,138 C154,148 154,156 152,164 C150,168 148,166 146,158 C146,148 146,138 146,128 C146,120 146,116 146,112 Z',
    fibers: ['M146,114 C148,126 150,140 152,156', 'M148,116 C150,128 152,142 154,158'] },

  // ===== FOREARMS (posterior) =====
  // Left forearm extensor group
  { muscle: 'forearms',
    d: 'M48,168 C46,176 44,188 42,200 C42,210 42,220 42,228 L48,228 C50,220 52,208 52,196 C52,186 52,178 52,170 L48,168 Z',
    fibers: ['M50,170 C48,184 44,200 42,218', 'M52,172 C50,186 46,202 44,220'] },
  // Right forearm extensor group
  { muscle: 'forearms',
    d: 'M152,168 C154,176 156,188 158,200 C158,210 158,220 158,228 L152,228 C150,220 148,208 148,196 C148,186 148,178 148,170 L152,168 Z',
    fibers: ['M150,170 C152,184 156,200 158,218', 'M148,172 C150,186 154,202 156,220'] },

  // ===== HANDS =====
  { muscle: null,
    d: 'M44,228 C42,232 40,238 42,242 C44,246 48,244 50,240 L48,228 Z' },
  { muscle: null,
    d: 'M156,228 C158,232 160,238 158,242 C156,246 152,244 150,240 L152,228 Z' },

  // ===== GLUTES =====
  // Left gluteus medius (upper outer glute)
  { muscle: 'glutes',
    d: 'M88,216 C84,218 80,222 78,228 C76,234 78,238 82,238 L88,234 C88,230 88,224 90,220 L88,216 Z',
    fibers: ['M86,218 C82,224 78,232 80,238', 'M88,218 C84,224 80,232 82,238'] },
  // Left gluteus maximus (main glute mass)
  { muscle: 'glutes',
    d: 'M82,238 C78,242 76,248 78,254 C80,260 86,262 94,260 Q98,258 100,254 L100,228 Q96,222 90,220 L88,234 L82,238 Z',
    fibers: ['M86,236 C82,244 78,252 82,260', 'M90,232 C86,240 82,250 86,260', 'M94,228 C90,238 86,248 88,258', 'M88,234 C84,242 80,252 84,262'] },
  // Right gluteus medius
  { muscle: 'glutes',
    d: 'M112,216 C116,218 120,222 122,228 C124,234 122,238 118,238 L112,234 C112,230 112,224 110,220 L112,216 Z',
    fibers: ['M114,218 C118,224 122,232 120,238', 'M112,218 C116,224 120,232 118,238'] },
  // Right gluteus maximus
  { muscle: 'glutes',
    d: 'M118,238 C122,242 124,248 122,254 C120,260 114,262 106,260 Q102,258 100,254 L100,228 Q104,222 110,220 L112,234 L118,238 Z',
    fibers: ['M114,236 C118,244 122,252 118,260', 'M110,232 C114,240 118,250 114,260', 'M106,228 C110,238 114,248 112,258', 'M112,234 C116,242 120,252 116,262'] },

  // ===== HAMSTRINGS =====
  // Left biceps femoris (outer hamstring)
  { muscle: 'hamstrings',
    d: 'M82,260 C80,270 78,282 80,294 C82,302 84,308 86,312 Q88,314 90,312 C90,304 88,292 88,280 C88,270 86,264 84,260 L82,260 Z',
    fibers: ['M84,262 C82,274 80,288 82,302 C84,308 86,312', 'M86,262 C84,274 82,288 84,302 C86,308 88,312', 'M82,264 C80,276 78,290 80,302 C82,308 84,312'] },
  // Left semitendinosus (middle hamstring)
  { muscle: 'hamstrings',
    d: 'M90,260 C90,270 90,282 90,294 C90,302 92,308 94,312 L96,310 C96,302 96,290 96,278 C96,268 94,262 92,260 L90,260 Z',
    fibers: ['M92,262 C92,276 92,290 94,306', 'M94,262 C94,276 94,290 96,306'] },
  // Left semimembranosus (inner hamstring)
  { muscle: 'hamstrings',
    d: 'M94,258 C96,264 98,274 98,286 C98,296 96,304 96,310 L100,310 C100,300 100,288 100,276 C100,266 98,258 96,256 L94,258 Z',
    fibers: ['M96,260 C98,272 98,286 98,302', 'M98,260 C100,272 100,286 100,302'] },
  // Right biceps femoris
  { muscle: 'hamstrings',
    d: 'M118,260 C120,270 122,282 120,294 C118,302 116,308 114,312 Q112,314 110,312 C110,304 112,292 112,280 C112,270 114,264 116,260 L118,260 Z',
    fibers: ['M116,262 C118,274 120,288 118,302 C116,308 114,312', 'M114,262 C116,274 118,288 116,302 C114,308 112,312', 'M118,264 C120,276 122,290 120,302 C118,308 116,312'] },
  // Right semitendinosus
  { muscle: 'hamstrings',
    d: 'M110,260 C110,270 110,282 110,294 C110,302 108,308 106,312 L104,310 C104,302 104,290 104,278 C104,268 106,262 108,260 L110,260 Z',
    fibers: ['M108,262 C108,276 108,290 106,306', 'M106,262 C106,276 106,290 104,306'] },
  // Right semimembranosus
  { muscle: 'hamstrings',
    d: 'M106,258 C104,264 102,274 102,286 C102,296 104,304 104,310 L100,310 C100,300 100,288 100,276 C100,266 102,258 104,256 L106,258 Z',
    fibers: ['M104,260 C102,272 102,286 102,302', 'M102,260 C100,272 100,286 100,302'] },

  // ===== KNEE BACKS =====
  { muscle: null,
    d: 'M84,314 C84,318 84,322 86,326 Q90,328 94,326 C94,322 94,318 92,314 Q88,312 84,314 Z' },
  { muscle: null,
    d: 'M116,314 C116,318 116,322 114,326 Q110,328 106,326 C106,322 106,318 108,314 Q112,312 116,314 Z' },

  // ===== CALVES (posterior) =====
  // Left gastrocnemius medial head
  { muscle: 'calves',
    d: 'M90,326 C88,332 88,340 88,348 C88,354 90,360 92,364 L94,362 C94,356 94,348 94,340 C94,334 92,330 90,326 Z',
    fibers: ['M92,328 C90,338 90,350 92,362', 'M94,330 C92,340 92,352 94,362'] },
  // Left gastrocnemius lateral head
  { muscle: 'calves',
    d: 'M86,326 C84,332 82,340 82,348 C82,354 84,358 86,360 L88,356 C88,350 88,342 88,334 C88,330 88,328 86,326 Z',
    fibers: ['M86,328 C84,338 82,348 84,358', 'M88,328 C86,338 84,348 86,358'] },
  // Left soleus (wider, below gastroc)
  { muscle: 'calves',
    d: 'M84,358 C84,362 84,368 86,372 L92,376 L94,374 C94,368 94,364 94,360 L92,362 L86,360 L84,358 Z',
    fibers: ['M86,360 C86,366 86,372 88,376', 'M90,362 C90,368 92,374 92,376'] },
  // Right gastrocnemius medial head
  { muscle: 'calves',
    d: 'M110,326 C112,332 112,340 112,348 C112,354 110,360 108,364 L106,362 C106,356 106,348 106,340 C106,334 108,330 110,326 Z',
    fibers: ['M108,328 C110,338 110,350 108,362', 'M106,330 C108,340 108,352 106,362'] },
  // Right gastrocnemius lateral head
  { muscle: 'calves',
    d: 'M114,326 C116,332 118,340 118,348 C118,354 116,358 114,360 L112,356 C112,350 112,342 112,334 C112,330 112,328 114,326 Z',
    fibers: ['M114,328 C116,338 118,348 116,358', 'M112,328 C114,338 116,348 114,358'] },
  // Right soleus
  { muscle: 'calves',
    d: 'M116,358 C116,362 116,368 114,372 L108,376 L106,374 C106,368 106,364 106,360 L108,362 L114,360 L116,358 Z',
    fibers: ['M114,360 C114,366 114,372 112,376', 'M110,362 C110,368 108,374 108,376'] },

  // ===== FEET =====
  { muscle: null,
    d: 'M86,376 C84,379 86,383 92,383 L94,380 C94,378 92,376 88,376 Z' },
  { muscle: null,
    d: 'M114,376 C116,379 114,383 108,383 L106,380 C106,378 108,376 112,376 Z' },
];

// ============================================================
// Component
// ============================================================
export function BodyGraph({ refreshKey, embedded }: BodyGraphProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [filter, setFilter] = useState<TimeFilter>('7days');
  const [muscleData, setMuscleData] = useState<Record<MuscleGroup, MuscleVolumeData> | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });
    return () => handle.cancel();
  }, []);

  useEffect(() => {
    if (ready) loadData();
  }, [filter, refreshKey, ready]);

  const loadData = async () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = new Date(end);
    if (filter === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (filter === '7days') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }
    const result = await getWorkoutsForDateRange(start.toISOString(), end.toISOString());
    if (result.success && result.workouts) {
      setMuscleData(calculateMuscleVolumes(result.workouts));
    }
  };

  const getFill = (panel: BodyPanel): string => {
    if (!panel.muscle) return INACTIVE_FILL;
    if (!muscleData) return PANEL_FILL;
    return getHeatColor(muscleData[panel.muscle].normalizedIntensity);
  };

  const getStroke = (panel: BodyPanel): string => {
    if (panel.muscle && selectedMuscle === panel.muscle) return SELECTED_STROKE;
    return STROKE_COLOR;
  };

  const getStrokeW = (panel: BodyPanel): number => {
    if (panel.muscle && selectedMuscle === panel.muscle) return SELECTED_WIDTH;
    return STROKE_WIDTH;
  };

  const screenWidth = Dimensions.get('window').width;
  const svgWidth = (screenWidth - s(80)) / 2;
  const svgHeight = svgWidth * 2;

  const selected = selectedMuscle && muscleData ? muscleData[selectedMuscle] : null;

  const renderPanels = (panels: BodyPanel[], prefix: string) =>
    panels.map((panel, i) => (
      <Path
        key={`${prefix}-${i}`}
        d={panel.d}
        fill={getFill(panel)}
        stroke={getStroke(panel)}
        strokeWidth={getStrokeW(panel)}
        strokeLinejoin="round"
        onPress={
          panel.muscle
            ? () => setSelectedMuscle(selectedMuscle === panel.muscle ? null : panel.muscle)
            : undefined
        }
      />
    ));

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      <Text style={styles.title}>Muscle Activation</Text>

      <View style={styles.filterRow}>
        {(['today', '7days', '30days'] as TimeFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => { setFilter(f); setSelectedMuscle(null); }}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f === 'today' ? 'Today' : f === '7days' ? '7 Days' : '30 Days'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!ready ? (
        <View style={styles.loadingBody}>
          <ActivityIndicator size="small" color="#56D4F4" />
        </View>
      ) : (
        <View style={styles.bodyRow}>
          <View style={styles.bodyColumn}>
            <Text style={styles.viewLabel}>Front</Text>
            <Svg width={svgWidth} height={svgHeight} viewBox="0 0 200 400">
              {renderPanels(FRONT_PANELS, 'front')}
            </Svg>
          </View>
          <View style={styles.bodyColumn}>
            <Text style={styles.viewLabel}>Back</Text>
            <Svg width={svgWidth} height={svgHeight} viewBox="0 0 200 400">
              {renderPanels(BACK_PANELS, 'back')}
            </Svg>
          </View>
        </View>
      )}

      <View style={styles.intensityLegend}>
        <Text style={styles.legendLabel}>Low</Text>
        <View style={styles.gradientBar}>
          {['#17405E', '#1A6B8E', '#0D9AC4', '#2DC8EE', '#56D4F4', '#88E3FA'].map((c, i) => (
            <View key={i} style={[styles.gradientSegment, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={styles.legendLabel}>High</Text>
      </View>

      {selectedMuscle && selected && (
        <View style={styles.popup}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>{MUSCLE_DISPLAY_NAMES[selectedMuscle]}</Text>
            <TouchableOpacity
              onPress={() => setSelectedMuscle(null)}
              hitSlop={{ top: s(10), bottom: s(10), left: s(10), right: s(10) }}
            >
              <Ionicons name="close-circle" size={s(20)} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.popupStats}>
            <View style={styles.popupStat}>
              <Text style={styles.popupStatValue}>{formatVolume(selected.volume)}</Text>
              <Text style={styles.popupStatLabel}>kg volume</Text>
            </View>
            <View style={styles.popupStat}>
              <Text style={styles.popupStatValue}>{Math.round(selected.normalizedIntensity * 100)}%</Text>
              <Text style={styles.popupStatLabel}>intensity</Text>
            </View>
            <View style={styles.popupStat}>
              <Text style={styles.popupStatValue}>{formatDate(selected.lastTrained)}</Text>
              <Text style={styles.popupStatLabel}>last trained</Text>
            </View>
          </View>
          {selected.exercises.length > 0 && (
            <Text style={styles.popupExercises}>{selected.exercises.join(', ')}</Text>
          )}
          {selected.volume === 0 && (
            <Text style={styles.popupEmpty}>Not trained in this period</Text>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    backgroundColor: c.card,
    marginHorizontal: s(20),
    marginTop: s(12),
    padding: s(16),
    borderRadius: s(10),
  },
  containerEmbedded: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginTop: 0,
    padding: s(12),
    borderRadius: 0,
  },
  title: {
    fontSize: s(14),
    fontFamily: 'Inter_700Bold',
    color: c.text,
    marginBottom: s(8),
    letterSpacing: s(-0.3),
  },
  filterRow: { flexDirection: 'row', gap: s(6), marginBottom: s(8) },
  pill: {
    paddingHorizontal: s(10),
    paddingVertical: s(4),
    borderRadius: s(12),
    backgroundColor: c.border,
  },
  pillActive: { backgroundColor: '#2DC8EE' },
  pillText: { fontSize: s(11), fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  pillTextActive: { color: c.bg },
  loadingBody: { height: s(300), alignItems: 'center', justifyContent: 'center' },
  bodyRow: { flexDirection: 'row', justifyContent: 'center', gap: s(8) },
  bodyColumn: { alignItems: 'center' },
  viewLabel: {
    fontSize: s(10),
    fontFamily: 'Inter_700Bold',
    color: c.textMuted,
    marginBottom: s(4),
    textTransform: 'uppercase',
    letterSpacing: s(1),
  },
  intensityLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: s(8),
    gap: s(6),
  },
  legendLabel: {
    fontSize: s(9),
    fontFamily: 'Inter_600SemiBold',
    color: c.textMuted,
  },
  gradientBar: {
    flexDirection: 'row',
    borderRadius: s(3),
    overflow: 'hidden',
  },
  gradientSegment: {
    width: s(16),
    height: s(5),
  },
  popup: {
    marginTop: s(14),
    backgroundColor: c.border,
    borderRadius: s(12),
    padding: s(14),
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s(10),
  },
  popupTitle: { fontSize: s(16), fontFamily: 'Inter_700Bold', color: c.text },
  popupStats: { flexDirection: 'row', gap: s(8) },
  popupStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.card,
    paddingVertical: s(10),
    borderRadius: s(8),
  },
  popupStatValue: { fontSize: s(15), fontFamily: 'Inter_700Bold', color: '#56D4F4' },
  popupStatLabel: { fontSize: s(10), color: c.textMuted, marginTop: s(2), fontFamily: 'Inter_500Medium' },
  popupExercises: { marginTop: s(10), fontSize: s(12), color: c.textSecondary, lineHeight: s(18) },
  popupEmpty: { marginTop: s(8), fontSize: s(12), color: c.textMuted, fontStyle: 'italic' },
});
