# Schema Dictionary 說明

## 命名與慣例
- 語言欄位: *_zh (中文)、*_en (英文)。先填中文都得
- 金額: *_hkd (整數或字串範圍 8,000-15,000)
- 日期: ISO 格式 YYYY-MM-DD
- ID: 全小寫、底線分隔 (如：makeup_001)
- 可選欄位: 如無數據，可留空字串 " "，空陣列 [ ] 或不填

## 通用欄位
- id: 唯一識別碼
- name_zh: 中文名稱
- name_en: 英文名稱
- description: 詳細介紹文字
- images: 圖片清單 (array)

## Vendor 專用
- ad_package: 廣告收費設定
  - image_count: 圖片數量
  - text_tokens: 文字長度（token 計算）
  - keywords: 關鍵字清單
  - boost_level: 排位優先度 (數字越大越前)
  - priority: 出現次數權重 (數字越大越多機會)
  - side_push_count: 同類型順帶推介次數
  - blog_posts: 包含在 blog 推介數量

## Dates 檔案
- date: YYYY-MM-DD
- label_zh: 中文名稱
- label_en: 英文名稱
- kind: 類型（public_holiday / special_day / 禁忌）
- note: 附註

## Traditions
- summary: 簡介
- details: 細項列表
- notes: 備註
