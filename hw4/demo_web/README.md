# HW4 Docker 系統展示頁

獨立的 React + TypeScript + Vite 純前端介紹頁。包含架構圖、技術分工、功能介紹、截圖預留區與可複製的 Docker 系統使用指令。採用原生 CSS，無後端與 API 串接。

## 本機使用

需要 Node.js 20.19+ 或 22.12+（建議使用目前維護中的 LTS 版本）。在本目錄執行：

```bash
npm install
npm run dev
```

此開發伺服器只提供展示頁，與原本 `localhost:8080` 的聊天系統分開運作；展示頁不需要先啟動 Docker 或 Ollama。

開發與預覽伺服器皆固定使用 `http://localhost:8181/`；若 8181 已被占用，會直接報錯，不自動切換連接埠。修改設定後，若伺服器原本正在執行，請停止後重新啟動。

其他指令：

```bash
npm run typecheck
npm run build
npm run preview
```

`build` 產物位於 `dist/`。Vite 已設定 `base: './'`，可供靜態伺服器放置於子目錄，不依賴根路徑路由。

## 內容與截圖

介紹文字、技術卡片、指令和截圖清單集中在 `src/content.ts`；元件在 `src/App.tsx`，樣式在 `src/styles.css`。

實際截圖放入 `public/screenshots/`，再替 `screenshots` 清單對應項目加入圖片路徑，例如：

```ts
{
  id: 'chat',
  title: '聊天畫面',
  description: '展示提問、串流回答與輸入區。',
  image: 'screenshots/chat.webp',
  alt: '聊天介面的實際使用截圖',
}
```

路徑不加開頭斜線；圖片透過 Vite 的部署基底路徑載入。未提供圖片或圖片載入失敗時會顯示「截圖待補」。目前不包含實際截圖。

複製指令使用 Clipboard API；瀏覽器未提供權限或不支援時，頁面會提示選取文字複製。
