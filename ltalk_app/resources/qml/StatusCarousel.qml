import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Row {
    id: root
    spacing: Theme.spacingSm

    property string chatId: ""
    property var modelData: []

    signal statusClicked(string statusId)

    Repeater {
        model: statusModel

        Item {
            width: 64
            height: 80

            Avatar {
                anchors.horizontalCenter: parent.horizontalCenter
                width: 56
                height: 56
                initials: model.displayName ? model.displayName.charAt(0) : "?"
                showOnlineDot: false
                hasStatus: !model.isViewed
            }

            Text {
                anchors.top: parent.top
                anchors.horizontalCenter: parent.horizontalCenter
                anchors.topMargin: 60
                text: model.displayName || "Me"
                font.pixelSize: Theme.fontSizeXs
                color: Theme.textSecondary
                horizontalAlignment: Text.AlignHCenter
                elide: Text.ElideRight
                width: 64
            }

            MouseArea {
                anchors.fill: parent
                onClicked: root.statusClicked(model.statusId)
            }
        }
    }
}
