// /api/lunar.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const { date } = req.query; // e.g. 2025-09-09
    if (!date) return res.status(400).json({ ok:false, error: 'missing date' });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY // 讀用 anon key 夠
    );

    const day = await supabase.from('days').select('*').eq('date', date).single();
    if (day.error) throw day.error;

    const hrs = await supabase.from('hours').select('*').eq('date', date).order('branch');
    if (hrs.error) throw hrs.error;

    return res.status(200).json({ ok:true, day: day.data, hours: hrs.data });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message });
  }
}
