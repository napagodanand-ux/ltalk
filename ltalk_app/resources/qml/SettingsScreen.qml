import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15
import QtQuick.Dialogs

Rectangle {
    id: root
    color: Theme.background

    signal closeRequested()

    property string currentName: ""
    property string currentAbout: ""
    property string currentAvatarUrl: ""

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // Header
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
                anchors.leftMargin: Theme.spacingLg
                anchors.rightMargin: Theme.spacingLg

                Text {
                    text: "\u2190"
                    font.pixelSize: Theme.fontSizeXl
                    color: Theme.primary
                    MouseArea {
                        anchors.fill: parent
                        onClicked: root.closeRequested()
                    }
                }

                Text {
                    Layout.fillWidth: true
                    text: "Settings"
                    font.pixelSize: Theme.fontSizeXl
                    font.bold: true
                    color: Theme.textPrimary
                    leftPadding: Theme.spacingMd
                }
            }
        }

        // Profile section
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 100
            color: Theme.surface

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Theme.spacingLg
                anchors.rightMargin: Theme.spacingLg
                spacing: Theme.spacingLg

                Avatar {
                    id: profileAvatar
                    width: 60
                    height: 60
                    initials: root.currentName ? root.currentName.charAt(0) : "U"
                    avatarUrl: root.currentAvatarUrl

                    MouseArea {
                        anchors.fill: parent
                        onClicked: avatarPicker.open()
                    }
                }

                FileDialog {
                    id: avatarPicker
                    title: "Select Avatar"
                    nameFilters: ["Images (*.png *.jpg *.jpeg *.webp)"]
                    onAccepted: {
                        var filePath = avatarPicker.fileUrl.toString()
                        if (filePath) {
                            backend.uploadAvatar(filePath)
                        }
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 0

                    Text {
                        text: root.currentName || "Your Name"
                        font.pixelSize: Theme.fontSizeLg
                        font.bold: true
                        color: Theme.textPrimary
                    }

                    Text {
                        text: root.currentAbout || "Available"
                        font.pixelSize: Theme.fontSizeSm
                        color: Theme.textSecondary
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            color: Theme.divider
        }

        // Settings items
        Repeater {
            model: [
                { label: "Edit Profile", section: "profile" },
                { label: "Appearance", section: "appearance" },
                { label: "Notifications", section: "notifications" },
                { label: "Privacy", section: "privacy" },
                { label: "Storage and Data", section: "storage" },
                { label: "Help", section: "help" },
                { label: "About", section: "about" },
            ]

            Rectangle {
                width: parent ? parent.width : 0
                height: 56
                color: itemMouse.containsMouse ? Theme.hover : Theme.surface

                MouseArea {
                    id: itemMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    onClicked: {
                        if (modelData.section === "appearance") {
                            Theme.isDark = !Theme.isDark
                        } else if (modelData.section === "profile") {
                            profileEditor.visible = true
                        }
                    }
                }

                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: Theme.spacingLg
                    anchors.rightMargin: Theme.spacingLg

                    Text {
                        Layout.fillWidth: true
                        text: modelData.label
                        font.pixelSize: Theme.fontSizeMd
                        color: Theme.textPrimary
                    }

                    Text {
                        text: modelData.section === "appearance" ? (Theme.isDark ? "Dark" : "Light") : ">"
                        font.pixelSize: Theme.fontSizeLg
                        color: Theme.textSecondary
                    }
                }

                Rectangle {
                    anchors.bottom: parent.bottom
                    width: parent.width
                    height: 1
                    color: Theme.divider
                }
            }
        }

        // Theme toggle
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            color: themeMouse.containsMouse ? Theme.hover : Theme.surface

            MouseArea {
                id: themeMouse
                anchors.fill: parent
                hoverEnabled: true
                onClicked: Theme.isDark = !Theme.isDark
            }

            RowLayout {
                anchors.fill: parent
                anchors.leftMargin: Theme.spacingLg
                anchors.rightMargin: Theme.spacingLg

                Text {
                    Layout.fillWidth: true
                    text: "Dark Mode"
                    font.pixelSize: Theme.fontSizeMd
                    color: Theme.textPrimary
                }

                Rectangle {
                    width: 44; height: 24
                    radius: 12
                    color: Theme.isDark ? Theme.primary : Theme.divider

                    Rectangle {
                        x: Theme.isDark ? 22 : 2
                        width: 20; height: 20
                        radius: 10
                        color: Theme.surface
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
            }
        }

        // Logout button
        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 56
            color: logoutMouse.containsMouse ? Qt.rgba(0.8, 0.1, 0.1, 0.1) : Theme.surface

            MouseArea {
                id: logoutMouse
                anchors.fill: parent
                hoverEnabled: true
                onClicked: backend.logout()
            }

            Text {
                anchors.centerIn: parent
                text: "Log Out"
                font.pixelSize: Theme.fontSizeMd
                color: Theme.error
            }
        }

        Item { Layout.fillHeight: true }
    }

    // Profile editor overlay
    Rectangle {
        id: profileEditor
        visible: false
        anchors.fill: parent
        color: Qt.rgba(0, 0, 0, 0.5)

        Rectangle {
            anchors.centerIn: parent
            width: 350
            height: 280
            radius: Theme.radiusLg
            color: Theme.surface

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: Theme.spacingLg
                spacing: Theme.spacingMd

                Text {
                    text: "Edit Profile"
                    font.pixelSize: Theme.fontSizeLg
                    font.bold: true
                    color: Theme.textPrimary
                }

                TextField {
                    id: nameField
                    Layout.fillWidth: true
                    placeholderText: "Display Name"
                    text: root.currentName
                    font.pixelSize: Theme.fontSizeMd
                    color: Theme.textPrimary
                    background: Rectangle {
                        radius: Theme.radiusSm
                        color: Theme.background
                        border.color: Theme.divider
                    }
                }

                TextField {
                    id: aboutField
                    Layout.fillWidth: true
                    placeholderText: "About"
                    text: root.currentAbout
                    font.pixelSize: Theme.fontSizeMd
                    color: Theme.textPrimary
                    background: Rectangle {
                        radius: Theme.radiusSm
                        color: Theme.background
                        border.color: Theme.divider
                    }
                }

                RowLayout {
                    Layout.fillWidth: true
                    spacing: Theme.spacingMd

                    Rectangle {
                        Layout.fillWidth: true
                        height: 40
                        radius: Theme.radiusSm
                        color: Theme.divider

                        MouseArea {
                            anchors.fill: parent
                            onClicked: profileEditor.visible = false
                        }

                        Text {
                            anchors.centerIn: parent
                            text: "Cancel"
                            color: Theme.textPrimary
                        }
                    }

                    Rectangle {
                        Layout.fillWidth: true
                        height: 40
                        radius: Theme.radiusSm
                        color: Theme.primary

                        MouseArea {
                            anchors.fill: parent
                            onClicked: {
                                backend.updateProfile(nameField.text, aboutField.text)
                                root.currentName = nameField.text
                                root.currentAbout = aboutField.text
                                profileEditor.visible = false
                            }
                        }

                        Text {
                            anchors.centerIn: parent
                            text: "Save"
                            color: Theme.senderText
                            font.bold: true
                        }
                    }
                }
            }
        }
    }
}
