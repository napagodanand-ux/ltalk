import QtQuick 2.15
import QtQuick.Window 2.15
import QtQuick.Controls 2.15
import "components" as Components

ApplicationWindow {
    id: root
    visible: true
    width: 1200
    height: 800
    minimumWidth: 900
    minimumHeight: 600
    title: "LTalk"
    color: Theme.background
    font.family: Theme.fontFamily
    font.pixelSize: Theme.fontSizeMd

    property bool isDarkMode: false

    Shortcut {
        sequence: "Ctrl+Q"
        onActivated: root.close()
    }

    Shortcut {
        sequence: "Ctrl+Shift+Q"
        onActivated: Qt.quit()
    }

    // Keyboard navigation
    Shortcut {
        sequence: "Ctrl+N"
        onActivated: {
            if (mainLoader.active) {
                mainLoader.item.showNewChat = true
            }
        }
    }

    Shortcut {
        sequence: "Ctrl+,"
        onActivated: {
            if (mainLoader.active) {
                mainLoader.item.showSettings = true
            }
        }
    }

    Shortcut {
        sequence: "Escape"
        onActivated: {
            if (mainLoader.active) {
                var layout = mainLoader.item
                if (layout.showNewChat) layout.showNewChat = false
                else if (layout.showContacts) layout.showContacts = false
                else if (layout.showSettings) layout.showSettings = false
                else if (layout.showCreateGroup) layout.showCreateGroup = false
                else if (layout.detailPanel) detailPanel.visible = false
            }
        }
    }

    Shortcut {
        sequence: "Ctrl+F"
        onActivated: {
            if (mainLoader.active) {
                mainLoader.item.sidebar.searchActive = !mainLoader.item.sidebar.searchActive
            }
        }
    }

    // Login screen shown when not authenticated
    Loader {
        id: authLoader
        anchors.fill: parent
        active: !backend.isAuthenticated
        sourceComponent: Component {
            LoginScreen {
                anchors.fill: parent
                onLoginRequested: (email, password) => backend.login(email, password)
                onRegisterRequested: (email, password, name) => backend.register(email, password, name)
            }
        }
    }

    // Main layout shown when authenticated
    Loader {
        id: mainLoader
        anchors.fill: parent
        active: backend.isAuthenticated
        sourceComponent: Component {
            MainLayout {
                anchors.fill: parent
            }
        }
    }

    Components.Toast {
        id: toast
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.margins: Theme.spacingXl
    }

    Connections {
        target: backend
        function onErrorOccurred(msg) {
            toast.show(msg, "error")
        }
    }
}
