import { Share } from 'react-native';
import { NO_PLACE, placeNameOf } from './places';
import { ItemPhoto } from './types';

/**
 * Household sharing, prototype layer (v0.11).
 *
 * The honest scope: there is no FindIt account system yet, so sharing
 * rides the platform share sheet — a family member receives a clean
 * text summary ("Passport — Bedroom, blue drawer. Marked: …") they can
 * keep in any app. When accounts/sync land, these same summaries
 * become the payload of shared places. Text only: a share never
 * attaches the photo file itself, and sensitive items share nothing
 * beyond what the owner explicitly confirms by tapping share.
 */

export function itemShareText(item: ItemPhoto): string {
  const lines: string[] = [`${item.title || 'Untitled item'}`];
  const place = placeNameOf(item);
  lines.push(place === NO_PLACE ? 'No place noted yet' : `Kept in: ${place}`);
  if (item.markerNote) lines.push(`Marked on the photo: ${item.markerNote}`);
  if (item.lentTo) lines.push(`Currently with: ${item.lentTo}`);
  if (item.expiresAt) lines.push(`Warranty / expiry: ${item.expiresAt}`);
  if (item.description) lines.push(item.description);
  lines.push('Shared from FindIt');
  return lines.join('\n');
}

export function placeShareText(placeName: string, items: ItemPhoto[]): string {
  const lines: string[] = [`${placeName} — ${items.length} item${items.length === 1 ? '' : 's'} stashed here:`, ''];
  for (const item of items) {
    // A place list should not leak what a shielded item is.
    lines.push(`• ${item.sensitive ? 'Private item' : item.title || 'Untitled item'}`);
  }
  lines.push('', 'Shared from FindIt');
  return lines.join('\n');
}

export type ShareOutcome = 'shared' | 'dismissed' | 'unavailable';

/** Open the system share sheet. Never throws. */
export async function shareText(title: string, text: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ title, message: text });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'unavailable';
  }
}
