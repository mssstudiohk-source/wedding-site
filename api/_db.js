// 只在 Server 使用 service_role，Vercel 不會洩露到前端
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.warn("Supabase env not set.");
}

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
