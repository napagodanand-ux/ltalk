import QtQuick 2.15

Item {
    id: root
    width: 8
    height: 8

    property bool isTyping: false

    Row {
        spacing: 4
        anchors.centerIn: parent

        Repeater {
            model: 3

            Rectangle {
                width: 6
                height: 6
                radius: 3
                color: Theme.primary

                SequentialAnimation on y {
                    running: root.isTyping
                    loops: Animation.Infinite
                    PauseAnimation { duration: index * 150 }
                    NumberAnimation { to: -8; duration: 300; easing.type: Easing.OutQuad }
                    NumberAnimation { to: 0; duration: 300; easing.type: Easing.InQuad }
                    PauseAnimation { duration: 600 }
                }
            }
        }
    }
}
