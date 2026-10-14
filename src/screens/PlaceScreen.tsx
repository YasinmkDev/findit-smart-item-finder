import { ArrowLeft, Check, MapPin, Package, Plus, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GalleryCard } from '../components/ItemCard';
import { QrLabel } from '../components/QrLabel';
import { labelPayload, shareLabelPdf } from '../qr';
import { placeShareText, shareText } from '../share';
import { color, radius, sheetShadow, space, type } from '../theme';
import { makeThemedStyles } from '../theme';
import { ItemPhoto } from '../types';

interface Props {
  placeName: string;
  items: ItemPhoto[];
  onBack: () => void;
  onSelect: (item: ItemPhoto) => void;
  onStashHere: () => void;
  /** In-place item updates — powers Moving mode's packed checklist. */
  onUpdateItem?: (item: ItemPhoto) => void;
}

/** Packed checkbox shown on each item card while Moving mode is on. */
function PackedToggle({ item, onToggle }: { item: ItemPhoto; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!item.packed }}
      onPress={onToggle}
      style={[styles.packToggle, item.packed && styles.packToggleOn]}
      hitSlop={6}
    >
      <Check size={15} color={item.packed ? '#fff' : color.muted} strokeWidth={3} />
    </Pressable>
  );
}

/**
 * Inside a place: the cover photo opens the space, then everything
 * stashed there. Browsing a place should feel like opening the box.
 */
export default function PlaceScreen({ placeName, items, onBack, onSelect, onStashHere, onUpdateItem }: Props) {
  const cover = items[0];
  const [moving, setMoving] = useState(false);
  const packedCount = items.filter((i) => i.packed).length;

  async function onPrintLabel() {
    const outcome = await shareLabelPdf(placeName, items);
    if (outcome === 'unavailable') {
      Alert.alert('Label printing needs the full app', 'The on-screen label above is scannable as-is; PDF printing works in the full app build.');
    } else if (outcome === 'failed') {
      Alert.alert('Label failed', 'The label PDF could not be created. Please try again.');
    }
  }
  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={items.slice(1)}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.coverWrap}>
              {!!cover && <Image source={{ uri: cover.imageUri }} style={styles.cover} resizeMode="cover" />}
              <View style={styles.coverScrim} />
              <Pressable accessibilityRole="button" onPress={onBack} style={styles.backBtn} hitSlop={8}>
                <ArrowLeft size={20} color={color.onPhoto} strokeWidth={2.4} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => shareText(placeName, placeShareText(placeName, items))}
                style={styles.shareBtn}
                hitSlop={8}
              >
                <Share2 size={18} color={color.onPhoto} strokeWidth={2.2} />
              </Pressable>
              <View style={styles.coverText}>
                <View style={styles.placeRow}>
                  <MapPin size={15} color={color.brand} strokeWidth={2.6} />
                  <Text style={styles.placeOverline}>PLACE</Text>
                </View>
                <Text style={styles.placeName}>{placeName}</Text>
                <Text style={styles.placeCount}>
                  {items.length} item{items.length === 1 ? '' : 's'} stashed here
                </Text>
              </View>
            </View>

            {/* Moving mode (v0.11): pack checklist + QR box label */}
            <View style={styles.movingBar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMoving((v) => !v)}
                style={[styles.movingChip, moving && styles.movingChipOn]}
              >
                <Package size={14} color={moving ? '#fff' : color.brand} />
                <Text style={[styles.movingChipText, moving && styles.movingChipTextOn]}>
                  {moving ? 'Moving mode on' : 'Moving mode'}
                </Text>
              </Pressable>
              {moving && (
                <Text style={styles.packedMeta}>
                  {packedCount} of {items.length} packed
                </Text>
              )}
            </View>
            {moving && (
              <View style={styles.labelWrap}>
                <QrLabel payload={labelPayload(placeName)} placeName={placeName} count={items.length} />
                <Pressable accessibilityRole="button" onPress={onPrintLabel} style={styles.printBtn}>
                  <Text style={styles.printBtnText}>Print / share this label</Text>
                </Pressable>
                <Text style={styles.movingHint}>
                  Tap the ✓ on each item as you pack it into this box.
                </Text>
              </View>
            )}

            {!!cover && (
              <View style={styles.firstItem}>
                <GalleryCard item={cover} onPress={() => onSelect(cover)} />
                {moving && !!onUpdateItem && (
                  <PackedToggle item={cover} onToggle={() => onUpdateItem({ ...cover, packed: !cover.packed })} />
                )}
              </View>
            )}
            {items.length > 1 && <Text style={styles.moreTitle}>Also here</Text>}
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.gridCell}>
            <GalleryCard item={item} tall={index % 3 === 1} onPress={() => onSelect(item)} />
            {moving && !!onUpdateItem && (
              <PackedToggle item={item} onToggle={() => onUpdateItem({ ...item, packed: !item.packed })} />
            )}
          </View>
        )}
        ListEmptyComponent={null}
      />

      <Pressable
        accessibilityRole="button"
        onPress={onStashHere}
        style={({ pressed }) => [styles.stashBtn, pressed && { backgroundColor: color.brandPressed }]}
      >
        <Plus size={19} color={color.onBrand} strokeWidth={2.8} />
        <Text style={styles.stashText}>Stash here</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = makeThemedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { paddingBottom: 120 },
  gridRow: { gap: space.lg, paddingHorizontal: space.screen },
  gridCell: { flex: 1, position: 'relative' },

  coverWrap: { height: 264, backgroundColor: c.surfaceAlt },
  cover: { ...StyleSheet.absoluteFill },
  coverScrim: { ...StyleSheet.absoluteFill, backgroundColor: c.photoScrimSoft },
  backBtn: {
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
  shareBtn: {
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
  coverText: { position: 'absolute', left: space.screen, right: space.screen, bottom: space.xl },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeOverline: { ...type.overline, color: c.brand },
  placeName: { fontSize: 30, lineHeight: 35, fontWeight: '800', color: c.onPhoto, marginTop: 4 },
  placeCount: { ...type.small, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  movingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.screen,
    marginTop: space.lg,
  },
  movingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: c.brand,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  movingChipOn: { backgroundColor: c.brand },
  movingChipText: { ...type.small, color: c.brand, fontWeight: '700' },
  movingChipTextOn: { color: '#fff' },
  packedMeta: { ...type.small, color: c.body, fontWeight: '600' },
  labelWrap: { paddingHorizontal: space.screen, marginTop: space.md, gap: space.sm },
  printBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: c.brand,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  printBtnText: { ...type.small, color: c.brand, fontWeight: '700' },
  movingHint: { ...type.caption, color: c.muted, textAlign: 'center' },
  packToggle: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packToggleOn: { backgroundColor: c.brand, borderColor: c.brand },
  firstItem: { paddingHorizontal: space.screen, marginTop: space.xl, position: 'relative' },
  moreTitle: { ...type.heading, color: c.ink, paddingHorizontal: space.screen, marginBottom: space.lg },

  stashBtn: {
    position: 'absolute',
    right: space.screen,
    bottom: space.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.brand,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    minHeight: 52,
    ...sheetShadow,
  },
  stashText: { ...type.bodyStrong, color: c.onBrand, fontSize: 16 },
}));
