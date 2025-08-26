// /api/debug-rules.js
export default async function handler(req, res) {
  try {
    const base = process.env.RULES_BASE_URL || "(missing)";
    const url = base.endsWith("/")
      ? base + "traditions.json"
      : base + "/traditions.json";

    const out = { base, testUrl: url };

    if (!process.env.RULES_BASE_URL) {
      out.problem = "RULES_BASE_URL env var is missing";
      return res.status(500).json(out);
    }

    const r = await fetch(url, { cache: "no-store" });
    out.status = r.status;
    out.ok = r.ok;

    if (!r.ok) {
      out.text = await r.text().catch(()=>"(no text)");
      return res.status(500).json(out);
    }

    const j = await r.json();
    out.sampleKeys = Object.keys(j).slice(0, 3); // e.g. ["過大禮","安床"...]
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
