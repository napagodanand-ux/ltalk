import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import QtQuick.Dialogs
import "components" as Components

Rectangle {
    id: root
    color: Theme.surface

    property string replyToMessageId: ""
    property string replyToContent: ""

    signal sendMessage(string content)

    function clear() {
        textInput.text = ""
        replyPreview.visible = false
    }

    function setReplyTo(msgId, content) {
        replyToMessageId = msgId
        replyToContent = content
        replyPreview.visible = true
        textInput.forceActiveFocus()
    }

    Rectangle {
        anchors.bottom: parent.bottom
        width: parent.width
        height: 1
        color: Theme.divider
    }

    // Reply preview
    Rectangle {
        id: replyPreview
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        height: visible ? 40 : 0
        color: Theme.surface
        visible: false
        clip: true

        Behavior on height {
            NumberAnimation { duration: Theme.animFast }
        }

        Rectangle {
            anchors.left: parent.left
            width: 3
            height: parent.height
            color: Theme.primary
        }

        Text {
            anchors.left: parent.left
            anchors.right: closeReply.left
            anchors.verticalCenter: parent.verticalCenter
            anchors.leftMargin: Theme.spacingMd
            text: replyToContent
            font.pixelSize: Theme.fontSizeSm
            color: Theme.textSecondary
            elide: Text.ElideRight
            maximumLineCount: 1
        }

        Text {
            id: closeReply
            anchors.right: parent.right
            anchors.verticalCenter: parent.verticalCenter
            anchors.rightMargin: Theme.spacingMd
            text: "X"
            font.pixelSize: Theme.fontSizeSm
            color: Theme.textSecondary

            MouseArea {
                anchors.fill: parent
                onClicked: replyPreview.visible = false
            }
        }
    }

    RowLayout {
        anchors.fill: parent
        anchors.margins: Theme.spacingSm
        spacing: Theme.spacingSm

        // Attach button
        Rectangle {
            width: 40; height: 40
            radius: Theme.radiusFull
            color: attachMouse.containsMouse ? Theme.hover : "transparent"

            Text {
                anchors.centerIn: parent
                text: "+"
                font.pixelSize: Theme.fontSizeXl
                font.bold: true
                color: Theme.primary
            }

            MouseArea {
                id: attachMouse
                anchors.fill: parent
                hoverEnabled: true
                onClicked: attachMenu.popup()
            }

            Menu {
                id: attachMenu
                MenuItem {
                    text: "Image"
                    onTriggered: imageDialog.open()
                }
                MenuItem {
                    text: "Document"
                    onTriggered: documentDialog.open()
                }
            }

            FileDialog {
                id: imageDialog
                title: "Select Image"
                nameFilters: ["Images (*.png *.jpg *.jpeg *.gif *.webp)"]
                onAccepted: {
                    var filePath = imageDialog.fileUrl.toString()
                    if (filePath) {
                        backend.sendFile(filePath, "image")
                    }
                }
            }

            FileDialog {
                id: documentDialog
                title: "Select Document"
                nameFilters: ["Documents (*.pdf *.doc *.docx *.txt *.xls *.xlsx)"]
                onAccepted: {
                    var filePath = documentDialog.fileUrl.toString()
                    if (filePath) {
                        backend.sendFile(filePath, "document")
                    }
                }
            }
        }

        // Text input
        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            radius: Theme.radiusMd
            color: Theme.primaryWash
            border.color: textInput.activeFocus ? Theme.primary : Theme.divider
            border.width: textInput.activeFocus ? 2 : 1

            TextInput {
                id: textInput
                anchors.fill: parent
                anchors.margins: Theme.spacingMd
                verticalAlignment: TextInput.AlignVCenter
                font.pixelSize: Theme.fontSizeLg
                color: Theme.textPrimary
                clip: true
                wrapMode: TextInput.Wrap

                Keys.onReturnPressed: (event) => {
                    if (event.modifiers & Qt.ShiftModifier) {
                        textInput.insert(textInput.cursorPosition, "\n")
                    } else {
                        root.sendMessage(textInput.text)
                    }
                }

                Keys.onEnterPressed: (event) => {
                    if (event.modifiers & Qt.ShiftModifier) {
                        textInput.insert(textInput.cursorPosition, "\n")
                    } else {
                        root.sendMessage(textInput.text)
                    }
                }

                // Handle paste events for images
                Keys.onPressed: (event) => {
                    if (event.key === Qt.Key_V && (event.modifiers & Qt.ControlModifier)) {
                        var clipboard = Qt.application.clipboard
                        if (clipboard.mimeData && clipboard.mimeData.hasUrls) {
                            var urls = clipboard.mimeData.urls
                            for (var i = 0; i < urls.length; i++) {
                                var filePath = urls[i].toString()
                                if (filePath) {
                                    var isImage = filePath.match(/\.(png|jpg|jpeg|gif|webp)$/i)
                                    backend.sendFile(filePath, isImage ? "image" : "document")
                                }
                            }
                            event.accepted = true
                        }
                    }
                }
            }

            Text {
                anchors.fill: parent
                anchors.margins: Theme.spacingMd
                text: "Type a message..."
                font.pixelSize: Theme.fontSizeLg
                color: Theme.textSecondary
                visible: textInput.text.length === 0 && !textInput.activeFocus
                verticalAlignment: Text.AlignVCenter
            }
        }

        // Voice record button
        Rectangle {
            width: 40; height: 40
            radius: Theme.radiusFull
            color: voiceMouse.containsMouse ? Theme.hover : "transparent"

            Text {
                anchors.centerIn: parent
                text: "Mic"
                font.pixelSize: Theme.fontSizeSm
                font.bold: true
                color: Theme.primary
            }

            MouseArea {
                id: voiceMouse
                anchors.fill: parent
                hoverEnabled: true
                onPressed: voiceRecorder.startRecording()
                onReleased: voiceRecorder.stopRecording()
            }
        }

        // Send button
        Rectangle {
            width: 40; height: 40
            radius: Theme.radiusFull
            color: textInput.text.length > 0 ? Theme.primary : Theme.divider

            Text {
                anchors.centerIn: parent
                text: ">"
                font.pixelSize: Theme.fontSizeXl
                font.bold: true
                color: Theme.senderText
            }

            MouseArea {
                anchors.fill: parent
                enabled: textInput.text.length > 0
                onClicked: {
                    root.sendMessage(textInput.text)
                    textInput.text = ""
                }
            }
        }
    }

    VoiceRecorder {
        id: voiceRecorder
        anchors.fill: parent
        visible: false
    }
}
