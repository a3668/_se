"""One Ollama request at a time, without blocking Qt's event loop."""

from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from PySide6.QtCore import QObject, QThread, Signal, Slot

from restaurant import Requirements

DEFAULT_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "gpt-oss:120b-cloud")
REQUEST_TIMEOUT = 120

SYSTEM_PROMPT = """你是餐廳文字接待員，使用繁體中文，負責理解需求和追問，不負責分桌。
餐廳有 A1～A7、B1～B7、C1～C7。A/C 是四人桌，B 是六人桌，只有 A 靠窗。
目前只支援人數、靠窗/非靠窗偏好、指定桌號。不支援併桌、無障礙等尚未建模的限制。
只輸出一個 JSON 物件，所有欄位必須存在：
{"party_size": null, "window_preference": null, "window_required": false,
 "table_name": null, "table_required": false, "other_requirements": [],
 "question": "", "reply": ""}
party_size 是正整數或 null，window_preference 是 true(靠窗)/false(不靠窗)/null(無偏好)。
table_name 是大寫合法桌號或 null。window_required/table_required 只在顧客明確表示
「一定、只能、必須」時為 true，「希望、想要」只是偏好。所有布林值必須是真正 JSON 布林值。
綜合目前確認的需求及這一輪對話更新欄位，未修改的已知需求必須保留。
不猜人數。缺少人數、有歧義或仍有不支援的條件時，question 放簡短追問；否則空字串。
顧客回答了前次問題後，要更新或清空 question。不要只為了問「還有其他需求嗎」而阻擋分桌。
不存在的桌號放入 other_requirements，詢問是否改選合法桌號，不能直接忽略。
other_requirements 保存所有尚未解決的不支援條件，並詢問是否可取消該條件，
只有顧客明確同意取消後才可移除，不能自行承諾可滿足。沒有條件時為空陣列。
reply 是簡短接待文字；需要追問時與 question 相同。資訊完整時只說明已理解的需求，
不要宣稱已分配、已保留、已確認座位或開始帶位，也不要編造桌位使用狀態。
"""


@dataclass
class ReceptionResult:
    requirements: Requirements
    reply: str


def parse_result(content: str) -> ReceptionResult:
    if not isinstance(content, str):
        raise ValueError("模型未傳回文字內容")
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content, flags=re.IGNORECASE)
        content = re.sub(r"\s*```$", "", content)
    data = json.loads(content)
    if not isinstance(data, dict):
        raise ValueError("接待回覆必須是 JSON 物件")
    fields = set(Requirements.__dataclass_fields__) | {"reply"}
    if not fields.issubset(data):
        raise ValueError("接待回覆缺少需求欄位")
    size = data["party_size"]
    if size is not None and (type(size) is not int or size <= 0):
        raise ValueError("人數必須是正整數")
    window = data["window_preference"]
    if window is not None and type(window) is not bool:
        raise ValueError("靠窗偏好格式錯誤")
    for key in ("window_required", "table_required"):
        if type(data[key]) is not bool:
            raise ValueError("必要限制格式錯誤")
    table = data["table_name"]
    if table is not None and (not isinstance(table, str) or not re.fullmatch(r"[ABC][1-7]", table)):
        raise ValueError("桌號必須介於 A1～C7")
    if data["window_required"] and window is None:
        raise ValueError("必要靠窗限制缺少具體條件")
    if data["table_required"] and table is None:
        raise ValueError("必要桌號限制缺少桌號")
    others = data["other_requirements"]
    if not isinstance(others, list) or any(not isinstance(item, str) or not item.strip() for item in others):
        raise ValueError("特殊需求格式錯誤")
    if not isinstance(data["question"], str) or not isinstance(data["reply"], str):
        raise ValueError("接待文字格式錯誤")
    requirements = Requirements(**{key: data[key] for key in Requirements.__dataclass_fields__})
    requirements.question = requirements.question.strip()
    requirements.other_requirements = [item.strip() for item in others]
    if size is None and not requirements.question:
        requirements.question = "請問一共有幾位用餐？"
    if others and not requirements.question:
        requirements.question = "目前尚無法保證這些特殊條件，是否可以取消這些條件？"
    return ReceptionResult(requirements, requirements.question or data["reply"].strip() or "已了解需求，接下來為您尋找餐桌。")


class RequestThread(QThread):
    def __init__(self, url: str, model: str, messages: list[dict[str, str]], parent: QObject) -> None:
        super().__init__(parent)
        self.url = url.rstrip("/")
        self.model = model
        self.messages = list(messages)
        self.result: ReceptionResult | None = None
        self.error = ""

    def run(self) -> None:
        try:
            for attempt in range(2):
                payload = json.dumps({
                    "model": self.model, "messages": self.messages, "stream": False,
                }, ensure_ascii=False).encode("utf-8")
                request = Request(self.url + "/api/chat", data=payload, headers={"Content-Type": "application/json"})
                with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                    envelope = json.loads(response.read().decode("utf-8"))
                if not isinstance(envelope, dict):
                    raise ValueError("Ollama 回覆格式錯誤")
                if envelope.get("error"):
                    raise RuntimeError(str(envelope["error"]))
                message = envelope.get("message", {})
                content = message.get("content", "") if isinstance(message, dict) else ""
                try:
                    self.result = parse_result(content)
                    return
                except (ValueError, TypeError) as error:
                    if attempt == 1:
                        raise ValueError("模型兩次回覆均無法解析，請重試。") from error
                    self.messages.extend([
                        {"role": "assistant", "content": content if isinstance(content, str) else ""},
                        {"role": "user", "content": "上一則格式無法解析，請依 system 規定重傳完整 JSON，不加 Markdown 或說明。"},
                    ])
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:400]
            self.error = f"Ollama HTTP {error.code}：{detail}。請確認服務、模型與雲端登入狀態。"
        except (URLError, TimeoutError, OSError) as error:
            self.error = f"無法連接 Ollama 或請求逾時：{error}。請確認服務已啟動後重試。"
        except Exception as error:
            self.error = f"接待失敗：{error}"


class OllamaClient(QObject):
    completed = Signal(object)
    failed = Signal(str)
    idle = Signal()

    def __init__(self, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self.worker: RequestThread | None = None

    @property
    def busy(self) -> bool:
        return self.worker is not None

    def request(self, url: str, model: str, history: list[dict[str, str]], requirements: Requirements) -> None:
        if self.busy:
            return
        prompt = SYSTEM_PROMPT + "\n目前已確認需求：" + json.dumps(asdict(requirements), ensure_ascii=False)
        self.worker = RequestThread(url, model, [{"role": "system", "content": prompt}, *history], self)
        self.worker.finished.connect(self._finished)
        self.worker.start()

    @Slot()
    def _finished(self) -> None:
        worker = self.worker
        self.worker = None
        if worker is not None:
            result, error = worker.result, worker.error
            worker.deleteLater()
            if result is not None:
                self.completed.emit(result)
            else:
                self.failed.emit(error or "模型未傳回接待內容，請重試。")
        self.idle.emit()
