import { ItemPhoto } from './types';

/**
 * Temporary sample dataset for design/testing (v0.7).
 *
 * Seeded automatically on first run when the library is empty, so the
 * layout (Jump back in, Spotlight, Places bento, search) can be tested
 * without photographing real things first. Photos are stable seeded
 * placeholders (picsum) — titles/tags/places are the real test data.
 * Sample items carry source:'sample' so they can be cleared in one tap
 * and never get confused with the user's real items.
 */

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString();
}

function pic(seed: string): string {
  return `https://picsum.photos/seed/${seed}/800/600`;
}

interface Seed {
  seed: string;
  title: string;
  place: string;
  category: string;
  colors: string[];
  tags: string[];
  objects: string[];
  description: string;
  ocrText?: string;
  daysAgo: number;
  markerX?: number;
  markerY?: number;
  markerNote?: string;
  sensitive?: boolean;
  lentTo?: string;
  lentDaysAgo?: number;
  expiresInDays?: number;
  valueGBP?: number;
}

const SEEDS: Seed[] = [
  {
    seed: 'findit-drill',
    title: 'Cordless drill',
    place: 'Garage — red toolbox',
    category: 'tool',
    colors: ['red', 'black'],
    tags: ['drill', 'cordless', 'tool', 'diy'],
    objects: ['power drill', 'battery pack'],
    description: '18V cordless drill-driver with two batteries and a charger.',
    daysAgo: 0,
    markerX: 0.62,
    markerY: 0.42,
    markerNote: 'Top tray of the toolbox, left side',
    valueGBP: 140,
  },
  {
    seed: 'findit-passport',
    title: 'Passport',
    place: 'Bedroom — blue drawer',
    category: 'document',
    colors: ['green'],
    tags: ['passport', 'travel', 'document', 'id'],
    objects: ['passport booklet'],
    description: 'Passport in the green cover, kept with the travel documents.',
    ocrText: 'PASSPORT',
    daysAgo: 0,
    sensitive: true,
    expiresInDays: 24,
  },
  {
    seed: 'findit-keys',
    title: 'Spare house keys',
    place: 'Hall — key bowl',
    category: 'other',
    colors: ['silver'],
    tags: ['keys', 'spare', 'house'],
    objects: ['key ring', 'keys'],
    description: 'Two spare keys on a plain ring, in the bowl by the front door.',
    daysAgo: 1,
  },
  {
    seed: 'findit-headphones',
    title: 'Headphones',
    place: 'Office — desk shelf',
    category: 'electronics',
    colors: ['black'],
    tags: ['headphones', 'music', 'work'],
    objects: ['over-ear headphones'],
    description: 'Wireless over-ear headphones with the charging case cable.',
    daysAgo: 1,
  },
  {
    seed: 'findit-wallet',
    title: 'Leather wallet',
    place: 'Bedroom — blue drawer',
    category: 'other',
    colors: ['brown', 'tan'],
    tags: ['wallet', 'cards', 'money'],
    objects: ['wallet'],
    description: 'Brown leather wallet with bank cards and driving licence.',
    daysAgo: 2,
  },
  {
    seed: 'findit-sunglasses',
    title: 'Sunglasses',
    place: 'Car — glove box',
    category: 'clothing',
    colors: ['black'],
    tags: ['sunglasses', 'driving', 'summer'],
    objects: ['sunglasses', 'case'],
    description: 'Sunglasses in the black hard case, kept in the car.',
    daysAgo: 3,
  },
  {
    seed: 'findit-charger',
    title: 'Phone charger cable',
    place: 'Office — desk shelf',
    category: 'electronics',
    colors: ['white'],
    tags: ['charger', 'cable', 'usb', 'phone'],
    objects: ['USB cable', 'wall adapter'],
    description: 'USB-C fast charger with the braided white cable.',
    daysAgo: 4,
    lentTo: 'Sara',
    lentDaysAgo: 3,
  },
  {
    seed: 'findit-medicine',
    title: 'First aid kit',
    place: 'Bathroom — cabinet',
    category: 'medicine',
    colors: ['white', 'red'],
    tags: ['first aid', 'medicine', 'plasters', 'health'],
    objects: ['first aid box', 'bandages'],
    description: 'First aid kit with plasters, bandages and antiseptic.',
    daysAgo: 5,
  },
  {
    seed: 'findit-umbrella',
    title: 'Umbrella',
    place: 'Hall — key bowl',
    category: 'other',
    colors: ['navy blue'],
    tags: ['umbrella', 'rain', 'monsoon'],
    objects: ['umbrella'],
    description: 'Large navy umbrella standing by the front door.',
    daysAgo: 6,
  },
  {
    seed: 'findit-tape',
    title: 'Measuring tape',
    place: 'Garage — red toolbox',
    category: 'tool',
    colors: ['yellow', 'black'],
    tags: ['tape', 'measure', 'tool'],
    objects: ['tape measure'],
    description: '5 metre measuring tape with the yellow case.',
    daysAgo: 7,
  },
  {
    seed: 'findit-notebook',
    title: 'Ideas notebook',
    place: 'Office — desk shelf',
    category: 'document',
    colors: ['orange'],
    tags: ['notebook', 'ideas', 'writing'],
    objects: ['notebook', 'pen'],
    description: 'Orange notebook with app ideas and sketches.',
    daysAgo: 8,
  },
  {
    seed: 'findit-jacket',
    title: 'Winter jacket',
    place: 'Bedroom — wardrobe',
    category: 'clothing',
    colors: ['grey'],
    tags: ['jacket', 'winter', 'warm'],
    objects: ['padded jacket'],
    description: 'Grey winter jacket hanging on the left side of the wardrobe.',
    daysAgo: 9,
  },
];

export function buildSampleItems(): ItemPhoto[] {
  return SEEDS.map((s, i) => ({
    id: `sample-${s.seed}`,
    imageUri: pic(s.seed),
    createdAt: new Date(Date.now() - s.daysAgo * DAY - i * 3600_000).toISOString(),
    title: s.title,
    description: s.description,
    tags: s.tags,
    objects: s.objects,
    colors: s.colors,
    category: s.category,
    locationLabel: s.place,
    ocrText: s.ocrText ?? '',
    source: 'sample' as const,
    markerX: s.markerX,
    markerY: s.markerY,
    markerNote: s.markerNote,
    sensitive: s.sensitive,
    lentTo: s.lentTo,
    lentAt: s.lentDaysAgo !== undefined ? daysAgo(s.lentDaysAgo) : undefined,
    expiresAt:
      s.expiresInDays !== undefined
        ? new Date(Date.now() + s.expiresInDays * DAY).toISOString().slice(0, 10)
        : undefined,
    valueGBP: s.valueGBP,
  }));
}

export function isSample(item: ItemPhoto): boolean {
  return item.source === 'sample' || item.id.startsWith('sample-');
}
