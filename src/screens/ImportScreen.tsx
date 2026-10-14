import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, EmptyState, WarningBanner } from '../components/ui';
import {
  analyseGalleryPhoto,
  fetchGalleryPage,
  GalleryPhoto,
  getLibraryPermission,
  isGalleryImportAvailable,
  looksLikeScreenshot,
  nearDuplicateIds,
  planSelection,
  requestLibraryPermission,
  SelectionPlan,
} from '../importer';
import { FREE_ITEM_LIMIT, PlanKind } from '../plan';
import { color, radius, sheetShadow, space, type } from '../theme';
import { makeThemedStyles } from '../theme';
import { ItemPhoto } from '../types';

const PRIMED_KEY = '@findit/import-primed/v1';
const CELL_GAP = 3;

type Stage =
  | 'checking'
  | 'unavailable'
  | 'priming'
  | 'denied'
  | 'grid'
  | 'processing'
  | 'summary';

interface FailedEntry {
  photo: GalleryPhoto;
  message: string;
}

interface Props {
  items: ItemPhoto[];
  plan: PlanKind;
  onImported: (item: ItemPhoto) => Promise<void>;
  onManualAdd: (photo: GalleryPhoto) => void;
  onUpgrade: () => void;
  onClose: () => void;
}

export default function ImportScreen({ items, plan, onImported, onManualAdd, onUpgrade, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('checking');
  const [limited, setLimited] = useState(false);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNext, setHasNext] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [selected, setSelected] = useState<Map<string, GalleryPhoto>>(new Map());
  const [showSummary, setShowSummary] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<SelectionPlan | null>(null);

  const [current, setCurrent] = useState<GalleryPhoto | null>(null);
  const [runTotal, setRunTotal] = useState(0);
  const [runProcessed, setRunProcessed] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [failed, setFailed] = useState<FailedEntry[]>([]);
  const [remaining, setRemaining] = useState<GalleryPhoto[]>([]);
  const [cancelledRun, setCancelledRun] = useState(false);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const nearDupIds = useMemo(() => nearDuplicateIds(photos), [photos]);
  const selectedFlags = useMemo(() => {
    const values = Array.from(selected.values());
    return {
      screenshots: values.filter(looksLikeScreenshot).length,
      nearDups: values.filter((p) => nearDupIds.has(p.assetId)).length,
    };
  }, [selected, nearDupIds]);
  const existingAssetIds = useMemo(
    () => new Set(items.map((i) => i.assetId).filter(Boolean) as string[]),
    [items]
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const loadPage = useCallback(async (after?: string) => {
    setLoadingPage(true);
    try {
      const page = await fetchGalleryPage(after);
      setPhotos((prev) => (after ? [...prev, ...page.photos] : page.photos));
      setEndCursor(page.endCursor);
      setHasNext(page.hasNextPage);
    } catch {
      // A failed page load simply leaves the grid as-is; user can retry by scrolling.
    } finally {
      setLoadingPage(false);
    }
  }, []);

  const enterGrid = useCallback(async () => {
    setStage('grid');
    await loadPage(undefined);
  }, [loadPage]);

  useEffect(() => {
    (async () => {
      if (!isGalleryImportAvailable()) {
        setStage('unavailable');
        return;
      }
      const permission = await getLibraryPermission();
      if (permission.granted) {
        setLimited(permission.limited);
        await enterGrid();
        return;
      }
      const primed = await AsyncStorage.getItem(PRIMED_KEY);
      setStage(primed === 'yes' ? 'denied' : 'priming');
    })();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChoosePhotos() {
    await AsyncStorage.setItem(PRIMED_KEY, 'yes');
    const permission = await requestLibraryPermission();
    if (!permission.granted) {
      setStage('denied');
      return;
    }
    setLimited(permission.limited);
    await enterGrid();
  }

  function toggle(photo: GalleryPhoto) {
    if (existingAssetIds.has(photo.assetId)) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(photo.assetId)) next.delete(photo.assetId);
      else next.set(photo.assetId, photo);
      return next;
    });
  }

  function openPreflight() {
    const planResult = planSelection(
      Array.from(selected.keys()),
      existingAssetIds,
      plan,
      itemsRef.current.length
    );
    setCurrentPlan(planResult);
    setShowSummary(true);
  }

  /** Runs a batch; returns photos left unprocessed because of cancellation. */
  async function runQueue(
    assetIds: string[],
    selectionMap: Map<string, GalleryPhoto>
  ): Promise<GalleryPhoto[]> {
    if (runningRef.current) return [];
    runningRef.current = true;
    cancelRef.current = false;
    setCancelledRun(false);
    setStage('processing');

    const queue = assetIds
      .map((id) => selectionMap.get(id))
      .filter(Boolean) as GalleryPhoto[];
    setRunTotal(queue.length);
    setRunProcessed(0);

    let unprocessed: GalleryPhoto[] = [];
    for (let i = 0; i < queue.length; i++) {
      if (cancelRef.current) {
        unprocessed = queue.slice(i);
        break;
      }
      const photo = queue[i];
      setCurrent(photo);
      const outcome = await analyseGalleryPhoto(photo);
      if (outcome.status === 'done') {
        await onImported(outcome.item);
        setDoneCount((c) => c + 1);
        // Smart-import flag: receipts/documents the AI recognised.
        if (outcome.item.category === 'document') setDocCount((c) => c + 1);
      } else {
        setFailed((prev) => [...prev, { photo, message: outcome.message }]);
      }
      setRunProcessed((c) => c + 1);
    }

    setCurrent(null);
    runningRef.current = false;
    setStage('summary');
    return unprocessed;
  }

  async function startImport() {
    if (!currentPlan) return;
    setShowSummary(false);
    setDoneCount(0);
    setDocCount(0);
    setFailed([]);
    setRemaining([]);
    const unprocessed = await runQueue(currentPlan.toImport, selected);
    // Unprocessed (cancelled) plus over-limit photos both stay available
    // in the summary — the latter for after a Pro upgrade.
    const overLimitPhotos = currentPlan.overLimit
      .map((id) => selected.get(id))
      .filter(Boolean) as GalleryPhoto[];
    setRemaining([...unprocessed, ...overLimitPhotos]);
  }

  async function retryFailed() {
    const retryPhotos = new Map(failed.map((f) => [f.photo.assetId, f.photo]));
    const ids = failed.map((f) => f.photo.assetId);
    setFailed([]);
    await runQueue(ids, retryPhotos);
  }

  async function importRemaining() {
    const map = new Map(remaining.map((p) => [p.assetId, p]));
    const ids = remaining.map((p) => p.assetId);
    setRemaining([]);
    await runQueue(ids, map);
  }

  /* --------------------------------- Stages -------------------------------- */

  if (stage === 'checking') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={color.brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'unavailable') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <EmptyState
            title="Import needs the full app"
            text={
              'Bulk gallery import uses a system library that Expo Go does not include, so this screen cannot run here.\n\n' +
              'Everything else works in Expo Go — and adding photos one by one via "Stash an item" → "Pick from gallery" works too. ' +
              'Bulk import runs in a development build of FindIt (the next step after this design test).'
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'priming') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Bring your existing photos</Text>
          <Text style={styles.lead}>
            FindIt can note what is in photos you have already taken, so you can
            search them by one word — just like new ones.
          </Text>
          <View style={styles.factList}>
            <Text style={styles.fact}>
              <Text style={styles.factStrong}>You choose. </Text>
              Nothing is scanned automatically in this version.
            </Text>
            <Text style={styles.fact}>
              <Text style={styles.factStrong}>What is sent. </Text>
              A resized copy of each photo you pick goes to our AI (Gemini) for
              analysis. Originals stay in your library.
            </Text>
            <Text style={styles.fact}>
              <Text style={styles.factStrong}>Your control. </Text>
              Delete imported items at any time. Photos are referenced, not
              copied, so no extra storage is used.
            </Text>
          </View>
          <View style={styles.spacer} />
          <Button label="Choose photos" onPress={handleChoosePhotos} />
          <Button label="Not now" variant="ghost" onPress={onClose} />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'denied') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <EmptyState
            title="Photo access is off"
            text={
              'FindIt cannot see your gallery without permission, so bulk import is unavailable.\n\n' +
              'You can still add items one by one with "Add an item" — that uses the system picker instead.'
            }
          >
            <View style={styles.deniedActions}>
              <Button label="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} />
            </View>
          </EmptyState>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'processing') {
    const total = runTotal;
    const processed = runProcessed;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Text style={styles.title}>Importing photos</Text>
          {!!current && (
            <Image source={{ uri: current.uri }} style={styles.currentPhoto} resizeMode="cover" />
          )}
          <Text style={styles.progressLabel}>
            {current ? `Analysing photo ${Math.min(processed + 1, total)} of ${total}` : 'Finishing…'}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: total > 0 ? `${Math.round((processed / total) * 100)}%` : '0%' },
              ]}
            />
          </View>
          <Text style={styles.counts}>
            {doneCount} imported · {failed.length} could not be analysed
          </Text>
          <WarningBanner text="Items already imported stay saved. Processing continues while you stay on this screen — background importing arrives in a later version." />
          <View style={styles.spacer} />
          <Button
            label="Cancel remaining"
            variant="secondary"
            onPress={() => {
              cancelRef.current = true;
              setCancelledRun(true);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'summary') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.page}>
          <Text style={styles.title}>{cancelledRun ? 'Import stopped' : 'Import complete'}</Text>
          <Text style={styles.lead}>
            {doneCount} imported · {failed.length} could not be analysed
            {remaining.length > 0 ? ` · ${remaining.length} not imported yet` : ''}
          </Text>
          {docCount > 0 && (
            <Text style={styles.docNote}>
              {docCount} of these look like receipts or documents — they are filed under the
              Documents category, and their text is searchable.
            </Text>
          )}

          {remaining.length > 0 && (
            <View style={styles.remainingCard}>
              <Text style={styles.cardTitle}>
                {plan === 'pro' ? 'Some photos are still waiting' : 'These need Pro — or free up space'}
              </Text>
              <Text style={styles.cardText}>
                {plan === 'pro'
                  ? 'Import them now to finish this batch.'
                  : `Your free plan holds ${FREE_ITEM_LIMIT} items. Upgrade to import the rest, or delete some items first.`}
              </Text>
              {plan !== 'pro' && <Button label="Upgrade to Pro" onPress={onUpgrade} />}
              {plan === 'pro' && <Button label={`Import remaining ${remaining.length}`} onPress={importRemaining} />}
            </View>
          )}

          {failed.length > 0 && (
            <View style={styles.failedCard}>
              <Text style={styles.cardTitle}>Could not be analysed</Text>
              <Text style={styles.cardText}>
                Usually the AI is busy, or the photo is only in iCloud. Nothing was
                saved for these, and they have not used your plan allowance.
              </Text>
              <View style={styles.failedThumbs}>
                {failed.slice(0, 6).map((f) => (
                  <Pressable key={f.photo.assetId} onPress={() => onManualAdd(f.photo)}>
                    <Image source={{ uri: f.photo.uri }} style={styles.failedThumb} />
                  </Pressable>
                ))}
              </View>
              <Button label="Retry" variant="secondary" onPress={retryFailed} />
              <Text style={styles.cardText}>Or tap a photo to add its tags yourself.</Text>
            </View>
          )}

          <View style={styles.spacer} />
          <Button label="View items" onPress={onClose} />
        </View>
      </SafeAreaView>
    );
  }

  /* ---------------------------------- Grid ---------------------------------- */

  const selectedCount = selected.size;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.gridHeader}>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.gridTitle}>Import photos</Text>
        <View style={styles.gridHeaderSpacer} />
      </View>
      {limited && (
        <Text style={styles.limitedNote}>
          Showing the photos you allowed FindIt to see. You can allow more in Settings.
        </Text>
      )}

      <FlatList
        data={photos}
        keyExtractor={(p) => p.assetId}
        numColumns={3}
        renderItem={({ item: photo }) => {
          const isIn = existingAssetIds.has(photo.assetId);
          const isSelected = selected.has(photo.assetId);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: isIn }}
              onPress={() => toggle(photo)}
              style={styles.cell}
            >
              <Image source={{ uri: photo.uri }} style={styles.cellImage} resizeMode="cover" />
              {!isIn && (looksLikeScreenshot(photo) || nearDupIds.has(photo.assetId)) && (
                <View style={styles.flagBadge}>
                  <Text style={styles.flagBadgeText}>
                    {looksLikeScreenshot(photo) ? 'Screenshot' : 'Similar shot'}
                  </Text>
                </View>
              )}
              {isIn ? (
                <View style={styles.inBadge}>
                  <Text style={styles.inBadgeText}>In FindIt</Text>
                </View>
              ) : (
                <View style={[styles.selectCircle, isSelected && styles.selectCircleOn]}>
                  {isSelected && <Text style={styles.check}>✓</Text>}
                </View>
              )}
              {isSelected && <View style={styles.selectedBorder} pointerEvents="none" />}
            </Pressable>
          );
        }}
        onEndReached={() => {
          if (hasNext && !loadingPage) loadPage(endCursor);
        }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          loadingPage ? <ActivityIndicator color={color.brand} style={styles.footerLoader} /> : null
        }
        ListEmptyComponent={
          loadingPage ? null : (
            <EmptyState title="No photos found" text="There are no photos in the library FindIt can see." />
          )
        }
      />

      {selectedCount > 0 && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionCount}>{selectedCount} selected</Text>
          <View style={styles.selectionAction}>
            <Button label="Analyse & import" onPress={openPreflight} />
          </View>
        </View>
      )}

      <Modal visible={showSummary} transparent animationType="slide" onRequestClose={() => setShowSummary(false)}>
        <View style={styles.scrim}>
          <Pressable style={styles.scrimTap} onPress={() => setShowSummary(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Before we start</Text>
            {currentPlan && (
              <>
                <Text style={styles.sheetLine}>{selectedCount} photos selected</Text>
                {currentPlan.duplicates.length > 0 && (
                  <Text style={styles.sheetLine}>{currentPlan.duplicates.length} already in FindIt — skipped</Text>
                )}
                <Text style={styles.sheetLine}>{currentPlan.toImport.length} will be imported now</Text>
                {selectedFlags.screenshots > 0 && (
                  <Text style={styles.sheetLine}>
                    {selectedFlags.screenshots} screenshot{selectedFlags.screenshots === 1 ? '' : 's'} in
                    your selection — receipts and bookings are worth keeping, memes maybe not
                  </Text>
                )}
                {selectedFlags.nearDups > 0 && (
                  <Text style={styles.sheetLine}>
                    {selectedFlags.nearDups} look like repeat shots of the same moment (burst photos)
                  </Text>
                )}
                {currentPlan.overLimit.length > 0 && (
                  <Text style={styles.sheetLine}>
                    {currentPlan.overLimit.length} need{currentPlan.overLimit.length === 1 ? 's' : ''} more room in
                    your plan — you can upgrade after this batch
                  </Text>
                )}
                <Text style={styles.sheetNote}>
                  This usually takes about 5–10 seconds per photo, depending on your
                  connection and AI demand.
                </Text>
                <View style={styles.sheetCta}>
                  <Button
                    label={currentPlan.toImport.length > 0 ? `Start import (${currentPlan.toImport.length})` : 'Nothing to import'}
                    onPress={startImport}
                    disabled={currentPlan.toImport.length === 0}
                  />
                </View>
                <Button label="Back" variant="ghost" onPress={() => setShowSummary(false)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = makeThemedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { flex: 1, padding: space.screen },
  spacer: { flex: 1 },
  back: { ...type.bodyStrong, color: c.brand, marginBottom: space.lg },
  title: { ...type.display, color: c.ink },
  lead: { ...type.body, color: c.body, marginTop: space.sm },
  factList: { marginTop: space.xxl },
  fact: { ...type.body, color: c.body, marginBottom: space.lg },
  factStrong: { fontWeight: '700', color: c.ink },
  deniedActions: { marginTop: space.xl, alignSelf: 'stretch' },

  gridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  gridTitle: { ...type.title, color: c.ink },
  gridHeaderSpacer: { width: 48 },
  limitedNote: {
    ...type.caption,
    color: c.warning,
    backgroundColor: c.warningBg,
    marginHorizontal: space.screen,
    borderRadius: radius.field,
    padding: space.sm,
    marginBottom: space.sm,
    overflow: 'hidden',
  },
  cell: { flex: 1 / 3, aspectRatio: 1, padding: CELL_GAP / 2 },
  cellImage: { flex: 1, borderRadius: 6, backgroundColor: c.surfaceAlt },
  selectCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(20,22,20,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleOn: { backgroundColor: c.brand, borderColor: c.brand },
  check: { color: '#fff', fontSize: 14, fontWeight: '800' },
  inBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(20,22,20,0.65)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  inBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  flagBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(91,69,242,0.85)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  flagBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  docNote: {
    ...type.body,
    color: c.body,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.field,
    padding: space.md,
    marginTop: space.md,
    overflow: 'hidden',
  },
  selectedBorder: {
    position: 'absolute',
    top: CELL_GAP / 2,
    left: CELL_GAP / 2,
    right: CELL_GAP / 2,
    bottom: CELL_GAP / 2,
    borderWidth: 3,
    borderColor: c.brand,
    borderRadius: 6,
  },
  footerLoader: { marginVertical: space.lg },

  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    ...sheetShadow,
  },
  selectionCount: { ...type.bodyStrong, color: c.ink, marginRight: space.lg },
  selectionAction: { flex: 1 },

  currentPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card, marginTop: space.xl, backgroundColor: c.surfaceAlt },
  progressLabel: { ...type.heading, color: c.ink, marginTop: space.xl },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, marginTop: space.md, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: c.brand },
  counts: { ...type.small, color: c.body, marginTop: space.md },

  remainingCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.card,
    padding: space.lg,
    marginTop: space.xl,
  },
  failedCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.card,
    padding: space.lg,
    marginTop: space.lg,
  },
  cardTitle: { ...type.heading, color: c.ink },
  cardText: { ...type.small, color: c.body, marginTop: space.xs, marginBottom: space.md },
  failedThumbs: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  failedThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: c.surfaceAlt },

  scrim: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  scrimTap: { flex: 1 },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxxl,
    ...sheetShadow,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: 'center', marginBottom: space.lg },
  sheetTitle: { ...type.title, color: c.ink, marginBottom: space.md },
  sheetLine: { ...type.body, color: c.ink, marginBottom: space.xs },
  sheetNote: { ...type.caption, color: c.muted, marginTop: space.md },
  sheetCta: { marginTop: space.xl },
}));
