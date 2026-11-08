"""Run unmodified main.py as __main__, scheduling only a normal window close."""
from pathlib import Path
import runpy
import sys
from unittest.mock import patch
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QApplication

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
original_exec = QApplication.exec

def close_after_start(app):
    def close_windows():
        for window in app.topLevelWidgets():
            if window.windowTitle() == 'AI 智慧餐廳帶位機器人':
                window.close()
    QTimer.singleShot(500, close_windows)
    return original_exec()

with patch.object(QApplication, 'exec', close_after_start):
    runpy.run_path(str(ROOT / 'main.py'), run_name='__main__')
