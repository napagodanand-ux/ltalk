"""Tests for the IPC protocol."""

import json

from ltalk_core.ipc.protocol import IpcMessage, IpcMessageType, IpcProtocol


class TestIpcMessage:
    """Tests for IPC message serialization/deserialization."""

    def test_serialize_deserialize(self):
        msg = IpcMessage(
            type=IpcMessageType.NEW_MESSAGE,
            data={"chat_id": "chat-1", "content": "Hello"},
            timestamp=1234567890.0,
        )
        raw = msg.serialize()
        assert raw.endswith(b"\n")
        deserialized = IpcMessage.deserialize(raw)
        assert deserialized.type == IpcMessageType.NEW_MESSAGE
        assert deserialized.data["chat_id"] == "chat-1"
        assert deserialized.data["content"] == "Hello"

    def test_gui_opened(self):
        msg = IpcMessage.gui_opened()
        assert msg.type == IpcMessageType.GUI_OPENED
        raw = msg.serialize()
        deserialized = IpcMessage.deserialize(raw)
        assert deserialized.type == IpcMessageType.GUI_OPENED

    def test_new_message(self):
        msg = IpcMessage.new_message({"id": "msg-1", "chat_id": "chat-1"})
        assert msg.type == IpcMessageType.NEW_MESSAGE
        assert msg.data["id"] == "msg-1"

    def test_message_status(self):
        msg = IpcMessage.message_status("msg-1", "chat-1", "user-1", "delivered")
        assert msg.type == IpcMessageType.MESSAGE_STATUS
        assert msg.data["status"] == "delivered"

    def test_send_message(self):
        msg = IpcMessage.send_message("chat-1", "encrypted", "text")
        assert msg.type == IpcMessageType.SEND_MESSAGE
        assert msg.data["chat_id"] == "chat-1"

    def test_typing_indicator(self):
        msg = IpcMessage.typing_indicator("chat-1", "user-1", True)
        assert msg.type == IpcMessageType.TYPING_INDICATOR
        assert msg.data["is_typing"] is True

    def test_presence_update(self):
        msg = IpcMessage.presence_update("user-1", "online", 1234567890.0)
        assert msg.type == IpcMessageType.PRESENCE_UPDATE
        assert msg.data["status"] == "online"

    def test_error(self):
        msg = IpcMessage.error("Something went wrong", request_id="req-1")
        assert msg.type == IpcMessageType.ERROR
        assert msg.data["message"] == "Something went wrong"
        assert msg.request_id == "req-1"

    def test_auth_token_refresh(self):
        msg = IpcMessage.auth_token_refresh("jwt-123", "refresh-456", 9999999999.0)
        assert msg.type == IpcMessageType.AUTH_TOKEN_REFRESH
        assert msg.data["jwt"] == "jwt-123"

    def test_empty_message_raises(self):
        try:
            IpcMessage.deserialize(b"\n")
            assert False, "Should have raised ValueError"
        except ValueError:
            pass


class TestIpcProtocol:
    """Tests for IPC message framing."""

    def test_feed_complete_message(self):
        protocol = IpcProtocol()
        msg = IpcMessage.gui_opened()
        raw = msg.serialize()
        messages = protocol.feed(raw)
        assert len(messages) == 1
        assert messages[0].type == IpcMessageType.GUI_OPENED

    def test_feed_multiple_messages(self):
        protocol = IpcProtocol()
        msg1 = IpcMessage.gui_opened()
        msg2 = IpcMessage.gui_closed()
        raw = msg1.serialize() + msg2.serialize()
        messages = protocol.feed(raw)
        assert len(messages) == 2
        assert messages[0].type == IpcMessageType.GUI_OPENED
        assert messages[1].type == IpcMessageType.GUI_CLOSED

    def test_feed_partial_message(self):
        protocol = IpcProtocol()
        msg = IpcMessage.gui_opened()
        raw = msg.serialize()
        # Feed first half
        messages = protocol.feed(raw[:len(raw)//2])
        assert len(messages) == 0
        # Feed second half
        messages = protocol.feed(raw[len(raw)//2:])
        assert len(messages) == 1

    def test_reset(self):
        protocol = IpcProtocol()
        msg = IpcMessage.gui_opened()
        raw = msg.serialize()
        protocol.feed(raw[:len(raw)//2])
        protocol.reset()
        messages = protocol.feed(raw)
        assert len(messages) == 1
