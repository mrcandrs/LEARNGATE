const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const geoapifyApiKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  geoapifyApiKey,
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
