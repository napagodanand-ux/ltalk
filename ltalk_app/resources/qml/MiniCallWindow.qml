import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Rectangle {
    id: root
    width: 300
    height: 200
    radius: Theme.radiusMd
    color: Theme.primaryDark
    visible: false

    property string callId: ""
    property string callerName: ""
    property string callType: "voice"
    property real callDuration: 0

    signal endRequested()
    signal maximizeRequested()

    ColumnLayout {
        anchors.fill: parent
        spacing: Theme.spacingSm

        // Header with drag area
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 30
            color: "transparent"

            MouseArea {
                anchors.fill: parent
                property real lastX: 0
                property real lastY: 0
                onPressed: {
                    lastX = mouseX
                    lastY = mouseY
                }
                onPositionChanged: {
                    root.x += mouseX - lastX
                    root.y += mouseY - lastY
                }
            }

            Text {
                anchors.centerIn: parent
                text: "Call in progress"
                font.pixelSize: Theme.fontSizeSm
                color: Theme.senderText
            }
        }

        // Avatar and info
        RowLayout {
            Layout.fillWidth: true
            Layout.leftMargin: Theme.spacingMd
            Layout.rightMargin: Theme.spacingMd
            spacing: Theme.spacingMd

            Avatar {
                width: 40
                height: 40
                initials: root.callerName ? root.callerName.charAt(0) : "?"
            }

            ColumnLayout {
                Layout.fillWidth: true
                spacing: 0

                Text {
                    text: root.callerName
                    font.pixelSize: Theme.fontSizeMd
                    font.bold: true
                    color: Theme.senderText
                    elide: Text.ElideRight
                }

                Text {
                    text: {
                        var mins = Math.floor(root.callDuration / 60)
                        var secs = Math.floor(root.callDuration % 60)
                        return mins.toString().padStart(2, "0") + ":" + secs.toString().padStart(2, "0")
                    }
                    font.pixelSize: Theme.fontSizeXs
                    color: Qt.lighter(Theme.senderText, 0.7)
                }
            }
        }

        // Controls
        RowLayout {
            Layout.fillWidth: true
            Layout.leftMargin: Theme.spacingMd
            Layout.rightMargin: Theme.spacingMd
            spacing: Theme.spacingSm

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 36
                radius: Theme.radiusSm
                color: Theme.callDecline

                Text {
                    anchors.centerIn: parent
                    text: "End"
                    font.pixelSize: Theme.fontSizeSm
                    font.bold: true
                    color: Theme.senderText
                }

                MouseArea {
                    anchors.fill: parent
                    onClicked: root.endRequested()
                }
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 36
                radius: Theme.radiusSm
                color: Qt.lighter(Theme.primaryDark, 1.2)

                Text {
                    anchors.centerIn: parent
                    text: "Maximize"
                    font.pixelSize: Theme.fontSizeSm
                    color: Theme.senderText
                }

                MouseArea {
                    anchors.fill: parent
                    onClicked: root.maximizeRequested()
                }
            }
        }
    }
}
