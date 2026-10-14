/**
 * Photo metadata helpers — the useful subset of EXIF/library metadata.
 *
 * What we keep and why:
 *  - Date/time the photo was TAKEN (not when it was stashed): powers
 *    honest dates on old gallery photos and month/year search.
 *  - Dimensions: free, occasionally useful for display/diagnostics.
 *
 * What we deliberately do NOT extract: GPS coordinates. A photo's GPS
 * says where the camera was, not where the item is kept — and precise
 * location history is a privacy liability the product does not need.
 */

/** Parse an EXIF DateTimeOriginal ("2026:10:15 07:42:39") into an ISO string. */
export function parseExifDateTime(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const m = raw.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(date.getTime())) return undefined;
  // Guard against nonsense EXIF (e.g. 0000:00:00 from some cameras).
  if (y < 1990 || y > 2100) return undefined;
  return date.toISOString();
}

/** MediaLibrary creationTime is epoch milliseconds; 0/invalid → undefined. */
export function isoFromEpochMs(ms?: number | null): string | undefined {
  if (!ms || typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return undefined;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * Searchable date words for an item, e.g. "october 2026" — lets users
 * find things by when the photo was taken ("passport october").
 */
export function dateSearchText(item: { photoTakenAt?: string; createdAt: string }): string {
  const iso = item.photoTakenAt || item.createdAt;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

import { UnitBox } from './types';

/** Clamp a Gemini bounding box into 0..1000 with a sane minimum size. */
export function clampUnitBox(raw: unknown): UnitBox | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const x = num(r.x);
  const y = num(r.y);
  const w = num(r.w);
  const h = num(r.h);
  if ([x, y, w, h].some(Number.isNaN)) return undefined;
  const cx = Math.min(Math.max(x, 0), 950);
  const cy = Math.min(Math.max(y, 0), 950);
  const cw = Math.min(Math.max(w, 50), 1000 - cx);
  const ch = Math.min(Math.max(h, 50), 1000 - cy);
  return { x: Math.round(cx), y: Math.round(cy), w: Math.round(cw), h: Math.round(ch) };
}

/** Convert a 0..1000 box to pixel crop geometry for a known image size. */
export function boxToPixels(
  box: UnitBox,
  imgW: number,
  imgH: number
): { originX: number; originY: number; width: number; height: number } | null {
  if (!imgW || !imgH || imgW <= 0 || imgH <= 0) return null;
  const originX = Math.round((box.x / 1000) * imgW);
  const originY = Math.round((box.y / 1000) * imgH);
  const width = Math.max(16, Math.min(Math.round((box.w / 1000) * imgW), imgW - originX));
  const height = Math.max(16, Math.min(Math.round((box.h / 1000) * imgH), imgH - originY));
  if (width <= 0 || height <= 0) return null;
  return { originX, originY, width, height };
}

/** Validate + normalise a YYYY-MM-DD date string. Returns undefined when invalid. */
export function parseIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Whole days from `now` until a YYYY-MM-DD date (negative = already past). */
export function daysUntil(dateIso: string, now: Date = new Date()): number {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const target = Date.UTC(y, mo - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** Human label for an expiry: "Expired 3 days ago", "Expires today", "12 days left". */
export function expiryLabel(dateIso: string, now: Date = new Date()): string {
  const days = daysUntil(dateIso, now);
  if (days < 0) return days === -1 ? 'Expired yesterday' : `Expired ${-days} days ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
}

/** True when two ISO dates fall on different calendar days. */
export function isDifferentDay(aIso?: string, bIso?: string): boolean {
  if (!aIso || !bIso) return false;
  const a = new Date(aIso);
  const b = new Date(bIso);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}
