// /api/lunar.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ ok: false, error: 'missing ?date=YYYY-MM-DD' });
    }

    const url  = process.env.SUPABASE_URL;
    const key  = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (!url)  return res.status(500).json({ ok:false, error:'SUPABASE_URL is required' });
    if (!key)  return res.status(500).json({ ok:false, error:'SUPABASE_ANON_KEY (or SUPABASE_KEY) is required' });

    const supabase = createClient(url, key);

    const day = await supabase.from('days').select('*').eq('date', date).single();
    if (day.error) {
      return res.status(502).json({ ok:false, where:'days', supabase:errorToPlain(day.error) });
    }

    const hours = await supabase.from('hours').select('*').eq('date', date).order('branch');
    if (hours.error) {
      return res.status(502).json({ ok:false, where:'hours', supabase:errorToPlain(hours.error) });
    }

    return res.status(200).json({
      ok: true,
      date,
      day: day.data,
      hours: hours.data
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}

// 把 Supabase 的錯誤轉成易讀 JSON
function errorToPlain(err) {
  return {
    message: err.message,
    details: err.details || null,
    hint: err.hint || null,
    code: err.code || null,
    status: err.status || null
  };
}
