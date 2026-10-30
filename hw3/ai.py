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
支援人數、靠窗/非靠窗偏好、指定桌號及多桌分配。桌子不移動；不支援實際併桌、無障礙等未建模限制。
超過6位可分坐多桌；6位以下沒有合適單桌時也可提出分桌方案，不需要先追問分桌意願。
只輸出一個 JSON 物件，所有欄位必須存在：
{"party_size": null, "window_preference": null, "window_required": false,
 "table_name": null, "table_required": false, "allow_split": null, "other_requirements": [],
 "question": "", "reply": ""}
party_size 是正整數或 null，window_preference 是 true(靠窗)/false(不靠窗)/null(無偏好)。
table_name 是大寫合法桌號或 null。window_required/table_required 只在顧客明確表示
「一定、只能、必須」時為 true，「希望、想要」只是偏好。所有布林值必須是真正 JSON 布林值。
多桌方案的靠窗需求適用所有桌位；指定桌號表示方案應包含該桌，無須把整組擠進同一桌。
allow_split 是 true(明確接受分桌)/false(明確拒絕分桌)/null(未表態)。未表態即可交由系統提出方案，
不主動詢問是否可分桌。單純選擇繼續等待，不等於拒絕所有分桌方案。
「必須坐同一桌、不要分桌」應設為 false；其他尚未建模的位置限制仍記錄為待釐清條件。
綜合目前確認的需求及這一輪對話更新欄位，未修改的已知需求必須保留。
不猜人數。只在缺少人數、需求矛盾、有歧義或特殊條件尚未釐清時，question 放簡短追問。
已明確表達但容量不足的需求，仍是完整需求，由 Python 說明無法安排。
例如「我們八位，不要分桌」必須輸出 party_size=8、allow_split=false、other_requirements=[]、
question=""、reply=""；不得把單桌容量不足記為特殊條件，也不要再次詢問是否可分桌。
超過全場席位、必要靠窗席位不足也同樣交給 Python 判斷，不自行新增歧義。
顧客未提靠窗或桌號時就是無偏好，相關欄位填 null，不得主動追問座位偏好。
例如「我們5位」應回傳 party_size=5、question=""、reply=""，直接交給系統分桌。
顧客回答了前次問題後，要更新或清空 question。不要詢問「還有其他需求嗎」。
不存在的桌號放入 other_requirements，詢問是否改選合法桌號，不能直接忽略。
other_requirements 保存所有尚未解決的不支援條件或需求歧義，包含矛盾條件及指涉不明的桌號。
對不支援條件詢問是否可取消；只有顧客明確同意取消後才可移除，不能自行承諾可滿足。
歧義釐清後移除對應項目。沒有待釐清條件時為空陣列；不要將未提及的可選偏好放進此欄位。
reply 只用於必要追問，與 question 相同。人數已知且 other_requirements 為空時，
question 和 reply 都必須是空字串，不重述人數、不確認無偏好、不提供操作說明。
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
    if data["allow_split"] is not None and type(data["allow_split"]) is not bool:
        raise ValueError("分桌意願必須為布林值或 null")
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
    # Unmentioned preferences are optional. A model-generated courtesy question
    # must not delay seating when the party size and all stated needs are clear.
    if size is not None and not requirements.other_requirements:
        requirements.question = ""
    if size is None and not requirements.question:
        requirements.question = "請問一共有幾位用餐？"
    if others and not requirements.question:
        requirements.question = "目前尚無法保證這些特殊條件，是否可以取消這些條件？"
    return ReceptionResult(requirements, requirements.question)


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
            try:
                detail = error.read().decode("utf-8", errors="replace")[:400]
            finally:
                error.close()
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
