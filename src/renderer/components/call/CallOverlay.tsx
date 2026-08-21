import { useEffect, useRef } from 'react';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useCallStore } from '../../stores/callStore';
import { useConversationStore } from '../../stores/conversationStore';
import { callManager } from '../../lib/call';
import { Avatar, IconButton } from '../ui';
import { cn } from '../../lib/helpers';

function VideoTile({
  stream,
  label,
  mirror,
  placeholder
}: {
  stream: MediaStream | null;
  label: string;
  mirror?: boolean;
  placeholder?: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled);

  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-black/80">
      {hasVideo ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className={cn('h-full w-full object-cover', mirror && 'scale-x-[-1]')}
        />
      ) : (
        <Avatar src={placeholder ?? null} name={label} size={72} />
      )}
      <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
        {label}
      </div>
    </div>
  );
}

export function CallOverlay() {
  const activeCall = useCallStore((s) => s.activeCall);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStreams = useCallStore((s) => s.remoteStreams);
  const peerMedia = useCallStore((s) => s.peerMedia);
  const micOn = useCallStore((s) => s.micOn);
  const cameraOn = useCallStore((s) => s.cameraOn);
  const conv = useConversationStore((s) =>
    activeCall ? s.conversations.find((c) => c.id === activeCall.conversationId) : undefined
  );

  if (!activeCall || !conv) return null;

  const participantMap = new Map(conv.participants.map((p) => [p.id, p]));
  const isVideo = activeCall.type === 'video';

  const remoteTiles = Object.entries(remoteStreams).map(([uid, stream]) => {
    const p = participantMap.get(uid);
    const media = peerMedia[uid];
    return {
      uid,
      stream: isVideo && !media?.cameraOff ? stream : null,
      name: p?.display_name ?? p?.username ?? 'Unknown',
      avatar: p?.avatar_url ?? null
    };
  });

  const total = remoteTiles.length + 1;
  const gridCols =
    total <= 1 ? 'grid-cols-1' : total <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className={cn('flex min-h-0 flex-1 gap-2 p-3', `grid ${gridCols}`)}>
        <VideoTile
          stream={isVideo && cameraOn ? localStream : null}
          label="You"
          mirror
          placeholder={null}
        />
        {remoteTiles.map((t) => (
          <VideoTile key={t.uid} stream={t.stream} label={t.name} placeholder={t.avatar} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 bg-black/80 py-4">
        <IconButton
          label={micOn ? 'Mute' : 'Unmute'}
          onClick={() => callManager.toggleMic()}
          className={cn(!micOn && 'bg-red-500/20 text-red-400')}
        >
          {micOn ? <Mic size={22} /> : <MicOff size={22} />}
        </IconButton>
        {isVideo && (
          <IconButton
            label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            onClick={() => callManager.toggleCamera()}
            className={cn(!cameraOn && 'bg-red-500/20 text-red-400')}
          >
            {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          </IconButton>
        )}
        <IconButton
          label="Hang up"
          onClick={() => void callManager.hangUp()}
          className="bg-red-500 text-white hover:bg-red-600"
        >
          <PhoneOff size={22} />
        </IconButton>
      </div>
    </div>
  );
}
