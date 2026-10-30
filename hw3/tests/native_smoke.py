"""Launch the real main entrypoint with a visible QtTest-driven window and real Ollama."""
from pathlib import Path
import sys
import time
import traceback
import json

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PySide6.QtCore import QTimer, Qt
from PySide6.QtTest import QTest
from PySide6.QtWidgets import QApplication, QScrollArea
import main
from gui import RestaurantWindow
from simulation import IDLE, ESCORTING, BLOCKED

OUTPUT = Path(__file__).with_name('artifacts')
OUTPUT.mkdir(exist_ok=True)
RESULT = {'passed': False, 'stages': [], 'errors': []}

class SmokeWindow(RestaurantWindow):
    def __init__(self, simulation):
        super().__init__(simulation)
        self.stage = 0
        self.deadline = time.monotonic()+180
        self.driver = QTimer(self)
        self.driver.setInterval(100)
        self.driver.timeout.connect(self.drive)
        self.driver.start()

    def record(self, text):
        RESULT['stages'].append(text)
        print(text, flush=True)

    def click_control(self, control):
        for scroll in self.findChildren(QScrollArea):
            if scroll.widget().isAncestorOf(control):
                scroll.ensureWidgetVisible(control)
        QApplication.processEvents()
        QTest.mouseClick(control, Qt.MouseButton.LeftButton)

    def snapshot(self, name):
        self.grab().save(str(OUTPUT / name))

    def drive(self):
        s = self.simulation
        try:
            if time.monotonic() > self.deadline:
                raise AssertionError(f'Native GUI deadline: stage {self.stage}, {s.phase}, {s.wait_reason}')
            if self.stage == 0:
                self.customer_input.setText('我們四位，希望靠窗')
                self.click_control(self.send_button)
                self.record('使用 main.py 真實入口送出 Ollama 接待需求')
                self.stage = 1
            elif self.stage == 1:
                if s.ai.busy: return
                assert not s.last_error, s.last_error
                assert s.proposed is not None
                assert all(name.startswith('A') for name in s.proposed.table_names)
                self.snapshot('01-proposal.png')
                self.click_control(self.confirm_button)
                assert s.phase == ESCORTING
                self.click_control(self.customer_stop)
                self.before = s.robot.visual_position
                self.record('模型提出靠窗座位；確認帶位並讓顧客停留')
                self.stage = 2
            elif self.stage == 2:
                assert s.robot.visual_position == self.before
                assert '顧客' in s.wait_reason
                self.snapshot('02-wait-customer.png')
                self.click_control(self.customer_stop)
                self.time_scale.setCurrentIndex(2)
                self.click_control(self.pause_button)
                self.before = s.robot.visual_position
                self.stage = 3
            elif self.stage == 3:
                assert s.robot.visual_position == self.before
                self.click_control(self.pause_button)
                self.person_start.setText('4, 4')
                self.person_goal.setText('6, 4')
                self.click_control(self.add_person)
                assert s.pedestrians
                self.record('顧客恢復跟隨、暫停／繼續、4 倍速與新增穿越行人')
                self.stage = 4
            elif self.stage == 4:
                if not any('行人接近' in line for line in s.events): return
                self.snapshot('03-pedestrian.png')
                self.record('實際計時移動中出現行人減速／停止反應')
                self.stage = 5
            elif self.stage == 5:
                if s.phase != IDLE: return
                assert any(t.status == '占用' for t in s.restaurant.tables)
                assert self.new_button.isEnabled()
                self.record('顧客入座、機器人返回入口、下一組控制恢復')
                self.click_control(self.new_button)
                self.customer_input.setText('我們五位')
                self.click_control(self.send_button)
                self.stage = 6
            elif self.stage == 6:
                if s.ai.busy: return
                assert s.proposed is not None
                self.click_control(self.confirm_button)
                # Block exits while respecting the current bodies; use the real map-edit API.
                for cell in ((7,2), (9,2), (8,3), (7,1), (9,1), (8,0)):
                    s.toggle_obstacle(cell)
                self.stage = 7
            elif self.stage == 7:
                if not s._assistance_logged: return
                assert s.phase == BLOCKED
                self.snapshot('04-blocked.png')
                for cell in list(s.restaurant.obstacles): s.toggle_obstacle(cell)
                self.record('持續受阻提示人工協助；移除障礙後恢復原任務')
                self.stage = 8
            elif self.stage == 8:
                if s.phase != IDLE: return
                self.snapshot('05-complete.png')
                self.record('恢復後完成入座與返回；關閉視窗')
                RESULT['passed'] = True
                self.finish()
        except Exception:
            RESULT['errors'].append(traceback.format_exc())
            print(RESULT['errors'][-1], flush=True)
            self.snapshot('failure.png')
            self.finish()

    def finish(self):
        self.driver.stop()
        if self.simulation.ai.busy:
            self.simulation.ai.idle.connect(self.close)
        self.close()

main.RestaurantWindow = SmokeWindow
status = main.main()
(OUTPUT / 'native-results.json').write_text(json.dumps(RESULT, ensure_ascii=False, indent=2))
sys.exit(0 if RESULT['passed'] and status == 0 else 1)
