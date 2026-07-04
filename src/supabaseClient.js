import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lnrrhqosdjbslvawdzlp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3KzhFXgyG8_huSWhH3dpeA_bBtqPiKz";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
