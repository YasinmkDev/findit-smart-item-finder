import { Lock, MapPin } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';
import { itemAccent } from '../colorStory';
import { NO_PLACE, placeNameOf, Place } from '../places';
import { color, radius, space, type } from '../theme';
import { makeThemedStyles } from '../theme';
import { ItemPhoto } from '../types';
import { SpringPressable } from './ui';

/**
 * v3 card anatomy (Airbnb pattern, from DESIGN_RESEARCH.md): the photo
 * alone is the card — big radius, no box. Text lives UNDER the photo on
 * the page background: bold title, grey place meta, colour dot.
 */
/** Privacy-shield veil used wherever a sensitive photo would appear. */
export function PhotoVeil({ style, small = false }: { style?: object; small?: boolean }) {
  return (
    <View style={[styles.veil, style]}>
      <Lock size={small ? 14 : 22} color={color.muted} />
      {!small && <Text style={styles.veilText}>Private</Text>}
    </View>
  );
}

/** Small marker dot positioned by normalised coordinates. */
export function MarkerDot({ item, size = 18 }: { item: ItemPhoto; size?: number }) {
  if (item.markerX === undefined || item.markerY === undefined) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.markerDot,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: size / 2,
          left: `${item.markerX * 100}%`,
          top: `${item.markerY * 100}%`,
        },
      ]}
    >
      <View style={styles.markerDotCore} />
    </View>
  );
}

export function GalleryCard({
  item,
  onPress,
  tall = false,
}: {
  item: ItemPhoto;
  onPress: () => void;
  tall?: boolean;
}) {
  const accent = itemAccent(item.colors);
  const place = placeNameOf(item);
  return (
    <SpringPressable onPress={onPress} style={styles.cardWrap}>
      <View>
        {item.sensitive ? (
          <PhotoVeil style={{ aspectRatio: tall ? 3 / 4 : 4 / 3, borderRadius: radius.card }} />
        ) : (
          <>
            <Image
              source={{ uri: item.imageUri }}
              style={[styles.cardImage, { aspectRatio: tall ? 3 / 4 : 4 / 3 }]}
              resizeMode="cover"
            />
            <MarkerDot item={item} />
          </>
        )}
      </View>
      <View style={styles.caption}>
        <View style={styles.captionText}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.sensitive ? 'Private item' : item.title}
          </Text>
          <View style={styles.placeRow}>
            <MapPin size={11} color={color.muted} strokeWidth={2.4} />
            <Text style={styles.cardPlace} numberOfLines={1}>
              {place === NO_PLACE ? 'No place yet' : place}
            </Text>
          </View>
        </View>
        {item.colors.length > 0 && <View style={[styles.colourDot, { backgroundColor: accent }]} />}
      </View>
    </SpringPressable>
  );
}

/** Spotify-style compact tile for "Jump back in": thumb left, text right. */
export function JumpTile({ item, onPress }: { item: ItemPhoto; onPress: () => void }) {
  const place = placeNameOf(item);
  return (
    <SpringPressable onPress={onPress} style={styles.jumpOuter} innerStyle={styles.jumpTile}>
      {item.sensitive ? (
        <PhotoVeil small style={styles.jumpThumb} />
      ) : (
        <Image source={{ uri: item.imageUri }} style={styles.jumpThumb} resizeMode="cover" />
      )}
      <View style={styles.jumpText}>
        <Text style={styles.jumpTitle} numberOfLines={2}>
          {item.sensitive ? 'Private item' : item.title}
        </Text>
        <Text style={styles.jumpPlace} numberOfLines={1}>
          {place === NO_PLACE ? 'No place yet' : place}
        </Text>
      </View>
    </SpringPressable>
  );
}

/**
 * Search-mode card (Airbnb feed anatomy): one answer per row —
 * full-width photo, then title, place and why it matched.
 */
export function AnswerCard({
  item,
  reason,
  onPress,
}: {
  item: ItemPhoto;
  reason?: string | null;
  onPress: () => void;
}) {
  const place = placeNameOf(item);
  return (
    <SpringPressable onPress={onPress} style={styles.answerCard}>
      {item.sensitive ? (
        <PhotoVeil style={styles.answerImage} />
      ) : (
        <View>
          <Image source={{ uri: item.imageUri }} style={styles.answerImage} resizeMode="cover" />
          <MarkerDot item={item} size={22} />
        </View>
      )}
      <View style={styles.answerBody}>
        <Text style={styles.answerTitle} numberOfLines={1}>
          {item.sensitive ? 'Private item' : item.title}
        </Text>
        <View style={styles.placeRow}>
          <MapPin size={12} color={color.muted} strokeWidth={2.4} />
          <Text style={styles.cardPlace} numberOfLines={1}>
            {place === NO_PLACE ? 'No place yet' : place}
          </Text>
        </View>
        {!!reason && !item.sensitive && <Text style={styles.answerReason}>{reason}</Text>}
      </View>
    </SpringPressable>
  );
}

/** Cover card for a Place — photo, scrim, big bold title (M3E album cover).
 *  Variants power the bento: `wide` = full-width hero tile, `half` = paired tile. */
export function PlaceCard({
  place,
  onPress,
  wide = false,
  half = false,
}: {
  place: Place;
  onPress: () => void;
  wide?: boolean;
  half?: boolean;
}) {
  return (
    <SpringPressable
      onPress={onPress}
      style={[styles.placeCard, wide && styles.placeCardWide, half && styles.placeCardHalf]}
    >
      {place.cover.sensitive ? (
        <PhotoVeil style={styles.placeImage} />
      ) : (
        <Image source={{ uri: place.cover.imageUri }} style={styles.placeImage} resizeMode="cover" />
      )}
      <View style={styles.placeScrim} />
      <View style={styles.placeTextWrap}>
        <Text style={[styles.placeName, half && styles.placeNameHalf]} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={styles.placeCount}>
          {place.items.length} item{place.items.length === 1 ? '' : 's'}
        </Text>
      </View>
    </SpringPressable>
  );
}

const styles = makeThemedStyles((c) => StyleSheet.create({
  veil: {
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  veilText: { ...type.caption, color: c.muted, fontWeight: '700', letterSpacing: 0.6 },
  markerDot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(91,69,242,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDotCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.brand },
  jumpOuter: { flex: 1 },
  jumpTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.field + 4,
    overflow: 'hidden',
    minHeight: 64,
  },
  jumpThumb: { width: 56, height: 64, backgroundColor: c.surfaceAlt },
  jumpText: { flex: 1, paddingHorizontal: space.md, paddingVertical: space.sm },
  jumpTitle: { fontSize: 13.5, lineHeight: 17, fontWeight: '600', color: c.ink },
  jumpPlace: { ...type.caption, color: c.muted, marginTop: 1 },

  answerCard: { marginBottom: space.xxl },
  answerImage: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.card, backgroundColor: c.surfaceAlt },
  answerBody: { paddingHorizontal: 2, paddingTop: space.sm },
  answerTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: c.ink },
  answerReason: { ...type.caption, fontWeight: '600', color: c.brand, marginTop: 2 },

  cardWrap: { marginBottom: space.xl },
  cardImage: { width: '100%', borderRadius: radius.card, backgroundColor: c.surfaceAlt },
  caption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 2,
    paddingTop: space.sm,
    gap: space.sm,
  },
  captionText: { flex: 1 },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: c.ink },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  cardPlace: { ...type.small, color: c.muted },
  colourDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },

  placeCard: {
    width: 248,
    height: 164,
    borderRadius: radius.card,
    overflow: 'hidden',
    marginRight: space.md,
    backgroundColor: c.surfaceAlt,
  },
  placeCardWide: { width: '100%', height: 178, marginRight: 0 },
  placeCardHalf: { flex: 1, width: undefined, height: 128, marginRight: 0 },
  placeNameHalf: { fontSize: 17, lineHeight: 21 },
  placeImage: { ...StyleSheet.absoluteFill },
  placeScrim: { ...StyleSheet.absoluteFill, backgroundColor: c.photoScrimSoft },
  placeTextWrap: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
  placeName: { fontSize: 21, lineHeight: 26, fontWeight: '800', color: c.onPhoto },
  placeCount: { ...type.caption, fontWeight: '600', color: 'rgba(255,255,255,0.88)', marginTop: 1 },
}));
