import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { withinRange, normalizeItems, isBigDisagreement } from "../src/lib/rules.js";

let CACHE = null;
function loadData() {
  if (CACHE) return CACHE;
  const p = path.join("data", "daily.csv");
  const csv = fs.readFileSync(p, "utf-8");
  const rows = parse(csv, { columns: true, skip_empty_lines: true });
  for (const r of rows) {
    r.yi = normalizeItems(r.yi || "");
    r.ji = normalizeItems(r.ji || "");
    r.yi_alt = normalizeItems(r.yi_alt || "");
    r.ji_alt = normalizeItems(r.ji_alt || "");
  }
  CACHE = rows;
  return rows;
}

export async function chooseDateHandler(req, res) {
  try {
    const { from, to, avoid_zodiac = [], prefer_items = [] } = req.body || {};
    if (!from || !to) return res.status(400).json({ error: "from/to required (YYYY-MM-DD)" });

    const data = loadData().filter(r => withinRange(r.date_gregorian, from, to));

    let filtered = data.filter(r => {
      if (!avoid_zodiac.length) return true;
      return !avoid_zodiac.includes((r.conflict_zodiac || "").trim());
    });

    if (prefer_items.length) {
      filtered = filtered.filter(r => {
        const yiSet = new Set((r.yi || "").split("｜"));
        return prefer_items.some(i => yiSet.has(i));
      });
    }

    const recommendations = filtered.map(r => {
      const big = isBigDisagreement(r.yi, r.ji, r.yi_alt, r.ji_alt);
      const reasonCore = [
        r.yi ? `宜：${r.yi}` : "",
        r.ji ? `忌：${r.ji}` : "",
        r.conflict_zodiac ? `沖：${r.conflict_zodiac}` : "",
        r.day_sha ? `日煞：${r.day_sha}` : "",
        r.shi_er_shen ? `十二神：${r.shi_er_shen}` : "",
        r.er_shi_ba_xiu ? `宿：${r.er_shi_ba_xiu}` : "",
        r.jiu_xing ? `九星：${r.jiu_xing}` : "",
        r.liu_yao ? `六曜：${r.liu_yao}` : ""
      ].filter(Boolean).join("，");

      let alt_note = "";
      if (big) {
        const extra = [];
        if (r.yi_alt) extra.push(`其他曆法亦列宜：${r.yi_alt}`);
        if (r.ji_alt) extra.push(`其他曆法列忌：${r.ji_alt}`);
        alt_note = extra.join("；");
      }

      return { date: r.date_gregorian, reason: reasonCore, alt_note };
    });

    res.json({ recommendations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
}
