import { createClient } from '@supabase/supabase-js';
import EncryptedStorage from 'react-native-encrypted-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(
  String(supabaseUrl ?? '').trim() && String(supabaseAnonKey ?? '').trim(),
);

export const supabase = hasSupabaseConfig
  ? createClient(String(supabaseUrl), String(supabaseAnonKey), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: {
          getItem: (key: string) => EncryptedStorage.getItem(key),
          setItem: (key: string, value: string) => EncryptedStorage.setItem(key, value),
          removeItem: (key: string) => EncryptedStorage.removeItem(key),
        },
      },
    })
  : null;
