/**
 * FindIt Design System v4 — Porcelain (light) + Midnight (dark).
 *
 * v3 "Porcelain" stays the light palette (founder-approved). v4 adds a
 * clean dark palette and a live theming engine:
 *  - `color` is a proxy that always reads the ACTIVE palette, so every
 *    render-time colour (icon props, inline styles) follows the theme.
 *  - StyleSheets are built through `makeThemedStyles`, which lazily
 *    builds styles from the active palette and rebuilds when it
 *    changes (App remounts the tree on a theme switch via a key).
 * Switching themes therefore needs no per-component hook plumbing.
 */

export const lightPalette = {
  brand: '#5B45F2',
  brandPressed: '#4632C8',
  brandSoft: '#EFEBFF',
  onBrand: '#FFFFFF',

  ink: '#191919',
  body: '#484848',
  muted: '#717171',
  bg: '#FAF9F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EFE9',
  border: '#EBEBEB',
  borderStrong: '#D8D4CC',

  success: '#1E7D46',
  warning: '#8A5A00',
  warningBg: '#FAF0D7',
  danger: '#C13515',
  dangerSoft: '#FDECEA',
  pro: '#B98A1C',
  proSoft: '#F7ECD2',
  scrim: 'rgba(20, 18, 16, 0.45)',

  photoScrim: 'rgba(15, 14, 12, 0.50)',
  photoScrimSoft: 'rgba(15, 14, 12, 0.26)',
  onPhoto: '#FFFFFF',
} as const;

export const darkPalette = {
  brand: '#7C6CFF',
  brandPressed: '#6A57F5',
  brandSoft: '#2A2450',
  onBrand: '#FFFFFF',

  ink: '#F5F3EF',
  body: '#C9C5CE',
  muted: '#9B96A5',
  bg: '#121017',
  surface: '#1C1A24',
  surfaceAlt: '#262331',
  border: '#2C2938',
  borderStrong: '#3D3950',

  success: '#3FB970',
  warning: '#E3B34C',
  warningBg: '#3A2F10',
  danger: '#FF7A5C',
  dangerSoft: '#40201B',
  pro: '#E9B949',
  proSoft: '#3A2F10',
  scrim: 'rgba(0, 0, 0, 0.62)',

  photoScrim: 'rgba(8, 6, 14, 0.55)',
  photoScrimSoft: 'rgba(8, 6, 14, 0.30)',
  onPhoto: '#FFFFFF',
} as const;

/** Widened palette type (values are plain strings in both palettes). */
export type Palette = { readonly [K in keyof typeof lightPalette]: string };

/** Pro gradient — identical in both themes; gold must hit instantly. */
export const proGradient = ['#FFC531', '#FF8A00'] as const;

/* ------------------------- Live theming engine ------------------------- */

let activePalette: Palette = darkPalette;

export function setActivePalette(palette: Palette): void {
  activePalette = palette;
}

export function getActivePalette(): Palette {
  return activePalette;
}

export function paletteIsDark(): boolean {
  return activePalette === darkPalette;
}

/**
 * The palette every module imports as `color`. Reads forward to the
 * active palette at access time, so values are always current at
 * render. (Do not spread it into a StyleSheet directly — use
 * makeThemedStyles, which receives the real palette object.)
 */
export const color: Palette = new Proxy({} as Palette, {
  get: (_target, prop) => (activePalette as Record<string, unknown>)[prop as string],
  has: (_target, prop) => prop in activePalette,
  ownKeys: () => Reflect.ownKeys(activePalette),
  getOwnPropertyDescriptor: (_target, prop) => ({
    enumerable: true,
    configurable: true,
    value: (activePalette as Record<string, unknown>)[prop as string],
  }),
});

/**
 * Build a StyleSheet factory bound to the active palette. The returned
 * proxy builds styles lazily on first access and rebuilds them when
 * the active palette changes, so a theme switch (with App's remount)
 * restyles everything without touching component code.
 */
export function makeThemedStyles<T extends object>(factory: (c: Palette) => T): T {
  let cache: { palette: Palette; styles: T } | null = null;
  return new Proxy({} as T, {
    get: (_target, prop) => {
      if (!cache || cache.palette !== activePalette) {
        cache = { palette: activePalette, styles: factory(activePalette) };
      }
      return (cache.styles as Record<string, unknown>)[prop as string];
    },
  });
}

/* --------------------------- Static tokens ----------------------------- */

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  screen: 20,
} as const;

export const radius = {
  field: 14,
  card: 24,
  sheet: 28,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
} as const;

/** Floating chrome shadow — docks, search pill, sheets (glass layer). */
export const sheetShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 20,
  elevation: 8,
} as const;

export const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 14,
  elevation: 4,
} as const;
