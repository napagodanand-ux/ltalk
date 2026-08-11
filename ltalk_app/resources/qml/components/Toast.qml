import QtQuick 2.15

Rectangle {
    id: root
    width: 200
    height: 40
    radius: Theme.radiusMd
    color: Theme.primaryDark
    opacity: 0

    property string message: ""
    property string type: "info" // info, error, success

    function show(msg, msgType) {
        message = msg
        type = msgType || "info"
        color = type === "error" ? Theme.error : Theme.primaryDark
        opacity = 1
        hideTimer.start()
    }

    Timer {
        id: hideTimer
        interval: 3000
        onTriggered: root.opacity = 0
    }

    Text {
        anchors.centerIn: parent
        text: root.message
        font.pixelSize: Theme.fontSizeMd
        color: Theme.senderText
        width: parent.width - Theme.spacingLg * 2
        horizontalAlignment: Text.AlignHCenter
        wrapMode: Text.Wrap
    }

    Behavior on opacity {
        NumberAnimation { duration: Theme.animNormal }
    }
}
