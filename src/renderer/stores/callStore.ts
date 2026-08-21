import { create } from 'zustand';

export interface ActiveCall {
  callId: string;
  conversationId: string;
  type: 'voice' | 'video';
  initiatorId: string;
}

export interface IncomingCall {
  callId: string;
  conversationId: string;
  type: 'voice' | 'video';
  initiatorId: string;
}

interface PeerMedia {
  muted: boolean;
  cameraOff: boolean;
}

interface CallState {
  activeCall: ActiveCall | null;
  incoming: IncomingCall | null;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  peerMedia: Record<string, PeerMedia>;
  micOn: boolean;
  cameraOn: boolean;

  setActiveCall: (call: ActiveCall | null) => void;
  setIncoming: (call: IncomingCall | null) => void;
  clearIncoming: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (userId: string, stream: MediaStream) => void;
  removeRemoteStream: (userId: string) => void;
  setPeerMediaState: (userId: string, muted: boolean, cameraOff: boolean) => void;
  setMicOn: (on: boolean) => void;
  setCameraOn: (on: boolean) => void;
  reset: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  incoming: null,
  localStream: null,
  remoteStreams: {},
  peerMedia: {},
  micOn: true,
  cameraOn: true,

  setActiveCall: (call) => set({ activeCall: call }),
  setIncoming: (call) => set({ incoming: call }),
  clearIncoming: () => set({ incoming: null }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (userId, stream) =>
    set((state) => ({ remoteStreams: { ...state.remoteStreams, [userId]: stream } })),
  removeRemoteStream: (userId) =>
    set((state) => {
      const next = { ...state.remoteStreams };
      delete next[userId];
      const media = { ...state.peerMedia };
      delete media[userId];
      return { remoteStreams: next, peerMedia: media };
    }),
  setPeerMediaState: (userId, muted, cameraOff) =>
    set((state) => ({
      peerMedia: { ...state.peerMedia, [userId]: { muted, cameraOff } }
    })),
  setMicOn: (on) => set({ micOn: on }),
  setCameraOn: (on) => set({ cameraOn: on }),
  reset: () =>
    set({
      activeCall: null,
      incoming: null,
      localStream: null,
      remoteStreams: {},
      peerMedia: {},
      micOn: true,
      cameraOn: true
    })
}));
