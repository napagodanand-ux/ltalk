import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Rectangle {
    id: root
    color: Theme.background
    visible: false

    property string statusId: ""
    property string content: ""
    property string backgroundColor: "#A52A2A"
    property real createdAt: 0
    property string userId: ""

    signal closeRequested()

    // Overlay
    Rectangle {
        anchors.fill: parent
        color: Theme.overlay
        MouseArea {
            anchors.fill: parent
            onClicked: root.closeRequested()
        }
    }

    // Status content
    Rectangle {
        anchors.centerIn: parent
        width: 400
        height: 700
        radius: Theme.radiusXl
        color: root.backgroundColor
        clip: true

        ColumnLayout {
            anchors.fill: parent
            spacing: 0

            // Header
            RowLayout {
                Layout.fillWidth: true
                Layout.preferredHeight: 60
                Layout.leftMargin: Theme.spacingLg
                Layout.rightMargin: Theme.spacingLg

                Avatar {
                    width: 40
                    height: 40
                    initials: root.userId ? root.userId.charAt(0).toUpperCase() : "?"
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0

                    Text {
                        text: root.userId
                        font.pixelSize: Theme.fontSizeLg
                        font.bold: true
                        color: Theme.senderText
                    }

                    Text {
                        text: {
                            if (!root.createdAt) return ""
                            var d = new Date(root.createdAt * 1000)
                            return Qt.formatDateTime(d, "MMM dd, HH:mm")
                        }
                        font.pixelSize: Theme.fontSizeXs
                        color: Qt.lighter(Theme.senderText, 0.7)
                    }
                }

                Text {
                    text: "X"
                    font.pixelSize: Theme.fontSizeXl
                    color: Theme.senderText

                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.closeRequested()
                    }
                }
            }

            // Status text
            Item {
                Layout.fillWidth: true
                Layout.fillHeight: true

                Text {
                    anchors.centerIn: parent
                    width: parent.width - Theme.spacing2xl * 2
                    text: root.content
                    font.pixelSize: Theme.fontSize2xl
                    color: Theme.senderText
                    wrapMode: Text.Wrap
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
            }

            // Progress bar
            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 4
                Layout.leftMargin: Theme.spacingLg
                Layout.rightMargin: Theme.spacingLg
                color: Qt.lighter(Theme.senderText, 0.5)
                radius: 2

                Rectangle {
                    width: parent.width * 0.3
                    height: parent.height
                    radius: 2
                    color: Theme.senderText

                    SequentialAnimation on width {
                        running: root.visible
                        loops: Animation.Infinite
                        NumberAnimation { from: 0; to: parent.width; duration: 5000 }
                    }
                }
            }
        }
    }
}
