import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = resolve("github-pages-dist");

const html = String.raw`<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="臺北市酒駕、毒駕、拒測累犯教育儀表板的 GitHub Pages 靜態說明頁。完整資料匯入、API、SQLite 與管理功能需使用 Docker/Node 部署。"
    />
    <title>臺北市酒駕／毒駕／拒測累犯教育儀表板</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #f6f1e7;
        --paper-strong: #efe4d1;
        --ink: #17211f;
        --muted: #5f6762;
        --line: #c9bca6;
        --field: #fffdf8;
        --green: #285a4d;
        --blue: #285179;
        --red: #a63d2f;
        --amber: #b5792b;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background:
          linear-gradient(90deg, rgba(40, 90, 77, 0.07) 1px, transparent 1px) 0 0 / 42px 42px,
          linear-gradient(180deg, rgba(166, 61, 47, 0.04), transparent 48vh),
          var(--paper);
        color: var(--ink);
        font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
      }

      a {
        color: inherit;
      }

      .rail {
        background: linear-gradient(180deg, var(--green), #18362f 62%, var(--red));
        bottom: 0;
        left: 0;
        position: fixed;
        top: 0;
        width: 14px;
      }

      .wrap {
        margin: 0 auto;
        max-width: 1120px;
        padding: 40px 24px 56px;
      }

      .eyebrow {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
      }

      .tag {
        border: 1px solid var(--green);
        color: var(--green);
        display: inline-block;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 6px 10px;
      }

      .stamp {
        border-color: color-mix(in srgb, var(--red) 72%, transparent);
        color: var(--red);
        transform: rotate(-2deg);
      }

      h1 {
        font-family: "Noto Serif TC", "Songti TC", "PMingLiU", serif;
        font-size: clamp(34px, 7vw, 72px);
        line-height: 1.05;
        margin: 0;
        max-width: 920px;
      }

      .lede {
        color: var(--muted);
        font-size: 18px;
        line-height: 1.8;
        margin: 24px 0 0;
        max-width: 820px;
      }

      .panel {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 252, 245, 0.94)),
          var(--field);
        border: 1px solid var(--line);
        box-shadow: 0 12px 30px rgba(23, 33, 31, 0.08);
      }

      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(3, 1fr);
        margin-top: 28px;
      }

      .card {
        min-height: 170px;
        padding: 22px;
      }

      .card h2,
      .section h2 {
        font-size: 18px;
        margin: 0 0 12px;
      }

      .card p,
      .section p,
      li {
        color: var(--muted);
        line-height: 1.75;
      }

      .section {
        margin-top: 18px;
        padding: 24px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 22px;
      }

      .button {
        background: var(--ink);
        color: white;
        display: inline-block;
        font-weight: 700;
        padding: 12px 16px;
        text-decoration: none;
      }

      .button.secondary {
        background: transparent;
        border: 1px solid var(--line);
        color: var(--ink);
      }

      code {
        background: rgba(40, 90, 77, 0.09);
        border: 1px solid rgba(40, 90, 77, 0.18);
        padding: 2px 5px;
      }

      footer {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.7;
        margin-top: 28px;
      }

      @media (max-width: 780px) {
        .rail {
          height: 8px;
          right: 0;
          width: auto;
        }

        .wrap {
          padding: 32px 16px 44px;
        }

        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="rail" aria-hidden="true"></div>
    <main class="wrap">
      <div class="eyebrow">
        <span class="tag">交通安全教育資料</span>
        <span class="tag stamp">GitHub Pages 靜態版</span>
      </div>
      <h1>臺北市酒駕／毒駕／拒測累犯教育儀表板</h1>
      <p class="lede">
        這是 GitHub Pages 發布的靜態說明頁。完整系統包含 Next.js API、SQLite、Python PDF 匯入解析與管理功能，必須部署為 Node/Docker 服務，不能只靠 GitHub Pages 執行。
      </p>

      <section class="grid" aria-label="專案功能摘要">
        <article class="panel card">
          <h2>資料來源</h2>
          <p>臺北市政府公開 PDF 公告資料，保留來源 attribution，供交通安全教育與資料視覺化示範使用。</p>
        </article>
        <article class="panel card">
          <h2>完整服務</h2>
          <p>包含公告爬取、PDF 解析、SQLite 儲存、API 篩選、統計卡片、資料表、地圖與管理匯入介面。</p>
        </article>
        <article class="panel card">
          <h2>Pages 限制</h2>
          <p>GitHub Pages 不支援伺服器 API、SQLite 寫入、Python worker 或管理匯入，因此此頁不顯示個案資料。</p>
        </article>
      </section>

      <section class="panel section">
        <h2>如何部署可運作的完整版本</h2>
        <ol>
          <li>在 GitHub Actions 執行 <code>CI</code>，確認 lint、typecheck、測試、Playwright、Lighthouse 通過。</li>
          <li><code>Build and Publish Image</code> workflow 會把 Docker image 推送到 GitHub Container Registry。</li>
          <li>在 Render、Railway、Fly.io、VPS 或校內主機拉取 GHCR image。</li>
          <li>設定 <code>ADMIN_TOKEN</code>，並掛載 <code>/app/drizzle</code>、<code>/app/data</code>、<code>/app/logs</code> 持久化儲存。</li>
          <li>第一次啟動前執行 <code>npm run db:migrate</code>。</li>
        </ol>
        <div class="actions">
          <a class="button" href="./README.zh-TW.md">查看中文 README</a>
          <a class="button secondary" href="./docs/deployment.md">查看部署指南</a>
        </div>
      </section>

      <section class="panel section">
        <h2>隱私與安全聲明</h2>
        <p>本網站資料來源為臺北市政府公開公告資料，僅供交通安全教育與資料視覺化示範使用。若原始公告修正、移除或更新，請以主管機關最新公告為準。</p>
        <p>本靜態頁不進行資料匯入、不顯示照片、不提供姓名查詢，也不對個人資料進行外部 enrichment。</p>
      </section>

      <footer>
        GitHub Pages 只提供靜態預覽。若你在 Repository Settings → Pages 選擇 GitHub Actions，請確認 <code>Deploy GitHub Pages</code> workflow 已成功執行。
      </footer>
    </main>
  </body>
</html>
`;

await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "index.html"), html, "utf8");
await writeFile(
  resolve(outDir, ".nojekyll"),
  "This file tells GitHub Pages not to process this artifact with Jekyll.\n",
  "utf8",
);

console.log(`GitHub Pages static artifact written to ${outDir}`);
