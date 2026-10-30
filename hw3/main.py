"""Launch the complete restaurant simulation: python main.py."""

import sys

from PySide6.QtCore import QCoreApplication, QEvent
from PySide6.QtWidgets import QApplication

from gui import STYLESHEET, RestaurantWindow
from simulation import Simulation


def main() -> int:
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setStyleSheet(STYLESHEET)
    simulation = Simulation()
    window = RestaurantWindow(simulation)
    screen = app.primaryScreen()
    if screen is not None:
        available = screen.availableGeometry()
        window.resize(min(1200, available.width()), min(980, available.height()))
    window.show()
    result = app.exec()
    # Dispose widgets while the application and simulation still exist. Leaving
    # parented widgets and Python signal closures to interpreter shutdown can
    # crash Qt's native macOS cleanup (notably with Python 3.14 / Qt 6.12).
    simulation.timer.stop()
    window.deleteLater()
    QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
    simulation.deleteLater()
    QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
