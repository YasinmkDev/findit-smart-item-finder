import { ItemPhoto } from './types';

/**
 * Places are the user's mental model ("the garage", "the blue drawer").
 * In v0.4 they are derived from the "where I kept it" note the user
 * already writes — no new data model, a new way of seeing the same data.
 */
export const NO_PLACE = 'No place yet';

export function placeNameOf(item: ItemPhoto): string {
  const label = item.locationLabel.trim();
  return label.length > 0 ? label : NO_PLACE;
}

export interface Place {
  name: string;
  items: ItemPhoto[];
  /** Most recent item — its photo is the place's cover. */
  cover: ItemPhoto;
  latestAt: string;
}

export function derivePlaces(items: ItemPhoto[]): Place[] {
  const byName = new Map<string, ItemPhoto[]>();
  for (const item of items) {
    const name = placeNameOf(item);
    const list = byName.get(name) ?? [];
    list.push(item);
    byName.set(name, list);
  }
  const places: Place[] = [];
  for (const [name, list] of byName.entries()) {
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    places.push({ name, items: sorted, cover: sorted[0], latestAt: sorted[0].createdAt });
  }
  // Real places first (by size), "No place yet" always last.
  return places.sort((a, b) => {
    if (a.name === NO_PLACE) return 1;
    if (b.name === NO_PLACE) return -1;
    return b.items.length - a.items.length || b.latestAt.localeCompare(a.latestAt);
  });
}

/** Distinct place names for capture-time chips, most used first. */
export function placeSuggestions(items: ItemPhoto[], limit = 6): string[] {
  return derivePlaces(items)
    .filter((p) => p.name !== NO_PLACE)
    .slice(0, limit)
    .map((p) => p.name);
}
