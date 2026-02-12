import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export interface AIInsight {
  prediction: { percent: number; sessions: number | null; reasoning: string };
  recommendation: {
    action: 'increase' | 'hold' | 'decrease';
    weight: number;
    text: string;
    reasoning: string;
  };
  projectedPoints: { date: string; value: number }[];
}

// In-memory cache: key → { data, timestamp }
const cache = new Map<string, { data: AIInsight; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getAIPrediction(
  exerciseName: string,
  dataPoints: { date: string; value: number }[],
  target: number,
): Promise<AIInsight | null> {
  if (dataPoints.length < 2 || target <= 0) return null;

  const cacheKey = `${exerciseName}|${dataPoints.length}|${target}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const history = dataPoints
    .map((p) => `${p.date}: ${p.value}kg`)
    .join('\n');

  const prompt = `You are a strength training coach AI. Analyze this workout data and provide predictions.

Exercise: ${exerciseName}
Target: ${target}kg
Session history (date → best working weight in kg):
${history}

Based on the progression pattern, training frequency, and exercise type, respond with ONLY valid JSON (no markdown, no code fences, no explanation):
{"prediction":{"percent":<0-100 integer chance of hitting target>,"sessions":<estimated sessions needed as integer, or null if declining>,"reasoning":"<1-2 sentence explanation of why this probability>"},"recommendation":{"action":"increase"|"hold"|"decrease","weight":<recommended next session weight as integer in kg>,"text":"<brief 5-8 word coaching tip>","reasoning":"<1-2 sentence explanation of this recommendation>"},"projectedPoints":[<4 objects with "date":"YYYY-MM-DD" and "value":<projected kg as integer>, spaced by the user's average training frequency>]}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn('Gemini API error:', response.status);
      return null;
    }

    const json = await response.json();

    // 2.5 Flash may return thinking + text parts — grab the last text part
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    let rawText = '';
    for (const part of parts) {
      if (part.text) rawText = part.text;
    }

    if (!rawText) {
      console.warn('Gemini returned no text');
      return null;
    }

    // Strip any markdown fences the model might add
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    let parsed: AIInsight;
    try {
      parsed = JSON.parse(cleaned) as AIInsight;
    } catch (parseErr) {
      console.warn('JSON parse failed. Raw text:', rawText);
      return null;
    }

    // Basic validation
    if (
      typeof parsed.prediction?.percent !== 'number' ||
      !parsed.recommendation?.action ||
      !Array.isArray(parsed.projectedPoints)
    ) {
      console.warn('Gemini response validation failed:', JSON.stringify(parsed));
      return null;
    }

    // Clamp percent
    parsed.prediction.percent = Math.max(
      0,
      Math.min(100, Math.round(parsed.prediction.percent)),
    );

    cache.set(cacheKey, { data: parsed, ts: Date.now() });
    return parsed;
  } catch (err) {
    console.warn('Gemini prediction failed:', err);
    return null;
  }
}
