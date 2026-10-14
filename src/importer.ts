import { analyseImage } from './gemini';

/**
 * Expo Go note (found by the founder testing, Oct 2026): recent Expo Go
 * builds do NOT ship the expo-media-library native module
 * ("Cannot find native module 'ExpoMediaLibraryNext'"), and a static
 * import crashes the whole app at startup — including screens that
 * never import photos. So both native modules are loaded lazily and
 * guarded: in Expo Go the app runs fully, and the Import screen shows
 * an honest "needs a development build" state. In a dev/production
 * build both load normally and import works as designed.
 */
let MediaLibrary: typeof import('expo-media-library') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MediaLibrary = require('expo-media-library');
} catch {
  MediaLibrary = null;
}

let ImageManipulatorMod: typeof import('expo-image-manipulator') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImageManipulatorMod = require('expo-image-manipulator');
} catch {
  ImageManipulatorMod = null;
}

/** True when bulk gallery import can actually run on this runtime. */
export function isGalleryImportAvailable(): boolean {
  return MediaLibrary !== null && ImageManipulatorMod !== null;
}
import { isoFromEpochMs } from './photoMeta';
import { canAddItem, FREE_ITEM_LIMIT, PlanKind } from './plan';
import { createId } from './storage';
import { ItemPhoto } from './types';

/**
 * Phase A bulk gallery import engine (see IMPORT_UX.md).
 * Selection planning is pure and unit-tested; device work (media library,
 * resizing, Gemini) is isolated in the functions below it.
 */

/** Soft per-batch cap — keeps a batch fast and predictable (UX doc, State 3). */
export const BATCH_CAP = 50;

export interface GalleryPhoto {
  assetId: string;
  uri: string;
  width: number;
  height: number;
  creationTime: number;
  /** Original filename when the library provides it — powers smart flags. */
  filename?: string;
}

/**
 * Smart-import flags (v0.11), all pure and advisory — they inform the
 * user, they never block an import.
 *
 * Screenshots: filename-based ("Screenshot_2026…", "IMG screenshot…"),
 * the signal every gallery app exposes.
 */
export function looksLikeScreenshot(photo: GalleryPhoto): boolean {
  const name = (photo.filename ?? '').toLowerCase();
  return name.includes('screenshot') || name.includes('screen_shot') || name.startsWith('scr_');
}

/**
 * Near-duplicate (burst) detection: photos with identical dimensions
 * taken within 2 seconds of an earlier one are almost always the same
 * shot taken again. Returns the ids of the later copies.
 */
export function nearDuplicateIds(photos: GalleryPhoto[]): Set<string> {
  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  const flagged = new Set<string>();
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (
      cur.width === prev.width &&
      cur.height === prev.height &&
      cur.creationTime - prev.creationTime <= 2000 &&
      cur.creationTime >= prev.creationTime
    ) {
      flagged.add(cur.assetId);
    }
  }
  return flagged;
}

export interface SelectionPlan {
  /** Photos that will be imported, in selection order. */
  toImport: string[];
  /** Already in FindIt — skipped. */
  duplicates: string[];
  /** Selected but beyond the plan allowance / batch cap. */
  overLimit: string[];
}

/** Pure: decide what a selection means before any network work happens. */
export function planSelection(
  selectedIds: string[],
  existingAssetIds: ReadonlySet<string>,
  plan: PlanKind,
  currentItemCount: number
): SelectionPlan {
  const duplicates = selectedIds.filter((id) => existingAssetIds.has(id));
  const fresh = selectedIds.filter((id) => !existingAssetIds.has(id));

  const allowance =
    plan === 'pro'
      ? BATCH_CAP
      : Math.max(0, Math.min(BATCH_CAP, FREE_ITEM_LIMIT - currentItemCount));

  return {
    toImport: fresh.slice(0, allowance),
    duplicates,
    overLimit: fresh.slice(allowance),
  };
}

export interface LibraryPermission {
  granted: boolean;
  limited: boolean;
}

export async function requestLibraryPermission(): Promise<LibraryPermission> {
  if (!MediaLibrary) return { granted: false, limited: false };
  const response = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  return {
    granted: response.granted,
    limited: response.accessPrivileges === 'limited',
  };
}

export async function getLibraryPermission(): Promise<LibraryPermission> {
  if (!MediaLibrary) return { granted: false, limited: false };
  const response = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  return {
    granted: response.granted,
    limited: response.accessPrivileges === 'limited',
  };
}

export interface GalleryPage {
  photos: GalleryPhoto[];
  endCursor: string | undefined;
  hasNextPage: boolean;
  totalCount: number;
}

export async function fetchGalleryPage(after?: string): Promise<GalleryPage> {
  if (!MediaLibrary) throw new Error('Gallery import is not available in this build.');
  const page = await MediaLibrary.getAssetsAsync({
    first: 120,
    after,
    mediaType: 'photo',
    sortBy: 'creationTime',
  });
  return {
    photos: page.assets.map((a) => ({
      assetId: a.id,
      uri: a.uri,
      width: a.width,
      height: a.height,
      creationTime: a.creationTime,
      filename: a.filename,
    })),
    endCursor: page.endCursor,
    hasNextPage: page.hasNextPage,
    totalCount: page.totalCount,
  };
}

/** Resolve a gallery asset to a local file URI usable for display/analysis. */
export async function resolveLocalUri(photo: GalleryPhoto): Promise<string> {
  try {
    if (!MediaLibrary) return photo.uri;
    const info = await MediaLibrary.getAssetInfoAsync(photo.assetId);
    return info.localUri ?? info.uri ?? photo.uri;
  } catch {
    return photo.uri;
  }
}

export type ImportOutcome =
  | { status: 'done'; item: ItemPhoto }
  | { status: 'failed'; photo: GalleryPhoto; message: string };

/**
 * Analyse one gallery photo into a ready-to-save item.
 * The image is resized to a 1024px long edge before it leaves the phone
 * (cost and speed), and the saved item references the original gallery
 * asset — the photo itself is never copied.
 */
export async function analyseGalleryPhoto(photo: GalleryPhoto): Promise<ImportOutcome> {
  try {
    const localUri = await resolveLocalUri(photo);

    if (!ImageManipulatorMod) {
      return { status: 'failed', photo, message: 'Image tools are not available in this build.' };
    }
    const context = ImageManipulatorMod.ImageManipulator.manipulate(localUri);
    const longEdge = Math.max(photo.width, photo.height);
    if (longEdge > 1024) {
      if (photo.width >= photo.height) context.resize({ width: 1024 });
      else context.resize({ height: 1024 });
    }
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      compress: 0.7,
      format: ImageManipulatorMod.SaveFormat.JPEG,
      base64: true,
    });
    if (!result.base64) {
      return { status: 'failed', photo, message: 'Could not read this photo.' };
    }

    const analysis = await analyseImage(result.base64, 'image/jpeg');
    const item: ItemPhoto = {
      id: createId(),
      imageUri: localUri,
      createdAt: new Date().toISOString(),
      title: analysis.title,
      description: analysis.description,
      tags: analysis.tags,
      objects: analysis.objects,
      colors: analysis.colors,
      category: analysis.category,
      locationLabel: '',
      ocrText: analysis.ocrText,
      source: 'gallery',
      assetId: photo.assetId,
      photoTakenAt: isoFromEpochMs(photo.creationTime),
      photoWidth: photo.width || undefined,
      photoHeight: photo.height || undefined,
    };
    return { status: 'done', item };
  } catch (e) {
    return {
      status: 'failed',
      photo,
      message: e instanceof Error ? e.message : 'Analysis failed.',
    };
  }
}

/**
 * Crop a photo to a pixel box using the image tools, when this build
 * has them (full app). Returns the cropped image URI, or null when the
 * tools are unavailable (Expo Go) or anything fails — the caller keeps
 * the original photo either way.
 */
export async function cropToPixels(
  uri: string,
  pixels: { originX: number; originY: number; width: number; height: number }
): Promise<string | null> {
  try {
    if (!ImageManipulatorMod) return null;
    const context = ImageManipulatorMod.ImageManipulator.manipulate(uri) as unknown as {
      crop?: (o: typeof pixels) => unknown;
      renderAsync: () => Promise<{ saveAsync: (o: object) => Promise<{ uri: string }> }>;
    };
    if (typeof context.crop !== 'function') return null;
    context.crop(pixels);
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      compress: 0.85,
      format: ImageManipulatorMod.SaveFormat.JPEG,
    });
    return saved.uri ?? null;
  } catch {
    return null;
  }
}

/** Re-exported for screens that need the same rule the engine uses. */
export { canAddItem };
