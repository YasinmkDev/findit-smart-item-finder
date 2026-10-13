import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Crop, Crosshair, Lock, MapPin, Pencil, RotateCcw, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, Field, FilterChip, TagChip, WarningBanner } from '../components/ui';
import { analyseImage, GeminiBusyError, GeminiNetworkError, MissingGeminiKeyError } from '../gemini';
import { cropToPixels } from '../importer';
import { boxToPixels, expiryLabel, parseExifDateTime, parseIsoDate } from '../photoMeta';
import { fallbackTitle, guessPlace } from '../placeGuess';
import { createId, persistPhoto } from '../storage';
import { color, radius, sheetShadow, space, type } from '../theme';
import { makeThemedStyles } from '../theme';
import { AnalysisResult, ItemPhoto, UnitBox } from '../types';

const CATEGORIES = [
  'tool',
  'electronics',
  'document',
  'clothing',
  'kitchen',
  'vehicle',
  'furniture',
  'toy',
  'medicine',
  'other',
];

const ANALYSE_STEPS = ['Reading the photo', 'Naming the item', 'Suggesting tags'];

/** Every way automatic analysis can end — each has a calm UI state. */
type AnalysisState =
  | 'idle' // no photo yet, or photo has no data to send
  | 'running'
  | 'done'
  | 'no-key' // Gemini key not configured in this build
  | 'busy' // Gemini 503 high demand
  | 'offline' // network unreachable / timeout
  | 'failed'; // anything else — still never blocks saving

interface Props {
  /** Present when editing an existing item. */
  initialItem?: ItemPhoto;
  /** Present when arriving from a failed import: photo is pre-filled for manual tagging. */
  initialPhotoUri?: string;
  /** Present when arriving from a Place ("Stash here"): the place is pre-filled. */
  initialLocation?: string;
  /** Photo metadata arriving with a pre-filled photo (from Import). */
  initialTakenAt?: string;
  initialWidth?: number;
  initialHeight?: number;
  /** The user's existing places, most used first — one-tap place chips. */
  placeSuggestions?: string[];
  /** The user's existing items — powers the smart place guess (local, free). */
  existingItems?: ItemPhoto[];
  /** Settings: run Gemini automatically on a new photo (default true). */
  autoAnalyse?: boolean;
  /** Settings: auto-enable the privacy shield for AI-detected documents. */
  shieldDocuments?: boolean;
  onSave: (item: ItemPhoto) => void;
  onCancel: () => void;
}

interface PickedPhoto {
  uri: string;
  base64: string | null;
  mimeType: string;
  /** EXIF/library metadata captured at pick time — free, no user effort. */
  takenAt?: string;
  width?: number;
  height?: number;
}

function splitWords(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export default function AddItemScreen({
  initialItem,
  initialPhotoUri,
  initialLocation,
  initialTakenAt,
  initialWidth,
  initialHeight,
  placeSuggestions = [],
  existingItems = [],
  autoAnalyse = true,
  shieldDocuments = false,
  onSave,
  onCancel,
}: Props) {
  const editing = !!initialItem;
  const [photo, setPhoto] = useState<PickedPhoto | null>(
    initialItem
      ? {
          uri: initialItem.imageUri,
          base64: null,
          mimeType: 'image/jpeg',
          takenAt: initialItem.photoTakenAt,
          width: initialItem.photoWidth,
          height: initialItem.photoHeight,
        }
      : initialPhotoUri
        ? {
            uri: initialPhotoUri,
            base64: null,
            mimeType: 'image/jpeg',
            takenAt: initialTakenAt,
            width: initialWidth,
            height: initialHeight,
          }
        : null
  );
  const [photoChanged, setPhotoChanged] = useState(!!initialPhotoUri);
  const [analysis, setAnalysis] = useState<AnalysisState>('idle');
  /** True once an analysis has succeeded during this session. */
  const [analysedOk, setAnalysedOk] = useState(false);
  const [analyseStep, setAnalyseStep] = useState(0);
  const [showDetails, setShowDetails] = useState(editing);
  const [showNewPlace, setShowNewPlace] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState(initialItem?.title ?? '');
  const [description, setDescription] = useState(initialItem?.description ?? '');
  const [tagsText, setTagsText] = useState(initialItem?.tags.join(', ') ?? '');
  const [objectsText, setObjectsText] = useState(initialItem?.objects.join(', ') ?? '');
  const [colorsText, setColorsText] = useState(initialItem?.colors.join(', ') ?? '');
  const [category, setCategory] = useState(initialItem?.category ?? '');
  const [ocrText, setOcrText] = useState(initialItem?.ocrText ?? '');
  const [expiresAt, setExpiresAt] = useState(initialItem?.expiresAt ?? '');
  const [valueText, setValueText] = useState(
    initialItem?.valueGBP !== undefined ? String(initialItem.valueGBP) : ''
  );
  const [locationLabel, setLocationLabel] = useState(initialItem?.locationLabel ?? initialLocation ?? '');

  // Photo tools (v0.10): mark-the-spot annotation, privacy shield, crop.
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(
    initialItem?.markerX !== undefined && initialItem?.markerY !== undefined
      ? { x: initialItem.markerX, y: initialItem.markerY }
      : null
  );
  const [markerNote, setMarkerNote] = useState(initialItem?.markerNote ?? '');
  const [markMode, setMarkMode] = useState(false);
  const [sensitive, setSensitive] = useState(initialItem?.sensitive ?? false);
  const [lastBox, setLastBox] = useState<UnitBox | undefined>(undefined);
  const [cropNote, setCropNote] = useState('');
  const [previewSize, setPreviewSize] = useState({ w: 0, h: 0 });

  const mounted = useRef(true);
  const runId = useRef(0);
  const placeTouched = useRef(!!initialLocation || editing);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (stepTimer.current) clearInterval(stepTimer.current);
    };
  }, []);

  /* ------------------------- Smart place guess ------------------------- */
  const guess = useMemo(
    () => (!editing ? guessPlace(existingItems, category || undefined) : null),
    [existingItems, category, editing]
  );

  // Pre-select the guess as soon as it exists — unless the user (or a
  // Place's "Stash here") already chose a place.
  useEffect(() => {
    if (!editing && guess && !placeTouched.current && locationLabel === '') {
      setLocationLabel(guess.place);
    }
  }, [guess, editing, locationLabel]);

  function choosePlace(place: string) {
    placeTouched.current = true;
    setLocationLabel(locationLabel === place ? '' : place);
  }

  /* ------------------------------ Photo intake ----------------------------- */

  async function handlePicked(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const exif = (asset as { exif?: { DateTimeOriginal?: string; DateTime?: string } }).exif;
    const picked: PickedPhoto = {
      uri: asset.uri,
      base64: asset.base64 ?? null,
      mimeType: asset.mimeType ?? 'image/jpeg',
      takenAt: parseExifDateTime(exif?.DateTimeOriginal ?? exif?.DateTime),
      width: asset.width || undefined,
      height: asset.height || undefined,
    };
    setPhoto(picked);
    setPhotoChanged(true);
    setError('');
    if (!editing) {
      // Zero-form: a new photo means a fresh automatic analysis.
      setTitle('');
      setDescription('');
      setTagsText('');
      setObjectsText('');
      setColorsText('');
      setCategory('');
      setOcrText('');
      // Settings → Capture: auto-analyse can be turned off; the user
      // then starts analysis with the button in the AI block instead.
      if (autoAnalyse) void runAnalysis(picked);
    }
  }

  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to take a photo of your item.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true, exif: true });
      await handlePicked(result);
    } catch {
      Alert.alert('Camera unavailable', 'The camera could not be opened. You can pick a photo from the gallery instead.');
    }
  }

  async function pickFromGallery() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Gallery permission needed', 'Allow photo access to pick an existing photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true, exif: true });
      await handlePicked(result);
    } catch {
      Alert.alert('Gallery unavailable', 'Your photos could not be opened just now. Please try again.');
    }
  }

  // A photo arriving from Import has no base64 in memory — read it from
  // disk so automatic analysis can still run. Fully guarded: any failure
  // simply leaves the photo un-analysed, never a crash.
  useEffect(() => {
    if (editing || !initialPhotoUri || !photo || photo.base64) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await FileSystem.readAsStringAsync(initialPhotoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (cancelled || !mounted.current || !data) return;
        const withData: PickedPhoto = {
          uri: initialPhotoUri,
          base64: data,
          mimeType: 'image/jpeg',
          takenAt: initialTakenAt,
          width: initialWidth,
          height: initialHeight,
        };
        setPhoto(withData);
        if (autoAnalyse) void runAnalysis(withData);
      } catch {
        // Leave state 'idle' — the item can still be stashed.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhotoUri]);

  /* --------------------------- Automatic analysis -------------------------- */

  function applyResult(result: AnalysisResult) {
    setAnalysedOk(true);
    setLastBox(result.box);
    setTitle(result.title);
    setDescription(result.description);
    setTagsText(result.tags.join(', '));
    setObjectsText(result.objects.join(', '));
    setColorsText(result.colors.join(', '));
    if (result.category) setCategory(result.category);
    if (result.expiryDate) setExpiresAt(result.expiryDate);
    // Settings → Capture: shield AI-detected documents automatically.
    if (shieldDocuments && result.category === 'document') setSensitive(true);
    setOcrText(result.ocrText);
  }

  async function runAnalysis(target: PickedPhoto) {
    if (!target.base64) {
      setAnalysis('idle');
      return;
    }
    const myRun = ++runId.current;
    setAnalysis('running');
    setAnalyseStep(0);
    if (stepTimer.current) clearInterval(stepTimer.current);
    stepTimer.current = setInterval(() => {
      setAnalyseStep((s) => Math.min(s + 1, ANALYSE_STEPS.length - 1));
    }, 1600);
    try {
      const result = await analyseImage(target.base64, target.mimeType);
      // Stale run (photo changed, or user already saved): ignore quietly.
      if (!mounted.current || runId.current !== myRun) return;
      applyResult(result);
      setAnalysis('done');
    } catch (e) {
      if (!mounted.current || runId.current !== myRun) return;
      if (e instanceof MissingGeminiKeyError) setAnalysis('no-key');
      else if (e instanceof GeminiBusyError) setAnalysis('busy');
      else if (e instanceof GeminiNetworkError) setAnalysis('offline');
      else setAnalysis('failed');
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
      if (mounted.current && runId.current === myRun) setAnalyseStep(0);
    }
  }

  /* ------------------------------ Photo tools ------------------------------ */

  function onPreviewTap(e: { nativeEvent: { locationX: number; locationY: number } }) {
    if (!markMode || previewSize.w <= 0 || previewSize.h <= 0) return;
    const x = Math.min(Math.max(e.nativeEvent.locationX / previewSize.w, 0.02), 0.98);
    const y = Math.min(Math.max(e.nativeEvent.locationY / previewSize.h, 0.02), 0.98);
    setMarker({ x, y });
  }

  async function onCropToItem() {
    if (!photo || !lastBox) return;
    const pixels = boxToPixels(lastBox, photo.width ?? 0, photo.height ?? 0);
    if (!pixels) {
      setCropNote('Crop needs the photo size — try a fresh photo.');
      return;
    }
    setCropNote('Cropping…');
    const croppedUri = await cropToPixels(photo.uri, pixels);
    if (!croppedUri) {
      setCropNote('Crop needs the full app build — it is unavailable in this preview.');
      return;
    }
    setPhoto({
      ...photo,
      uri: croppedUri,
      base64: null,
      mimeType: 'image/jpeg',
      width: pixels.width,
      height: pixels.height,
    });
    setPhotoChanged(true);
    setMarker(null);
    setCropNote('Cropped to the item. Re-check the marker if you set one.');
  }

  /* --------------------------------- Saving -------------------------------- */

  async function save() {
    if (!photo) {
      setError('Take or pick a photo first.');
      return;
    }
    if (editing && !title.trim() && !tagsText.trim()) {
      setError('Give the item at least a title or one tag, otherwise search will never find it.');
      return;
    }
    setSaving(true);
    // If analysis is still running, its result is no longer needed.
    runId.current++;
    try {
      const id = initialItem?.id ?? createId();
      const imageUri = photoChanged ? await persistPhoto(photo.uri, id) : photo.uri;
      // Enrichment bookkeeping: an item still needs AI details later if
      // analysis never succeeded AND the user did not type them manually.
      const manuallyComplete = !!title.trim() && !!tagsText.trim();
      const needsEnrichment = analysedOk || manuallyComplete ? undefined : true;
      onSave({
        id,
        imageUri,
        createdAt: initialItem?.createdAt ?? new Date().toISOString(),
        title: title.trim() || (editing ? initialItem?.title ?? '' : fallbackTitle()),
        description: description.trim(),
        tags: splitWords(tagsText),
        objects: splitWords(objectsText),
        colors: splitWords(colorsText),
        category: category.trim().toLowerCase(),
        locationLabel: locationLabel.trim(),
        ocrText: ocrText.trim(),
        source: initialItem?.source,
        needsEnrichment: editing && !analysedOk && !manuallyComplete ? initialItem?.needsEnrichment : needsEnrichment,
        photoTakenAt: photo.takenAt ?? initialItem?.photoTakenAt,
        photoWidth: photo.width ?? initialItem?.photoWidth,
        photoHeight: photo.height ?? initialItem?.photoHeight,
        markerX: marker ? marker.x : undefined,
        markerY: marker ? marker.y : undefined,
        markerNote: marker && markerNote.trim() ? markerNote.trim() : undefined,
        sensitive: sensitive || undefined,
        expiresAt: parseIsoDate(expiresAt),
        valueGBP: (() => {
          const n = parseFloat(valueText.replace(/[^0-9.]/g, ''));
          return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
        })(),
        packed: initialItem?.packed,
      });
    } catch {
      setError('The photo could not be saved to this device. Check storage space and try again.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  /* --------------------------------- Render -------------------------------- */

  const aiTags = splitWords(tagsText);
  const placeChips = useMemo(() => {
    const list = [...placeSuggestions];
    if (guess && !list.includes(guess.place)) list.unshift(guess.place);
    return list.slice(0, 6);
  }, [placeSuggestions, guess]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{editing ? 'Edit item' : 'Stash an item'}</Text>
        <Text style={styles.subline}>
          {editing
            ? 'Update anything — future-you thanks you.'
            : 'One photo, one question: where is it going? AI handles the rest.'}
        </Text>
        <View style={styles.stepRow}>
          <Text style={[styles.step, styles.stepActive]}>1 · Photo</Text>
          <Text style={styles.stepDivider}>—</Text>
          <Text style={[styles.step, photo ? styles.stepActive : styles.stepIdle]}>2 · Place</Text>
          <Text style={styles.stepDivider}>—</Text>
          <Text style={[styles.step, photo ? styles.stepActive : styles.stepIdle]}>3 · Stash it</Text>
        </View>

        {photo ? (
          <Pressable
            onLayout={(e) =>
              setPreviewSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
            }
            onPress={onPreviewTap}
          >
            <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
            {marker && (
              <View
                pointerEvents="none"
                style={[
                  styles.markerDot,
                  { left: `${marker.x * 100}%`, top: `${marker.y * 100}%` },
                ]}
              >
                <View style={styles.markerDotCore} />
              </View>
            )}
            {markMode && (
              <View pointerEvents="none" style={styles.markHint}>
                <Text style={styles.markHintText}>Tap the photo exactly where the item is</Text>
              </View>
            )}
          </Pressable>
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.noPhotoTitle}>Start with a photo</Text>
            <Text style={styles.noPhotoText}>
              One clear photo of the item, where it lives if you can.
            </Text>
          </View>
        )}

        <View style={styles.sheet}>
          <View style={styles.photoActions}>
            <View style={styles.flex1}>
              <Button label={photo ? 'Retake' : 'Take photo'} variant="secondary" onPress={takePhoto} />
            </View>
            <View style={styles.flex1}>
              <Button label="Pick from gallery" variant="secondary" onPress={pickFromGallery} />
            </View>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          {/* --- Photo tools (v0.10): mark it, shield it, crop to it --- */}
          {!!photo && (
            <View style={styles.toolsBlock}>
              <View style={styles.toolsRow}>
                <Pressable
                  onPress={() => setMarkMode((v) => !v)}
                  style={[styles.toolChip, (markMode || marker) && styles.toolChipOn]}
                >
                  <Crosshair size={14} color={markMode || marker ? '#fff' : color.brand} />
                  <Text style={[styles.toolChipText, (markMode || marker) && styles.toolChipTextOn]}>
                    {marker ? 'Marked' : 'Mark the spot'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSensitive((v) => !v)}
                  style={[styles.toolChip, sensitive && styles.toolChipOn]}
                >
                  <Lock size={14} color={sensitive ? '#fff' : color.brand} />
                  <Text style={[styles.toolChipText, sensitive && styles.toolChipTextOn]}>
                    Privacy shield {sensitive ? 'on' : 'off'}
                  </Text>
                </Pressable>
                {!!lastBox && (
                  <Pressable onPress={onCropToItem} style={styles.toolChip}>
                    <Crop size={14} color={color.brand} />
                    <Text style={styles.toolChipText}>Crop to item</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.toolsHint}>
                Mark the spot shows future-you exactly where it is. Privacy shield hides the
                photo in lists — for passports and documents.
              </Text>
              {!!cropNote && <Text style={styles.toolsHint}>{cropNote}</Text>}
              {!!parseIsoDate(expiresAt) && (
                <Text style={styles.toolsHint}>
                  Warranty / expiry spotted: {parseIsoDate(expiresAt)} ({expiryLabel(parseIsoDate(expiresAt)!)}) —
                  it will show in “Coming up” on Home.
                </Text>
              )}
              {marker && (
                <>
                  <Field
                    label="Marker note (optional)"
                    value={markerNote}
                    onChangeText={setMarkerNote}
                    placeholder="Top shelf, behind the paint cans"
                  />
                  <Pressable
                    onPress={() => {
                      setMarker(null);
                      setMarkerNote('');
                    }}
                  >
                    <Text style={styles.clearMark}>Remove marker</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* --- AI status (capture mode): automatic, calm in every state --- */}
          {!editing && !!photo && (
            <View style={styles.aiBlock}>
              {analysis === 'idle' && !autoAnalyse && (
                <View>
                  <Text style={styles.aiText}>
                    Auto-analyse is off (Settings). Run it when you're ready — or just stash.
                  </Text>
                  <Pressable accessibilityRole="button" onPress={() => photo && void runAnalysis(photo)} style={styles.retryRow}>
                    <Sparkles size={14} color={color.brand} strokeWidth={2.4} />
                    <Text style={styles.retryText}>Analyse with AI</Text>
                  </Pressable>
                </View>
              )}
              {analysis === 'running' && (
                <View style={styles.aiRow}>
                  <ActivityIndicator size="small" color={color.brand} />
                  <Text style={styles.aiText}>
                    {ANALYSE_STEPS[analyseStep]}… — you can already pick the place and stash it.
                  </Text>
                </View>
              )}
              {analysis === 'done' && (
                <View>
                  <View style={styles.aiRow}>
                    <Sparkles size={17} color={color.brand} strokeWidth={2.2} />
                    <Text style={styles.aiTextStrong}>
                      AI named it “{title || 'your item'}” — no typing needed.
                    </Text>
                  </View>
                  {aiTags.length > 0 && (
                    <View style={styles.aiTags}>
                      {aiTags.slice(0, 6).map((t) => (
                        <TagChip key={t} label={t} />
                      ))}
                    </View>
                  )}
                </View>
              )}
              {analysis === 'no-key' && (
                <WarningBanner text="AI is off in this build (no key added yet). Stash anyway — it gets a quick name now and full AI details later, when the key is in." />
              )}
              {analysis === 'busy' && (
                <View>
                  <WarningBanner text="AI is busy right now (high demand). Stash anyway — details can be filled in automatically later." />
                  <Pressable accessibilityRole="button" onPress={() => photo && void runAnalysis(photo)} style={styles.retryRow}>
                    <RotateCcw size={14} color={color.brand} strokeWidth={2.4} />
                    <Text style={styles.retryText}>Try AI again</Text>
                  </Pressable>
                </View>
              )}
              {analysis === 'offline' && (
                <View>
                  <WarningBanner text="You look offline, so AI can't see this photo yet. Stash anyway — nothing is lost." />
                  <Pressable accessibilityRole="button" onPress={() => photo && void runAnalysis(photo)} style={styles.retryRow}>
                    <RotateCcw size={14} color={color.brand} strokeWidth={2.4} />
                    <Text style={styles.retryText}>Try AI again</Text>
                  </Pressable>
                </View>
              )}
              {analysis === 'failed' && (
                <View>
                  <WarningBanner text="AI couldn't read this photo. Stash anyway — you can add details from the item page anytime." />
                  <Pressable accessibilityRole="button" onPress={() => photo && void runAnalysis(photo)} style={styles.retryRow}>
                    <RotateCcw size={14} color={color.brand} strokeWidth={2.4} />
                    <Text style={styles.retryText}>Try AI again</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* --- Edit mode keeps the manual analyse button --- */}
          {editing && !!photo && (
            <View style={styles.aiBlock}>
              <Button
                label={analysis === 'running' ? ANALYSE_STEPS[analyseStep] + '…' : 'Analyse with AI'}
                onPress={() => photo && void runAnalysis(photo)}
                loading={analysis === 'running'}
              />
              {analysis === 'no-key' && (
                <View style={{ marginTop: space.md }}>
                  <WarningBanner text="AI analysis is off because the Gemini key is not set in this build." />
                </View>
              )}
              {(analysis === 'busy' || analysis === 'offline' || analysis === 'failed') && (
                <View style={{ marginTop: space.md }}>
                  <WarningBanner text="AI could not complete just now. Your edits can still be saved." />
                </View>
              )}
            </View>
          )}

          {/* --- The one question --- */}
          <View style={styles.placeBlock}>
            <View style={styles.placeLabelRow}>
              <MapPin size={17} color={color.ink} strokeWidth={2.4} />
              <Text style={styles.placeLabel}>Where did you put it?</Text>
            </View>
            {!!guess && !editing && locationLabel === guess.place && (
              <Text style={styles.guessReason}>
                Suggested — {guess.reason.charAt(0).toLowerCase() + guess.reason.slice(1)}
              </Text>
            )}
            {placeChips.length > 0 && (
              <View style={styles.placeChips}>
                {placeChips.map((p) => (
                  <FilterChip key={p} label={p} selected={locationLabel === p} onPress={() => choosePlace(p)} />
                ))}
                <FilterChip label="+ New place" selected={showNewPlace} onPress={() => setShowNewPlace(!showNewPlace)} />
              </View>
            )}
            {(showNewPlace || placeChips.length === 0 || editing) && (
              <Field
                label={editing ? 'Where I kept it' : 'New place'}
                value={locationLabel}
                onChangeText={(t) => {
                  placeTouched.current = true;
                  setLocationLabel(t);
                }}
                placeholder="e.g. Garage — red toolbox"
                hint="Room + container works best. This is what future-you will search by."
              />
            )}
          </View>

          {/* --- Details: hidden by default in capture mode --- */}
          {!editing && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDetails(!showDetails)}
              style={styles.detailsToggle}
            >
              <Pencil size={14} color={color.brand} strokeWidth={2.4} />
              <Text style={styles.detailsToggleText}>
                {showDetails ? 'Hide details' : 'Edit details myself'}
              </Text>
            </Pressable>
          )}

          {(editing || showDetails) && (
            <View style={styles.card}>
              <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Red screwdriver" />
              <Field
                label="Tags"
                value={tagsText}
                onChangeText={setTagsText}
                placeholder="screwdriver, tool, phillips"
                hint="Comma separated. The words you would type to find this."
                autoCapitalize="none"
              />
              <Field
                label="Description"
                value={description}
                onChangeText={setDescription}
                placeholder="One sentence about the item"
                multiline
              />
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((c) => (
                  <FilterChip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? '' : c)} />
                ))}
              </View>
              <Field label="Objects seen" value={objectsText} onChangeText={setObjectsText} autoCapitalize="none" />
              <Field label="Colours" value={colorsText} onChangeText={setColorsText} autoCapitalize="none" />
              {!!ocrText && (
                <Field label="Text in the photo" value={ocrText} onChangeText={setOcrText} multiline />
              )}
              <Field
                label="Warranty / expiry date (YYYY-MM-DD)"
                value={expiresAt}
                onChangeText={setExpiresAt}
                placeholder="e.g. 2027-03-31 — AI fills this from receipts"
              />
              <Field
                label="Approx. value (£)"
                value={valueText}
                onChangeText={setValueText}
                placeholder="e.g. 120 — used by the insurance report"
                keyboardType="numeric"
              />
              <View style={styles.cardBottomSpacer} />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.cancelWrap}>
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
        <View style={styles.saveWrap}>
          <Button
            label={editing ? 'Save changes' : analysis === 'running' ? 'Stash it — AI still working' : 'Stash it'}
            onPress={save}
            loading={saving}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = makeThemedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { padding: space.screen, paddingBottom: space.xl },
  heading: { ...type.display, color: c.ink },
  subline: { ...type.body, color: c.muted, marginTop: space.xs },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.md, marginBottom: space.lg },
  step: { ...type.caption, fontWeight: '700' },
  stepActive: { color: c.brand },
  stepIdle: { color: c.muted },
  stepDivider: { color: c.borderStrong, marginHorizontal: space.sm },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card, backgroundColor: c.surfaceAlt },
  markerDot: {
    position: 'absolute',
    width: 26,
    height: 26,
    marginLeft: -13,
    marginTop: -13,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(91,69,242,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.brand },
  markHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
  },
  markHintText: {
    ...type.small,
    color: '#fff',
    backgroundColor: 'rgba(20,20,30,0.72)',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  toolsBlock: { marginTop: space.md },
  toolsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: c.brand,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 7,
  },
  toolChipOn: { backgroundColor: c.brand },
  toolChipText: { ...type.small, color: c.brand, fontWeight: '600' },
  toolChipTextOn: { color: '#fff' },
  toolsHint: { ...type.small, color: c.body, marginTop: space.sm },
  clearMark: { ...type.small, color: c.danger, fontWeight: '600', marginTop: space.xs },
  noPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxxl,
  },
  noPhotoTitle: { ...type.heading, color: c.ink, marginBottom: space.xs },
  noPhotoText: { ...type.small, color: c.body, textAlign: 'center' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginHorizontal: -space.screen,
    paddingHorizontal: space.screen,
    paddingTop: space.lg,
    marginTop: -space.xl,
    ...sheetShadow,
  },
  photoActions: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  flex1: { flex: 1 },
  error: { ...type.small, color: c.danger, marginTop: space.md },
  aiBlock: { marginTop: space.lg },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  aiText: { ...type.small, color: c.body, flex: 1 },
  aiTextStrong: { ...type.small, fontWeight: '600', color: c.ink, flex: 1 },
  aiTags: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm, marginTop: space.sm },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm, paddingVertical: 2 },
  retryText: { ...type.small, fontWeight: '700', color: c.brand },
  placeBlock: { marginTop: space.xl },
  placeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  placeLabel: { ...type.heading, fontSize: 18, color: c.ink },
  guessReason: { ...type.caption, fontWeight: '600', color: c.brand, marginTop: 4 },
  placeChips: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm, marginTop: space.md },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.xl,
    paddingVertical: space.xs,
  },
  detailsToggleText: { ...type.small, fontWeight: '700', color: c.brand },
  card: { paddingTop: space.xs, marginTop: space.md },
  fieldLabel: { ...type.small, fontWeight: '600', color: c.ink, marginTop: space.lg, marginBottom: space.sm },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  cardBottomSpacer: { height: space.sm },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
    ...sheetShadow,
  },
  cancelWrap: { width: 110 },
  saveWrap: { flex: 1 },
}));
