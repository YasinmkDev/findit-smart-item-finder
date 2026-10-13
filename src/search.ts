import { dateSearchText } from './photoMeta';
import { ItemPhoto } from './types';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

function includesWord(field: string, word: string): boolean {
  return field.toLowerCase().includes(word);
}

function listScore(list: string[], word: string, exactPoints: number, partialPoints: number): number {
  let score = 0;
  for (const entry of list) {
    const value = entry.toLowerCase();
    if (value === word) score += exactPoints;
    else if (value.includes(word) || word.includes(value)) score += partialPoints;
  }
  return score;
}

/**
 * Ranked keyword search over everything Gemini + the user noted about an item.
 * A photo of a red screwdriver should win for "screwdriver", "red tool",
 * and even "garage" (if that is where the user said it is kept).
 */
/** Question filler — "who has my drill?" should search for "drill". */
const STOPWORDS = new Set(['who', 'has', 'have', 'my', 'the', 'where', 'is', 'what', 'does', 'with', 'a', 'an']);

export function scoreItem(item: ItemPhoto, query: string): number {
  const words = tokenize(query).filter((w) => !STOPWORDS.has(w));
  if (words.length === 0) return 0;

  let score = 0;
  for (const word of words) {
    score += listScore(item.tags, word, 10, 5);
    score += listScore(item.objects, word, 10, 5);
    score += listScore(item.colors, word, 6, 3);
    if (includesWord(item.title, word)) score += 8;
    // "Who has my drill?" / searching a borrower's name finds lent items.
    if (item.lentTo && includesWord(item.lentTo, word)) score += 8;
    if (includesWord(item.category, word)) score += 6;
    if (includesWord(item.locationLabel, word)) score += 5;
    if (includesWord(item.description, word)) score += 3;
    if (includesWord(item.ocrText, word)) score += 3;
    // Month/year the photo was taken ("passport october") — low weight:
    // it narrows, it should never outrank the item itself.
    if (includesWord(dateSearchText(item), word)) score += 3;
  }
  return score;
}

export function searchItems(items: ItemPhoto[], query: string): ItemPhoto[] {
  const sortedByDate = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!query.trim()) return sortedByDate;

  return sortedByDate
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.item.createdAt.localeCompare(a.item.createdAt))
    .map((r) => r.item);
}
