#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
PORT="${E2E_SERVER_PORT:-18082}"
PID=""
WORK=""

for dependency in cargo node npm curl python3; do
    command -v "$dependency" >/dev/null || { echo "缺少指令：$dependency" >&2; exit 1; }
done
if [[ ! -x "$SCRIPT_DIR/node_modules/.bin/playwright" ]]; then
    echo '請先執行：cd tests/e2e && npm ci && npm run install:browser' >&2
    exit 1
fi
python3 - "$PORT" <<'PY'
import socket
import sys
port = sys.argv[1]
if not port.isascii() or not port.isdecimal() or not 1024 <= int(port) <= 65535:
    sys.exit("E2E_SERVER_PORT 須為 1024–65535 的整數")
with socket.socket() as sock:
    try:
        sock.bind(("127.0.0.1", int(port)))
    except OSError as error:
        sys.exit(f"測試連接埠無法使用：{error}")
PY

cleanup() {
    local code=$?
    trap - EXIT
    if [[ -n "$PID" ]]; then
        kill -INT "$PID" 2>/dev/null || true
        for ((attempt=0; attempt<50; attempt++)); do
            if ! kill -0 "$PID" 2>/dev/null; then break; fi
            sleep 0.1
        done
        kill -TERM "$PID" 2>/dev/null || true
        wait "$PID" 2>/dev/null || true
    fi
    if [[ -n "$WORK" ]]; then rm -rf -- "$WORK"; fi
    echo "E2E 結束，退出碼 ${code}；測試服務與臨時資料已清理。"
    exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$PROJECT_ROOT"
mkdir -p "$SCRIPT_DIR/artifacts"
rm -f "$SCRIPT_DIR/artifacts/results.json"
echo '[1/4] 編譯 Rust 後端與前端'
cargo build
npm --prefix frontend run build

WORK="$(mktemp -d "${TMPDIR:-/tmp}/hw5-e2e.XXXXXX")"
export HW5_E2E_BASE_URL="http://127.0.0.1:$PORT"
export HW5_E2E_ISOLATED=1
export PLAYWRIGHT_BROWSERS_PATH="$SCRIPT_DIR/node_modules/.cache/ms-playwright"
echo "[2/4] 啟動隔離後端 $HW5_E2E_BASE_URL"
BINARY="$(cargo metadata --no-deps --format-version 1 | python3 -c 'import json,sys; print(json.load(sys.stdin)["target_directory"] + "/debug/mips-pipeline-lab")')"
DATABASE_PATH="$WORK/e2e.db" SERVER_ADDR="127.0.0.1:$PORT" "$BINARY" > "$SCRIPT_DIR/artifacts/server.log" 2>&1 &
PID=$!
READY=0
for ((attempt=0; attempt<100; attempt++)); do
    if ! kill -0 "$PID" 2>/dev/null; then break; fi
    if grep -Fq "MIPS Pipeline Lab：http://127.0.0.1:$PORT" "$SCRIPT_DIR/artifacts/server.log" &&
       curl --noproxy '*' --silent --fail --max-time 1 "$HW5_E2E_BASE_URL/health" >/dev/null; then READY=1; break; fi
    sleep 0.1
done
if (( READY == 0 )); then
    cat "$SCRIPT_DIR/artifacts/server.log" >&2
    echo '測試後端未就緒' >&2
    exit 1
fi
kill -0 "$PID"
echo '[3/4] 執行 E2E 靜態型別檢查'
npm --prefix "$SCRIPT_DIR" run typecheck
echo '[4/4] 執行無頭 Chromium E2E'
cd "$SCRIPT_DIR"
./node_modules/.bin/playwright test "$@"
