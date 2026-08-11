import QtQuick 2.15

Rectangle {
    id: root
    width: 48
    height: 48
    radius: Theme.radiusFull
    color: Theme.primary

    property string initials: "?"
    property string avatarUrl: ""
    property bool showOnlineDot: false
    property bool hasStatus: false

    // Image avatar (shown when avatarUrl is set)
    Image {
        id: avatarImage
        anchors.fill: parent
        source: root.avatarUrl ? root.avatarUrl : ""
        fillMode: Image.PreserveAspectCrop
        visible: root.avatarUrl !== "" && status === Image.Ready
        asynchronous: true
        clip: true

        // Circular mask
        layer.enabled: true
        layer.effect: null
    }

    // Fallback text initials (shown when no image)
    Text {
        anchors.centerIn: parent
        text: root.initials.toUpperCase()
        font.pixelSize: Theme.fontSizeXl
        font.bold: true
        color: Theme.senderText
        visible: !avatarImage.visible
    }

    // Status ring
    Canvas {
        id: statusRing
        anchors.fill: parent
        visible: root.hasStatus
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()
        Connections {
            target: Theme
            function onPrimaryChanged() { statusRing.requestPaint() }
        }
        onPaint: {
            var ctx = getContext("2d")
            ctx.clearRect(0, 0, width, height)
            ctx.strokeStyle = Theme.primary
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(width/2, height/2, width/2 - 2, 0, Math.PI * 2)
            ctx.stroke()
        }
    }

    // Online dot
    Rectangle {
        id: onlineDot
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        width: 12
        height: 12
        radius: 6
        color: Theme.online
        visible: root.showOnlineDot
        border.color: Theme.surface
        border.width: 2
    }
}
