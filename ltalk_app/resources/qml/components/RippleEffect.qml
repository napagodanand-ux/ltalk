import QtQuick 2.15

Item {
    id: root
    width: parent ? parent.width : 0
    height: parent ? parent.height : 0

    property real startX: 0
    property real startY: 0

    Canvas {
        id: rippleCanvas
        anchors.fill: parent
        visible: false

        onPaint: {
            var ctx = getContext("2d")
            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = Qt.rgba(1, 1, 1, 0.3)
            ctx.beginPath()
            ctx.arc(root.startX, root.startY, radius, 0, Math.PI * 2)
            ctx.fill()
        }

        property real radius: 0
    }

    NumberAnimation {
        id: rippleAnim
        target: rippleCanvas
        property: "radius"
        from: 0
        to: Math.max(root.width, root.height)
        duration: 400
        easing.type: Easing.OutQuad

        onRunningChanged: {
            if (!running) {
                rippleCanvas.visible = false
                rippleCanvas.radius = 0
            }
        }
    }

    function start(x, y) {
        root.startX = x
        root.startY = y
        rippleCanvas.visible = true
        rippleAnim.start()
    }
}
