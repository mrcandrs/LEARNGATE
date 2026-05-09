const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const geoapifyApiKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;

/** Static map tiles (Geoapify). Parent map uses react-native-maps + Google on Android — key lives in `android/.../res/values/strings.xml` → `google_maps_api_key` (see Google Cloud: enable Maps SDK for Android, restrict by app package). */

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  geoapifyApiKey,
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
