import {
  Armchair,
  Blocks,
  Cable,
  Car,
  Drill,
  FileText,
  Images,
  KeyRound,
  MapPin,
  Pill,
  Plus,
  Crown,
  ScanSearch,
  Search,
  Settings2,
  Shapes,
  Shirt,
  Sparkles,
  UtensilsCrossed,
  Wrench,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AnswerCard, GalleryCard, JumpTile, PlaceCard } from '../components/ItemCard';
import { Button, ProBadge, SpringPressable, UsageMeter } from '../components/ui';
import { PlanKind } from '../plan';
import { derivePlaces, NO_PLACE, placeNameOf } from '../places';
import { isSample } from '../sampleData';
import { daysUntil, expiryLabel } from '../photoMeta';
import { searchItems } from '../search';
import { LinearGradient } from 'expo-linear-gradient';
import { cardShadow, color, proGradient, radius, sheetShadow, space, type } from '../theme';
import { makeThemedStyles } from '../theme';
import { ItemPhoto } from '../types';

interface Props {
  items: ItemPhoto[];
  plan: PlanKind;
  onAdd: () => void;
  onImport: () => void;
  onSelect: (item: ItemPhoto) => void;
  onOpenPlace: (placeName: string) => void;
  onReport: () => void;
  onSettings: () => void;
  onUpgrade: () => void;
  onLoadSamples: () => void;
  onClearSamples: () => void;
}

const CATEGORY_ICONS: Record<string, typeof Wrench> = {
  tool: Wrench,
  electronics: Cable,
  document: FileText,
  clothing: Shirt,
  kitchen: UtensilsCrossed,
  vehicle: Car,
  furniture: Armchair,
  toy: Blocks,
  medicine: Pill,
  other: Shapes,
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Why this item matched — shown on answer cards so search explains itself. */
function matchReason(item: ItemPhoto, query: string): string | null {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // Lent items answer the question directly: "With Sara since 12 Oct".
  if (item.lentTo) {
    const asksWho = words.includes('who') || words.includes('lent') || words.includes('borrowed');
    const namesBorrower = words.some((w) => item.lentTo!.toLowerCase().includes(w));
    if (asksWho || namesBorrower) {
      const since = item.lentAt
        ? new Date(item.lentAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
        : '';
      return `With ${item.lentTo}${since ? ` since ${since}` : ''}`;
    }
  }
  for (const w of words) {
    if (placeNameOf(item).toLowerCase().includes(w)) return `Kept in ${placeNameOf(item)}`;
    if (item.tags.some((t) => t.toLowerCase().includes(w))) return `Tagged “${w}”`;
    if (item.title.toLowerCase().includes(w)) return 'In its name';
    if (item.category.toLowerCase().includes(w)) return `A ${item.category}`;
    if (item.colors.some((c) => c.toLowerCase().includes(w))) return `Colour: ${item.colors.join(', ')}`;
  }
  return null;
}

const SCREEN_W = Dimensions.get('window').width;
const SPOT_W = Math.round(SCREEN_W * 0.82);

export default function HomeScreen({ items, plan, onAdd, onImport, onSelect, onOpenPlace, onReport, onSettings, onUpgrade, onLoadSamples, onClearSamples }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [spotIndex, setSpotIndex] = useState(0);
  const searching = query.trim().length > 0;
  const sampleCount = useMemo(() => items.filter(isSample).length, [items]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items]
  );
  const places = useMemo(() => derivePlaces(items), [items]);
  const realPlaces = useMemo(() => places.filter((p) => p.name !== NO_PLACE), [places]);
  const jumpItems = useMemo(() => sorted.slice(0, 4), [sorted]);
  const lentItems = useMemo(() => items.filter((i) => i.lentTo), [items]);
  const comingUp = useMemo(
    () =>
      items
        .filter((i) => i.expiresAt)
        .map((item) => ({ item, days: daysUntil(item.expiresAt!) }))
        .filter(({ days }) => days <= 60)
        .sort((a, b) => a.days - b.days)
        .slice(0, 5),
    [items]
  );
  const spotlight = useMemo(() => sorted.slice(0, 5), [sorted]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.category) set.add(item.category);
    return Array.from(set).sort();
  }, [items]);

  const results = useMemo(() => {
    let list = searchItems(items, query);
    if (category) list = list.filter((i) => i.category === category);
    return list;
  }, [items, query, category]);

  const showMeter = plan === 'free' && items.length >= 15;

  function onSpotScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SPOT_W + space.md));
    if (idx !== spotIndex) setSpotIndex(Math.max(0, Math.min(spotlight.length - 1, idx)));
  }

  const header = (
    <View>
      {/* Zone 1 — App bar: ONE row, one job per element.
          [avatar] [greeting + count] ... [GO PRO] [settings]
          Nothing stacks, nothing competes. */}
      <View style={styles.masthead}>
        <View style={styles.monogram}>
          <Text style={styles.monogramText}>F</Text>
        </View>
        <View style={styles.mastheadText}>
          <Text style={styles.greeting} numberOfLines={1}>
            {searching ? 'Find it fast' : greeting()}
          </Text>
          <Text style={styles.worldSub} numberOfLines={1}>
            {items.length} thing{items.length === 1 ? '' : 's'} · {realPlaces.length} place
            {realPlaces.length === 1 ? '' : 's'} · all findable
          </Text>
        </View>
        {plan === 'pro' ? (
          <ProBadge />
        ) : (
          <Pressable accessibilityRole="button" onPress={onUpgrade} hitSlop={8}>
            <LinearGradient colors={proGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.upgradePill}>
              <Crown size={13} color="#FFFFFF" strokeWidth={2.6} />
              <Text style={styles.upgradeText}>GO PRO</Text>
            </LinearGradient>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onSettings} hitSlop={8} style={styles.gearBtn}>
          <Settings2 size={19} color={color.body} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Zone 2 — Search owns its row, full width. Actions get their
          own labeled row underneath: no mystery round buttons. */}
      <View style={styles.searchWrap}>
        <Search size={20} color={color.ink} strokeWidth={2.4} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your things…"
          placeholderTextColor={color.muted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searching && (
          <Pressable accessibilityRole="button" onPress={() => setQuery('')} hitSlop={8}>
            <X size={18} color={color.muted} strokeWidth={2.4} />
          </Pressable>
        )}
      </View>
      {!searching && <Text style={styles.searchHint}>Try “passport”, “red drill”, or the place you kept it</Text>}
      {!searching && (
        <View style={styles.actionsRow}>
          <SpringPressable onPress={onImport} style={styles.actionChip} accessibilityLabel="Import photos">
            <Images size={17} color={color.brand} strokeWidth={2.2} />
            <Text style={styles.actionChipText}>Import photos</Text>
          </SpringPressable>
          <SpringPressable onPress={onReport} style={styles.actionChip} accessibilityLabel="Insurance report (PDF)">
            <FileText size={17} color={color.brand} strokeWidth={2.2} />
            <Text style={styles.actionChipText}>Report PDF</Text>
          </SpringPressable>
        </View>
      )}

      {sampleCount > 0 && !searching && (
        <View style={styles.sampleBanner}>
          <Text style={styles.sampleBannerText}>
            Sample data — {sampleCount} test items so you can try the design
          </Text>
          <Pressable accessibilityRole="button" onPress={onClearSamples} hitSlop={8}>
            <Text style={styles.sampleBannerClear}>Clear</Text>
          </Pressable>
        </View>
      )}

      {showMeter && !searching && (
        <View style={styles.meterWrap}>
          <UsageMeter used={items.length} onUpgrade={onUpgrade} />
        </View>
      )}

      {!searching && (
        <>
          {/* Zone 3 — Jump back in (Spotify): familiar, recent, compact */}
          {jumpItems.length >= 2 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Jump back in</Text>
              <View style={styles.jumpGrid}>
                {[0, 2].map((start) => (
                  <View key={start} style={styles.jumpRow}>
                    {jumpItems.slice(start, start + 2).map((item) => (
                      <JumpTile key={item.id} item={item} onPress={() => onSelect(item)} />
                    ))}
                    {jumpItems.slice(start, start + 2).length === 1 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Out on loan — lent-it tracker surface (v0.11) */}
          {lentItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Out on loan</Text>
              <View style={styles.jumpGrid}>
                {lentItems.slice(0, 4).map((item) => (
                  <View key={item.id} style={styles.loanRow}>
                    <JumpTile item={item} onPress={() => onSelect(item)} />
                    <Text style={styles.loanMeta} numberOfLines={1}>
                      With {item.lentTo}
                      {item.lentAt
                        ? ` · ${new Date(item.lentAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                        : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Coming up — warranty & expiry radar (v0.11) */}
          {comingUp.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Coming up</Text>
              <View style={styles.jumpGrid}>
                {comingUp.map(({ item, days }) => (
                  <Pressable key={item.id} onPress={() => onSelect(item)} style={styles.expiryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.expiryName} numberOfLines={1}>
                        {item.sensitive ? 'Private item' : item.title}
                      </Text>
                      <Text style={styles.loanMeta}>{item.expiresAt}</Text>
                    </View>
                    <View
                      style={[
                        styles.expiryChip,
                        days < 0 && styles.expiryChipDanger,
                        days >= 0 && days <= 14 && styles.expiryChipWarn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.expiryChipText,
                          (days < 0 || days <= 14) && styles.expiryChipTextHot,
                        ]}
                      >
                        {expiryLabel(item.expiresAt!)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Zone 4 — Spotlight carousel (Apple Music): featured, snap, dots */}
          {spotlight.length >= 3 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Spotlight</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={SPOT_W + space.md}
                decelerationRate="fast"
                contentContainerStyle={styles.spotRail}
                onScroll={onSpotScroll}
                scrollEventThrottle={32}
              >
                {spotlight.map((item) => (
                  <SpringPressable
                    key={item.id}
                    onPress={() => onSelect(item)}
                    style={[styles.spotCard, { width: SPOT_W }]}
                  >
                    <Image source={{ uri: item.imageUri }} style={styles.spotImage} resizeMode="cover" />
                    <View style={styles.heroScrim} />
                    <View style={styles.heroText}>
                      <Text style={styles.heroOverline}>RECENTLY STASHED</Text>
                      <Text style={styles.heroTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.heroPlaceRow}>
                        <MapPin size={13} color="#FFFFFF" strokeWidth={2.6} />
                        <Text style={styles.heroPlace}>{placeNameOf(item)}</Text>
                      </View>
                    </View>
                  </SpringPressable>
                ))}
              </ScrollView>
              <View style={styles.dots}>
                {spotlight.map((item, i) => (
                  <View key={item.id} style={[styles.dot, i === spotIndex && styles.dotActive]} />
                ))}
              </View>
            </View>
          )}

          {/* Zone 5 — Your places, bento: size = how much lives there */}
          {realPlaces.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your places</Text>
              <PlaceCard place={realPlaces[0]} wide onPress={() => onOpenPlace(realPlaces[0].name)} />
              {realPlaces.length >= 3 && (
                <View style={styles.bentoRow}>
                  <PlaceCard place={realPlaces[1]} half onPress={() => onOpenPlace(realPlaces[1].name)} />
                  <View style={{ width: space.md }} />
                  <PlaceCard place={realPlaces[2]} half onPress={() => onOpenPlace(realPlaces[2].name)} />
                </View>
              )}
              {realPlaces.length === 2 && (
                <View style={styles.bentoRow}>
                  <PlaceCard place={realPlaces[1]} wide onPress={() => onOpenPlace(realPlaces[1].name)} />
                </View>
              )}
              {realPlaces.length > 3 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rail}
                  style={styles.morePlaces}
                >
                  {realPlaces.slice(3).map((place) => (
                    <PlaceCard key={place.name} place={place} onPress={() => onOpenPlace(place.name)} />
                  ))}
                  {places.some((p) => p.name === NO_PLACE) && (
                    <PlaceCard
                      place={places.find((p) => p.name === NO_PLACE)!}
                      onPress={() => onOpenPlace(NO_PLACE)}
                    />
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Zone 6 — Category icon rail: serves content, never gates it */}
          {categories.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iconRail}
              style={styles.iconRailWrap}
            >
              {categories.map((name) => {
                const Icon = CATEGORY_ICONS[name] ?? Shapes;
                const active = category === name;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCategory(active ? null : name)}
                    style={styles.iconRailItem}
                  >
                    <Icon size={24} color={active ? color.ink : color.muted} strokeWidth={active ? 2.4 : 2} />
                    <Text style={[styles.iconRailLabel, active && styles.iconRailLabelActive]}>{name}</Text>
                    <View style={[styles.iconRailUnderline, active && styles.iconRailUnderlineActive]} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {/* Zone 7 title */}
      <Text style={styles.sectionTitleSpaced}>
        {searching
          ? `${results.length} answer${results.length === 1 ? '' : 's'} for “${query.trim()}”`
          : category
            ? `All ${category}`
            : 'All things'}
      </Text>
    </View>
  );

  /* ------------------------------ Empty library ----------------------------- */
  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.emptyScroll}>
          <View style={styles.masthead}>
            <View style={styles.monogram}>
              <Text style={styles.monogramText}>F</Text>
            </View>
            <Text style={[styles.wordmark, { flex: 1 }]}>
              Find<Text style={{ color: color.brand }}>It</Text>
            </Text>
            <Pressable accessibilityRole="button" onPress={onSettings} hitSlop={8} style={styles.gearBtn}>
              <Settings2 size={19} color={color.body} strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text style={styles.display}>Never lose a{'\n'}thing again.</Text>
          <Text style={styles.worldSub}>
            Photograph what you own and where you put it. Later, one word brings it back.
          </Text>
          <DemoSearch />
          <View style={styles.emptyCtas}>
            <Button label="Stash your first item" onPress={onAdd} />
            <View style={{ height: space.md }} />
            <Button label="Import photos you already have" variant="secondary" onPress={onImport} />
            <View style={{ height: space.md }} />
            <Button label="Load sample data (for testing)" variant="ghost" onPress={onLoadSamples} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        key={searching ? 'answers' : 'browse'}
        data={results}
        keyExtractor={(item) => item.id}
        numColumns={searching ? 1 : 2}
        columnWrapperStyle={searching ? undefined : styles.gridRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        renderItem={({ item, index }) =>
          searching ? (
            <AnswerCard item={item} reason={matchReason(item, query)} onPress={() => onSelect(item)} />
          ) : (
            <View style={styles.gridCell}>
              <GalleryCard item={item} tall={index % 3 === 1} onPress={() => onSelect(item)} />
            </View>
          )
        }
        ListEmptyComponent={
          <View style={styles.noResults}>
            <Text style={styles.noResultsTitle}>Nothing matches “{query.trim()}” yet</Text>
            <Text style={styles.noResultsText}>
              Try a simpler word — a colour, an object, or the place you kept it.
            </Text>
          </View>
        }
      />

      {/* Floating dock */}
      <View style={styles.dock}>
        <Pressable
          accessibilityRole="button"
          onPress={onImport}
          style={({ pressed }) => [styles.dockImport, pressed && { backgroundColor: color.surfaceAlt }]}
        >
          <Images size={19} color={color.ink} strokeWidth={2.2} />
          <Text style={styles.dockImportText}>Import</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [styles.dockAdd, pressed && { backgroundColor: color.brandPressed }]}
        >
          <Plus size={20} color={color.onBrand} strokeWidth={2.8} />
          <Text style={styles.dockAddText}>Stash an item</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ------------------------- Interactive first-run demo ------------------------ */

const DEMO = [
  { title: 'Passport', place: 'Bedroom — blue drawer', Icon: ScanSearch, tint: '#3E6FB0', words: 'passport document travel id' },
  { title: 'Cordless drill', place: 'Garage — red toolbox', Icon: Drill, tint: '#D64541', words: 'drill tool red garage screwdriver' },
  { title: 'Spare house keys', place: 'Hall — key bowl', Icon: KeyRound, tint: '#E8A33D', words: 'keys spare house metal' },
];

function DemoSearch() {
  const [q, setQ] = useState('');
  const hits = DEMO.filter((d) => (d.title + ' ' + d.place + ' ' + d.words).toLowerCase().includes(q.trim().toLowerCase()));
  const showHits = q.trim().length > 0 ? hits : DEMO;
  return (
    <View style={styles.demoCard}>
      <Text style={styles.demoOverline}>TRY IT — A SAMPLE WORLD</Text>
      <View style={styles.demoSearch}>
        <Search size={17} color={color.muted} strokeWidth={2.4} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Type “passport” or “garage”…"
          placeholderTextColor={color.muted}
          style={styles.demoInput}
          autoCorrect={false}
        />
      </View>
      <View style={styles.demoRow}>
        {showHits.map(({ title, place, Icon, tint }) => (
          <View key={title} style={styles.demoItem}>
            <View style={[styles.demoIconWrap, { backgroundColor: tint }]}>
              <Icon size={26} color="#fff" strokeWidth={2} />
            </View>
            <Text style={styles.demoTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.demoPlace} numberOfLines={1}>{place}</Text>
          </View>
        ))}
        {q.trim().length > 0 && hits.length === 0 && (
          <Text style={styles.demoNone}>No match in the sample — yours will search everything about a photo.</Text>
        )}
      </View>
      <Text style={styles.demoCaption}>
        That is the whole idea: stash it once, find it in seconds.
      </Text>
    </View>
  );
}

/* ---------------------------------- Styles ---------------------------------- */

const styles = makeThemedStyles((c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  listContent: { paddingHorizontal: space.screen, paddingBottom: 120 },
  gridRow: { gap: space.lg },
  gridCell: { flex: 1 },

  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.md,
    marginBottom: space.lg,
  },
  mastheadText: { flex: 1, minWidth: 0 },
  greeting: { fontSize: 21, lineHeight: 26, fontWeight: '800', color: c.ink, letterSpacing: -0.3 },
  worldSub: { ...type.small, color: c.muted, marginTop: 1 },
  monogram: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { color: c.onBrand, fontSize: 18, fontWeight: '800' },
  wordmark: { fontSize: 22, fontWeight: '800', color: c.ink, letterSpacing: -0.3 },
  gearBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  upgradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    shadowColor: '#FF8A00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: 56,
    ...sheetShadow,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', color: c.ink, paddingVertical: space.md },
  actionsRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    minHeight: 44,
    ...cardShadow,
  },
  actionChipText: { ...type.small, fontWeight: '700', color: c.ink },
  searchHint: { ...type.caption, color: c.muted, marginTop: space.sm, marginLeft: space.lg },
  sampleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.brandSoft,
    borderRadius: radius.field,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    marginTop: space.md,
  },
  sampleBannerText: { ...type.caption, fontWeight: '600', color: c.brandPressed, flex: 1 },
  sampleBannerClear: { ...type.caption, fontWeight: '800', color: c.brand },
  meterWrap: { marginTop: space.lg },

  section: { marginTop: space.xxl },
  sectionTitle: { ...type.heading, color: c.ink, marginBottom: space.md },
  sectionTitleSpaced: { ...type.heading, color: c.ink, marginTop: space.xxl, marginBottom: space.lg },

  jumpGrid: { gap: space.md },
  loanRow: { gap: space.xs },
  loanMeta: { ...type.caption, color: c.muted, fontWeight: '600', marginLeft: space.xs },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: c.surface,
    borderRadius: radius.field + 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    ...cardShadow,
  },
  expiryName: { ...type.body, color: c.ink, fontWeight: '700' },
  expiryChip: {
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  expiryChipWarn: { backgroundColor: c.warningBg },
  expiryChipDanger: { backgroundColor: c.dangerSoft },
  expiryChipText: { ...type.caption, color: c.body, fontWeight: '700' },
  expiryChipTextHot: { color: c.danger },
  jumpRow: { flexDirection: 'row', gap: space.md },

  spotRail: { paddingRight: space.screen },
  spotCard: {
    height: 218,
    borderRadius: radius.sheet,
    overflow: 'hidden',
    marginRight: space.md,
    backgroundColor: c.surfaceAlt,
    ...cardShadow,
  },
  spotImage: { ...StyleSheet.absoluteFill },
  heroScrim: { ...StyleSheet.absoluteFill, backgroundColor: c.photoScrimSoft },
  heroText: { position: 'absolute', left: space.xl, right: space.xl, bottom: space.lg },
  heroOverline: { ...type.overline, color: '#FFFFFF' },
  heroTitle: { fontSize: 26, lineHeight: 31, fontWeight: '800', color: c.onPhoto, marginTop: 3 },
  heroPlaceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  heroPlace: { ...type.small, fontWeight: '600', color: 'rgba(255,255,255,0.92)' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.borderStrong },
  dotActive: { width: 18, backgroundColor: c.ink },

  bentoRow: { flexDirection: 'row', marginTop: space.md },
  morePlaces: { marginTop: space.md, marginHorizontal: -space.screen },
  rail: { paddingHorizontal: space.screen, paddingRight: space.screen },

  iconRailWrap: { marginTop: space.xxl, marginHorizontal: -space.screen },
  iconRail: { paddingHorizontal: space.screen, gap: space.xl },
  iconRailItem: { alignItems: 'center', paddingBottom: 6 },
  iconRailLabel: {
    ...type.caption,
    fontWeight: '600',
    color: c.muted,
    textTransform: 'capitalize',
    marginTop: 5,
  },
  iconRailLabelActive: { color: c.ink },
  iconRailUnderline: { height: 2, width: '100%', backgroundColor: 'transparent', marginTop: 5, borderRadius: 1 },
  iconRailUnderlineActive: { backgroundColor: c.ink },

  noResults: { paddingVertical: space.xxxl, paddingHorizontal: space.lg },
  noResultsTitle: { ...type.heading, color: c.ink, textAlign: 'center' },
  noResultsText: { ...type.small, color: c.muted, textAlign: 'center', marginTop: space.sm, lineHeight: 19 },

  dock: {
    position: 'absolute',
    left: space.screen,
    right: space.screen,
    bottom: space.xxl,
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.pill,
    padding: space.sm,
    ...sheetShadow,
  },
  dockImport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: 50,
  },
  dockImportText: { ...type.bodyStrong, color: c.ink },
  dockAdd: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: c.brand,
    borderRadius: radius.pill,
    minHeight: 50,
  },
  dockAddText: { ...type.bodyStrong, color: c.onBrand, fontSize: 16 },

  display: { ...type.display, color: c.ink },
  emptyScroll: { paddingHorizontal: space.screen, paddingBottom: space.xxxl },
  emptyCtas: { marginTop: space.xxl },
  demoCard: {
    marginTop: space.xxl,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 22,
    padding: space.lg,
    ...cardShadow,
  },
  demoOverline: { ...type.overline, color: c.brand, marginBottom: space.md },
  demoSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 44,
  },
  demoInput: { flex: 1, fontSize: 14, color: c.ink, paddingVertical: space.sm },
  demoRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  demoItem: { flex: 1 },
  demoIconWrap: {
    height: 64,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoTitle: { ...type.small, fontWeight: '700', color: c.ink, marginTop: space.sm },
  demoPlace: { ...type.caption, color: c.muted },
  demoNone: { ...type.small, color: c.muted, flex: 1 },
  demoCaption: { ...type.caption, color: c.muted, marginTop: space.lg },
}));
