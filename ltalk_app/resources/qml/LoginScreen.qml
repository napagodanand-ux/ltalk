import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import "components" as Components

Rectangle {
    id: root
    color: Theme.background

    property bool showRegister: false

    signal loginRequested(string email, string password)
    signal registerRequested(string email, string password, string name)

    ColumnLayout {
        anchors.centerIn: parent
        width: 360
        spacing: Theme.spacingXl

        // Logo
        Rectangle {
            Layout.alignment: Qt.AlignHCenter
            width: 80
            height: 80
            radius: Theme.radiusFull
            color: Theme.primary

            Text {
                anchors.centerIn: parent
                text: "LT"
                font.pixelSize: Theme.fontSize3xl
                font.bold: true
                color: Theme.senderText
            }
        }

        Text {
            text: "LTalk"
            font.pixelSize: Theme.fontSize3xl
            font.bold: true
            color: Theme.textPrimary
            Layout.alignment: Qt.AlignHCenter
        }

        Text {
            text: "Your conversation, your color."
            font.pixelSize: Theme.fontSizeMd
            color: Theme.textSecondary
            Layout.alignment: Qt.AlignHCenter
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
            text: "Login"
            onClicked: root.loginRequested(emailField.text, passwordField.text)
        }

        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            spacing: Theme.spacingSm

            Text {
                text: "Don't have an account?"
                font.pixelSize: Theme.fontSizeMd
                color: Theme.textSecondary
            }

            Text {
                text: "Register"
                font.pixelSize: Theme.fontSizeMd
                font.bold: true
                color: Theme.primary

                MouseArea {
                    anchors.fill: parent
                    onClicked: root.showRegister = true
                }
            }
        }
    }

    RegisterScreen {
        anchors.fill: parent
        visible: root.showRegister
        onBackRequested: root.showRegister = false
    }
}
