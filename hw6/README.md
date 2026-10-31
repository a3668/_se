# 席間 · AI 餐廳帶位控制台

`hw3` 的獨立網頁版本，使用 React + TypeScript + Vite，透過 SVG 呈現餐廳地圖，支援 AI 接待、分桌、候位與 A* 導航避障。

## 安裝與啟動

需要 Node.js 22.12 以上版本與 npm。

```bash
cd hw6
npm install
npm run dev
```

本機網址：`http://127.0.0.1:6060`。

另外啟動 Ollama：

```bash
OLLAMA_CONTEXT_LENGTH=16384 ollama serve
```

## 建置與本機執行

```bash
npm run build
npm start
```

## 接待與座位

- 選擇模型，輸入「我們五位」或「我們四位，希望靠窗」，由 AI 理解需求，分桌引擎安排座位。
- 支援靠窗、指定桌號與分桌需求；無法安排時可選擇替代方案或加入候位。
- 按「確認座位並帶位」後，機器人引導顧客入座，多桌逐桌停靠，完成後返回入口。
- 「候位名單」可接待指定組別並修改需求；已占用餐桌可手動釋放。

## 模擬與地圖

- 地圖 18 × 34 格，每格 1 公尺；共 21 桌、98 席，A 區靠窗。
- 機器人使用四方向 A* 導航，360 度感測半徑為 4 公尺，發現障礙物後重新規劃路線。
- 啟用「編輯障礙物」後，可點選空白格新增或移除障礙物。
- 可新增行人，起終點使用整數座標，例如 `4,8` → `6,8`；機器人會減速、停止或繞行。
- 可調整機器人與顧客速度、暫停及切換模擬倍速，並用「顧客停留」與「恢復跟隨」控制顧客。

重新整理頁面會重置所有資料。

## 程式結構

| 位置                                  | 職責                                   |
| ------------------------------------- | -------------------------------------- |
| `src/core/restaurant.ts`              | 地圖、桌位、需求、顧客與角色資料       |
| `src/core/seating.ts`                 | 分桌搜尋、排序、替代方案與整組重新檢查 |
| `src/core/navigation.ts`、`motion.ts` | A\*、連續座標、身體與移動碰撞          |
| `src/core/simulation.ts`              | 接待、候位、帶位、感測與避障狀態機     |
| `src/core/ai.ts`、`prompt.ts`         | Ollama 接待提示、請求、重試與解析      |
| `src/components/RestaurantMap.tsx`    | SVG 地圖與障礙物編輯                   |
| `src/App.tsx`、`useSimulation.ts`     | 工作台、管理面板與動畫生命週期         |
| `src/useOllamaModels.ts`              | 應用層的模型清單、選擇與載入狀態       |
| `server/ollamaProxy.ts`               | 開發及本機 preview 共用的 Ollama 代理  |

## 測試圖

![AI 智慧餐廳帶位機器人示範圖](hw6-pic/test.png)
