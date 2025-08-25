// 安裝：在本地或 repo 加 package.json 並 `npm i @supabase/supabase-js`
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  // 假設你前端把 user_email 帶過來；冇就用臨時ID
  const email = req.query.email || 'guest@example.com';

  // 1) 取/建 user
  let { data: u } = await supabase.from('users').select('*').eq('external_id', email).single();
  if (!u) {
    const { data: newU, error } = await supabase.from('users').insert({ external_id: email }).select().single();
    if (error) return res.status(500).json({ ok:false, error: 'create user failed' });
    u = newU;
  }

  // 2) 更新 Toolkit（示例：如果用戶講「已預約化妝師」）
  const q = req.query.question || '';
  if (q.includes('已預約') && q.includes('化妝')) {
    // 將 notes 內的 appointments.makeup 設為 true
    const { data: tk } = await supabase.from('toolkits').select('*').eq('user_id', u.id).single();
    const notes = (tk?.notes || {});
    notes.appointments = { ...(notes.appointments || {}), makeup: true };

    if (tk) {
      await supabase.from('toolkits').update({ notes, updated_at: new Date().toISOString() }).eq('id', tk.id);
    } else {
      await supabase.from('toolkits').insert({ user_id: u.id, notes });
    }
  }

  // 3) 保存對話（可選）
  await supabase.from('conversations').insert({ user_id: u.id, message: q, answer: '(稍後填入真實回答)' });

  return res.json({ ok: true, message: '已處理入庫示例 ✅' });
}
