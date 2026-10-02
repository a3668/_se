#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_dir"

for dependency in cargo python3; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    echo "缺少必要工具：$dependency" >&2
    exit 1
  fi
done

# 固定使用此專案的建置結果，避免測到之前安裝的 kcurl。
echo '建置 kcurl…'
cargo build --locked --bin kcurl --target-dir "$project_dir/target"

python3 - "$project_dir/target/debug/kcurl" <<'PY'
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

binary = sys.argv[1]
binary_body = bytes(range(256)) * 32
results = []


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def handle_request(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        status = 200
        headers = {}
        if self.path == "/redirect":
            status, payload = 302, b"redirect"
            headers["Location"] = "/hello"
        elif self.path == "/loop":
            status, payload = 302, b"loop"
            headers["Location"] = "/loop"
        elif self.path == "/missing":
            status, payload = 404, b"not found"
        elif self.path == "/binary":
            payload = binary_body
        elif self.path == "/echo":
            payload = json.dumps({
                "method": self.command,
                "body": body.decode("utf-8"),
                "content_type": self.headers.get("Content-Type"),
                "custom_headers": self.headers.get_all("X-Kcurl", []),
            }).encode("utf-8")
        else:
            payload = b"hello kcurl\n"

        try:
            if self.path == "/slow":
                time.sleep(0.8)
            self.send_response(status)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("X-Kcurl-Response", "yes")
            for name, value in headers.items():
                self.send_header(name, value)
            self.end_headers()
            self.wfile.flush()
            if self.path == "/slow-body":
                time.sleep(0.8)
            if self.command != "HEAD":
                self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_HEAD = do_OPTIONS = handle_request


def case(name, args, code=0, stdout=None, fields=None, stderr=None, check=None):
    try:
        response = subprocess.run(
            [binary, *args], capture_output=True, timeout=8, env=environment
        )
        if response.returncode != code:
            raise AssertionError(
                f"預期結束碼 {code}，實際 {response.returncode}；"
                + response.stderr.decode("utf-8", errors="replace")
            )
        if stdout is not None and response.stdout != stdout:
            raise AssertionError(f"輸出不符：{response.stdout[:200]!r}")
        if fields is not None:
            actual = json.loads(response.stdout)
            for key, value in fields.items():
                if actual.get(key) != value:
                    raise AssertionError(f"{key}：預期 {value!r}，實際 {actual.get(key)!r}")
        if stderr is not None and stderr.encode("utf-8") not in response.stderr:
            raise AssertionError(f"錯誤訊息不符：{response.stderr!r}")
        if code == 0 and response.stderr:
            raise AssertionError(f"成功時出現錯誤輸出：{response.stderr!r}")
        if check is not None:
            check(response)
    except Exception as error:
        results.append(False)
        print(f"FAIL  {name}：{error}", flush=True)
    else:
        results.append(True)
        print(f"PASS  {name}", flush=True)


def check_included(response):
    headers, body = response.stdout.split(b"\r\n\r\n", 1)
    if not headers.startswith(b"HTTP/1.1 200"):
        raise AssertionError("缺少正確的 HTTP 狀態行")
    if b"x-kcurl-response: yes" not in headers.lower():
        raise AssertionError("缺少回應標頭")
    if body != b"hello kcurl\n":
        raise AssertionError("回應本文不符")


def check_file(path, expected, response):
    if response.stdout:
        raise AssertionError("使用 -o 時仍輸出本文到標準輸出")
    if path.read_bytes() != expected:
        raise AssertionError("儲存的檔案內容不符")


def check_help(response):
    if b"Usage:" not in response.stdout or b"--max-time" not in response.stdout:
        raise AssertionError("缺少使用說明或主要參數")


# 本機請求不經過使用者的代理設定。
environment = os.environ.copy()
environment["NO_PROXY"] = environment["no_proxy"] = "127.0.0.1,localhost"

with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
    base = f"http://127.0.0.1:{server.server_port}"
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"使用本機 HTTP 伺服器：{base}", flush=True)
    try:
        with tempfile.TemporaryDirectory(prefix="kcurl-test-") as directory:
            output = Path(directory) / "download.bin"
            case("預設 GET", [base + "/echo"], fields={"method": "GET", "body": ""})
            case("原始回應本文", [base + "/hello"], stdout=b"hello kcurl\n")
            case("-i 狀態碼與標頭", ["-i", base + "/hello"], check=check_included)
            for method in ("PUT", "PATCH", "DELETE", "OPTIONS"):
                case(f"-X {method}", ["-X", method, base + "/echo"], fields={"method": method})
            case("HEAD 不輸出本文", ["-X", "HEAD", base + "/hello"], stdout=b"")
            case("重複自訂標頭", ["-H", "X-Kcurl: first", "-H", "X-Kcurl: second", base + "/echo"],
                 fields={"custom_headers": ["first", "second"]})
            case("-d 預設 POST 與表單類型", ["-d", "name=Kai", "-d", "lang=Rust", base + "/echo"],
                 fields={"method": "POST", "body": "name=Kai&lang=Rust",
                         "content_type": "application/x-www-form-urlencoded"})
            case("JSON 與方法覆寫", ["-X", "patch", "-H", "Content-Type: application/json",
                                     "-d", '{"name":"Kai"}', base + "/echo"],
                 fields={"method": "PATCH", "body": '{"name":"Kai"}', "content_type": "application/json"})
            case("預設不跟隨重新導向", [base + "/redirect"], stdout=b"redirect")
            case("-L 跟隨重新導向", ["-L", base + "/redirect"], stdout=b"hello kcurl\n")
            case("重新導向上限", ["-L", base + "/loop"], code=1, stderr="重新導向")
            case("二進位標準輸出", [base + "/binary"], stdout=binary_body)
            output.write_bytes(b"old content" * 1000)
            case("-o 覆寫並保存二進位內容", ["-o", str(output), base + "/binary"],
                 check=lambda response: check_file(output, binary_body, response))
            case("-o - 標準輸出", ["-o", "-", base + "/hello"], stdout=b"hello kcurl\n")
            case("不存在的輸出目錄", ["-o", str(Path(directory) / "missing" / "file"), base + "/hello"],
                 code=1, stdout=b"", stderr="無法建立輸出檔案")
            case("404 保留本文與成功結束碼", [base + "/missing"], stdout=b"not found")
            case("等待回應逾時", ["-m", "0.1", base + "/slow"], code=1, stdout=b"", stderr="逾時")
            case("讀取本文逾時與 --timeout 別名", ["--timeout", "0.1", base + "/slow-body"],
                 code=1, stdout=b"", stderr="逾時")
            case("拒絕非 HTTP 網址", ["ftp://example.com"], code=2, stdout=b"", stderr="HTTP")
            case("拒絕不完整的網址", ["example.com"], code=2, stdout=b"", stderr="網址")
            case("拒絕無效標頭", ["-H", "missing-colon", base], code=2, stdout=b"", stderr="標頭")
            case("拒絕標頭換行", ["-H", "X-Kcurl: value\r\nInjected: yes", base],
                 code=2, stdout=b"", stderr="標頭")
            case("拒絕零逾時", ["-m", "0", base], code=2, stdout=b"", stderr="逾時")
            case("拒絕非有限逾時", ["-m", "NaN", base], code=2, stdout=b"", stderr="逾時")
            case("--help", ["--help"], check=check_help)
            case("--version", ["--version"], stdout=b"kcurl 0.1.0\n")
    finally:
        server.shutdown()

passed = sum(results)
failed = len(results) - passed
print(f"\n結果：{passed} 通過，{failed} 失敗", flush=True)
sys.exit(1 if failed else 0)
PY
