import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Rectangle {
    id: root
    width: parent.width
    height: bubbleContent.height + Theme.spacingMd * 2
    color: "transparent"

    property bool isSent: false
    property string content: ""
    property real timestamp: 0
    property string status: "sent"
    property bool isDeleted: false
    property bool isEdited: false
    property string replyTo: ""
    property string senderName: ""

    signal replyRequested(string messageId)
    signal deleteRequested(string messageId)

    // Bubble appear animation
    scale: 0.85
    opacity: 0
    Component.onCompleted: {
        bubbleIn.start()
    }

    ParallelAnimation {
        id: bubbleIn
        NumberAnimation {
            target: root
            property: "scale"
            from: 0.85
            to: 1.0
            duration: Theme.animNormal
            easing.type: Easing.OutBack
        }
        NumberAnimation {
            target: root
            property: "opacity"
            from: 0
            to: 1
            duration: Theme.animNormal
        }
    }

    // Sent/Received alignment
    anchors.right: isSent ? parent.right : undefined
    anchors.left: isSent ? undefined : parent.left
    anchors.rightMargin: isSent ? Theme.spacingLg : 0
    anchors.leftMargin: isSent ? 0 : Theme.spacingLg

    Rectangle {
        id: bubbleContainer
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.leftMargin: isSent ? parent.width * 0.2 : 0
        anchors.rightMargin: isSent ? 0 : parent.width * 0.2
        anchors.verticalCenter: parent.verticalCenter
        height: bubbleContent.height + Theme.spacingSm * 2
        radius: Theme.radiusLg
        color: isSent ? Theme.senderBubble : Theme.receiverBubble

        // Tail
        Canvas {
            id: tailCanvas
            anchors.top: parent.top
            anchors.topMargin: 8
            anchors.left: isSent ? undefined : parent.left
            anchors.right: isSent ? parent.right : undefined
            width: 12
            height: 12
            onWidthChanged: requestPaint()
            onHeightChanged: requestPaint()
            Connections {
                target: Theme
                function onSenderBubbleChanged() { tailCanvas.requestPaint() }
                function onReceiverBubbleChanged() { tailCanvas.requestPaint() }
            }

            onPaint: {
                var ctx = getContext("2d")
                ctx.clearRect(0, 0, width, height)
                ctx.fillStyle = isSent ? Theme.senderBubble : Theme.receiverBubble
                ctx.beginPath()
                if (isSent) {
                    ctx.moveTo(0, 0)
                    ctx.lineTo(12, 0)
                    ctx.lineTo(0, 12)
                } else {
                    ctx.moveTo(12, 0)
                    ctx.lineTo(0, 0)
                    ctx.lineTo(12, 12)
                }
                ctx.closePath()
                ctx.fill()
            }
        }

        ColumnLayout {
            id: bubbleContent
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.margins: Theme.spacingMd
            spacing: 2

            // Sender name in groups
            Text {
                visible: !isSent && senderName.length > 0
                text: senderName
                font.pixelSize: Theme.fontSizeSm
                font.bold: true
                color: Theme.primary
                Layout.fillWidth: true
            }

            // Reply preview
            Rectangle {
                visible: replyTo.length > 0
                Layout.fillWidth: true
                Layout.preferredHeight: 30
                radius: Theme.radiusSm
                color: Qt.darker(isSent ? Theme.senderBubble : Theme.receiverBubble, 1.1)

                Text {
                    anchors.left: parent.left
                    anchors.right: parent.right
                    anchors.margins: 6
                    anchors.verticalCenter: parent.verticalCenter
                    text: replyTo
                    font.pixelSize: Theme.fontSizeXs
                    color: Theme.textSecondary
                    elide: Text.ElideRight
                    maximumLineCount: 1
                }
            }

            // Message content
            // Image display
            Image {
                visible: content && content.toString().indexOf("http") === 0 && content.toString().match(/\.(png|jpg|jpeg|gif|webp)$/i)
                Layout.fillWidth: true
                Layout.preferredHeight: 200
                source: visible ? content : ""
                fillMode: Image.PreserveAspectFit
                asynchronous: true

                Rectangle {
                    anchors.fill: parent
                    color: Theme.hover
                    visible: parent.status === Image.Error
                    radius: Theme.radiusSm

                    Text {
                        anchors.centerIn: parent
                        text: "Image"
                        color: Theme.textSecondary
                    }
                }
            }

            // Text content (for non-image messages or fallback)
            Text {
                visible: !content || content.toString().indexOf("http") !== 0 || !content.toString().match(/\.(png|jpg|jpeg|gif|webp)$/i)
                Layout.fillWidth: true
                text: isDeleted ? "This message was deleted" : content
                font.pixelSize: Theme.fontSizeLg
                color: isDeleted ? Theme.textSecondary : (isSent ? Theme.senderText : Theme.receiverText)
                wrapMode: Text.Wrap
                font.italic: isDeleted
            }

            // Footer: time, edited, status
            RowLayout {
                Layout.fillWidth: true
                spacing: Theme.spacingXs

                Item { Layout.fillWidth: true }

                Text {
                    text: isEdited ? "(edited)" : ""
                    font.pixelSize: Theme.fontSizeXs
                    color: isSent ? Qt.lighter(Theme.senderText, 0.7) : Theme.textSecondary
                    visible: isEdited
                }

                Text {
                    text: {
                        if (!timestamp) return ""
                        var d = new Date(timestamp * 1000)
                        return Qt.formatTime(d, "HH:mm")
                    }
                    font.pixelSize: Theme.fontSizeXs
                    color: isSent ? Qt.lighter(Theme.senderText, 0.7) : Theme.textSecondary
                }

                // Tick icons (sent/delivered/read)
                Text {
                    visible: isSent
                    text: {
                        if (status === "read") return "XX" // Double blue
                        if (status === "delivered") return "XX" // Double grey
                        return "X" // Single grey
                    }
                    font.pixelSize: Theme.fontSizeXs
                    font.bold: status === "read"
                    color: status === "read" ? Theme.tickRead : Theme.tick
                }
            }
        }

        // Context menu
        MouseArea {
            anchors.fill: parent
            acceptedButtons: Qt.RightButton
            onClicked: (mouse) => msgContextMenu.popup()
        }

        Menu {
            id: msgContextMenu
            MenuItem {
                text: "Reply"
                onTriggered: root.replyRequested(model ? model.messageId : "")
            }
            MenuItem {
                text: "Copy"
                onTriggered: {
                    if (model) {
                        copyHelper.text = model.content || ""
                        copyHelper.selectAll()
                        copyHelper.copy()
                    }
                }
            }
            MenuItem {
                text: "Forward"
                enabled: false
                onTriggered: {}
            }
            MenuItem {
                text: isSent ? "Edit" : "Star"
                onTriggered: {
                    if (isSent && model) {
                        backend.errorOccurred("Edit coming soon")
                    } else {
                        backend.errorOccurred("Star coming soon")
                    }
                }
            }
            MenuSeparator {}
            MenuItem {
                text: "Delete for me"
                onTriggered: root.deleteRequested(model ? model.messageId : "")
            }
            MenuItem {
                text: "Delete for everyone"
                enabled: isSent
                onTriggered: backend.deleteMessage(model ? model.messageId : "")
            }
        }

        // Hidden text field for clipboard copy
        TextEdit {
            id: copyHelper
            visible: false
        }
    }
}
