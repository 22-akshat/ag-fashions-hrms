declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_DEFAULT_SHOP_ID?: string;
    EXPO_PUBLIC_OFFICE_LAT?: string;
    EXPO_PUBLIC_OFFICE_LNG?: string;
    EXPO_PUBLIC_ALLOWED_RADIUS_METERS?: string;
    EXPO_PUBLIC_ATTENDANCE_EDGE_INVOCATION_KEY?: string;
    EXPO_PUBLIC_DEV_SKIP_FACE_MATCH?: string;
    EXPO_PUBLIC_ENABLE_LIVENESS?: string;
    EXPO_PUBLIC_FACE_MATCH_THRESHOLD?: string;
    EXPO_PUBLIC_LIVENESS_THRESHOLD?: string;
    EXPO_PUBLIC_SHARPNESS_THRESHOLD?: string;
    EXPO_PUBLIC_EXPECTED_APP_ID?: string;
  }
}

/** RN Metro + babel inlines env at build; TS only needs `process.env` typing (see babel react-native-dotenv). */
declare const process: { env: NodeJS.ProcessEnv };

/** Hermes / RN global used for reading binary files as base64 (RNFS). */
declare function atob(data: string): string;
