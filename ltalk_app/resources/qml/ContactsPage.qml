import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.background

    signal closeRequested()
    signal chatRequested(string chatId)

    property var contacts: []

    function loadContacts() {
        // Contacts are loaded via backend signals
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Header
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Theme.titlebarHeight
            color: Theme.primary

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Theme.spacingLg
                anchors.rightMargin: Theme.spacingLg

                Text {
                    text: "\u2190"
                    font.pixelSize: Theme.fontSizeXl
                    color: Theme.senderText
                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.closeRequested()
                    }
                }

                Text {
                    text: "Contacts"
                    color: Theme.senderText
                    font.pixelSize: Theme.fontSizeLg
                    font.bold: true
                }

                Item { Layout.fillWidth: true }

                Text {
                    text: "+"
                    font.pixelSize: Theme.fontSizeXl
                    font.bold: true
                    color: Theme.senderText
                    MouseArea {
                        anchors.fill: parent
                        onClicked: newChatPage.visible = true
                    }
                }
            }
        }

        // Search
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            color: Theme.surface

            Components.SearchBar {
                anchors.fill: parent
                anchors.margins: Theme.spacingSm
                searchPlaceholder: "Search contacts..."
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Contacts list
        ListView {
            id: contactsList
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true

            delegate: Rectangle {
                width: contactsList.width
                height: 64
                color: contactMouse.containsMouse ? Theme.hover : Theme.surface

                property string contactUserId: modelData.user_id || ""

                MouseArea {
                    id: contactMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: {
                        if (contactUserId) {
                            backend.createChat(contactUserId)
                            root.chatRequested(contactUserId)
                        }
                    }
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: Theme.spacingMd
                    anchors.rightMargin: Theme.spacingMd
                    spacing: Theme.spacingMd

                    Avatar {
                        Layout.preferredWidth: 44
                        Layout.preferredHeight: 44
                        initials: modelData.display_name ? modelData.display_name.charAt(0) : "?"
                        showOnlineDot: false
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2

                        Text {
                            text: modelData.display_name || "Unknown"
                            font.pixelSize: Theme.fontSizeMd
                            font.bold: true
                            color: Theme.textPrimary
                            elide: Text.ElideRight
                        }

                        Text {
                            text: modelData.about || "No about info"
                            font.pixelSize: Theme.fontSizeSm
                            color: Theme.textSecondary
                            elide: Text.ElideRight
                            maximumLineCount: 1
                        }
                    }
                }
            }

            // Empty state
            Text {
                anchors.centerIn: parent
                visible: contactsList.count === 0
                text: "No contacts yet.\nTap + to add someone."
                font.pixelSize: Theme.fontSizeMd
                color: Theme.textSecondary
                horizontalAlignment: Text.AlignHCenter
            }
        }
    }
}
