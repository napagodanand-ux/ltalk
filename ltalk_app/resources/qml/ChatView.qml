import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.surface

    property string chatId: ""
    property string chatName: ""
    property bool isGroup: false

    signal backRequested()
    signal openDetail()

    // Drag and drop support
    DropArea {
        anchors.fill: parent
        keys: ["text/uri-list"]

        onEntered: {
            dragOverlay.visible = true
        }

        onExited: {
            dragOverlay.visible = false
        }

        onDropped: (drop) => {
            dragOverlay.visible = false
            if (drop.hasUrls) {
                for (var i = 0; i < drop.urls.length; i++) {
                    var filePath = drop.urls[i].toString()
                    if (filePath) {
                        var isImage = filePath.match(/\.(png|jpg|jpeg|gif|webp)$/i)
                        backend.sendFile(filePath, isImage ? "image" : "document")
                    }
                }
            }
        }
    }

    // Drop overlay
    Rectangle {
        id: dragOverlay
        visible: false
        anchors.fill: parent
        color: Qt.rgba(Theme.primary.r, Theme.primary.g, Theme.primary.b, 0.1)
        border.color: Theme.primary
        border.width: 2
        z: 100

        Text {
            anchors.centerIn: parent
            text: "Drop files to send"
            font.pixelSize: Theme.fontSizeXl
            font.bold: true
            color: Theme.primary
        }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Chat header
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
                anchors.leftMargin: Theme.spacingMd
                anchors.rightMargin: Theme.spacingMd
                spacing: Theme.spacingMd

                // Back button (mobile-style)
                Text {
                    text: "\u2190"
                    font.pixelSize: Theme.fontSizeXl
                    color: Theme.primary
                    visible: false // Set true on narrow screens via MainLayout
                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.backRequested()
                    }
                }

                Avatar {
                    Layout.preferredWidth: 36
                    Layout.preferredHeight: 36
                    initials: root.chatName ? root.chatName.charAt(0) : "?"
                    showOnlineDot: false
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0

                    Text {
                        text: root.chatName || "Select a chat"
                        font.pixelSize: Theme.fontSizeLg
                        font.bold: true
                        color: Theme.textPrimary
                        elide: Text.ElideRight
                    }

                    Text {
                        text: root.isGroup ? "Group" : "Online"
                        font.pixelSize: Theme.fontSizeXs
                        color: Theme.textSecondary
                        visible: root.chatId !== ""
                    }
                }

                // Call buttons (placeholder - calls not yet implemented)
                Rectangle {
                    width: 32; height: 32
                    radius: Theme.radiusFull
                    color: voiceCallMouse.containsMouse ? Theme.hover : "transparent"
                    visible: root.chatId !== ""

                    Text {
                        anchors.centerIn: parent
                        text: "\u{1F4DE}"
                        font.pixelSize: Theme.fontSizeMd
                        color: Theme.primary
                    }

                    MouseArea {
                        id: voiceCallMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        onClicked: backend.errorOccurred("Voice calls coming soon")
                    }
                }

                Rectangle {
                    width: 32; height: 32
                    radius: Theme.radiusFull
                    color: videoCallMouse.containsMouse ? Theme.hover : "transparent"
                    visible: root.chatId !== ""

                    Text {
                        anchors.centerIn: parent
                        text: "\u{1F4F7}"
                        font.pixelSize: Theme.fontSizeSm
                        color: Theme.primary
                    }

                    MouseArea {
                        id: videoCallMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        onClicked: backend.errorOccurred("Video calls coming soon")
                    }
                }

                // Info button
                Rectangle {
                    width: 32; height: 32
                    radius: Theme.radiusFull
                    color: infoMouse.containsMouse ? Theme.hover : "transparent"
                    visible: root.chatId !== ""

                    Text {
                        anchors.centerIn: parent
                        text: "i"
                        font.pixelSize: Theme.fontSizeLg
                        font.bold: true
                        color: Theme.primary
                    }

                    MouseArea {
                        id: infoMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        onClicked: root.openDetail()
                    }
                }
            }
        }

        // Messages area
        ListView {
            id: messageListView
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            model: messageListModel
            spacing: Theme.spacingXs

            // Auto-scroll to bottom on new messages
            onCountChanged: {
                Qt.callLater(function() {
                    messageListView.positionViewAtEnd()
                })
            }

            header: Item {
                width: messageListView.width
                height: Theme.spacingLg
            }

            delegate: MessageBubble {
                width: messageListView.width
                isSent: model.isSent
                content: model.content
                timestamp: model.timestamp
                status: model.status
                isDeleted: model.isDeleted
                isEdited: model.isEdited
                replyTo: model.replyTo
                senderName: model.senderName
                onReplyRequested: (msgId) => messageInput.setReplyTo(msgId, model.content)
                onDeleteRequested: (msgId) => backend.deleteMessage(msgId)
            }
        }

        // Typing indicator
        TypingIndicator {
            id: typingIndicator
            Layout.fillWidth: true
            Layout.preferredHeight: visible ? 40 : 0
            visible: false
        }

        Connections {
            target: backend
            function onTypingChanged(chatId, userId, isTyping) {
                if (chatId === root.chatId && userId !== "") {
                    typingIndicator.visible = isTyping
                }
            }
        }

        // Message input
        MessageInput {
            id: messageInput
            Layout.fillWidth: true
            Layout.preferredHeight: Theme.inputBarHeight
            enabled: root.chatId !== ""
            onSendMessage: (content) => {
                if (content.trim().length === 0) return
                backend.sendMessage(content)
                messageInput.clear()
            }
        }
    }
}
