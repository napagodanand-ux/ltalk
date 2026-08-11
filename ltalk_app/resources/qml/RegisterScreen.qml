import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.background
    visible: false

    property string email: ""
    property string password: ""

    signal backRequested()

    ColumnLayout {
        anchors.centerIn: parent
        width: 360
        spacing: Theme.spacingXl

        // Back button
        Text {
            text: "< Back"
            font.pixelSize: Theme.fontSizeMd
            color: Theme.primary
            MouseArea {
                anchors.fill: parent
                onClicked: root.backRequested()
            }
        }

        Text {
            text: "Create Account"
            font.pixelSize: Theme.fontSize3xl
            font.bold: true
            color: Theme.textPrimary
            Layout.alignment: Qt.AlignHCenter
        }

        Components.MaroonTextField {
            id: displayNameField
            Layout.fillWidth: true
            placeholderText: "Display Name"
        }

        Components.MaroonTextField {
            id: emailField
            Layout.fillWidth: true
            placeholderText: "Email"
            inputMethodHints: Qt.ImhEmailCharactersOnly
        }

        Components.MaroonTextField {
            id: passwordField
            Layout.fillWidth: true
            placeholderText: "Password"
            echoMode: TextInput.Password
        }

        Components.MaroonButton {
            Layout.fillWidth: true
            text: "Register"
            onClicked: {
                root.email = emailField.text
                root.password = passwordField.text
                backend.register(emailField.text, passwordField.text, displayNameField.text)
            }
        }
    }
}
