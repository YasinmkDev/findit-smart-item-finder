export interface ItemPhoto {
  id: string;
  /** Local URI of the saved photo (copied into app storage when possible). */
  imageUri: string;
  /** ISO date string for when the item was saved. */
  createdAt: string;
  title: string;
  description: string;
  tags: string[];
  objects: string[];
  colors: string[];
  category: string;
  /** Free-text note from the user: where the item is kept, e.g. "Garage - red toolbox". */
  locationLabel: string;
  /** Any readable text seen in the photo (from Gemini). */
  ocrText: string;
  /** Where the photo came from. Undefined on records saved before v0.3. */
  source?: 'camera' | 'gallery' | 'sample';
  /**
   * True when the item was saved before AI analysis could fill its
   * details (no key, busy, offline) — zero-form capture never blocks
   * saving, so such items are enriched later instead.
   */
  needsEnrichment?: boolean;
  /**
   * When the PHOTO was taken (EXIF DateTimeOriginal for captures,
   * MediaLibrary creationTime for imports) — distinct from createdAt,
   * which is when the item was stashed in FindIt. Powers "photo taken"
   * display and month/year search. Undefined on older records.
   */
  photoTakenAt?: string;
  /** Original photo dimensions in pixels, when the source provided them. */
  photoWidth?: number;
  photoHeight?: number;
  /** Gallery asset id for imported photos — used for dedupe. */
  assetId?: string;
  /**
   * "Mark the spot": a marker the user dropped on the photo (normalised
   * 0..1 coordinates) with an optional note — the visual answer to
   * "where exactly is it?" on cluttered/container photos.
   */
  markerX?: number;
  markerY?: number;
  markerNote?: string;
  /**
   * Privacy shield: when true, the photo is veiled in lists and only
   * reveals inside the item page — for passports, documents, valuables.
   */
  sensitive?: boolean;
  /** Lent-it tracker: who currently has this item, and since when (ISO). */
  lentTo?: string;
  lentAt?: string;
  /** Warranty / expiry date (YYYY-MM-DD) — read by AI off receipts/packaging or typed. */
  expiresAt?: string;
  /** Approximate value in GBP (owner estimate) — powers the insurance report. */
  valueGBP?: number;
  /** Moving mode: packed into its place/box yet? */
  packed?: boolean;
}

/** Bounding box in 0..1000 normalised coordinates (Gemini convention). */
export interface UnitBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the Gemini analysis returns for one photo (everything except id/image/date). */
export interface AnalysisResult {
  title: string;
  description: string;
  tags: string[];
  objects: string[];
  colors: string[];
  category: string;
  ocrText: string;
  /** Approximate bounding box of the main item — powers "Crop to item". */
  box?: UnitBox;
  /** Warranty/expiry date (YYYY-MM-DD) if visible on a receipt/card/packaging. */
  expiryDate?: string;
}

export const EMPTY_ANALYSIS: AnalysisResult = {
  title: '',
  description: '',
  tags: [],
  objects: [],
  colors: [],
  category: '',
  ocrText: '',
};
