import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  try {
    const question = (req.query.question || '').trim();
    const email = (req.query.email || 'guest@example.com').trim();

    // 1) 取/建 user
    let { data: user } = await supabase.from('users').select('*').eq('external_id', email).single();
    if (!user) {
      const { data: uNew, error } = await supabase.from('users').insert({ external_id: email }).select().single();
      if (error) throw new Error('Create user failed');
      user = uNew;
    }

    // 2) （示例）如果句子包含「已預約化妝師」，就更新 toolkit.notes
    if (question.includes('已預約') && question.includes('化妝')) {
      const { data: tk } = await supabase.from('toolkits').select('*').eq('user_id', user.id).single();
      const notes = tk?.notes || {};
      notes.appointments = { ...(notes.appointments || {}), makeup: true };

      if (tk) {
        await supabase.from('toolkits').update({ notes, updated_at: new Date().toISOString() }).eq('id', tk.id);
      } else {
        await supabase.from('toolkits').insert({ user_id: user.id, notes });
      }
    }

    // 3) 暫時回覆（之後你可換成 OpenAI 回答）
    await supabase.from('conversations').insert({ user_id: user.id, message: question, answer: '已收到✅' });

    return res.status(200).json({ ok: true, saved: true, sampleRule: 'makeup=true if matched' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
