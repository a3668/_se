"""Launch the complete restaurant simulation: python main.py."""

import sys

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
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
