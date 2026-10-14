/**
 * Colour story: the AI already tells us each item's colours. We turn the
 * first colour into the item's accent — a rich dot, chip tint and card
 * underline — so the gallery is coloured by the user's real things,
 * not by app chrome. Falls back to the brand accent.
 */

const COLOUR_HEX: Record<string, string> = {
  red: '#D64541',
  crimson: '#B03046',
  orange: '#E4762E',
  amber: '#E8A33D',
  yellow: '#E8C33D',
  gold: '#C9A227',
  green: '#4E9B5F',
  teal: '#2E8C7A',
  turquoise: '#37A6A0',
  navy: '#2E4468',
  blue: '#3E6FB0',
  purple: '#7A5AA6',
  violet: '#7A5AA6',
  pink: '#D77FA6',
  brown: '#8A6642',
  beige: '#C9B896',
  cream: '#E4DCC8',
  white: '#EDEAE2',
  grey: '#8B8B8B',
  gray: '#8B8B8B',
  silver: '#B9BDC2',
  black: '#3A3A3A',
  charcoal: '#4A4A4A',
};

const FALLBACK = '#E4572E';

/** Hex for a colour name (case-insensitive, partial match allowed). */
export function colourHex(name: string | undefined): string {
  if (!name) return FALLBACK;
  const key = name.trim().toLowerCase();
  if (COLOUR_HEX[key]) return COLOUR_HEX[key];
  // Longest names first, so "navy blue" resolves to navy, not blue.
  const entries = Object.entries(COLOUR_HEX).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of entries) {
    if (key.includes(k)) return v;
  }
  return FALLBACK;
}

/** The accent colour for an item: its first recognised colour. */
export function itemAccent(colours: string[]): string {
  for (const c of colours) {
    const hex = colourHex(c);
    if (hex !== FALLBACK) return hex;
  }
  return FALLBACK;
}

/** Dark tinted surface derived from a hex accent (for chips/captions). */
export function tintOf(hex: string): string {
  // Mix the accent at ~18% over the gallery surface by using rgba over dark.
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r + g + b)) return 'rgba(228, 87, 46, 0.18)';
  return `rgba(${r}, ${g}, ${b}, 0.20)`;
}
