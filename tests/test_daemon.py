"""Tests for the daemon components."""

import pytest

from ltalk_core.ipc.protocol import IpcMessage, IpcMessageType


class TestDaemonIpc:
    """Tests for daemon IPC message handling."""

    def test_message_types_exist(self):
        """Verify all required IPC message types are defined."""
        required_types = [
            "GUI_OPENED", "GUI_CLOSED", "SEND_MESSAGE",
            "UPDATE_PRESENCE", "SHUTDOWN_DAEMON",
            "NEW_MESSAGE", "MESSAGE_STATUS", "INCOMING_CALL",
            "TYPING_INDICATOR", "PRESENCE_UPDATE", "SYNC_STATE",
            "ERROR", "AUTH_TOKEN_REFRESH",
        ]
        for msg_type in required_types:
            assert hasattr(IpcMessageType, msg_type)

    def test_sync_state_message(self):
        msg = IpcMessage.sync_state({"total_unread": 5, "chats": []})
        assert msg.type == IpcMessageType.SYNC_STATE
        assert msg.data["total_unread"] == 5

    def test_incoming_call_message(self):
        msg = IpcMessage(
            type=IpcMessageType.INCOMING_CALL,
            data={"call_id": "call-1", "caller_id": "user-1", "call_type": "voice"},
        )
        assert msg.type == IpcMessageType.INCOMING_CALL
        assert msg.data["call_type"] == "voice"
