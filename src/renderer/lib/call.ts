import { supabase } from './supabase';
import {
  startCall as apiStartCall,
  joinCall as apiJoinCall,
  leaveCall as apiLeaveCall,
  endCall as apiEndCall
} from './api/calls';
import { useCallStore } from '../stores/callStore';
import { useConversationStore } from '../stores/conversationStore';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import type { Call, CallType } from '../../../src/shared/types';

// Public STUN servers for ICE. NOTE: a TURN server is required for calls to
// succeed across symmetric/restrictive NATs; without one, some peer pairs will
// fail to connect. STUN alone covers the common cases.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

interface SignalPayload {
  callId: string;
  conversationId: string;
  from: string;
  to: string | null;
  kind: 'offer' | 'answer' | 'candidate';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface CallStartPayload {
  callId: string;
  conversationId: string;
  initiatorId: string;
  type: CallType;
}

interface CallEndPayload {
  callId: string;
}

interface CallLeavePayload {
  callId: string;
  userId: string;
}

interface ParticipantJoinPayload {
  callId: string;
  conversationId: string;
  userId: string;
}

interface MediaStatePayload {
  callId: string;
  userId: string;
  muted: boolean;
  cameraOff: boolean;
}

interface CallInfo {
  callId: string;
  conversationId: string;
  type: CallType;
  initiatorId: string;
}

function getMedia(type: CallType): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia(
    type === 'video' ? { audio: true, video: true } : { audio: true }
  );
}

class CallManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private callId: string | null = null;
  private conversationId: string | null = null;
  private myId = '';
  private initialized = false;

  // Signalling received before our local media is ready — replayed once we have it.
  private pendingSignals: SignalPayload[] = [];
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    const me = useAuthStore.getState().user?.id;
    if (me) this.myId = me;

    const ch = supabase.channel('calls');
    ch.on('broadcast', { event: 'signal' }, ({ payload }) => this.onSignal(payload as SignalPayload));
    ch.on('broadcast', { event: 'call-start' }, ({ payload }) =>
      this.onCallStart(payload as CallStartPayload)
    );
    ch.on('broadcast', { event: 'call-end' }, ({ payload }) => this.onCallEnd(payload as CallEndPayload));
    ch.on('broadcast', { event: 'call-leave' }, ({ payload }) =>
      this.onCallLeave(payload as CallLeavePayload)
    );
    ch.on('broadcast', { event: 'participant-join' }, ({ payload }) =>
      this.onParticipantJoin(payload as ParticipantJoinPayload)
    );
    ch.on('broadcast', { event: 'media-state' }, ({ payload }) =>
      this.onMediaState(payload as MediaStatePayload)
    );
    ch.subscribe();
    this.channel = ch;

    useAuthStore.subscribe((s) => {
      if (s.user) this.myId = s.user.id;
    });
  }

  private send(event: string, payload: Record<string, unknown>): void {
    this.channel?.send({ type: 'broadcast', event, payload });
  }

  private participantIds(): string[] {
    const conv = this.conversationId
      ? useConversationStore.getState().getById(this.conversationId)
      : undefined;
    if (!conv) return [];
    return conv.participants.filter((p) => p.id !== this.myId).map((p) => p.id);
  }

  // ---- Public API -------------------------------------------------------

  async startCall(conversationId: string, type: CallType): Promise<void> {
    this.init();
    const me = this.myId;
    if (!me) return;
    const conv = useConversationStore.getState().getById(conversationId);
    if (!conv) return;
    const store = useCallStore.getState();
    if (store.activeCall || store.incoming) return;

    this.conversationId = conversationId;

    let call: Call;
    try {
      call = await apiStartCall(conversationId, type);
    } catch {
      useToastStore.getState().push({ body: 'Could not start call', variant: 'error' });
      this.conversationId = null;
      return;
    }
    this.callId = call.id;

    try {
      this.localStream = await getMedia(type);
    } catch {
      await this.safeEndDb(call.id);
      useToastStore.getState().push({
        body: 'Microphone/camera permission denied',
        variant: 'error'
      });
      this.conversationId = null;
      this.callId = null;
      return;
    }

    this.applyLocalStream(type);
    store.setActiveCall({
      callId: call.id,
      conversationId,
      type,
      initiatorId: me
    });
    this.send('call-start', {
      callId: call.id,
      conversationId,
      initiatorId: me,
      type
    });
    this.flushPending();
    for (const o of this.participantIds()) this.ensurePeer(o);
    this.sendMediaState();
  }

  async acceptCall(): Promise<void> {
    const pending = useCallStore.getState().incoming;
    if (!pending) return;
    await this.joinCallInternal(pending);
  }

  async joinActiveCall(call: Call): Promise<void> {
    this.init();
    if (!this.myId) return;
    const conv = useConversationStore.getState().getById(call.conversation_id);
    if (!conv) return;
    if (useCallStore.getState().activeCall) return;
    await this.joinCallInternal({
      callId: call.id,
      conversationId: call.conversation_id,
      type: call.type,
      initiatorId: call.initiator_id
    });
  }

  async hangUp(): Promise<void> {
    if (!this.callId) {
      this.teardown();
      return;
    }
    const active = useCallStore.getState().activeCall;
    const amInitiator = active?.initiatorId === this.myId;
    try {
      await apiLeaveCall(this.callId);
    } catch {
      /* best effort */
    }
    if (amInitiator) {
      this.send('call-end', { callId: this.callId });
      await this.safeEndDb(this.callId);
    } else {
      this.send('call-leave', { callId: this.callId, userId: this.myId });
    }
    this.teardown();
  }

  declineCall(): void {
    const pending = useCallStore.getState().incoming;
    if (pending && this.callId === pending.callId) {
      this.send('call-leave', { callId: pending.callId, userId: this.myId });
    }
    useCallStore.getState().clearIncoming();
  }

  toggleMic(): void {
    if (!this.localStream) return;
    const tracks = this.localStream.getAudioTracks();
    if (!tracks.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = next));
    useCallStore.getState().setMicOn(next);
    this.sendMediaState();
  }

  toggleCamera(): void {
    if (!this.localStream) return;
    const tracks = this.localStream.getVideoTracks();
    if (!tracks.length) return;
    const next = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = next));
    useCallStore.getState().setCameraOn(next);
    this.sendMediaState();
  }

  // ---- Internals --------------------------------------------------------

  private async joinCallInternal(info: CallInfo): Promise<void> {
    this.init();
    const me = this.myId;
    if (!me) return;
    const conv = useConversationStore.getState().getById(info.conversationId);
    if (!conv) return;

    this.callId = info.callId;
    this.conversationId = info.conversationId;

    try {
      this.localStream = await getMedia(info.type);
    } catch {
      useToastStore.getState().push({
        body: 'Microphone/camera permission denied',
        variant: 'error'
      });
      useCallStore.getState().clearIncoming();
      this.callId = null;
      this.conversationId = null;
      return;
    }

    this.applyLocalStream(info.type);
    useCallStore.getState().clearIncoming();
    useCallStore.getState().setActiveCall({
      callId: info.callId,
      conversationId: info.conversationId,
      type: info.type,
      initiatorId: info.initiatorId
    });

    try {
      await apiJoinCall(info.callId);
    } catch {
      /* best effort */
    }
    this.send('participant-join', {
      callId: info.callId,
      conversationId: info.conversationId,
      userId: me
    });
    this.flushPending();
    for (const o of this.participantIds()) this.ensurePeer(o);
    this.sendMediaState();
  }

  private applyLocalStream(type: CallType): void {
    const store = useCallStore.getState();
    store.setLocalStream(this.localStream);
    store.setMicOn(this.localStream?.getAudioTracks().some((t) => t.enabled) ?? false);
    store.setCameraOn(
      type === 'video' ? this.localStream?.getVideoTracks().some((t) => t.enabled) ?? false : false
    );
  }

  private sendMediaState(): void {
    if (!this.callId) return;
    const store = useCallStore.getState();
    this.send('media-state', {
      callId: this.callId,
      userId: this.myId,
      muted: !store.micOn,
      cameraOff: !store.cameraOn
    });
  }

  // Creates a mesh peer connection to `otherId`. The peer with the
  // lexicographically smaller id is the offerer, which avoids SDP glare.
  private ensurePeer(otherId: string): void {
    if (this.peers.has(otherId) || !this.localStream || !this.callId || !this.conversationId) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    pc.onicecandidate = (e) => {
      if (e.candidate && this.callId && this.conversationId) {
        this.send('signal', {
          callId: this.callId,
          conversationId: this.conversationId,
          from: this.myId,
          to: otherId,
          kind: 'candidate',
          candidate: e.candidate.toJSON()
        });
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) useCallStore.getState().setRemoteStream(otherId, stream);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'failed' || st === 'closed' || st === 'disconnected') {
        this.removePeer(otherId);
      }
    };

    this.peers.set(otherId, pc);

    if (this.myId < otherId) {
      pc.createOffer()
        .then(async (offer) => {
          if (!this.callId || !this.conversationId) return;
          await pc.setLocalDescription(offer);
          this.send('signal', {
            callId: this.callId,
            conversationId: this.conversationId,
            from: this.myId,
            to: otherId,
            kind: 'offer',
            sdp: offer
          });
        })
        .catch(() => undefined);
    }
  }

  private removePeer(otherId: string): void {
    const pc = this.peers.get(otherId);
    if (pc) {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    }
    this.peers.delete(otherId);
    this.pendingCandidates.delete(otherId);
    useCallStore.getState().removeRemoteStream(otherId);
  }

  private async onSignal(p: SignalPayload): Promise<void> {
    if (!this.callId || p.callId !== this.callId) return;
    if (p.from === this.myId) return;
    if (p.to && p.to !== this.myId) return;

    if (p.kind === 'candidate') {
      if (p.candidate) await this.handleCandidate(p.from, p.candidate);
      return;
    }
    if (!this.localStream) {
      this.pendingSignals.push(p);
      return;
    }
    if (p.kind === 'offer' && p.sdp) await this.handleOffer(p.from, p.sdp);
    else if (p.kind === 'answer' && p.sdp) await this.handleAnswer(p.from, p.sdp);
  }

  private async handleCandidate(from: string, cand: RTCIceCandidateInit): Promise<void> {
    let pc = this.peers.get(from);
    if (!pc) {
      this.ensurePeer(from);
      pc = this.peers.get(from);
    }
    if (!pc) return;
    if (pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(cand);
      } catch {
        /* ignore */
      }
    } else {
      const q = this.pendingCandidates.get(from) ?? [];
      q.push(cand);
      this.pendingCandidates.set(from, q);
    }
  }

  private async handleOffer(from: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    this.ensurePeer(from);
    const pc = this.peers.get(from);
    if (!pc) return;
    await pc.setRemoteDescription(sdp);
    await this.flushCandidates(from, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (this.callId && this.conversationId) {
      this.send('signal', {
        callId: this.callId,
        conversationId: this.conversationId,
        from: this.myId,
        to: from,
        kind: 'answer',
        sdp: answer
      });
    }
  }

  private async handleAnswer(from: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peers.get(from);
    if (!pc) return;
    await pc.setRemoteDescription(sdp);
    await this.flushCandidates(from, pc);
  }

  private async flushCandidates(from: string, pc: RTCPeerConnection): Promise<void> {
    const q = this.pendingCandidates.get(from);
    if (!q || !q.length) return;
    for (const c of q) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
    this.pendingCandidates.delete(from);
  }

  private flushPending(): void {
    const queued = this.pendingSignals;
    this.pendingSignals = [];
    for (const p of queued) void this.onSignal(p);
  }

  private onCallStart(p: CallStartPayload): void {
    if (p.initiatorId === this.myId) return;
    const conv = useConversationStore.getState().getById(p.conversationId);
    if (!conv) return; // not a conversation I belong to
    const store = useCallStore.getState();
    if (store.activeCall || store.incoming) return;
    store.setIncoming({
      callId: p.callId,
      conversationId: p.conversationId,
      type: p.type as CallType,
      initiatorId: p.initiatorId
    });
  }

  private onCallEnd(p: CallEndPayload): void {
    if (useCallStore.getState().incoming?.callId === p.callId) {
      useCallStore.getState().clearIncoming();
    }
    if (this.callId === p.callId) this.teardown();
  }

  private onCallLeave(p: CallLeavePayload): void {
    if (p.callId !== this.callId) return;
    if (p.userId) this.removePeer(p.userId);
  }

  private onParticipantJoin(p: ParticipantJoinPayload): void {
    if (p.callId !== this.callId || !p.userId || p.userId === this.myId) return;
    if (!this.localStream) return;
    this.ensurePeer(p.userId);
  }

  private onMediaState(p: MediaStatePayload): void {
    if (p.callId !== this.callId || !p.userId) return;
    useCallStore.getState().setPeerMediaState(
      p.userId,
      Boolean(p.muted),
      Boolean(p.cameraOff)
    );
  }

  private async safeEndDb(callId: string): Promise<void> {
    try {
      await apiEndCall(callId);
    } catch {
      /* ignore */
    }
  }

  private teardown(): void {
    this.peers.forEach((pc) => {
      try {
        pc.close();
      } catch {
        /* ignore */
      }
    });
    this.peers.clear();
    this.pendingSignals = [];
    this.pendingCandidates.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    useCallStore.getState().reset();
    this.callId = null;
    this.conversationId = null;
  }
}

export const callManager = new CallManager();
