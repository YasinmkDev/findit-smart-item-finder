import { ItemPhoto } from './types';

/**
 * Smart place suggestion — pure local logic, no AI, no cost.
 *
 * Given the user's existing items and (optionally) the category the AI
 * detected for the new photo, guess where the new item most likely
 * goes, with a human reason:
 *  1. The place where most items of the same category already live.
 *  2. Otherwise, the most recently used place.
 * Returns null when there is no history to learn from.
 */
export interface PlaceGuess {
  place: string;
  reason: string;
}

export function guessPlace(items: ItemPhoto[], category?: string): PlaceGuess | null {
  const withPlace = items.filter((i) => i.locationLabel.trim() !== '');
  if (withPlace.length === 0) return null;

  const cat = (category ?? '').trim().toLowerCase();
  if (cat) {
    const counts = new Map<string, number>();
    for (const item of withPlace) {
      if (item.category.trim().toLowerCase() === cat) {
        const place = item.locationLabel.trim();
        counts.set(place, (counts.get(place) ?? 0) + 1);
      }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [place, count] of counts) {
      if (count > bestCount) {
        best = place;
        bestCount = count;
      }
    }
    if (best) {
      return {
        place: best,
        reason:
          bestCount === 1
            ? `Your other ${cat} lives here`
            : `${bestCount} of your ${cat}s live here`,
      };
    }
  }

  const sorted = [...withPlace].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recent = sorted[0].locationLabel.trim();
  return { place: recent, reason: 'Your most recent place' };
}

/** Auto title used when the AI could not name the item — never blank, never blocks saving. */
export function fallbackTitle(now = new Date()): string {
  const date = now.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `Item · ${date}, ${time}`;
}
