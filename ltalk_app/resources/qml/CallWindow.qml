import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.background
    visible: false

    property string callId: ""
    property string callerName: ""
    property string callType: "voice"
    property real callDuration: 0

    signal acceptRequested()
    signal declineRequested()
    signal endRequested()

    // Overlay
    Rectangle {
        anchors.fill: parent
        color: Theme.overlay
    }

    // Call window
    Rectangle {
        anchors.centerIn: parent
        width: 320
        height: 480
        radius: Theme.radiusXl
        color: Theme.primaryDark

        ColumnLayout {
            anchors.fill: parent
            spacing: Theme.spacingXl

            Item { Layout.preferredHeight: Theme.spacingXl }

            // Caller avatar with pulse
            Item {
                Layout.alignment: Qt.AlignHCenter
                width: 120
                height: 120

                // Pulse rings
                Rectangle {
                    id: pulse1
                    anchors.centerIn: parent
                    width: 120
                    height: 120
                    radius: 60
                    color: "transparent"
                    border.color: Theme.primary
                    border.width: 3

                    SequentialAnimation on scale {
                        running: true
                        loops: Animation.Infinite
                        NumberAnimation { from: 1.0; to: 1.4; duration: 1000; easing.type: Easing.OutQuad }
                        NumberAnimation { from: 1.4; to: 1.0; duration: 1000; easing.type: Easing.InQuad }
                    }
                    SequentialAnimation on opacity {
                        running: true
                        loops: Animation.Infinite
                        NumberAnimation { from: 0.6; to: 0; duration: 1000 }
                        NumberAnimation { from: 0; to: 0.6; duration: 1000 }
                    }
                }

                Rectangle {
                    id: pulse2
                    anchors.centerIn: parent
                    width: 120
                    height: 120
                    radius: 60
                    color: "transparent"
                    border.color: Theme.primary
                    border.width: 3

                    SequentialAnimation on scale {
                        running: true
                        loops: Animation.Infinite
                        PauseAnimation { duration: 500 }
                        NumberAnimation { from: 1.0; to: 1.4; duration: 1000; easing.type: Easing.OutQuad }
                        NumberAnimation { from: 1.4; to: 1.0; duration: 1000; easing.type: Easing.InQuad }
                    }
                    SequentialAnimation on opacity {
                        running: true
                        loops: Animation.Infinite
                        PauseAnimation { duration: 500 }
                        NumberAnimation { from: 0.6; to: 0; duration: 1000 }
                        NumberAnimation { from: 0; to: 0.6; duration: 1000 }
                    }
                }

                Avatar {
                    anchors.centerIn: parent
                    width: 100
                    height: 100
                    initials: root.callerName ? root.callerName.charAt(0) : "?"
                }
            }

            // Caller name
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.callerName || "Unknown"
                font.pixelSize: Theme.fontSize2xl
                font.bold: true
                color: Theme.senderText
            }

            // Call type
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: root.callType === "video" ? "Video Call" : "Voice Call"
                font.pixelSize: Theme.fontSizeLg
                color: Qt.lighter(Theme.senderText, 0.7)
            }

            // Duration
            Text {
                Layout.alignment: Qt.AlignHCenter
                text: {
                    var mins = Math.floor(root.callDuration / 60)
                    var secs = Math.floor(root.callDuration % 60)
                    return mins.toString().padStart(2, "0") + ":" + secs.toString().padStart(2, "0")
                }
                font.pixelSize: Theme.fontSizeXl
                color: Theme.senderText
                visible: false // Only show during active call
            }

            Item { Layout.fillHeight: true }

            // Control buttons
            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: Theme.spacingXl

                // Decline button
                Rectangle {
                    width: 60; height: 60
                    radius: Theme.radiusFull
                    color: Theme.callDecline

                    Text {
                        anchors.centerIn: parent
                        text: "X"
                        font.pixelSize: Theme.fontSizeXl
                        font.bold: true
                        color: Theme.senderText
                    }

                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.declineRequested()
                    }
                }

                // Accept button
                Rectangle {
                    width: 60; height: 60
                    radius: Theme.radiusFull
                    color: Theme.callGreen

                    Text {
                        anchors.centerIn: parent
                        text: "V"
                        font.pixelSize: Theme.fontSizeXl
                        font.bold: true
                        color: Theme.senderText
                    }

                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.acceptRequested()
                    }
                }
            }

            Item { Layout.preferredHeight: Theme.spacingXl }
        }
    }
}
