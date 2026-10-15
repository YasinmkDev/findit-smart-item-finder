import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * App settings (v0.12) — persisted locally, all with sane defaults.
 * Every setting is wired to real behaviour:
 *  - themeMode: 'dark' | 'light' | 'system' (system follows the phone)
 *  - autoAnalyse: capture runs Gemini automatically on a new photo
 *  - shieldDocuments: AI-detected documents get the privacy shield
 *  - confirmDelete: deleting an item asks first
 */

export type ThemeMode = 'dark' | 'light' | 'system';

export interface Settings {
  themeMode: ThemeMode;
  autoAnalyse: boolean;
  shieldDocuments: boolean;
  confirmDelete: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'dark',
  autoAnalyse: true,
  shieldDocuments: false,
  confirmDelete: true,
};

const SETTINGS_KEY = '@findit/settings/v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      themeMode:
        parsed.themeMode === 'light' || parsed.themeMode === 'system' || parsed.themeMode === 'dark'
          ? parsed.themeMode
          : DEFAULT_SETTINGS.themeMode,
      autoAnalyse: typeof parsed.autoAnalyse === 'boolean' ? parsed.autoAnalyse : DEFAULT_SETTINGS.autoAnalyse,
      shieldDocuments:
        typeof parsed.shieldDocuments === 'boolean' ? parsed.shieldDocuments : DEFAULT_SETTINGS.shieldDocuments,
      confirmDelete:
        typeof parsed.confirmDelete === 'boolean' ? parsed.confirmDelete : DEFAULT_SETTINGS.confirmDelete,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings failing to persist must never break the app.
  }
}
