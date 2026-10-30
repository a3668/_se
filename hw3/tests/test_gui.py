import unittest
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch
from support import APP
from PySide6.QtCore import Qt, QPoint
from PySide6.QtTest import QTest
from ai import ReceptionResult
from gui import RestaurantWindow
from restaurant import Requirements
from simulation import Simulation, ESCORTING, IDLE, THINKING

class GuiTests(unittest.TestCase):
    def setUp(self):
        self.s = Simulation()
        self.s.timer.stop()
        self.w = RestaurantWindow(self.s)
        self.w.resize(1100, 900)
        self.w.show()
        APP.processEvents()

    def tearDown(self):
        self.s.timer.stop()
        self.w.close()
        self.w.deleteLater()
        APP.processEvents()

    def escort(self):
        self.s._received(ReceptionResult(Requirements(party_size=4), ''))
        QTest.mouseClick(self.w.confirm_button, Qt.MouseButton.LeftButton)
        self.assertEqual(self.s.phase, ESCORTING)

    def test_send_and_confirm(self):
        with patch.object(self.s.ai, 'request') as request:
            QTest.keyClicks(self.w.customer_input, '4')
            QTest.mouseClick(self.w.send_button, Qt.MouseButton.LeftButton)
            request.assert_called_once()
            self.assertEqual(self.s.phase, THINKING)
        self.s._received(ReceptionResult(Requirements(party_size=4), ''))
        self.assertTrue(self.w.confirm_button.isEnabled())
        QTest.mouseClick(self.w.confirm_button, Qt.MouseButton.LeftButton)
        self.assertEqual(self.s.phase, ESCORTING)
        self.assertFalse(self.w.send_button.isEnabled())

    def test_customer_stop_resume(self):
        self.escort()
        QTest.mouseClick(self.w.customer_stop, Qt.MouseButton.LeftButton)
        self.assertTrue(self.s.group.stopped)
        self.s.step(1)
        self.assertIn('顧客', self.w.motion_reason.text())
        QTest.mouseClick(self.w.customer_stop, Qt.MouseButton.LeftButton)
        self.assertFalse(self.s.group.stopped)

    def test_speed_and_pause_controls(self):
        self.escort()
        self.w.speed.setValue(.7)
        self.w.customer_speed.setValue(.6)
        self.w.time_scale.setCurrentIndex(2)
        self.assertEqual(self.s.speed, .7)
        self.assertEqual(self.s.group.speed, .6)
        self.assertEqual(self.s.time_scale, 4)
        QTest.mouseClick(self.w.pause_button, Qt.MouseButton.LeftButton)
        before = self.s.robot.visual_position
        self.s.step(1)
        self.assertEqual(self.s.robot.visual_position, before)
        QTest.mouseClick(self.w.pause_button, Qt.MouseButton.LeftButton)
        self.s.step(.5)
        self.assertNotEqual(self.s.robot.visual_position, before)

    def test_add_and_clear_pedestrian(self):
        QTest.mouseClick(self.w.add_person, Qt.MouseButton.LeftButton)
        self.assertEqual(len(self.s.pedestrians), 1)
        QTest.mouseClick(self.w.clear_people, Qt.MouseButton.LeftButton)
        self.assertFalse(self.s.pedestrians)

    def test_bad_coordinates_report_error(self):
        self.w.person_start.setText('bad')
        QTest.mouseClick(self.w.add_person, Qt.MouseButton.LeftButton)
        self.assertFalse(self.s.pedestrians)
        self.assertIn('座標', self.w.events.toPlainText())

    def test_complete_round_updates_controls(self):
        self.escort()
        self.s.step(50)
        self.assertEqual(self.s.phase, IDLE)
        self.assertTrue(self.w.new_button.isEnabled())
        self.assertFalse(self.w.customer_stop.isEnabled())
        self.assertFalse(self.w.customer_stop.isChecked())

    def test_draw_sensor_pedestrian_and_memory(self):
        self.s.add_pedestrian((4,8), (6,8))
        self.s.restaurant.obstacles.add((8,3))
        self.s._sense()
        self.s.restaurant.obstacles.remove((8,3))
        self.s.changed.emit()
        pixmap = self.w.canvas.grab()
        self.assertFalse(pixmap.isNull())

    def test_close_when_idle(self):
        self.w.close()
        self.assertFalse(self.w.isVisible())

    def test_close_waits_for_ai(self):
        class Worker:
            def isRunning(self): return True
        self.s.ai.worker = Worker()
        self.w.close()
        self.assertTrue(self.w.close_pending)
        self.assertTrue(self.w.isVisible())
        self.s.ai.worker = None
        self.s.ai.idle.emit()
        self.assertFalse(self.w.isVisible())

    def test_map_edit_click_adds_and_removes_obstacle(self):
        QTest.mouseClick(self.w.edit_obstacles, Qt.MouseButton.LeftButton)
        self.assertTrue(self.w.canvas.editing_obstacles)
        floor, scale = self.w.canvas.geometry_for_map()
        point = QPoint(round(floor.left()+8.5*scale), round(floor.bottom()-3.5*scale))
        QTest.mouseClick(self.w.canvas, Qt.MouseButton.LeftButton, pos=point)
        self.assertIn((8,3), self.s.restaurant.obstacles)
        self.assertIn((8,3), self.s.restaurant.known_obstacles)
        QTest.mouseClick(self.w.canvas, Qt.MouseButton.LeftButton, pos=point)
        self.assertNotIn((8,3), self.s.restaurant.obstacles)
        self.assertNotIn((8,3), self.s.restaurant.known_obstacles)

    def test_main_entrypoint_exits_cleanly(self):
        process = subprocess.run([sys.executable, str(Path(__file__).with_name('close_entrypoint.py'))],
                                 capture_output=True, text=True, timeout=15)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertNotIn('shared QObject was deleted', process.stderr)

if __name__ == '__main__': unittest.main()
