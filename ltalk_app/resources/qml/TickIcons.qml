import QtQuick 2.15

Row {
    id: root
    spacing: 2

    property string status: "sent"

    Repeater {
        model: root.status === "read" || root.status === "delivered" ? 2 : 1

        Text {
            text: "V"
            font.pixelSize: 10
            font.bold: true
            color: root.status === "read" ? Theme.tickRead : Theme.tick
            rotation: 45
        }
    }
}
