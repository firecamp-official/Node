import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4?target=es2020&no-dts";

const SUPABASE_URL = "https://sajbptntunqvgvgmvevy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3uwlTSa52A_-QrgVjLif6Q_Glo2RqoV";

// Singleton — prevents multiple GoTrue instances fighting over the same Web Lock
if (!globalThis.__supabaseInstance) {
  globalThis.__supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,  // handles recovery/OAuth hash tokens automatically
      storageKey: "sb-sajbptntunqvgvgmvevy-auth-token"
    }
  });
}

export const supabase = globalThis.__supabaseInstance;
