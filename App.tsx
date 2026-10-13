import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, useColorScheme, View } from 'react-native';
import PaywallSheet from './src/components/PaywallSheet';
import { GalleryPhoto, resolveLocalUri } from './src/importer';
import { canAddItem, loadPlan, PlanKind, savePlan } from './src/plan';
import { isoFromEpochMs } from './src/photoMeta';
import { NO_PLACE, placeSuggestions } from './src/places';
import { clearSession, loadSession, loadUser, Session } from './src/auth';
import { shareReportPdf } from './src/report';
import { buildSampleItems, isSample } from './src/sampleData';
import AuthScreen from './src/screens/AuthScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, Settings } from './src/settings';
import { darkPalette, lightPalette, setActivePalette } from './src/theme';
import AddItemScreen from './src/screens/AddItemScreen';
import DetailScreen from './src/screens/DetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import ImportScreen from './src/screens/ImportScreen';
import PlaceScreen from './src/screens/PlaceScreen';
import { deleteItem, loadItems, saveItem, updateItem, wipeLibrary } from './src/storage';
import { color } from './src/theme';
import { makeThemedStyles } from './src/theme';
import { ItemPhoto } from './src/types';

type Screen =
  | { name: 'home' }
  | {
      name: 'add';
      prefillPhotoUri?: string;
      prefillLocation?: string;
      returnToPlace?: string;
      prefillTakenAt?: string;
      prefillWidth?: number;
      prefillHeight?: number;
    }
  | { name: 'import' }
  | { name: 'settings' }
  | { name: 'place'; placeName: string }
  | { name: 'edit'; itemId: string }
  | { name: 'detail'; itemId: string; fromPlace?: string };

export default function App() {
  const [items, setItems] = useState<ItemPhoto[]>([]);
  const [plan, setPlan] = useState<PlanKind>('free');
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [session, setSession] = useState<Session>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [accountName, setAccountName] = useState('');
  const systemScheme = useColorScheme();

  // Resolve the theme: explicit dark/light, or follow the phone.
  const resolvedTheme =
    settings.themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : settings.themeMode;
  setActivePalette(resolvedTheme === 'dark' ? darkPalette : lightPalette);

  function handleSettingsChange(next: Settings) {
    setSettings(next);
    void saveSettings(next);
  }

  async function handleWipe() {
    await wipeLibrary();
    await AsyncStorage.removeItem('@findit/sample-seeded/v1');
    setItems([]);
    setScreen({ name: 'home' });
  }

  useEffect(() => {
    loadSession()
      .then(async (loaded) => {
        setSession(loaded);
        if (loaded?.kind === 'user') {
          const user = await loadUser();
          setAccountName(user?.name ?? '');
        }
      })
      .finally(() => setSessionLoaded(true));
  }, []);

  async function refreshSession() {
    const loaded = await loadSession();
    setSession(loaded);
    if (loaded?.kind === 'user') {
      const user = await loadUser();
      setAccountName(user?.name ?? '');
    } else {
      setAccountName('');
    }
  }

  async function handleSignOut() {
    await clearSession();
    setSession(null);
    setAccountName('');
    setScreen({ name: 'home' });
  }

  useEffect(() => {
    Promise.all([loadItems(), loadPlan(), loadSettings()])
      .then(async ([loadedItems, loadedPlan, loadedSettings]) => {
        setPlan(loadedPlan);
        setSettings(loadedSettings);
        // First run with an empty library: seed the sample dataset once,
        // so the design can be tested immediately (cleared in one tap).
        if (loadedItems.length === 0) {
          const seeded = await AsyncStorage.getItem('@findit/sample-seeded/v1');
          if (!seeded) {
            const samples = buildSampleItems();
            for (const s of samples) await saveItem(s);
            await AsyncStorage.setItem('@findit/sample-seeded/v1', '1');
            setItems(await loadItems());
            return;
          }
        }
        setItems(loadedItems);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLoadSamples() {
    const existing = items.filter(isSample).length;
    if (existing > 0) return;
    for (const s of buildSampleItems()) await saveItem(s);
    setItems(await loadItems());
  }

  async function handleClearSamples() {
    const sampleIds = items.filter(isSample).map((i) => i.id);
    for (const id of sampleIds) await deleteItem(id);
    setItems(await loadItems());
  }

  function handleAddPress() {
    if (!canAddItem(plan, items.length)) {
      setPaywallVisible(true);
      return;
    }
    setScreen({ name: 'add' });
  }

  async function handleSave(item: ItemPhoto, isEdit: boolean, returnToPlace?: string) {
    const next = isEdit ? await updateItem(item) : await saveItem(item);
    setItems(next);
    setScreen(returnToPlace ? { name: 'place', placeName: returnToPlace } : { name: 'home' });
  }

  function handleStashPress(prefillLocation?: string, returnToPlace?: string) {
    if (!canAddItem(plan, items.length)) {
      setPaywallVisible(true);
      return;
    }
    setScreen({ name: 'add', prefillLocation, returnToPlace });
  }

  async function handleImported(item: ItemPhoto) {
    const next = await saveItem(item);
    setItems(next);
  }

  async function handleManualAddFromImport(photo: GalleryPhoto) {
    const localUri = await resolveLocalUri(photo);
    setScreen({
      name: 'add',
      prefillPhotoUri: localUri,
      prefillTakenAt: isoFromEpochMs(photo.creationTime),
      prefillWidth: photo.width || undefined,
      prefillHeight: photo.height || undefined,
    });
  }

  async function handleDelete(item: ItemPhoto) {
    const next = await deleteItem(item.id);
    setItems(next);
    setScreen({ name: 'home' });
  }

  /** Insurance report: a Pro feature — free plan opens the paywall. */
  async function handleReport() {
    if (plan !== 'pro') {
      setPaywallVisible(true);
      return;
    }
    if (items.length === 0) {
      Alert.alert('Nothing to report yet', 'Stash a few items first, then generate your inventory report.');
      return;
    }
    const outcome = await shareReportPdf(items);
    if (outcome === 'unavailable') {
      Alert.alert(
        'Report needs the full app',
        'PDF generation is not available in this preview build. In the full app it creates a print-ready inventory report.'
      );
    } else if (outcome === 'failed') {
      Alert.alert('Report failed', 'The PDF could not be created. Please try again.');
    }
  }

  async function handleUnlock() {
    await savePlan('pro');
    setPlan('pro');
    setPaywallVisible(false);
  }

  if (loading || !sessionLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={color.brand} />
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  // The front door: no session → the Living Wall auth experience.
  if (!session) {
    return (
      <View style={styles.root} key={`auth-${resolvedTheme}`}>
        <AuthScreen onAuthenticated={() => void refreshSession()} />
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  const detailItem = screen.name === 'detail' ? items.find((i) => i.id === screen.itemId) : undefined;
  const editItem = screen.name === 'edit' ? items.find((i) => i.id === screen.itemId) : undefined;

  return (
    <View style={styles.root} key={resolvedTheme}>
      {(screen.name === 'home' || (screen.name === 'detail' && !detailItem)) && (
        <HomeScreen
          items={items}
          plan={plan}
          onAdd={handleAddPress}
          onImport={() => setScreen({ name: 'import' })}
          onSettings={() => setScreen({ name: 'settings' })}
          onSelect={(item) => setScreen({ name: 'detail', itemId: item.id })}
          onOpenPlace={(placeName) => setScreen({ name: 'place', placeName })}
          onReport={handleReport}
          onUpgrade={() => setPaywallVisible(true)}
          onLoadSamples={handleLoadSamples}
          onClearSamples={handleClearSamples}
        />
      )}
      {screen.name === 'settings' && (
        <SettingsScreen
          settings={settings}
          onChange={handleSettingsChange}
          plan={plan}
          onUpgrade={() => setPaywallVisible(true)}
          itemCount={items.length}
          sampleCount={items.filter(isSample).length}
          onLoadSamples={handleLoadSamples}
          onClearSamples={handleClearSamples}
          onWipe={handleWipe}
          onBack={() => setScreen({ name: 'home' })}
          version="0.13.2"
          accountName={accountName}
          accountEmail={session?.kind === 'user' ? session.email : undefined}
          isGuest={session?.kind === 'guest'}
          onSignOut={handleSignOut}
          onCreateAccount={handleSignOut}
        />
      )}
      {screen.name === 'place' && (
        <PlaceScreen
          placeName={screen.placeName}
          items={items.filter(
            (i) => (i.locationLabel.trim() || NO_PLACE) === screen.placeName
          )}
          onBack={() => setScreen({ name: 'home' })}
          onSelect={(item) => setScreen({ name: 'detail', itemId: item.id, fromPlace: screen.placeName })}
          onStashHere={() =>
            screen.placeName === NO_PLACE
              ? handleAddPress()
              : handleStashPress(screen.placeName, screen.placeName)
          }
          onUpdateItem={async (updated) => setItems(await updateItem(updated))}
        />
      )}
      {screen.name === 'import' && (
        <ImportScreen
          items={items}
          plan={plan}
          onImported={handleImported}
          onManualAdd={handleManualAddFromImport}
          onUpgrade={() => setPaywallVisible(true)}
          onClose={() => setScreen({ name: 'home' })}
        />
      )}
      {screen.name === 'add' && (
        <AddItemScreen
          initialPhotoUri={screen.prefillPhotoUri}
          initialLocation={screen.prefillLocation}
          initialTakenAt={screen.prefillTakenAt}
          initialWidth={screen.prefillWidth}
          initialHeight={screen.prefillHeight}
          placeSuggestions={placeSuggestions(items)}
          existingItems={items}
          autoAnalyse={settings.autoAnalyse}
          shieldDocuments={settings.shieldDocuments}
          onSave={(item) => handleSave(item, false, screen.returnToPlace)}
          onCancel={() =>
            setScreen(
              screen.returnToPlace
                ? { name: 'place', placeName: screen.returnToPlace }
                : { name: 'home' }
            )
          }
        />
      )}
      {screen.name === 'edit' && editItem && (
        <AddItemScreen
          initialItem={editItem}
          autoAnalyse={settings.autoAnalyse}
          shieldDocuments={settings.shieldDocuments}
          onSave={(item) => handleSave(item, true)}
          onCancel={() => setScreen({ name: 'detail', itemId: editItem.id })}
        />
      )}
      {screen.name === 'detail' && detailItem && (
        <DetailScreen
          item={detailItem}
          onBack={() =>
            setScreen(
              screen.fromPlace ? { name: 'place', placeName: screen.fromPlace } : { name: 'home' }
            )
          }
          onEdit={(item) => setScreen({ name: 'edit', itemId: item.id })}
          onDelete={handleDelete}
          onOpenPlace={(placeName) => setScreen({ name: 'place', placeName })}
          confirmDelete={settings.confirmDelete}
          onUpdate={async (updated) => setItems(await updateItem(updated))}
          borrowers={Array.from(new Set(items.map((i) => i.lentTo).filter(Boolean) as string[]))}
          moreItems={items.filter(
            (i) =>
              i.id !== detailItem.id &&
              detailItem.locationLabel.trim() !== '' &&
              i.locationLabel.trim() === detailItem.locationLabel.trim()
          )}
          onSelectItem={(item) =>
            setScreen({ name: 'detail', itemId: item.id, fromPlace: screen.fromPlace })
          }
        />
      )}
      <PaywallSheet visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={handleUnlock} />
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = makeThemedStyles((c) => StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
}));
