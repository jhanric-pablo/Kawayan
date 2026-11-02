import React, { useEffect, useRef, useState } from 'react';
import {
  CallControls, SpeakerLayout, StreamCall, StreamTheme, StreamVideo, StreamVideoClient, type Call,
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import clsx from 'clsx';
import './callWindow.css';

interface Props {
  apiKey: string;
  token: string;
  user: { id: string; name: string };
  callId: string;
  kind: 'video' | 'voice';
  title: string;
  /** Pinned to the top of the help panel instead of floating in the corner. */
  docked?: boolean;
  /** Called once when this person leaves (or the call can't start), with how long they were in it. */
  onLeave: (durationSec: number) => void;
}

// The SDK's typings mark its placeholder props as required, but it supplies defaults when they're left out.
const Speaker = SpeakerLayout as unknown as React.FC<Partial<React.ComponentProps<typeof SpeakerLayout>>>;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * A support call (voice, video and screen share) on Stream Video, in a floating window that can
 * go full screen. Loaded on demand, so the video SDK isn't part of the main app bundle.
 */
const CallWindow: React.FC<Props> = ({ apiKey, token, user, callId, kind, title, docked, onLeave }) => {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [error, setError] = useState('');
  const [big, setBig] = useState(false);
  const [secs, setSecs] = useState(0);
  const joinedAt = useRef<number | null>(null);
  const left = useRef(false);

  const leave = () => {
    if (left.current) return;
    left.current = true;
    onLeave(joinedAt.current ? Math.round((Date.now() - joinedAt.current) / 1000) : 0);
  };

  useEffect(() => {
    // A client per mount: a shared one gets disconnected by the previous mount's cleanup
    // while this one is still joining (React runs effects twice in development).
    const c = new StreamVideoClient({ apiKey, user, token });
    const theCall = c.call('default', callId);
    let cancelled = false;
    const joined = (async () => {
      try {
        await theCall.join({ create: true });
        if (kind === 'voice') await theCall.camera.disable();
        else await theCall.camera.enable().catch(() => undefined); // no camera: still in the call
        await theCall.microphone.enable().catch(() => undefined);
        if (cancelled) return;
        joinedAt.current = Date.now();
        setClient(c);
        setCall(theCall);
      } catch (e: any) {
        if (!cancelled) setError(e?.message?.includes('Permission') ? 'Allow your microphone (and camera) in the browser, then try again.' : 'Could not connect the call. Check your connection and try again.');
      }
    })();
    return () => {
      cancelled = true;
      // Leave only once joining has settled, then sign this client out.
      joined.finally(() => theCall.leave().catch(() => undefined).finally(() => c.disconnectUser().catch(() => undefined)));
    };
  }, [apiKey, token, user.id, user.name, callId, kind]);

  useEffect(() => {
    if (!call) return;
    const t = setInterval(() => joinedAt.current && setSecs(Math.round((Date.now() - joinedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call]);

  return (
    <div className={clsx('cw', big && 'is-big', docked && 'is-docked')} role="dialog" aria-label={`${kind === 'voice' ? 'Voice' : 'Video'} call: ${title}`}>
      <div className="cw__bar">
        <span className="cw__dot" aria-hidden />
        <b>{title}</b>
        <span className="cw__time">{call ? mmss(secs) : 'Connecting…'}</span>
        <button type="button" onClick={() => setBig((v) => !v)} aria-label={big ? 'Smaller window' : 'Full screen'}>
          {big ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </button>
      </div>
      <div className="cw__body">
        {error ? (
          <div className="cw__state"><p>{error}</p><button type="button" className="cw__leave" onClick={leave}>Close</button></div>
        ) : client && call ? (
          <StreamVideo client={client}>
            <StreamTheme className="cw__theme">
              <StreamCall call={call}>
                <Speaker participantsBarPosition="bottom" />
                <CallControls onLeave={leave} />
              </StreamCall>
            </StreamTheme>
          </StreamVideo>
        ) : (
          <div className="cw__state"><Loader2 className="animate-spin" aria-hidden /><p>Connecting the call…</p></div>
        )}
      </div>
    </div>
  );
};

export default CallWindow;
