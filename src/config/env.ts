const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const geoapifyApiKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;
/** Injected into AndroidManifest on prebuild via plugins/withGoogleMapsAndroid.js */
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
/** From `npx eas init` → app.config.js `extra.eas.projectId`. Required for Expo push tokens on dev builds. */
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

/** Static map tiles (Geoapify). Parent map on Android uses react-native-maps + Google Maps (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY). */

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  geoapifyApiKey,
  googleMapsApiKey,
  easProjectId,
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
