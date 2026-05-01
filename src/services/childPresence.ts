import { supabase } from "@/services/supabase";

export async function setChildOnlineStatus(isOnline: boolean) {
  if (!supabase) {
    return;
  }
  await supabase.rpc("set_child_online_status", { p_is_online: isOnline });
}
