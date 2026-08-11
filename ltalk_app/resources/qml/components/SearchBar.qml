import QtQuick 2.15
import QtQuick.Controls 2.15

Rectangle {
    id: root
    color: Theme.surface
    radius: Theme.radiusMd

    property string searchPlaceholder: "Search..."

    signal searchChanged(string query)

    TextField {
        id: searchField
        anchors.left: parent.left
        anchors.right: clearButton.left
        anchors.verticalCenter: parent.verticalCenter
        anchors.leftMargin: Theme.spacingMd
        placeholderText: root.searchPlaceholder
        font.pixelSize: Theme.fontSizeMd
        color: Theme.textPrimary
        background: Rectangle {
            radius: Theme.radiusSm
            color: Theme.primaryWash
            border.color: searchField.activeFocus ? Theme.primary : Theme.divider
            border.width: 1
        }
        leftPadding: Theme.spacingMd
        onTextChanged: root.searchChanged(text)
    }

    Rectangle {
        id: clearButton
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        anchors.rightMargin: Theme.spacingSm
        width: 24
        height: 24
        radius: Theme.radiusFull
        color: clearMouse.containsMouse ? Theme.hover : "transparent"
        visible: searchField.text.length > 0

        Text {
            anchors.centerIn: parent
            text: "X"
            font.pixelSize: Theme.fontSizeSm
            color: Theme.textSecondary
        }

        MouseArea {
            id: clearMouse
            anchors.fill: parent
            hoverEnabled: true
            onClicked: searchField.text = ""
        }
    }
}
