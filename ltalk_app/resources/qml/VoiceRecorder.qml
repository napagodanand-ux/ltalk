import QtQuick 2.15

Rectangle {
    id: root
    color: Theme.primaryDark
    visible: false

    property bool isRecording: false
    property real duration: 0

    signal recordingComplete(string filePath)

    function startRecording() {
        root.isRecording = true
        root.visible = true
        root.duration = 0
        timer.start()
    }

    function stopRecording() {
        root.isRecording = false
        timer.stop()
        root.visible = false
        root.recordingComplete("")
    }

    Timer {
        id: timer
        interval: 100
        repeat: true
        onTriggered: root.duration += 0.1
    }

    Row {
        anchors.centerIn: parent
        spacing: Theme.spacingMd

        // Waveform placeholder
        Row {
            spacing: 2
            Repeater {
                model: 20
                Rectangle {
                    width: 3
                    height: root.isRecording ? Math.random() * 20 + 5 : 5
                    radius: 1.5
                    color: Theme.senderText

                    Behavior on height {
                        NumberAnimation { duration: 100 }
                    }
                }
            }
        }

        Text {
            text: {
                var mins = Math.floor(root.duration / 60)
                var secs = Math.floor(root.duration % 60)
                return mins.toString().padStart(2, "0") + ":" + secs.toString().padStart(2, "0")
            }
            font.pixelSize: Theme.fontSizeMd
            color: Theme.senderText
            anchors.verticalCenter: parent.verticalCenter
        }

        Rectangle {
            width: 40; height: 40
            radius: Theme.radiusFull
            color: Theme.callDecline

            Text {
                anchors.centerIn: parent
                text: "X"
                font.pixelSize: Theme.fontSizeLg
                font.bold: true
                color: Theme.senderText
            }

            MouseArea {
                anchors.fill: parent
                onClicked: root.stopRecording()
            }
        }
    }
}
