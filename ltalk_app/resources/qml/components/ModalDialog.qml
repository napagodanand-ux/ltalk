import QtQuick 2.15

Rectangle {
    id: root
    color: Theme.overlay
    visible: false

    property string title: ""
    property alias content: contentItem.sourceComponent

    signal closed()

    MouseArea {
        anchors.fill: parent
        onClicked: root.visible = false
    }

    Rectangle {
        anchors.centerIn: parent
        width: Math.min(parent.width - 64, 400)
        height: contentItem.height + Theme.spacing2xl * 2
        radius: Theme.radiusXl
        color: Theme.surface

        Column {
            id: contentColumn
            anchors.fill: parent
            anchors.margins: Theme.spacingXl
            spacing: Theme.spacingLg

            Text {
                text: root.title
                font.pixelSize: Theme.fontSizeXl
                font.bold: true
                color: Theme.textPrimary
                visible: root.title.length > 0
            }

            Loader {
                id: contentItem
                width: parent.width
            }
        }
    }
}
