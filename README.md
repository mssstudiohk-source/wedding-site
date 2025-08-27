# Wedding Sisi API

👰🤵 A simple API for wedding planning & tradition queries.  
提供婚禮策劃與傳統禮儀查詢的 API。

---

## 📌 API Endpoints

### Health Check
- `GET /api/hello`  
  回傳 API 狀態，用於測試部署是否正常。  
  Returns `{ ok: true, msg: "hello API OK ✅" }`.

---

### Lunar Calendar (擇日系統)
- `GET /api/lunar?date=YYYY-MM-DD&format=text`  
  查詢指定日期的農曆資訊、吉凶、時辰。  
  Query lunar calendar info for a given date.

  **Params:**
  - `date` (必須 Required) — 公曆日期，例如 `2025-09-09`  
  - `format` (可選 Optional)  
    - `json` → 原始 JSON 資料  
    - `text` → 格式化文字輸出  

  **Example:**  
