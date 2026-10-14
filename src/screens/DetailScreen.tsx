import { ArrowLeft, Crosshair, HandCoins, Lock, MapPin, Pencil, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
// ScrollView is used by the "More from this place" shelf below.
import { MarkerDot, PhotoVeil } from '../components/ItemCard';
import { Button, Field, TagChip } from '../components/ui';
import { colourHex, tintOf } from '../colorStory';
import { expiryLabel, isDifferentDay } from '../photoMeta';
import { itemShareText, shareText } from '../share';
import { NO_PLACE, placeNameOf } from '../places';
import { cardShadow, color, radius, space, type } from '../theme';
import { makeThemedStyles } from '../theme';
import { ItemPhoto } from '../types';

interface Props {
  item: ItemPhoto;
  onBack: () => void;
  onEdit: (item: ItemPhoto) => void;
  onDelete: (item: ItemPhoto) => void;
  onOpenPlace: (placeName: string) => void;
  /** Other items kept in the same place — the "More from this place" shelf. */
  moreItems?: ItemPhoto[];
  onSelectItem?: (item: ItemPhoto) => void;
  /** Quick in-place updates (lent-it actions) without opening Edit. */
  onUpdate?: (item: ItemPhoto) => void;
  /** Settings → Safety: ask before deleting (default true). */
  confirmDelete?: boolean;
  /** People this user has lent to before — one-tap borrower chips. */
  borrowers?: string[];
}

function ChipSection({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chips}>
        {values.map((v) => (
          <TagChip key={v} label={v} />
        ))}
      </View>
    </View>
  );
}

/**
 * The answer page. Order matters: photo first (recognition), then the
 * one fact the user came for — where it is — bigger than anything else.
 */
export default function DetailScreen({ item, onBack, onEdit, onDelete, onOpenPlace, moreItems = [], onSelectItem, onUpdate, borrowers = [], confirmDelete = true }: Props) {
  const [lendFormOpen, setLendFormOpen] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const place = placeNameOf(item);
  const hasPlace = place !== NO_PLACE;
  // Privacy shield: a sensitive photo stays veiled until tapped, and
  // re-veils whenever a different item is opened.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [item.id]);
  const shielded = !!item.sensitive && !revealed;

  function askDelete() {
    if (!confirmDelete) {
      onDelete(item);
      return;
    }
    Alert.alert('Delete this item?', 'The photo and its tags will be removed from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Immersive photo header */}
        <View style={styles.photoWrap}>
          {shielded ? (
            <Pressable onPress={() => setRevealed(true)}>
              <PhotoVeil style={styles.photo} />
              <View style={styles.veilHint} pointerEvents="none">
                <Lock size={13} color={color.muted} />
                <Text style={styles.veilHintText}>Private photo — tap to reveal</Text>
              </View>
            </Pressable>
          ) : (
            <>
              <Image source={{ uri: item.imageUri }} style={styles.photo} resizeMode="cover" />
              <MarkerDot item={item} size={26} />
            </>
          )}
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.circleBtnLeft} hitSlop={8}>
            <ArrowLeft size={20} color={color.onPhoto} strokeWidth={2.4} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onEdit(item)} style={styles.circleBtnRight} hitSlop={8}>
            <Pencil size={18} color={color.onPhoto} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {!!item.needsEnrichment && (
            <View style={styles.pendingNote}>
              <Text style={styles.pendingNoteText}>
                AI details pending — saved before analysis could finish. Open Edit to complete it.
              </Text>
            </View>
          )}
          <Text style={styles.title}>{item.title || 'Untitled item'}</Text>
          {!!item.description && <Text style={styles.description}>{item.description}</Text>}

          {/* THE answer: where it is */}
          <Pressable
            accessibilityRole="button"
            disabled={!hasPlace}
            onPress={() => onOpenPlace(place)}
            style={styles.placeCard}
          >
            <View style={styles.placeIconWrap}>
              <MapPin size={22} color={color.brand} strokeWidth={2.4} />
            </View>
            <View style={styles.placeText}>
              <Text style={styles.placeLabel}>{hasPlace ? 'YOU KEPT IT IN' : 'NO PLACE NOTED'}</Text>
              <Text style={styles.placeValue}>{hasPlace ? place : 'Edit this item to add where it lives'}</Text>
            </View>
          </Pressable>

          {/* Lent-it tracker (v0.11) */}
          {!!onUpdate && (
            <View style={styles.lendCard}>
              {item.lentTo ? (
                <>
                  <View style={styles.lendRow}>
                    <HandCoins size={18} color={color.brand} strokeWidth={2.2} />
                    <Text style={styles.lendText}>
                      With {item.lentTo}
                      {item.lentAt
                        ? ` since ${new Date(item.lentAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : ''}
                    </Text>
                  </View>
                  <Button
                    label="Mark returned"
                    variant="secondary"
                    onPress={() => onUpdate({ ...item, lentTo: undefined, lentAt: undefined })}
                  />
                </>
              ) : lendFormOpen ? (
                <>
                  <Field
                    label="Who has it?"
                    value={borrowerName}
                    onChangeText={setBorrowerName}
                    placeholder="e.g. Ahmed, Sara, Uncle Rashid"
                  />
                  {borrowers.length > 0 && (
                    <View style={styles.chips}>
                      {borrowers.map((b) => (
                        <Pressable key={b} onPress={() => setBorrowerName(b)} style={styles.borrowerChip}>
                          <Text style={styles.borrowerChipText}>{b}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <View style={styles.lendActions}>
                    <View style={{ flex: 1 }}>
                      <Button label="Cancel" variant="ghost" onPress={() => setLendFormOpen(false)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Lend it"
                        onPress={() => {
                          const name = borrowerName.trim();
                          if (!name) return;
                          onUpdate({ ...item, lentTo: name, lentAt: new Date().toISOString() });
                          setLendFormOpen(false);
                          setBorrowerName('');
                        }}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <Button label="Lend it out" variant="secondary" onPress={() => setLendFormOpen(true)} />
              )}
            </View>
          )}

          {/* Household sharing (v0.11): send a clean summary to family */}
          <Pressable
            accessibilityRole="button"
            onPress={() => shareText(item.title || 'FindIt item', itemShareText(item))}
            style={styles.shareRow}
          >
            <Share2 size={16} color={color.brand} strokeWidth={2.2} />
            <Text style={styles.shareText}>Share with family</Text>
          </Pressable>

          {/* Mark-the-spot note: the visual answer, in words */}
          {!!item.markerNote && !shielded && (
            <View style={styles.markerNote}>
              <Crosshair size={15} color={color.brand} strokeWidth={2.4} />
              <Text style={styles.markerNoteText}>Marked on the photo: {item.markerNote}</Text>
            </View>
          )}

          {/* Colour story */}
          {item.colors.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Colour story</Text>
              <View style={styles.colourRow}>
                {item.colors.map((c) => {
                  const hex = colourHex(c);
                  return (
                    <View key={c} style={styles.colourChip}>
                      <View style={[styles.colourSwatch, { backgroundColor: hex, borderColor: tintOf(hex) }]} />
                      <Text style={styles.colourName}>{c}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <ChipSection label="Tags" values={item.tags} />
          <ChipSection label="Also in the photo" values={item.objects} />

          <View style={styles.factsCard}>
            {!!item.category && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Category</Text>
                <Text style={styles.factValue}>{item.category}</Text>
              </View>
            )}
            {!!item.expiresAt && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Warranty / expiry</Text>
                <Text style={styles.factValue}>
                  {item.expiresAt} · {expiryLabel(item.expiresAt)}
                </Text>
              </View>
            )}
            {!!item.photoTakenAt && isDifferentDay(item.photoTakenAt, item.createdAt) && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Photo taken</Text>
                <Text style={styles.factValue}>
                  {new Date(item.photoTakenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            )}
            <View style={[styles.factRow, styles.factRowLast]}>
              <Text style={styles.factLabel}>Stashed</Text>
              <Text style={styles.factValue}>
                {new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
          </View>

          {!!item.ocrText && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Text in the photo</Text>
              <View style={styles.quote}>
                <Text style={styles.quoteText}>{item.ocrText}</Text>
              </View>
            </View>
          )}

          {/* More from this place — an answer page should not be a dead end */}
          {hasPlace && moreItems.length > 0 && onSelectItem && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>More from {place}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.moreRail}
                style={styles.moreRailWrap}
              >
                {moreItems.map((other) => (
                  <Pressable
                    key={other.id}
                    accessibilityRole="button"
                    onPress={() => onSelectItem(other)}
                    style={styles.moreCard}
                  >
                    {other.sensitive ? (
                      <PhotoVeil small style={styles.moreImage} />
                    ) : (
                      <Image source={{ uri: other.imageUri }} style={styles.moreImage} resizeMode="cover" />
                    )}
                    <Text style={styles.moreTitle} numberOfLines={1}>
                      {other.sensitive ? 'Private item' : other.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.deleteWrap}>
            <Button label="Delete this item" variant="dangerGhost" onPress={askDelete} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = makeThemedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { paddingBottom: space.huge },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: c.surfaceAlt },
  circleBtnLeft: {
    position: 'absolute',
    top: space.lg,
    left: space.screen,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.photoScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnRight: {
    position: 'absolute',
    top: space.lg,
    right: space.screen,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.photoScrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: space.screen,
    paddingTop: space.xl,
    marginTop: -space.xxl,
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    marginBottom: space.sm,
  },
  shareText: { ...type.body, color: c.brand, fontWeight: '700' },
  lendCard: {
    backgroundColor: c.surface,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.sm,
    marginBottom: space.md,
    ...cardShadow,
  },
  lendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lendText: { ...type.body, color: c.ink, fontWeight: '700', flex: 1 },
  lendActions: { flexDirection: 'row', gap: space.md },
  borrowerChip: {
    borderWidth: 1,
    borderColor: c.brand,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 5,
  },
  borrowerChipText: { ...type.small, color: c.brand, fontWeight: '600' },
  veilHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  veilHintText: { ...type.small, color: c.muted, fontWeight: '600' },
  markerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.field,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.md,
  },
  markerNoteText: { ...type.small, color: c.body, flex: 1, fontWeight: '600' },
  pendingNote: {
    backgroundColor: c.warningBg,
    borderRadius: radius.field,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    marginBottom: space.md,
  },
  pendingNoteText: { ...type.caption, fontWeight: '600', color: c.warning },
  title: { ...type.display, color: c.ink },
  description: { ...type.body, color: c.body, marginTop: space.sm },

  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.card,
    padding: space.lg,
    marginTop: space.xl,
  },
  placeIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: { flex: 1 },
  placeLabel: { ...type.overline, color: c.muted },
  placeValue: { fontSize: 19, lineHeight: 24, fontWeight: '700', color: c.ink, marginTop: 2 },

  section: { marginTop: space.xl },
  sectionLabel: { ...type.overline, color: c.muted, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  colourRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  colourChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colourSwatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  colourName: { ...type.small, color: c.body, textTransform: 'capitalize' },

  factsCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    marginTop: space.xl,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  factRowLast: { borderBottomWidth: 0 },
  factLabel: { ...type.small, fontWeight: '600', color: c.muted },
  factValue: { ...type.bodyStrong, color: c.ink, textTransform: 'capitalize' },

  quote: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.card,
    padding: space.lg,
  },
  quoteText: { ...type.body, color: c.body },

  moreRailWrap: { marginHorizontal: -space.screen },
  moreRail: { paddingHorizontal: space.screen, gap: space.md },
  moreCard: { width: 128 },
  moreImage: { width: 128, height: 96, borderRadius: radius.field + 4, backgroundColor: c.surfaceAlt },
  moreTitle: { ...type.small, fontWeight: '600', color: c.ink, marginTop: 6 },

  deleteWrap: { marginTop: space.xxxl },
}));
