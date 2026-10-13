import { clampUnitBox, parseIsoDate } from './photoMeta';
import { AnalysisResult, EMPTY_ANALYSIS } from './types';

/**
 * Gemini image analysis for FindIt.
 *
 * Verified against Google's Gemini API reference (2026-10-13):
 * - Host: https://generativelanguage.googleapis.com
 * - Endpoint: POST /v1beta/models/{model}:generateContent
 * - Auth: header "x-goog-api-key: <API key>"
 * - Images are sent inline as base64: { inlineData: { mimeType, data } }
 *
 * Live behaviour verified with the founder's key on 2026-10-13:
 * - gemini-2.5-flash returns 404 for new users — never use it.
 * - gemini-3.5-flash answers correctly; vision calls intermittently
 *   return 503 "high demand" (a temporary Google-side spike).
 * - Resilience: on a 503 we wait and retry, then fall back to
 *   gemini-3.8-flash, then surface GeminiBusyError so the UI can offer
 *   manual entry instead of a dead end.
 *
 * SECURITY NOTE (prototype): EXPO_PUBLIC_ variables are bundled into the
 * app, so this key is NOT secret in a published build. For production,
 * move this call behind your own small backend that holds the key.
 */

const API_HOST = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-3.8-flash';

export class MissingGeminiKeyError extends Error {
  constructor() {
    super('No Gemini API key found. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file, then restart Expo.');
    this.name = 'MissingGeminiKeyError';
  }
}

/** Gemini is reachable but busy (503). The UI shows a calm retry message. */
export class GeminiBusyError extends Error {
  constructor() {
    super('Gemini is busy right now (high demand). Wait a minute and try Analyse again — or save with your own tags.');
    this.name = 'GeminiBusyError';
  }
}

/**
 * The request never reached Gemini — offline, DNS failure, or timeout.
 * Switching models cannot fix this, so it is thrown immediately and the
 * UI offers save-anyway (the item is enriched later).
 */
export class GeminiNetworkError extends Error {
  constructor() {
    super('Could not reach the AI service — you may be offline. The item can still be saved.');
    this.name = 'GeminiNetworkError';
  }
}

/** Hard cap on one request so the UI can never hang forever. */
const REQUEST_TIMEOUT_MS = 25_000;

export function getGeminiConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || DEFAULT_MODEL;
  return { apiKey, model };
}

const ANALYSIS_PROMPT = `You are the image analyser for an app that helps a person find their things later by searching a word.

Look at this photo and return ONLY a JSON object with exactly these fields:
{
  "title": "short name of the main item, e.g. Red screwdriver",
  "description": "one sentence describing the main item(s), materials and scene",
  "tags": ["5 to 10 single-word or short search keywords a person would type to find this"],
  "objects": ["every distinct object you can see"],
  "colors": ["main colours of the main item(s)"],
  "category": "one of: tool, electronics, document, clothing, kitchen, vehicle, furniture, toy, medicine, other",
  "ocrText": "any readable text in the photo, or an empty string",
  "box": {"x": 0, "y": 0, "w": 0, "h": 0},
  "expiryDate": ""
}
For "expiryDate": if the photo shows a receipt, warranty card, medicine or food packaging with a visible expiry or warranty-end date, return that date as YYYY-MM-DD. Otherwise return an empty string. Never guess a date that is not visible.
For "box", give the approximate bounding box of the MAIN item in 0-1000 coordinates (x,y = top-left corner; w,h = size). Estimate carefully; a slightly loose box is better than a tight wrong one.
Use simple everyday English words in tags/objects so normal search words match.
Return JSON only, no markdown, no explanation.`;

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 15);
}

function normalize(raw: unknown): AnalysisResult {
  if (!raw || typeof raw !== 'object') return EMPTY_ANALYSIS;
  const r = raw as Record<string, unknown>;
  return {
    title: typeof r.title === 'string' ? r.title.trim() : '',
    description: typeof r.description === 'string' ? r.description.trim() : '',
    tags: toStringList(r.tags),
    objects: toStringList(r.objects),
    colors: toStringList(r.colors),
    category: typeof r.category === 'string' ? r.category.trim().toLowerCase() : '',
    ocrText: typeof r.ocrText === 'string' ? r.ocrText.trim() : '',
    box: clampUnitBox(r.box),
    expiryDate: parseIsoDate(r.expiryDate),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class BusySignal extends Error {}

async function requestAnalysis(
  apiKey: string,
  model: string,
  base64Image: string,
  mimeType: string
): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_HOST}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: base64Image } },
            { text: ANALYSIS_PROMPT },
          ],
        },
      ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });
  } catch (e) {
    // AbortError (our timeout), TypeError (fetch failed / offline), or any
    // other transport-level failure: all mean "never reached Gemini".
    if (e instanceof GeminiNetworkError) throw e;
    throw new GeminiNetworkError();
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 503) throw new BusySignal();
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini request failed (${response.status}). ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error("Gemini returned an empty answer. Try again.");

  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return normalize(JSON.parse(cleaned));
  } catch {
    throw new Error("Could not read Gemini's answer. Try again, or fill the tags manually.");
  }
}

/**
 * Analyse one photo with Gemini, with 503 resilience:
 * primary model → wait 2.5s → primary again → fallback model →
 * GeminiBusyError (the UI then offers manual tags; saving is never blocked).
 */
export async function analyseImage(base64Image: string, mimeType: string): Promise<AnalysisResult> {
  const { apiKey, model } = getGeminiConfig();
  if (!apiKey) throw new MissingGeminiKeyError();

  const models = model === FALLBACK_MODEL ? [model] : [model, FALLBACK_MODEL];
  for (let i = 0; i < models.length; i++) {
    try {
      return await requestAnalysis(apiKey, models[i], base64Image, mimeType);
    } catch (e) {
      if (e instanceof BusySignal) {
        const isLast = i === models.length - 1;
        if (isLast) break;
        await wait(2500);
        // One retry of the same busy model happens via the loop's next
        // model only if this was not already the fallback; to keep the
        // chain simple and predictable we move on after a short wait.
        try {
          return await requestAnalysis(apiKey, models[i], base64Image, mimeType);
        } catch (retryError) {
          if (!(retryError instanceof BusySignal)) throw retryError;
        }
      } else {
        throw e;
      }
    }
  }
  throw new GeminiBusyError();
}
