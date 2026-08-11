import QtQuick 2.15
import QtQuick.Controls 2.15

Button {
    id: root
    property string buttonText: text

    background: Rectangle {
        radius: Theme.radiusMd
        color: root.pressed ? Theme.primaryDark :
               root.hovered ? Theme.primaryLight : Theme.primary

        Behavior on color {
            ColorAnimation { duration: Theme.animFast }
        }

        // Ripple effect
        Rectangle {
            id: ripple
            radius: parent.radius
            anchors.centerIn: parent
            width: 0; height: 0
            color: "#33FFFFFF"
            visible: false
        }

        ParallelAnimation {
            id: rippleAnim
            NumberAnimation { target: ripple; property: "width"; from: 0; to: parent.width * 3; duration: 400 }
            NumberAnimation { target: ripple; property: "height"; from: 0; to: parent.width * 3; duration: 400 }
            NumberAnimation { target: ripple; property: "opacity"; from: 0.3; to: 0; duration: 400 }
        }
    }

    contentItem: Text {
        text: root.text
        font.pixelSize: Theme.fontSizeLg
        font.bold: true
        color: Theme.senderText
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
    }

    onClicked: {
        ripple.visible = true
        rippleAnim.start()
    }

    leftPadding: Theme.spacingXl
    rightPadding: Theme.spacingXl
    topPadding: Theme.spacingMd
    bottomPadding: Theme.spacingMd
}
