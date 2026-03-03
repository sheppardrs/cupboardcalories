import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UserSettings } from '@/types';

const SETTINGS_COLLECTION = 'settings';

const DEFAULT_SETTINGS: UserSettings = {
  defaultFinishDays: 14,
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const docRef = doc(db, SETTINGS_COLLECTION, userId);
  const snapshot = await getDoc(docRef);
  
  if (snapshot.exists()) {
    return snapshot.data() as UserSettings;
  }
  
  return DEFAULT_SETTINGS;
}

export async function updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<void> {
  const docRef = doc(db, SETTINGS_COLLECTION, userId);
  const snapshot = await getDoc(docRef);
  
  if (snapshot.exists()) {
    await updateDoc(docRef, updates);
  } else {
    await setDoc(docRef, { ...DEFAULT_SETTINGS, ...updates });
  }
}

export async function initializeUserSettings(userId: string): Promise<UserSettings> {
  const docRef = doc(db, SETTINGS_COLLECTION, userId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    await setDoc(docRef, DEFAULT_SETTINGS);
  }
  
  return getUserSettings(userId);
}
