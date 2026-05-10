import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { invalidateEmployeeUuidCache } from '../lib/employeeIdResolve';
import { fetchShopGeofenceFromSupabase } from '../lib/shopGeofence';
import type { ShopGeofence } from '../lib/shopGeofence';
import { hasSupabaseConfig } from '../supabase';

export type AppStage = 'splash' | 'register' | 'scan' | 'success';

type AppContextValue = {
  isHydrated: boolean;
  shopFence: ShopGeofence | null;
  shopFenceLoading: boolean;
  shopFenceError: string | null;
  refreshShopFence: () => Promise<ShopGeofence | null>;
  stage: AppStage;
  employeeId: string;
  registeredFaceUri: string | null;
  registeredFaceEmbedding: number[] | null;
  setStage: (stage: AppStage) => void;
  setEmployeeId: (employeeId: string) => Promise<void>;
  setRegisteredFaceUri: (uri: string) => Promise<void>;
  setRegisteredFaceEmbedding: (embedding: number[] | null) => Promise<void>;
  clearRegistration: () => Promise<void>;
};

const EMPLOYEE_ID_KEY = 'attendance_employee_id';
const FACE_URI_KEY = 'attendance_face_uri';
const FACE_EMBEDDING_KEY = 'attendance_face_embedding_json';

const AppContext = createContext<AppContextValue | undefined>(undefined);

function parseEmbedding(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) &&
      parsed.every((n) => typeof n === 'number' && Number.isFinite(n))
      ? (parsed as number[])
      : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [shopFence, setShopFence] = useState<ShopGeofence | null>(null);
  const [shopFenceLoading, setShopFenceLoading] = useState(false);
  const [shopFenceError, setShopFenceError] = useState<string | null>(null);

  const [stage, setStage] = useState<AppStage>('splash');
  const [employeeId, setEmployeeIdState] = useState('');
  const [registeredFaceUri, setRegisteredFaceUriState] = useState<string | null>(null);
  const [registeredFaceEmbedding, setRegisteredFaceEmbeddingState] = useState<number[] | null>(
    null,
  );

  const refreshShopFence = useCallback(async (): Promise<ShopGeofence | null> => {
    if (!hasSupabaseConfig) {
      setShopFence(null);
      setShopFenceError(null);
      setShopFenceLoading(false);
      return null;
    }
    setShopFenceLoading(true);
    setShopFenceError(null);
    try {
      const row = await fetchShopGeofenceFromSupabase();
      setShopFence(row);
      return row;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setShopFenceError(message);
      setShopFence(null);
      return null;
    } finally {
      setShopFenceLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const [storedEmployeeId, storedFaceUri, embeddingRaw] = await Promise.all([
        AsyncStorage.getItem(EMPLOYEE_ID_KEY),
        AsyncStorage.getItem(FACE_URI_KEY),
        AsyncStorage.getItem(FACE_EMBEDDING_KEY),
      ]);
      if (storedEmployeeId) setEmployeeIdState(storedEmployeeId);
      if (storedFaceUri) setRegisteredFaceUriState(storedFaceUri);
      setRegisteredFaceEmbeddingState(parseEmbedding(embeddingRaw));
      setIsHydrated(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void refreshShopFence();
  }, [isHydrated, refreshShopFence]);

  const setEmployeeId = useCallback(async (nextEmployeeId: string) => {
    await invalidateEmployeeUuidCache();
    setEmployeeIdState(nextEmployeeId);
    await AsyncStorage.setItem(EMPLOYEE_ID_KEY, nextEmployeeId);
  }, []);

  const setRegisteredFaceUri = useCallback(async (uri: string) => {
    setRegisteredFaceUriState(uri);
    await AsyncStorage.setItem(FACE_URI_KEY, uri);
  }, []);

  const setRegisteredFaceEmbedding = useCallback(async (embedding: number[] | null) => {
    setRegisteredFaceEmbeddingState(embedding);
    if (embedding && embedding.length > 0) {
      await AsyncStorage.setItem(FACE_EMBEDDING_KEY, JSON.stringify(embedding));
    } else {
      await AsyncStorage.removeItem(FACE_EMBEDDING_KEY);
    }
  }, []);

  const clearRegistration = useCallback(async () => {
    await invalidateEmployeeUuidCache();
    setRegisteredFaceUriState(null);
    setRegisteredFaceEmbeddingState(null);
    await AsyncStorage.multiRemove([FACE_URI_KEY, FACE_EMBEDDING_KEY]);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      isHydrated,
      shopFence,
      shopFenceLoading,
      shopFenceError,
      refreshShopFence,
      stage,
      employeeId,
      registeredFaceUri,
      registeredFaceEmbedding,
      setStage,
      setEmployeeId,
      setRegisteredFaceUri,
      setRegisteredFaceEmbedding,
      clearRegistration,
    }),
    [
      isHydrated,
      shopFence,
      shopFenceLoading,
      shopFenceError,
      refreshShopFence,
      stage,
      employeeId,
      registeredFaceUri,
      registeredFaceEmbedding,
      setEmployeeId,
      setRegisteredFaceUri,
      setRegisteredFaceEmbedding,
      clearRegistration,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
