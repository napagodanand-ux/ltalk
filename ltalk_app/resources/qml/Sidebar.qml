import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.background

    property bool searchActive: false
    property string selectedChatId: ""

    signal chatSelected(string chatId)
    signal newChatRequested()
    signal newGroupRequested()
    signal settingsRequested()

    property bool showStatusViewer: false
    property var currentStatus: null

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Title bar
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: Theme.titlebarHeight
            color: Theme.primary

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Theme.spacingLg
                anchors.rightMargin: Theme.spacingLg

                Text {
                    text: "LTalk"
                    color: Theme.senderText
                    font.pixelSize: Theme.fontSizeXl
                    font.bold: true
                }

                Item { Layout.fillWidth: true }

                // Theme toggle
                Rectangle {
                    width: 32; height: 32
                    radius: Theme.radiusFull
                    color: Theme.primaryDark

                    Text {
                        anchors.centerIn: parent
                        text: Theme.isDark ? "D" : "L"
                        color: Theme.senderText
                        font.pixelSize: Theme.fontSizeSm
                        font.bold: true
                    }

                    MouseArea {
                        anchors.fill: parent
                        onClicked: Theme.isDark = !Theme.isDark
                    }
                }

                // New chat button
                Rectangle {
                    width: 32; height: 32
                    radius: Theme.radiusFull
                    color: Theme.primaryDark

                    Text {
                        anchors.centerIn: parent
                        text: "+"
                        color: Theme.senderText
                        font.pixelSize: Theme.fontSizeLg
                        font.bold: true
                    }

                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.newChatRequested()
                    }
                }

                // New group button
                Rectangle {
                    width: 32; height: 32
                    radius: Theme.radiusFull
                    color: groupMouse.containsMouse ? Theme.primaryDark : "transparent"

                    Text {
                        anchors.centerIn: parent
                        text: "G"
                        color: Theme.senderText
                        font.pixelSize: Theme.fontSizeSm
                        font.bold: true
                    }

                    MouseArea {
                        id: groupMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        onClicked: root.newGroupRequested()
                    }
                }

                // Settings button
                Rectangle {
                    width: 32; height: 32
                    radius: Theme.radiusFull
                    color: settingsMouse.containsMouse ? Theme.primaryDark : "transparent"

                    Text {
                        anchors.centerIn: parent
                        text: "\u2699"
                        color: Theme.senderText
                        font.pixelSize: Theme.fontSizeLg
                    }

                    MouseArea {
                        id: settingsMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        onClicked: root.settingsRequested()
                    }
                }
            }
        }

        // Search bar
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: root.searchActive ? 50 : 0
            color: Theme.surface
            clip: true

            Behavior on Layout.preferredHeight {
                NumberAnimation { duration: Theme.animNormal }
            }

            Components.SearchBar {
                anchors.fill: parent
                anchors.margins: Theme.spacingSm
                visible: root.searchActive
                searchPlaceholder: "Search chats..."
                onSearchChanged: (query) => chatListModel.search(query)
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Status carousel
        StatusCarousel {
            Layout.fillWidth: true
            Layout.preferredHeight: 90
            onStatusClicked: (statusId) => {
                // Find status in model
                for (var i = 0; i < statusModel.rowCount(); i++) {
                    var idx = statusModel.index(i, 0)
                    if (statusModel.data(idx, statusModel.StatusId) === statusId) {
                        root.currentStatus = {
                            statusId: statusId,
                            content: statusModel.data(idx, statusModel.Content),
                            backgroundColor: statusModel.data(idx, statusModel.BackgroundColor),
                            createdAt: statusModel.data(idx, statusModel.CreatedAt),
                            userId: statusModel.data(idx, statusModel.DisplayName),
                        }
                        root.showStatusViewer = true
                        break
                    }
                }
            }
        }

        // Chat list
        ListView {
            id: chatListView
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            model: chatListModel

            delegate: Rectangle {
                width: chatListView.width
                height: 72
                color: model.chatId === root.selectedChatId ? Theme.active :
                       chatMouse.containsMouse ? Theme.hover : Theme.surface

                MouseArea {
                    id: chatMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: {
                        root.selectedChatId = model.chatId
                        root.chatSelected(model.chatId)
                    }
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: Theme.spacingMd
                    anchors.rightMargin: Theme.spacingMd
                    spacing: Theme.spacingMd

                    Avatar {
                        Layout.preferredWidth: 48
                        Layout.preferredHeight: 48
                        initials: model.displayName ? model.displayName.charAt(0) : "?"
                        showOnlineDot: model.isOnline
                        hasStatus: false
                    }

                    ColumnLayout {
                        Layout.fillWidth: true
                        spacing: 2

                        RowLayout {
                            Text {
                                Layout.fillWidth: true
                                text: model.displayName || "Unknown"
                                font.pixelSize: Theme.fontSizeLg
                                font.bold: model.unreadCount > 0
                                color: Theme.textPrimary
                                elide: Text.ElideRight
                            }

                            Text {
                                text: {
                                    if (!model.lastMessageTime) return ""
                                    var d = new Date(model.lastMessageTime * 1000)
                                    var now = new Date()
                                    if (d.toDateString() === now.toDateString()) {
                                        return Qt.formatTime(d, "HH:mm")
                                    }
                                    return Qt.formatDate(d, "MM/dd")
                                }
                                font.pixelSize: Theme.fontSizeXs
                                color: model.unreadCount > 0 ? Theme.primary : Theme.textSecondary
                            }
                        }

                        RowLayout {
                            Text {
                                Layout.fillWidth: true
                                text: model.lastMessage || ""
                                font.pixelSize: Theme.fontSizeSm
                                color: Theme.textSecondary
                                elide: Text.ElideRight
                                maximumLineCount: 1
                            }

                            // Unread badge
                            Rectangle {
                                visible: model.unreadCount > 0
                                width: Math.max(20, unreadText.width + 12)
                                height: 20
                                radius: Theme.radiusFull
                                color: Theme.primary

                                Text {
                                    id: unreadText
                                    anchors.centerIn: parent
                                    text: model.unreadCount > 99 ? "99+" : model.unreadCount
                                    font.pixelSize: Theme.fontSizeXs
                                    font.bold: true
                                    color: Theme.senderText
                                }
                            }

                            // Mute icon
                            Text {
                                visible: model.isMuted
                                text: "M"
                                font.pixelSize: Theme.fontSizeXs
                                color: Theme.textSecondary
                            }
                        }
                    }
                }

                // Context menu
                MouseArea {
                    anchors.fill: parent
                    acceptedButtons: Qt.RightButton
                    onClicked: (mouse) => contextMenu.popup()
                }

                Menu {
                    id: contextMenu
                    MenuItem {
                        text: model.isMuted ? "Unmute" : "Mute"
                        onTriggered: backend.toggleMuteChat(model.chatId)
                    }
                    MenuItem {
                        text: model.isPinned ? "Unpin" : "Pin"
                        onTriggered: {} // TODO
                    }
                    MenuItem {
                        text: model.isArchived ? "Unarchive" : "Archive"
                        onTriggered: backend.toggleArchiveChat(model.chatId)
                    }
                    MenuItem {
                        text: "Delete"
                        onTriggered: backend.deleteChat(model.chatId)
                    }
                }
            }
        }
    }

    // Status viewer overlay (outside ColumnLayout to avoid layout conflicts)
    StatusViewer {
        id: statusViewer
        anchors.fill: parent
        visible: root.showStatusViewer
        statusId: root.currentStatus ? root.currentStatus.statusId : ""
        content: root.currentStatus ? root.currentStatus.content : ""
        backgroundColor: root.currentStatus ? root.currentStatus.backgroundColor : "#A52A2A"
        createdAt: root.currentStatus ? root.currentStatus.createdAt : 0
        userId: root.currentStatus ? root.currentStatus.userId : ""
        onCloseRequested: root.showStatusViewer = false
    }
}
