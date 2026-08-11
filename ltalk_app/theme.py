"""Theme singleton exposed to QML as a context property."""

from PySide6.QtCore import QObject, Property, Signal


class Theme(QObject):
    """Maroon-themed design tokens for the LTalk UI."""

    isDarkChanged = Signal()
    primaryChanged = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._isDark = False

    # --- Theme mode ---

    @Property(bool, notify=isDarkChanged)
    def isDark(self):
        return self._isDark

    @isDark.setter
    def isDark(self, value):
        if self._isDark != value:
            self._isDark = value
            self.isDarkChanged.emit()
            self.primaryChanged.emit()

    # --- Core colors ---

    @Property(str, notify=primaryChanged)
    def primary(self):
        return "#7F1D1D" if self._isDark else "#A52A2A"

    @Property(str, notify=primaryChanged)
    def primaryDark(self):
        return "#5C0E0E" if self._isDark else "#8B1A1A"

    @Property(str, notify=primaryChanged)
    def primaryLight(self):
        return "#9B3B3B" if self._isDark else "#C44B4B"

    @Property(str, notify=primaryChanged)
    def primaryWash(self):
        return "#1C1212" if self._isDark else "#FAF0F0"

    @Property(str, notify=primaryChanged)
    def surface(self):
        return "#1E1515" if self._isDark else "#FFFFFF"

    @Property(str, notify=primaryChanged)
    def background(self):
        return "#0F0A0A" if self._isDark else "#F5F0F0"

    @Property(str, notify=primaryChanged)
    def textPrimary(self):
        return "#EDE0E0" if self._isDark else "#1A1A1A"

    @Property(str, notify=primaryChanged)
    def textSecondary(self):
        return "#A08888" if self._isDark else "#6B4E4E"

    @Property(str, notify=primaryChanged)
    def receiverBubble(self):
        return "#2A2020" if self._isDark else "#E8E0E0"

    @Property(str, notify=primaryChanged)
    def receiverText(self):
        return "#EDE0E0" if self._isDark else "#1A1A1A"

    @Property(str, notify=primaryChanged)
    def senderBubble(self):
        return "#7F1D1D" if self._isDark else "#A52A2A"

    @Property(str, notify=primaryChanged)
    def senderText(self):
        return "#FFFFFF"

    @Property(str, notify=primaryChanged)
    def tick(self):
        return "#C44B4B" if self._isDark else "#A52A2A"

    @Property(str, notify=primaryChanged)
    def tickRead(self):
        return "#6BB3F0" if self._isDark else "#4A90D9"

    @Property(str, notify=primaryChanged)
    def online(self):
        return "#4CAF50"

    @Property(str, notify=primaryChanged)
    def error(self):
        return "#EF5350" if self._isDark else "#D32F2F"

    @Property(str, notify=primaryChanged)
    def callGreen(self):
        return "#388E3C" if self._isDark else "#2E7D32"

    @Property(str, notify=primaryChanged)
    def callDecline(self):
        return "#C62828"

    @Property(str, notify=primaryChanged)
    def divider(self):
        return "#2A1F1F" if self._isDark else "#E0D5D5"

    @Property(str, notify=primaryChanged)
    def hover(self):
        return "#1A1010" if self._isDark else "#F0E8E8"

    @Property(str, notify=primaryChanged)
    def active(self):
        return "#2A1818" if self._isDark else "#E8D8D8"

    @Property(str, notify=primaryChanged)
    def overlay(self):
        return "#CC000000" if self._isDark else "#66000000"

    # --- Typography ---

    @Property(str, notify=primaryChanged)
    def fontFamily(self):
        return "Ubuntu, Noto Sans, DejaVu Sans, sans-serif"

    @Property(str, notify=primaryChanged)
    def fontMono(self):
        return "JetBrains Mono, Fira Code, Ubuntu Mono, monospace"

    @Property(int, constant=True)
    def fontSizeXs(self):
        return 10

    @Property(int, constant=True)
    def fontSizeSm(self):
        return 12

    @Property(int, constant=True)
    def fontSizeMd(self):
        return 14

    @Property(int, constant=True)
    def fontSizeLg(self):
        return 16

    @Property(int, constant=True)
    def fontSizeXl(self):
        return 20

    @Property(int, constant=True)
    def fontSize2xl(self):
        return 24

    @Property(int, constant=True)
    def fontSize3xl(self):
        return 32

    # --- Spacing ---

    @Property(int, constant=True)
    def spacingXs(self):
        return 4

    @Property(int, constant=True)
    def spacingSm(self):
        return 8

    @Property(int, constant=True)
    def spacingMd(self):
        return 12

    @Property(int, constant=True)
    def spacingLg(self):
        return 16

    @Property(int, constant=True)
    def spacingXl(self):
        return 24

    @Property(int, constant=True)
    def spacing2xl(self):
        return 32

    # --- Border radii ---

    @Property(int, constant=True)
    def radiusSm(self):
        return 6

    @Property(int, constant=True)
    def radiusMd(self):
        return 12

    @Property(int, constant=True)
    def radiusLg(self):
        return 18

    @Property(int, constant=True)
    def radiusXl(self):
        return 24

    @Property(int, constant=True)
    def radiusFull(self):
        return 9999

    # --- Layout ---

    @Property(int, constant=True)
    def sidebarWidth(self):
        return 380

    @Property(int, constant=True)
    def detailPanelWidth(self):
        return 340

    @Property(int, constant=True)
    def titlebarHeight(self):
        return 48

    @Property(int, constant=True)
    def inputBarHeight(self):
        return 62

    # --- Animation timing ---

    @Property(int, constant=True)
    def animFast(self):
        return 150

    @Property(int, constant=True)
    def animNormal(self):
        return 250

    @Property(int, constant=True)
    def animSlow(self):
        return 400
