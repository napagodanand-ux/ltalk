import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.surface

    signal chatSelected(string chatId)
    signal openDetail()

    property string activeChatId: ""
    property string activeChatName: ""
    property bool showNewChat: false
    property bool showContacts: false
    property bool showSettings: false
    property bool showCreateGroup: false
    property bool narrowMode: width < 768
    property bool sidebarVisible: true

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // Sidebar
        Sidebar {
            id: sidebar
            visible: root.sidebarVisible || !root.narrowMode
            Layout.preferredWidth: root.narrowMode ? root.width : Theme.sidebarWidth
            Layout.fillHeight: true
            selectedChatId: root.activeChatId

            onChatSelected: (chatId) => {
                root.activeChatId = chatId
                // Get display name from model
                for (var i = 0; i < chatListModel.rowCount(); i++) {
                    var idx = chatListModel.index(i, 0)
                    if (chatListModel.data(idx, chatListModel.ChatId) === chatId) {
                        root.activeChatName = chatListModel.data(idx, chatListModel.DisplayName) || ""
                        break
                    }
                }
                chatView.chatId = chatId
                chatView.chatName = root.activeChatName
                backend.openChat(chatId)
                if (root.narrowMode) root.sidebarVisible = false
            }

            onNewChatRequested: root.showNewChat = true
            onSettingsRequested: root.showSettings = true
            onNewGroupRequested: root.showCreateGroup = true
        }

        // Divider
        Rectangle {
            visible: !root.narrowMode || root.sidebarVisible
            Layout.preferredWidth: 1
            Layout.fillHeight: true
            color: Theme.divider
        }

        // Chat view
        ChatView {
            id: chatView
            visible: !root.narrowMode || !root.sidebarVisible
            Layout.fillWidth: true
            Layout.fillHeight: true
            chatId: root.activeChatId
            chatName: root.activeChatName

            onOpenDetail: detailPanel.visible = true
            onBackRequested: root.sidebarVisible = true
        }

        // Detail panel (slides in)
        DetailPanel {
            id: detailPanel
            visible: false
            Layout.preferredWidth: Theme.detailPanelWidth
            Layout.fillHeight: true
            chatId: root.activeChatId

            onCloseRequested: visible = false
        }
    }

    // New Chat overlay
    NewChatPage {
        id: newChatPage
        anchors.fill: parent
        visible: root.showNewChat
        onCloseRequested: root.showNewChat = false
        onChatCreated: (chatId) => {
            root.showNewChat = false
        }
    }

    // Contacts overlay
    ContactsPage {
        id: contactsPage
        anchors.fill: parent
        visible: root.showContacts
        onCloseRequested: root.showContacts = false
        onChatRequested: (chatId) => {
            root.showContacts = false
        }
    }

    // Settings overlay
    SettingsScreen {
        id: settingsScreen
        anchors.fill: parent
        visible: root.showSettings
        onCloseRequested: root.showSettings = false
    }

    // Create Group overlay
    CreateGroupPage {
        id: createGroupPage
        anchors.fill: parent
        visible: root.showCreateGroup
        onCloseRequested: root.showCreateGroup = false
        onGroupCreated: (chatId) => {
            root.showCreateGroup = false
        }
    }
}
