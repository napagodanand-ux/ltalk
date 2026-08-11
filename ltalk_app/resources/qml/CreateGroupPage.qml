import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.background

    signal closeRequested()
    signal groupCreated(string chatId)

    property string groupName: ""
    property var selectedMembers: []
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

    function isSelected(userId) {
        for (var i = 0; i < root.selectedMembers.length; i++) {
            if (root.selectedMembers[i].id === userId) return true
        }
        return false
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
                    text: "New Group"
                    color: Theme.senderText
                    font.pixelSize: Theme.fontSizeLg
                    font.bold: true
                }

                Item { Layout.fillWidth: true }

                Text {
                    text: "Create"
                    font.pixelSize: Theme.fontSizeMd
                    font.bold: true
                    color: root.selectedMembers.length > 0 && root.groupName.length > 0 ? Theme.senderText : Qt.lighter(Theme.senderText, 0.5)
                    MouseArea {
                        anchors.fill: parent
                        enabled: root.selectedMembers.length > 0 && root.groupName.length > 0
                        onClicked: {
                            var memberIds = []
                            for (var i = 0; i < root.selectedMembers.length; i++) {
                                memberIds.push(root.selectedMembers[i].id)
                            }
                            backend.createGroup(root.groupName, JSON.stringify(memberIds))
                            root.closeRequested()
                        }
                    }
                }
            }
        }

        // Group name input
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 60
            color: Theme.surface

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Theme.spacingMd
                anchors.rightMargin: Theme.spacingMd
                spacing: Theme.spacingMd

                Avatar {
                    Layout.preferredWidth: 44
                    Layout.preferredHeight: 44
                    initials: root.groupName ? root.groupName.charAt(0) : "G"
                    showOnlineDot: false
                }

                TextField {
                    id: groupNameField
                    Layout.fillWidth: true
                    placeholderText: "Group name"
                    font.pixelSize: Theme.fontSizeMd
                    color: Theme.textPrimary
                    background: Rectangle {
                        color: "transparent"
                    }
                    onTextChanged: root.groupName = text
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Selected members chips
        Rectangle {
            visible: root.selectedMembers.length > 0
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            color: Theme.surface

            ListView {
                anchors.fill: parent
                anchors.margins: Theme.spacingSm
                orientation: ListView.Horizontal
                spacing: Theme.spacingSm
                model: root.selectedMembers

                delegate: Rectangle {
                    height: 32
                    width: chipText.width + 40
                    radius: 16
                    color: Theme.primaryWash

                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: Theme.spacingSm
                        anchors.rightMargin: Theme.spacingSm
                        spacing: 4

                        Text {
                            id: chipText
                            text: modelData.display_name || "Unknown"
                            font.pixelSize: Theme.fontSizeSm
                            color: Theme.primary
                        }

                        Text {
                            text: "X"
                            font.pixelSize: Theme.fontSizeSm
                            color: Theme.primary
                            MouseArea {
                                anchors.fill: parent
                                onClicked: {
                                    var newArr = []
                                    for (var i = 0; i < root.selectedMembers.length; i++) {
                                        if (root.selectedMembers[i].id !== modelData.id) {
                                            newArr.push(root.selectedMembers[i])
                                        }
                                    }
                                    root.selectedMembers = newArr
                                }
                            }
                        }
                    }
                }
            }
        }

        Rectangle {
            visible: root.selectedMembers.length > 0
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Search input
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 50
            color: Theme.surface

            Components.SearchBar {
                anchors.fill: parent
                anchors.margins: Theme.spacingSm
                searchPlaceholder: "Search members..."
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
                height: 60
                color: memberMouse.containsMouse ? Theme.hover : Theme.surface

                property bool memberSelected: root.isSelected(modelData.id || "")

                MouseArea {
                    id: memberMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: {
                        var userId = modelData.id || ""
                        if (!userId) return

                        if (root.isSelected(userId)) {
                            // Remove
                            var newArr = []
                            for (var i = 0; i < root.selectedMembers.length; i++) {
                                if (root.selectedMembers[i].id !== userId) {
                                    newArr.push(root.selectedMembers[i])
                                }
                            }
                            root.selectedMembers = newArr
                        } else {
                            // Add
                            var arr = root.selectedMembers.slice()
                            arr.push({id: userId, display_name: modelData.display_name || "Unknown"})
                            root.selectedMembers = arr
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

                    Text {
                        Layout.fillWidth: true
                        text: modelData.display_name || "Unknown"
                        font.pixelSize: Theme.fontSizeMd
                        font.bold: true
                        color: Theme.textPrimary
                        elide: Text.ElideRight
                    }

                    Rectangle {
                        width: 24; height: 24
                        radius: 12
                        border.color: memberSelected ? Theme.primary : Theme.divider
                        border.width: 2
                        color: memberSelected ? Theme.primary : "transparent"

                        Text {
                            anchors.centerIn: parent
                            text: memberSelected ? "\u2713" : ""
                            color: Theme.senderText
                            font.pixelSize: Theme.fontSizeSm
                            font.bold: true
                        }
                    }
                }
            }

            // Empty state
            Text {
                anchors.centerIn: parent
                visible: root.searchResults.length === 0
                text: "Search for people to add to the group"
                font.pixelSize: Theme.fontSizeMd
                color: Theme.textSecondary
            }
        }
    }
}
