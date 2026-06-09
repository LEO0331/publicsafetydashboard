# 設計

## 方向

UI 採用 civic archive 風格：公共紀錄感的 typography、克制的制度色彩、ledger-like panels，以及中性的交通安全文字。繁體中文是預設介面語言，前端提供英文切換。

## 原則

- 預設使用繁體中文標籤，並提供英文 frontend copy，但不翻譯公開來源的資料值。
- 保持教育用途，不使用煽動或獵奇語言。
- 優先支援密集但可讀的資料掃描。
- 保留來源 attribution 與政府公開資料 disclaimer。
- 姓名搜尋不放在預設操作流程。

## 視覺系統

- 色彩：paper、ink、civic green、civic blue、signal red、amber。
- Typography：主標題使用繁體中文 serif display treatment，body 使用易讀 sans-serif。
- Components：ledger panels、public-notice stamps、bordered form controls、清楚的 focus rings。
- Motion：只保留短暫 page-load ledger entry animation。

## 可近用性

- Root language 是 `zh-Hant`。
- Dashboard 有 skip link。
- 互動 controls 有可見 focus states。
- Tables 保留可讀 labels 與 source links。
- Lighthouse accessibility 目標至少 90。

## 地圖設計

Map markers 代表 grouped locations，不代表個人。為了避免密集 pin wall，map tab 使用 ranked location explorer：

- 可搜尋 side list 顯示確切地點名稱、事件數、日期範圍與類型 breakdown。
- Map 預設顯示事件數最高的 geocoded locations，較低排名地點收合在 show-all control 後。
- Map marks 使用 scaled circles，不使用個人 pins。
- Popups 顯示 location、incident count、type breakdown 與 date range。
