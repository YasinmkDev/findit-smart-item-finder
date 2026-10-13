import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { ItemPhoto } from './types';

const STORAGE_KEY = '@findit/items/v1';

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function loadItems(): Promise<ItemPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ItemPhoto[]) : [];
  } catch {
    return [];
  }
}

async function persist(items: ItemPhoto[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function saveItem(item: ItemPhoto): Promise<ItemPhoto[]> {
  const items = await loadItems();
  const next = [item, ...items.filter((i) => i.id !== item.id)];
  await persist(next);
  return next;
}

export async function updateItem(item: ItemPhoto): Promise<ItemPhoto[]> {
  const items = await loadItems();
  const next = items.map((i) => (i.id === item.id ? item : i));
  await persist(next);
  return next;
}

export async function deleteItem(id: string): Promise<ItemPhoto[]> {
  const items = await loadItems();
  const next = items.filter((i) => i.id !== id);
  await persist(next);
  return next;
}

/** Erase the whole library (Settings → Erase everything). */
export async function wipeLibrary(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else sensible to do; the caller refreshes state anyway.
  }
}

/**
 * Copy a picked/captured photo out of the temporary cache folder into the
 * app's own document folder so it survives cache clean-ups.
 * Falls back to the original URI if the copy fails for any reason.
 */
export async function persistPhoto(sourceUri: string, id: string): Promise<string> {
  try {
    if (!FileSystem.documentDirectory) return sourceUri;
    if (sourceUri.startsWith(FileSystem.documentDirectory)) return sourceUri;
    const extension = sourceUri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
    const target = `${FileSystem.documentDirectory}findit-${id}.${extension}`;
    await FileSystem.copyAsync({ from: sourceUri, to: target });
    return target;
  } catch {
    return sourceUri;
  }
}
