#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
PORT="${TEST_SERVER_PORT:-18080}"
PASS=0
FAIL=0
PID=""
FINISHED=0

for dependency in cargo curl python3; do
    command -v "$dependency" >/dev/null || { echo "缺少指令：$dependency" >&2; exit 1; }
done
python3 - "$PORT" <<'PY'
import sys
port = sys.argv[1]
if not port.isascii() or not port.isdecimal() or not 1024 <= int(port) <= 65535:
    sys.exit("TEST_SERVER_PORT 須為 1024–65535 的整數")
PY

ADDRESS="127.0.0.1:$PORT"
BASE="http://$ADDRESS"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/hw5-api.XXXXXX")"
BODY="$WORK/body.json"
FIXTURES="$WORK/fixtures"

stop_server() {
    if [[ -n "$PID" ]]; then
        kill -INT "$PID" 2>/dev/null || true
        for ((attempt=0; attempt<50; attempt++)); do
            if ! kill -0 "$PID" 2>/dev/null; then break; fi
            sleep 0.1
        done
        kill -TERM "$PID" 2>/dev/null || true
        wait "$PID" 2>/dev/null || true
        PID=""
    fi
}

cleanup() {
    local code=$?
    trap - EXIT
    if ((code == 0 && FINISHED == 0)); then code=1; fi
    stop_server
    if ((code != 0)) && [[ -f "$WORK/server.log" ]]; then
        echo '--- 後端日誌（最後 40 行）---' >&2
        tail -n 40 "$WORK/server.log" >&2
    fi
    rm -rf -- "$WORK"
    exit "$code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

report() {
    local label=$1 success=$2
    if [[ "$success" == yes ]]; then
        PASS=$((PASS + 1))
        if [[ "${QUIET:-0}" != 1 ]]; then echo "  OK  $label"; fi
    else
        FAIL=$((FAIL + 1))
        echo "  FAIL  $label" >&2
    fi
}

request() {
    local label=$1 method=$2 path=$3 expected=$4 file=${5:-} content_type=${6:-application/json}
    local status
    local -a options=(--silent --show-error --noproxy '*' --connect-timeout 2 --max-time 15
        --request "$method" --output "$BODY" --write-out '%{http_code}')
    if [[ -n "$file" ]]; then
        options+=(--header "Content-Type: $content_type" --data-binary "@$file")
    fi
    if ! status=$(curl "${options[@]}" "$BASE$path"); then
        report "${label}：HTTP 連線失敗" no
        exit 1
    fi
    if [[ "$status" == "$expected" ]]; then
        report "${label}（HTTP ${status}）" yes
    else
        report "${label}（預期 HTTP ${expected}，實際 ${status}）" no
        head -c 500 "$BODY" >&2
        echo >&2
    fi
}

# Expressions below are authored test code; response data is only parsed as JSON.
json_check() {
    local label=$1 expression=$2
    shift 2
    if python3 - "$BODY" "$expression" "$@" <<'PY'
import json
import sys
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
    refs = []
    for path in sys.argv[3:]:
        with open(path) as f:
            refs.append(json.load(f))
    if not eval(sys.argv[2], {"d": d, "refs": refs}):
        raise AssertionError(sys.argv[2])
except Exception as error:
    print(f"JSON 斷言失敗：{error}", file=sys.stderr)
    sys.exit(1)
PY
    then report "$label" yes; else report "$label" no; fi
}

record_id() {
    python3 - "$BODY" <<'PY'
import json
import sys
with open(sys.argv[1]) as f:
    value = json.load(f)["id"]
if type(value) is not int or value <= 0:
    sys.exit("建立紀錄未回傳有效 ID，無法繼續關聯案例")
print(value)
PY
}

start_server() {
    # Fail instead of attaching to, or stopping, an existing listener.
    python3 - "$PORT" <<'PY'
import errno
import socket
import sys
with socket.socket() as probe:
    try:
        probe.bind(("127.0.0.1", int(sys.argv[1])))
    except OSError as error:
        if error.errno == errno.EADDRINUSE:
            sys.exit("測試連接埠已被占用；可設定 TEST_SERVER_PORT")
        sys.exit(f"無法檢查測試連接埠：{error}")
PY
    DATABASE_PATH="$WORK/api.db" SERVER_ADDR="$ADDRESS" "$BINARY" >>"$WORK/server.log" 2>&1 &
    PID=$!
    for ((attempt=0; attempt<100; attempt++)); do
        if ! kill -0 "$PID" 2>/dev/null; then
            echo '測試後端提早退出' >&2
            return 1
        fi
        # The banner is printed only after this process successfully binds.
        if [[ "$(<"$WORK/server.log")" == *"MIPS Pipeline Lab：http://$ADDRESS"* ]]; then
            if curl --silent --show-error --noproxy '*' --connect-timeout 1 --max-time 1 \
                --fail "$BASE/health" >"$WORK/health.txt" 2>/dev/null; then
                if [[ "$(<"$WORK/health.txt")" == OK ]] && kill -0 "$PID" 2>/dev/null; then return 0; fi
            fi
        fi
        sleep 0.1
    done
    echo '等待測試後端就緒逾時' >&2
    return 1
}

rejected_create() {
    local label=$1 path=$2 expected=$3 fixture=$4 message=${5:-} content_type=${6:-application/json}
    request "${label}：事前清單" GET "$path" 200
    cp "$BODY" "$WORK/before.json"
    request "$label" POST "$path" "$expected" "$fixture" "$content_type"
    if [[ -n "$message" ]]; then
        json_check "${label}：應用錯誤 JSON" \
            'isinstance(d, dict) and isinstance(d.get("error"), str) and refs[0] in d["error"]' \
            "$FIXTURES/message-$message.json"
    fi
    request "${label}：事後清單" GET "$path" 200
    json_check "${label}：沒有新增紀錄" 'd == refs[0]' "$WORK/before.json"
}

echo '[1] 編譯 Rust 後端'
cd -- "$PROJECT_ROOT"
cargo build --bin mips-pipeline-lab --message-format=json >"$WORK/build.jsonl"
BINARY=$(python3 - "$WORK/build.jsonl" <<'PY'
import json
import sys
with open(sys.argv[1]) as f:
    binaries = [item["executable"] for line in f if (item := json.loads(line)).get("reason") == "compiler-artifact"
                and item.get("target", {}).get("name") == "mips-pipeline-lab" and item.get("executable")]
if not binaries:
    sys.exit("找不到 cargo build 產生的後端執行檔")
print(binaries[-1])
PY
)

python3 - "$FIXTURES" <<'PY'
import copy
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
root.mkdir()
def write(name, data):
    (root / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

source = "lw $t0, 0($zero)\nadd $t1, $t0, $t0\nsw $t1, 4($zero)"
base = {"title": "  API 範例  ", "input": {"source": source, "registers": {"16": 4294967295},
        "memory": {"0": 7}, "max_cycles": 64}}
write("program", base)
write("updated", {"title": "修改後", "input": {"source": "addi $t0, $zero, 99"}})
write("draft", {"title": "未完成草稿", "input": {"source": "li $t0, 1"}})
write("boundary", {"title": "測" * 100, "input": {"source": "#" + "x" * 262138 + "\nnop\n", "max_cycles": 10000}})
write("error", {"title": "執行錯誤", "program_id": None, "input": {"source": "lw $t0, 2($zero)"}})
write("limit", {"title": "迴圈上限", "program_id": None, "input": {"source": "loop: j loop", "max_cycles": 20}})
write("nop", {"title": "清單案例", "input": {"source": "nop"}})
write("unknown-program", dict(base, program_id=9223372036854775807))
for name, message in {"title": "名稱須為", "source": "256 KiB", "syntax": "不支援指令",
        "empty": "至少一條", "punctuation": "缺少指令名稱", "instructions": "20 條",
        "register": "暫存器編號", "zero": "$zero", "alignment": "對齊",
        "memory": "超出", "cycles": "cycle 上限", "missing": "紀錄不存在"}.items():
    write(f"message-{name}", message)

cases = []
def invalid(name, status, message="", *, title=None, changes=None, top=None):
    data = copy.deepcopy(base)
    if title is not None:
        data["title"] = title
    if changes:
        data["input"].update(changes)
    if top:
        data.update(top)
    write(name, data)
    cases.append((name, status, message))

invalid("empty-title", 400, "title", title="")
invalid("blank-title", 400, "title", title=" \t ")
invalid("long-title", 400, "title", title="測" * 101)
invalid("long-source", 400, "source", changes={"source": "#" + "x" * 262144})
invalid("unknown-field", 422, top={"unexpected": True})
invalid("unknown-input-field", 422, changes={"unexpected": True})
invalid("wrong-source-type", 422, changes={"source": 7})
invalid("negative-register-value", 422, changes={"registers": {"8": -1}})
invalid("negative-memory-value", 422, changes={"memory": {"0": -1}})
invalid("negative-cycle-type", 422, changes={"max_cycles": -1})
invalid("null-title", 422, top={"title": None})
for name, field in [("missing-title", "title"), ("missing-input", "input")]:
    data = copy.deepcopy(base)
    del data[field]
    write(name, data)
    cases.append((name, 422, ""))
write("oversize", {"title": "大請求", "input": {"source": "x" * 524288}})
(root / "malformed.json").write_text("{", encoding="utf-8")
cases.extend([("malformed", 400, ""), ("oversize", 413, "")])
with (root / "common.tsv").open("w") as f:
    for row in cases:
        f.write("|".join(map(str, row)) + "\n")

cases = []
invalid("illegal-source", 400, "syntax", changes={"source": "li $t0, 1"})
invalid("empty-source", 400, "empty", changes={"source": ""})
invalid("punctuation-source", 400, "punctuation", changes={"source": ",()"})
invalid("too-many-instructions", 400, "instructions", changes={"source": "nop\n" * 21})
invalid("invalid-register", 400, "register", changes={"registers": {"32": 1}})
invalid("nonzero-zero", 400, "zero", changes={"registers": {"0": 1}})
invalid("unaligned-memory", 400, "alignment", changes={"memory": {"2": 1}})
invalid("out-of-range-memory", 400, "memory", changes={"memory": {"1024": 1}})
invalid("zero-cycles", 400, "cycles", changes={"max_cycles": 0})
invalid("too-many-cycles", 400, "cycles", changes={"max_cycles": 10001})
with (root / "simulation.tsv").open("w") as f:
    for row in cases:
        f.write("|".join(map(str, row)) + "\n")
PY

echo '[2] 啟動獨立後端與臨時資料庫'
start_server
request '健康檢查' GET /health 200
if [[ "$(<"$BODY")" == OK ]]; then report '健康檢查內容為 OK' yes; else report '健康檢查內容為 OK' no; fi
for resource in programs simulations; do
    request "$resource 初始清單" GET "/api/v1/$resource" 200
    json_check "$resource 初始為空陣列" 'd == []'
done
request '未知 API' GET /api/v1/not-found 404
json_check '未知 API 的應用錯誤格式' 'd == {"error": "API 不存在"}'
request '不支援的方法' PATCH /api/v1/programs 405

echo '[3] 程式 CRUD 與模擬快照'
request '建立程式' POST /api/v1/programs 201 "$FIXTURES/program.json"
PROGRAM_ID=$(record_id)
json_check '程式名稱去除首尾空白，保存輸入與時間戳' \
    'd["title"] == "API 範例" and d["input"] == refs[0]["input"] and type(d["updated_at"]) is int and d["updated_at"] > 0' "$FIXTURES/program.json"
cp "$BODY" "$WORK/program.json"
request '讀取程式' GET "/api/v1/programs/$PROGRAM_ID" 200
json_check '讀回程式與建立結果一致' 'd == refs[0]' "$WORK/program.json"
request '程式清單' GET /api/v1/programs 200
json_check '程式清單包含建立紀錄' 'd == [refs[0]]' "$WORK/program.json"

python3 - "$FIXTURES/program.json" "$FIXTURES/linked.json" "$PROGRAM_ID" <<'PY'
import json
import sys
with open(sys.argv[1]) as f:
    data = json.load(f)
data["program_id"] = int(sys.argv[3])
with open(sys.argv[2], "w") as f:
    json.dump(data, f)
PY
request '建立關聯模擬' POST /api/v1/simulations 201 "$FIXTURES/linked.json"
RUN_ID=$(record_id)
json_check '模擬關聯、標題、時間戳與原輸入' \
    'd["program_id"] == refs[0]["program_id"] and d["title"] == "API 範例" and type(d["created_at"]) is int and d["created_at"] > 0 and d["simulation"]["input"] == refs[0]["input"]' "$FIXTURES/linked.json"
json_check 'completed 模擬結果與逐 cycle trace' \
    'd["simulation"]["model_version"] == "mips-single-ex-v1" and d["simulation"]["status"] == "completed" and len(d["simulation"]["instructions"]) == 3 and len(d["simulation"]["trace"]) == 8 and [c["number"] for c in d["simulation"]["trace"]] == list(range(1,9)) and d["simulation"]["statistics"]["retired"] == 3 and d["simulation"]["statistics"]["stalls"] == 1 and d["simulation"]["statistics"]["flushed"] == 0 and d["simulation"]["statistics"]["cycles"] == 8 and abs(d["simulation"]["statistics"]["cpi"] - 8/3) < 1e-12 and d["simulation"]["trace"][-1]["registers_after"][8:10] == [7,14] and d["simulation"]["trace"][-1]["registers_after"][16] == 4294967295 and d["simulation"]["trace"][-1]["memory_after"][:2] == [7,14]'
cp "$BODY" "$WORK/completed.json"
request '讀取完整快照' GET "/api/v1/simulations/$RUN_ID" 200
json_check '完整快照與建立結果一致' 'd == refs[0]' "$WORK/completed.json"

for state in error limit; do
    request "保存 $state 模擬" POST /api/v1/simulations 201 "$FIXTURES/$state.json"
    state_id=$(record_id)
    if [[ "$state" == error ]]; then
        json_check '執行錯誤仍保存部分 trace' \
            'd["program_id"] is None and d["simulation"]["status"] == "error" and "對齊" in d["simulation"]["stop_reason"] and d["simulation"]["statistics"]["cycles"] == 4 and d["simulation"]["statistics"]["retired"] == 0 and len(d["simulation"]["trace"]) == 4'
    else
        json_check 'cycle 上限仍保存部分 trace' \
            'd["program_id"] is None and d["simulation"]["status"] == "limit" and "20 cycles" in d["simulation"]["stop_reason"] and d["simulation"]["statistics"]["cycles"] == 20 and d["simulation"]["statistics"]["retired"] == 6 and len(d["simulation"]["trace"]) == 20'
    fi
    cp "$BODY" "$WORK/$state.json"
    request "讀回 $state 快照" GET "/api/v1/simulations/$state_id" 200
    json_check "$state 快照保存完整" 'd == refs[0]' "$WORK/$state.json"
done
request '模擬摘要清單' GET /api/v1/simulations 200
json_check '摘要符合 completed/error/limit 的詳細紀錄，且未包含 trace' \
    'len(d) == 3 and all(row == {"id": full["id"], "title": full["title"], "program_id": full["program_id"], "created_at": full["created_at"], "status": full["simulation"]["status"], "cycles": full["simulation"]["statistics"]["cycles"], "retired": full["simulation"]["statistics"]["retired"]} for row, full in zip(d, reversed(refs)))' \
    "$WORK/completed.json" "$WORK/error.json" "$WORK/limit.json"

request '更新程式' PUT "/api/v1/programs/$PROGRAM_ID" 200 "$FIXTURES/updated.json"
json_check '更新保留 ID，套用新內容與預設初值' \
    'd["id"] == refs[0]["id"] and d["title"] == "修改後" and d["input"] == {"source": "addi $t0, $zero, 99", "registers": {}, "memory": {}, "max_cycles": 10000} and d["updated_at"] >= refs[0]["updated_at"]' "$WORK/program.json"
cp "$BODY" "$WORK/updated.json"
request '更新後讀回程式' GET "/api/v1/programs/$PROGRAM_ID" 200
json_check '新內容已保存' 'd == refs[0]' "$WORK/updated.json"
request '更新程式後讀取舊快照' GET "/api/v1/simulations/$RUN_ID" 200
json_check '舊快照不隨程式更新而變動' 'd == refs[0]' "$WORK/completed.json"
request '保存尚未能組譯的草稿' POST /api/v1/programs 201 "$FIXTURES/draft.json"
DRAFT_ID=$(record_id)
json_check '草稿不要求先通過組譯' 'd["input"]["source"] == "li $t0, 1"'
request '刪除草稿' DELETE "/api/v1/programs/$DRAFT_ID" 204
if [[ ! -s "$BODY" ]]; then report '204 沒有 response body' yes; else report '204 沒有 response body' no; fi

echo '[4] 拒絕錯誤請求，且不新增紀錄'
for resource in programs simulations; do
    while IFS='|' read -r name status message; do
        rejected_create "$resource/$name" "/api/v1/$resource" "$status" "$FIXTURES/$name.json" "$message"
    done <"$FIXTURES/common.tsv"
    rejected_create "$resource/錯誤 Content-Type" "/api/v1/$resource" 415 "$FIXTURES/program.json" '' text/plain
done
while IFS='|' read -r name status message; do
    rejected_create "simulations/$name" /api/v1/simulations "$status" "$FIXTURES/$name.json" "$message"
done <"$FIXTURES/simulation.tsv"
rejected_create '不存在的關聯程式' /api/v1/simulations 404 "$FIXTURES/unknown-program.json" missing
request '拒絕非法程式更新' PUT "/api/v1/programs/$PROGRAM_ID" 400 "$FIXTURES/blank-title.json"
json_check '更新錯誤格式' 'isinstance(d.get("error"), str)'
request '非法更新後讀回程式' GET "/api/v1/programs/$PROGRAM_ID" 200
json_check '非法更新未覆蓋原紀錄' 'd == refs[0]' "$WORK/updated.json"

request '接受 100 字名稱與 256 KiB 程式草稿' POST /api/v1/programs 201 "$FIXTURES/boundary.json"
BOUNDARY_ID=$(record_id)
json_check '保存允許的名稱與程式大小上界' 'len(d["title"]) == 100 and len(d["input"]["source"].encode()) == 262144'
request '接受 256 KiB 程式與 10000 cycle 上限的模擬' POST /api/v1/simulations 201 "$FIXTURES/boundary.json"
BOUNDARY_RUN_ID=$(record_id)
json_check '大小上界內可正常完成 nop' 'd["simulation"]["status"] == "completed" and d["simulation"]["statistics"]["cycles"] == 5 and d["simulation"]["statistics"]["retired"] == 1'
request '刪除大小邊界程式' DELETE "/api/v1/programs/$BOUNDARY_ID" 204
request '刪除大小邊界快照' DELETE "/api/v1/simulations/$BOUNDARY_RUN_ID" 204

for specification in 'GET programs' 'PUT programs' 'DELETE programs' 'GET simulations' 'DELETE simulations'; do
    read -r method resource <<<"$specification"
    request "$method 不存在的 $resource ID" "$method" "/api/v1/$resource/9223372036854775807" 404 "$FIXTURES/program.json"
    json_check '不存在的紀錄回傳應用錯誤' 'd == {"error": "紀錄不存在"}'
done
request '重複刪除草稿' DELETE "/api/v1/programs/$DRAFT_ID" 404

echo '[5] 重啟保存、刪除程式保留快照'
stop_server
: >"$WORK/server.log"
start_server
request '重啟後程式仍存在' GET "/api/v1/programs/$PROGRAM_ID" 200
json_check '重啟保留程式資料' 'd == refs[0]' "$WORK/updated.json"
for snapshot in completed error limit; do
    snapshot_id=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$WORK/$snapshot.json")
    request "重啟後 $snapshot 快照仍存在" GET "/api/v1/simulations/$snapshot_id" 200
    json_check "重啟保留 $snapshot 完整快照" 'd == refs[0]' "$WORK/$snapshot.json"
done
request '刪除關聯程式' DELETE "/api/v1/programs/$PROGRAM_ID" 204
request '已刪除程式不存在' GET "/api/v1/programs/$PROGRAM_ID" 404
request '關聯程式刪除後快照仍存在' GET "/api/v1/simulations/$RUN_ID" 200
json_check '只清除 program_id，快照內容不變' 'd == dict(refs[0], program_id=None)' "$WORK/completed.json"
request '刪除模擬紀錄' DELETE "/api/v1/simulations/$RUN_ID" 204
request '已刪除快照不存在' GET "/api/v1/simulations/$RUN_ID" 404
request '重複刪除模擬紀錄' DELETE "/api/v1/simulations/$RUN_ID" 404
request '刪除後的摘要清單' GET /api/v1/simulations 200
json_check '摘要清單也移除刪除的快照' 'all(row["id"] != refs[0]["id"] for row in d)' "$WORK/completed.json"

echo '[6] 兩種清單排序與最近 100 筆限制（各建立 101 筆）'
for resource in programs simulations; do
    mkdir "$WORK/$resource"
    for ((index=0; index<101; index++)); do
        QUIET=1 request "$resource 清單案例 $index" POST "/api/v1/$resource" 201 "$FIXTURES/nop.json"
        cp "$BODY" "$WORK/$resource/$index.json"
    done
    python3 - "$WORK/$resource" "$WORK/$resource-created.json" <<'PY'
import json
from pathlib import Path
import sys
records = [json.loads((Path(sys.argv[1]) / f"{index}.json").read_text()) for index in range(101)]
Path(sys.argv[2]).write_text(json.dumps(records))
PY
    if [[ "$resource" == programs ]]; then
        # Give the oldest ID a newer timestamp to distinguish updated_at ordering from ID ordering.
        first_id=$(python3 - "$WORK/programs-created.json" <<'PY'
import json
import sys
import time
with open(sys.argv[1]) as f:
    records = json.load(f)
deadline = time.monotonic() + 3
while time.time() < max(r["updated_at"] for r in records) + 1:
    if time.monotonic() >= deadline:
        sys.exit("等待排序案例的時鐘邊界逾時")
    time.sleep(0.05)
print(records[0]["id"])
PY
)
        request '更新最早建立的清單程式' PUT "/api/v1/programs/$first_id" 200 "$FIXTURES/nop.json"
        json_check '更新時間晚於其他清單程式' \
            'd["id"] == refs[0][0]["id"] and d["updated_at"] > max(r["updated_at"] for r in refs[0])' "$WORK/programs-created.json"
        python3 - "$WORK/programs-created.json" "$BODY" <<'PY'
import json
from pathlib import Path
import sys
path = Path(sys.argv[1])
records = json.loads(path.read_text())
records[0] = json.loads(Path(sys.argv[2]).read_text())
path.write_text(json.dumps(records))
PY
    fi
    request "$resource 最近 100 筆清單" GET "/api/v1/$resource" 200
    if [[ "$resource" == programs ]]; then
        json_check '程式清單按 updated_at、id 遞減，且截取 100 筆' \
            'len(d) == 100 and len({r["id"] for r in refs[0]}) == 101 and all(type(r["id"]) is int and r["id"] > 0 for r in refs[0]) and d == sorted(refs[0], key=lambda r: (r["updated_at"], r["id"]), reverse=True)[:100]' "$WORK/programs-created.json"
    else
        json_check '模擬清單依 id 遞減，且截取 100 筆正確摘要' \
            'len(d) == 100 and len({r["id"] for r in refs[0]}) == 101 and all(type(r["id"]) is int and r["id"] > 0 for r in refs[0]) and d == [{"id": r["id"], "title": r["title"], "program_id": r["program_id"], "created_at": r["created_at"], "status": "completed", "cycles": 5, "retired": 1} for r in sorted(refs[0], key=lambda r: r["id"], reverse=True)[:100]]' "$WORK/simulations-created.json"
    fi
done

echo "結果：$PASS/$((PASS + FAIL)) 通過，$FAIL 失敗"
if ((FAIL > 0)); then exit 1; fi
FINISHED=1
