import { supabase } from "./_db";
import { fmt } from "./_format";

// 小工具：統一回應
function out(res, payload, asText=false) {
  if (asText) {
    res.setHeader("Content-Type","text/plain; charset=utf-8");
    return res.status(200).send(String(payload.answer || ""));
  }
  res.setHeader("Content-Type","application/json; charset=utf-8");
  return res.status(200).json(payload);
}

// （如你仍有 GitHub JSON 規則，可保留 fetchJSON 使用）
async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetch ${url} ${r.status}`);
  return r.json();
}

export default async function handler(req, res){
  try{
    const q = String(req.query.q || req.query.question || "").trim();
    const text = (req.query.format||"").toLowerCase()==="text";

    if(!q){
      return out(res,{
        ok:true,
        answer: "你可以咁問：\n- 我想知過大禮要準備啲乜？\n- 搵化妝師（九龍）\n- 2025 有邊啲公眾假期？\n- 今日有咩吉時？\n（加 &format=text 會用純文字）"
      }, text);
    }

    // ---- 路由：關鍵詞很簡單先頂住 MVP ----

    // 1) 傳統儀式：過大禮/安床/上頭/回門（如果你保持 JSON 規則）
    if (/(過大禮|安床|上頭|回門)/.test(q)) {
      // 這裡用 Supabase 也可，但你現時已有 JSON 就先沿用：
      const RULES = process.env.RULES_BASE_URL ||
        "https://raw.githubusercontent.com/你的repo/rules/main";
      const data = await fetchJSON(`${RULES}/traditions/traditions.json`);
      const key = ["過大禮","安床","上頭","回門"].find(k=>q.includes(k));
      const item = data?.[key];
      const answer = item ? fmt.tradition(item, `${key}重點`) : "暫時未有該項資料。";
      return out(res, { ok:true, source:"traditions.json", answer }, text);
    }

    // 2) 假期（用 holidays 表）
    if (/(紅日|公眾假期|假期)/.test(q)){
      const { data, error } = await supabase
        .from("holidays")
        .select("date,name")
        .eq("region","HK")
        .gte("date", new Date().toISOString().slice(0,10))
        .order("date",{ascending:true})
        .limit(5);
      if(error) throw error;
      const answer = fmt.holiday(data||[]);
      return out(res, { ok:true, answer }, text);
    }

    // 3) Vendor（簡單關鍵字：化妝師/場地 + 可選地點字樣）
    if (/化妝|MUA|化妝師/.test(q) || /場地|banquet|venue/i.test(q)){
      const type = /場地|venue/i.test(q) ? "venue" : "makeup";

      // 抽取地點字（MVP：很鬆手法；之後可接 regions 表）
      const maybeCity = (q.match(/(葵芳|旺角|尖沙咀|中環|沙田|荃灣|元朗|將軍澳|銅鑼灣)/) || [])[0];

      // 取 vendor + 封面圖
      const { data: vendors, error } = await supabase
        .from("vendors")
        .select("id,name_zh,name_en,services,price_min,price_max,location_city,location_district,priority")
        .eq("type", type)
        .order("priority",{ascending:false})
        .limit(30);
      if (error) throw error;

      // 取封面圖（每個 vendor 3 張）
      const ids = (vendors||[]).map(v=>v.id);
      let coverMap = {};
      if(ids.length){
        const { data: photos } = await supabase
          .from("vendor_photos")
          .select("vendor_id,url,is_cover,sort_order")
          .in("vendor_id", ids)
          .eq("is_cover", true)
          .order("sort_order",{ascending:true});
        (photos||[]).forEach(p=>{
          coverMap[p.vendor_id] = coverMap[p.vendor_id] || [];
          if (coverMap[p.vendor_id].length < 3) coverMap[p.vendor_id].push(p.url);
        });
      }

      // 簡單地點 filter（MVP）
      const filtered = maybeCity
        ? (vendors||[]).filter(v => (v.location_city||"").includes(maybeCity) || (v.location_district||"").includes(maybeCity))
        : vendors||[];

      const top = filtered.slice(0,3).map(v=>({
        ...v,
        cover_photos: coverMap[v.id] || []
      }));

      const answer = fmt.vendorCards(top);
      return out(res, { ok:true, total:(filtered||[]).length, answer }, text);
    }

    // 4) 今日吉時（示例：取今日 13 段，列兩段）
    if (/(吉時|時辰|幾點好)/.test(q)){
      const today = new Date().toISOString().slice(0,10);
      const { data, error } = await supabase
        .from("lunar_hours")
        .select("hour_zhi,slot,time_range,good_for_main,avoid_main")
        .eq("date", today)
        .order("ord",{ascending:true})
        .limit(3);
      if (error) throw error;

      const lines = (data||[]).map(r => fmt.hour(r));
      const answer = lines.length ? `📆 今日（${today}）時辰：\n${lines.join("\n\n")}` : "暫未有今日時辰資料。";
      return out(res, { ok:true, answer }, text);
    }

    // fallback：之後你可接 OpenAI／或傳去更複雜判斷
    return out(res, { ok:true, answer:"暫時支援：傳統禮節／假期／化妝師或場地／吉時。可試：『搵化妝師（旺角）』或『2025公眾假期』" }, text);

  }catch(e){
    return res.status(200).json({ ok:false, error:String(e) });
  }
}
