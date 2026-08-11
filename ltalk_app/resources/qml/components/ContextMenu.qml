import QtQuick 2.15
import QtQuick.Controls 2.15

Menu {
    id: root

    property var menuItems: []

    background: Rectangle {
        implicitWidth: 180
        implicitHeight: contentColumn.height + Theme.spacingSm * 2
        color: Theme.surface
        radius: Theme.radiusSm
        border.color: Theme.divider
        border.width: 1

        Column {
            id: contentColumn
            anchors.fill: parent
            anchors.margins: Theme.spacingSm

            Repeater {
                model: root.menuItems

                Rectangle {
                    width: contentColumn.width
                    height: 36
                    radius: Theme.radiusSm
                    color: itemMouse.containsMouse ? Theme.hover : "transparent"

                    Text {
                        anchors.left: parent.left
                        anchors.leftMargin: Theme.spacingMd
                        anchors.verticalCenter: parent.verticalCenter
                        text: modelData.text || ""
                        font.pixelSize: Theme.fontSizeMd
                        color: modelData.danger ? Theme.error : Theme.textPrimary
                    }

                    MouseArea {
                        id: itemMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        onClicked: {
                            if (modelData.action) modelData.action()
                            root.close()
                        }
                    }
                }
            }
        }
    }
}
