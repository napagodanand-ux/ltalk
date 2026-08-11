import QtQuick 2.15
import QtQuick.Controls 2.15

TextField {
    id: root
    property string placeholder: placeholderText

    background: Rectangle {
        id: bg
        radius: Theme.radiusMd
        color: Theme.primaryWash
        property color borderColor: root.activeFocus ? Theme.primary : Theme.divider
        property int borderWidth: root.activeFocus ? 2 : 1

        border.color: borderColor
        border.width: borderWidth

        Behavior on borderColor {
            ColorAnimation { duration: Theme.animFast }
        }
    }

    placeholderTextColor: Theme.textSecondary
    color: Theme.textPrimary
    font.pixelSize: Theme.fontSizeLg
    leftPadding: Theme.spacingLg
    rightPadding: Theme.spacingLg
    topPadding: Theme.spacingMd
    bottomPadding: Theme.spacingMd

    verticalAlignment: TextInput.AlignVCenter
}
