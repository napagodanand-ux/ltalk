import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.background

    signal closeRequested()
    signal chatCreated(string chatId)

    property var searchResults: []

    Connections {
        target: backend
        function onSearchResults(resultsJson) {
            try {
                root.searchResults = JSON.parse(resultsJson)
            } catch(e) {
                root.searchResults = []
            }
        }
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
                    text: "New Chat"
                    color: Theme.senderText
                    font.pixelSize: Theme.fontSizeLg
                    font.bold: true
                }
            }
        }

        // Search input
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            color: Theme.surface

            Components.SearchBar {
                anchors.fill: parent
                anchors.margins: Theme.spacingSm
                searchPlaceholder: "Search by name..."
                onSearchChanged: (query) => {
                    if (query.length >= 2) {
                        backend.searchUsers(query)
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Results list
        ListView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            model: root.searchResults

            delegate: Rectangle {
                width: parent ? parent.width : 0
                height: 64
                color: delegateMouse.containsMouse ? Theme.hover : Theme.surface

                MouseArea {
                    id: delegateMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: {
                        var userId = modelData.id || ""
                        if (userId) {
                            backend.createChat(userId)
                            root.closeRequested()
                        }
                    }
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: Theme.spacingMd
                    anchors.rightMargin: Theme.spacingMd
                    spacing: Theme.spacingMd

                    Avatar {
                        Layout.preferredWidth: 40
                        Layout.preferredHeight: 40
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
                            text: modelData.about || ""
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
                visible: root.searchResults.length === 0
                text: "Search for users to start a chat"
                font.pixelSize: Theme.fontSizeMd
                color: Theme.textSecondary
            }
        }
    }
}
