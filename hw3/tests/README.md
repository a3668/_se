# 測試

全部指令在 `hw3/` 執行，沿用既有 `.venv`、Python 標準函式庫與 PySide6，不另裝測試框架。

## 一般自動化

```bash
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
```

49 個測試：核心基準 6、AI 解析與 HTTP 10、連續移動與具身行為 22、Qt 介面 11。一般測試以 offscreen Qt 執行，不連線 Ollama。幾何情境與模擬採固定時間步進；介面透過 QtTest 操作控制項。

## 真實 Ollama

先由使用者啟動 Ollama，然後執行：

```bash
.venv/bin/python tests/live_ollama.py
```

使用 `OLLAMA_BASE_URL`、`OLLAMA_MODEL`，預設 `http://localhost:11434` 與 `gpt-oss:120b-cloud`。只送出程式內合成的餐廳需求，不傳送私人資料。包含 6 情境各 3 輪，共 18 個測試、24 次正常聊天請求；格式錯誤可能額外重試。此指令會呼叫現有模型，不下載模型或啟動服務。

一般人數、靠窗、多桌、拒絕分桌、缺人數追問、多輪修改；可安排的情境會接續確認座位、完成入座並返回。記錄實際欄位與原始回覆於 `ollama-results.json`，歷次執行另存於 `runs/`。

## 原生視窗流程

```bash
.venv/bin/python tests/native_smoke.py
```

以真正的 `main.main()` 入口建立原生視窗，QtTest 操作相同控制項，使用實際 Qt 計時器與真實 Ollama。涵蓋兩組接待、靠窗座位確認、顧客停留恢復、暫停繼續、4 倍速、行人穿越與減速、受阻 10 秒提示、移除障礙後恢復、入座及返回。需要可用桌面工作階段。

介面控制項先捲動至可見位置再操作；障礙物情境透過地圖編輯所呼叫的同一個 `toggle_obstacle` API 設定。結束自動關閉自己的視窗。畫面及階段記錄保存在 `artifacts/`。

## 紀錄與限制

本次結果見 [RESULTS.md](RESULTS.md)。測試檔、合成的歷史失敗樣本與結果摘要保留；每次產生的 PNG／JSON 放在被 Git 忽略的 `artifacts/`、`runs/`。一般測試不會執行真實串接或原生流程。

測試涵蓋有限的指定情境；未涵蓋任意人流配置、所有模型用語與真實機器人硬體。無法保證模型的每次輸出都相同。

原生腳本退出回歸可另執行 `.venv/bin/python tests/close_entrypoint.py`。這會直接以 `__main__` 執行原始 `main.py`，只安排正常關閉視窗，不替換視窗類別。一般測試也會用獨立子程序覆蓋此案例。
