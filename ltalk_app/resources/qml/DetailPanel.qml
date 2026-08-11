import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Rectangle {
    id: root
    color: Theme.surface
    visible: false

    property string chatId: ""
    property string blockUserId: ""

    signal closeRequested()

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Header
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Theme.titlebarHeight
            color: Theme.surface

            Rectangle {
                anchors.bottom: parent.bottom
                width: parent.width
                height: 1
                color: Theme.divider
            }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Theme.spacingLg
                anchors.rightMargin: Theme.spacingLg

                Text {
                    text: "<"
                    font.pixelSize: Theme.fontSizeXl
                    color: Theme.primary
                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.closeRequested()
                    }
                }

                Text {
                    Layout.fillWidth: true
                    text: "Contact Info"
                    font.pixelSize: Theme.fontSizeXl
                    font.bold: true
                    color: Theme.textPrimary
                    leftPadding: Theme.spacingMd
                }
            }
        }

        // Avatar and name
        Item {
            Layout.fillWidth: true
            Layout.preferredHeight: 160

            Avatar {
                anchors.centerIn: parent
                width: 100
                height: 100
                initials: "?"
            }
        }

        // Info sections
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Media
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            color: Theme.surface

            MouseArea {
                anchors.fill: parent
                onClicked: {}
            }

            Text {
                anchors.left: parent.left
                anchors.verticalCenter: parent.verticalCenter
                anchors.leftMargin: Theme.spacingLg
                text: "Media, Links, and Docs"
                font.pixelSize: Theme.fontSizeMd
                color: Theme.textPrimary
            }

            Text {
                anchors.right: parent.right
                anchors.verticalCenter: parent.verticalCenter
                anchors.rightMargin: Theme.spacingLg
                text: ">"
                font.pixelSize: Theme.fontSizeLg
                color: Theme.textSecondary
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Mute
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            color: Theme.surface

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Theme.spacingLg
                anchors.rightMargin: Theme.spacingLg

                Text {
                    text: "Mute Notifications"
                    font.pixelSize: Theme.fontSizeMd
                    color: Theme.textPrimary
                    Layout.fillWidth: true
                }

                Switch {
                    onToggled: backend.toggleMuteChat(root.chatId)
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Clear chat
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            color: Theme.surface

            MouseArea {
                anchors.fill: parent
                onClicked: backend.deleteChat(root.chatId)
            }

            Text {
                anchors.centerIn: parent
                text: "Clear Chat"
                font.pixelSize: Theme.fontSizeMd
                color: Theme.error
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Block
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            color: Theme.surface

            MouseArea {
                anchors.fill: parent
                onClicked: {
                    if (root.blockUserId) {
                        backend.blockUser(root.blockUserId)
                    }
                }
            }

            Text {
                anchors.centerIn: parent
                text: "Block Contact"
                font.pixelSize: Theme.fontSizeMd
                color: Theme.error
            }
        }

        Item { Layout.fillHeight: true }
    }
}
