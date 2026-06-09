# 維運

## 本機設定

```bash
npm install
python3 -m pip install -r requirements.txt
npm run db:migrate
npm run dev
```

## 匯入指令

```bash
python3 scripts/crawl_sources.py
python3 scripts/import_pdf.py --url "<PDF_URL>"
python3 scripts/import_pdf.py --file ./path/to/file.pdf
python3 scripts/geocode_locations.py
python3 scripts/export_geocode_cache.py
python3 scripts/seed_geocode_cache.py
python3 scripts/rebuild_all.py
python3 scripts/seed_example.py
npm run seed:initial
npm run export:geocode
npm run seed:geocode
```

`npm run seed:initial` 會匯入內建起始資料，來源是 115.04.22 與 115.05.27 臺北市交通局公開 PDF 公告。它只保存解析後資料列，不包含原始 PDF binaries 或照片。

## Admin UI

啟動 app 前，將 `ADMIN_TOKEN` 設為非預設 secret，然後開啟 `/admin`。Admin import routes 與 import logs 都需要 `x-admin-token` header。未設定 token 或使用 `change-me` 會被拒絕。

部署環境匯入 PDF 後，請在 `/admin` 執行「Generate Map Coordinates」以填入 `geocoded_locations`。Map tab 只顯示有快取座標的地點。這個動作會對尚未 geocode 或先前失敗的地點逐筆呼叫 Nominatim，遵守 delay 設定，且只送出地點文字。

如果 logs 出現 `HTTP Error 429: Too many requests`，請停止並等待後再重試。Render shared outbound IP 可能觸發 Nominatim rate limit。請使用小批次，例如 limit `5`、delay `10` 秒。Geocoder 會在第一個 429 後停止當前 batch，並在下次執行時重試該地點。

Render free 建議使用本機 geocoding：

1. 在本機匯入相同 PDFs。
2. 執行 `python3 scripts/geocode_locations.py --limit 5 --delay 10`，直到需要的地點都有快取座標。
3. 執行 `npm run export:geocode`。
4. Commit `data/seed/geocoded_locations.json`。
5. 部署。Render startup 會執行 `scripts/seed_geocode_cache.py`，不需從 Render 呼叫 Nominatim。

## Geocoding

Nominatim 只應在 import/maintenance flows 使用。Queries 會 normalize 成 `臺北市 {locationText}` 並快取在 SQLite。不要在 page load 時 geocode。

## 來源網站禮貌規則

Crawler requests 使用描述性 User-Agent、sequential requests 與頁面間 delay。不要繞過 access controls，也不要 aggressive parallelize 政府網站。

## 已知風險

- PDF table format 可能變動，需要人工 review。
- PyMuPDF 可作為未來 fallback，但目前 parser path 是 `pdfplumber` 加 text fallback。
- Live import 與 geocoding 需要 network access，可能獨立於 dashboard 失敗。
- Sandbox 環境中，本機 Lighthouse/e2e server startup 可能需要 localhost binding permission。
