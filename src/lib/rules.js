import { parseISO, isWithinInterval } from "date-fns";

export function withinRange(dateStr, fromStr, toStr) {
  try {
    const d = parseISO(dateStr);
    return isWithinInterval(d, { start: parseISO(fromStr), end: parseISO(toStr) });
  } catch {
    return false;
  }
}

const BLACKLIST = new Set(["萬事皆宜","万事皆宜","諸事不宜","诸事不宜"]);
export function normalizeItems(s) {
  if (!s) return "";
  const parts = s.split(/[,，、;；\\s|/]+/).map(t => t.trim()).filter(Boolean);
  const out = [], seen = new Set();
  for (let p of parts) {
    if (!p || BLACKLIST.has(p)) continue;
    if (!seen.has(p)) { seen.add(p); out.push(p); }
  }
  return out.join("｜");
}

export function isBigDisagreement(yi, ji, yi_alt, ji_alt) {
  const set = s => new Set((s||"").split("｜").filter(Boolean));
  const Y = set(yi), J = set(ji), Ya = set(yi_alt), Ja = set(ji_alt);
  for (const x of Y) if (Ja.has(x)) return true;
  for (const x of J) if (Ya.has(x)) return true;
  return false;
}
