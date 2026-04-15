const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  supabaseUrl,
  supabaseAnonKey,
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
