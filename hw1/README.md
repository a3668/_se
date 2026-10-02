# kcurl

以 Rust 撰寫的 HTTP／HTTPS 命令列工具，提供基本的 curl 風格參數。

## 建置與安裝

需要 Rust 與 Cargo（支援 Rust 2024 edition 的 stable 工具鏈）。

```bash
cd hw1
cargo build --release
```

編譯完成後，可執行 `./target/release/kcurl`。若要安裝成 `kcurl` 指令：

```bash
cargo install --path .
```

請確保 Cargo 的 bin 目錄（通常是 `$HOME/.cargo/bin`）已加入 `PATH`。

## 功能與參數

```text
kcurl [OPTIONS] <URL>
```

| 參數 | 功能 |
| --- | --- |
| `<URL>` | 完整的 HTTP／HTTPS 網址 |
| `-X, --request <METHOD>` | 指定方法，預設 GET；有 `-d` 時預設 POST |
| `-H, --header <NAME: VALUE>` | 自訂標頭，可重複指定 |
| `-d, --data <DATA>` | 傳送原始文字、JSON 或已編碼的表單字串 |
| `-i, --include` | 在回應本文前輸出 HTTP 版本、狀態碼與標頭 |
| `-o, --output <FILE>` | 將回應存入檔案；`-` 表示標準輸出 |
| `-L, --location` | 跟隨重新導向，最多 10 次 |
| `-m, --max-time <SECONDS>` | 逾時秒數，預設 30 秒，支援正小數 |
| `--timeout <SECONDS>` | `--max-time` 的別名 |
| `-h, --help` | 顯示使用說明 |
| `-V, --version` | 顯示版本 |

## 使用範例

取得回應本文：

```bash
kcurl https://example.com
```

包含狀態碼與回應標頭：

```bash
kcurl -i https://example.com
```

傳送 JSON：

```bash
kcurl -X POST https://example.com/api \
  -H 'Content-Type: application/json' \
  -d '{"name":"Kai"}'
```

傳送表單字串（多個 `-d` 以 `&` 連接）：

```bash
kcurl https://example.com/api -d 'name=Kai' -d 'language=Rust'
```

指定方法與多個標頭：

```bash
kcurl -X DELETE https://example.com/api/items/1 \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Accept: application/json'
```

跟隨重新導向並儲存檔案：

```bash
kcurl -L https://example.com/file -o file.bin
```

設定逾時：

```bash
kcurl --max-time 5.5 https://example.com
```

## 行為說明

- 預設只輸出回應本文，不額外加入換行；本文以原始位元組串流輸出，支援二進位檔案。
- HTTPS 使用 reqwest 的預設 TLS 與憑證檢查。
- 預設不跟隨重新導向；使用 `-L -i` 時只輸出最終回應的標頭與本文。
- `-X` 優先於 `-d` 推導的方法。方法會轉成大寫，支援 HEAD、OPTIONS 等合法 HTTP 方法。
- `-d` 原樣傳送資料，不自動編碼、不讀取 `@檔案`、不檢查 JSON 語法。未指定 Content-Type 時使用 `application/x-www-form-urlencoded`；JSON 或一般文字請自行用 `-H` 指定。
- 多個 `-H` 保留重複標頭。標頭名稱不分大小寫。
- `-o` 會覆寫已有檔案，父目錄須已存在；搭配 `-i` 時，標頭也會寫入同一檔案。傳輸失敗可能留下部分內容。
- 逾時涵蓋連線到讀取回應本文；輸出到本機檔案或標準輸出的寫入時間不受此限制。
- HTTP 4xx／5xx 仍輸出回應並以 0 結束，方便讀取伺服器的錯誤內容。
- 連線、逾時、重新導向、讀取或寫入失敗以 1 結束；參數錯誤以 2 結束。標準輸出管線被下游關閉時以 0 結束。
- 錯誤訊息輸出到標準錯誤，不混入回應內容。

目前未提供檔案上傳、Cookie 儲存、Basic Auth 專用參數、代理伺服器專用參數與下載進度。reqwest 預設的環境變數／系統代理設定仍適用。

## 使用的套件

- [clap](https://docs.rs/clap/latest/clap/)：命令列參數解析。
- [reqwest](https://docs.rs/reqwest/latest/reqwest/)：HTTP／HTTPS 請求與重新導向。
