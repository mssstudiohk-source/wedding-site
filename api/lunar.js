// api/lunar.js
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL || '';
const SRV_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const KEY_TO_USE = SRV_KEY || ANON_KEY;  // 先用 service role，冇就退回 anon

const supa = (SUPA_URL && KEY_TO_USE)
  ? createClient(SUPA_URL, KEY_TO_USE, { auth: { persistSession: false } })
  : null;

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const date = (url.searchParams.get('date') || '').slice(0, 10);
    const wantText =
      (url.searchParams.get('format') || '').toLowerCase() === 'text' ||
      (req.headers.accept || '').includes('text/plain');
    const diag = url.searchParams.get('diag');

    if (!SUPA_URL || !KEY_TO_USE) {
      const payload = {
        ok: false,
        error: 'env-missing',
        has_url: !!SUPA_URL,
        use_service_role: !!SRV_KEY,
        use_anon: !!ANON_KEY
      };
      return respond(res, payload, wantText);
    }
    if (!date) {
      return respond(res, { ok:false, error:'date is required (YYYY-MM-DD)' }, wantText);
    }

    // 查當日；無→取最近之後一日
    let { data: day, error } = await supa
      .from('lunar_days')
      .select('*')
      .eq('date', date)
      .maybeSingle();

    if (!error && !day) {
      const { data: nextRows } = await supa
        .from('lunar_days')
        .select('*')
        .gte('date', date)
        .order('date', { ascending: true })
        .limit(1);
      if (nextRows && nextRows.length) day = nextRows[0];
    }

    if (diag) {
      return respond(res, {
        ok: !!day,
        query_date: date,
        used_date: day?.date || null,
        supabase_error: error?.message || null
      }, false);
    }

    if (!day) {
      return respond(res, { ok:true, empty:true, query_date: date }, wantText);
    }

    if (wantText) {
      const lines = [
        `📅 要求：${date}${day.date !== date ? ` → 使用：${day.date}` : ''}`,
        day.wu_xing ? `五行：${day.wu_xing}` : '',
        day.day_officer ? `十二神：${day.day_officer}` : '',
        day.day_conflict ? `沖煞：${day.day_conflict}` : '',
        day.star_god ? `星神：${day.star_god}` : '',
        day.good_for_main?.length ? `✅ 宜（主）：${day.good_for_main.join('、')}` : '',
        day.avoid_main?.length ? `⛔ 忌（主）：${day.avoid_main.join('、')}` : ''
      ].filter(Boolean);
      return respond(res, { ok:true, answer: lines.join('\n') }, true);
    }

    return respond(res, { ok:true, query_date: date, used_date: day.date, day }, false);

  } catch (e) {
    return respond(res, { ok:false, fatal: String(e?.stack || e) }, false);
  }
}

function respond(res, payload, asText) {
  if (asText) {
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    return res.status(200).send(String(payload.answer || JSON.stringify(payload)));
  }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.status(200).json(payload);
}
// 紅日分支最後幾行
const r = await fetch(url, { cache: 'no-store' });
const txt = await r.text();

if (wantText) {
  return res.status(200).send(txt);
}
let json;
try { json = JSON.parse(txt); }
catch { json = { ok: true, answer: txt }; }
return res.status(200).json(json);
