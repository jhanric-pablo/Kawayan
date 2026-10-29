import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Captions, CaptionsOff, Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';

/** Chapters of public/demo/kawayan-promo.mp4 (the promo from ../kawayan-promo, built from real app screens).
 *  Each chapter's narration starts just after its `at`, so jumping never lands mid-sentence. */
const CHAPTERS = [
  { at: 0, title: 'Meet Kawayan', text: 'Why posting every day is hard, and who Kawayan is for.' },
  { at: 11.1, title: 'Plan and write', text: 'Kawayan drafts the month and writes each post in Taglish.' },
  { at: 22.9, title: 'Schedule and track', text: 'Facebook and Instagram on one timeline, posted for you.' },
  { at: 33, title: 'Make it yours', text: 'Four themes, an admin console, and the plans.' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * The product demo, played on request in a native <dialog> (focus trap, Esc and the backdrop
 * come with it). The video only loads once the dialog opens; the chapters are the progress bar.
 * It starts with the voice-over on; if the browser refuses sound, it plays muted with captions
 * and an Unmute button.
 */
const DemoModal: React.FC<Props> = ({ open, onClose, onStart }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<FullscreenVideo>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(48.2);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setTime(0);
      setEnded(false);
      setMuted(false);
      setCaptions(true);
      dialog.showModal();
      closeRef.current?.focus(); // not the sign-up button, which comes first in the markup
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Start with sound; the click that opened the dialog usually allows it.
  useEffect(() => {
    const v = videoRef.current;
    if (!open || !v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => undefined);
    });
  }, [open]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  };

  const jump = (at: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = at;
    v.play().catch(() => undefined);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };

  const toggleCaptions = () => {
    const track = videoRef.current?.textTracks[0];
    if (!track) return;
    track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
    setCaptions(track.mode === 'showing');
  };

  const fullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    // iPhone Safari only has the video-specific API.
    if (v.requestFullscreen) v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  return (
    <dialog
      ref={dialogRef}
      className="lp-demo"
      aria-labelledby="lp-demo-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="lp-demo__panel">
        <div className="lp-demo__title">
          <h2 id="lp-demo-title">Kawayan in under a minute</h2>
          <p>A quick tour built from real screens of the app.</p>
        </div>
        <button type="button" className="lp-demo__cta" onClick={onStart}>
          Start Free Trial <ArrowRight className="w-4 h-4" />
        </button>
        <button ref={closeRef} type="button" className="lp-demo__close" onClick={onClose} aria-label="Close demo">
          <X className="w-5 h-5" />
        </button>

        <div className="lp-demo__stage">
          {open && (
            <video
              ref={videoRef}
              className="lp-demo__video"
              src="/demo/kawayan-promo.mp4"
              poster="/demo/kawayan-promo.jpg"
              width={1920}
              height={1080}
              playsInline
              aria-label="Kawayan promo: planning a month of posts, writing Taglish captions with AI, scheduling to Facebook and Instagram, tracking posts, themes and the admin console"
              onClick={toggle}
              onPlay={() => {
                setPlaying(true);
                setEnded(false);
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => setEnded(true)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
            >
              <track kind="captions" src="/demo/kawayan-promo.vtt" srcLang="en" label="English" default />
            </video>
          )}
          {!playing && (
            <button type="button" className="lp-demo__big" onClick={ended ? () => jump(0) : toggle} aria-label={ended ? 'Watch again' : 'Play demo'}>
              {ended ? <RotateCcw className="w-7 h-7" /> : <Play className="w-7 h-7 translate-x-0.5" />}
            </button>
          )}
          <div className={`lp-demo__ctrls lp-demo__ctrls--left${muted ? ' is-pinned' : ''}`}>
            <button type="button" className="lp-demo__ctrl" onClick={toggle} aria-label={playing ? 'Pause demo' : 'Play demo'}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            {muted ? (
              <button type="button" className="lp-demo__ctrl lp-demo__ctrl--text" onClick={toggleMute}>
                <VolumeX className="w-4 h-4" /> Unmute
              </button>
            ) : (
              <button type="button" className="lp-demo__ctrl" onClick={toggleMute} aria-label="Mute voice-over">
                <Volume2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="lp-demo__ctrls lp-demo__ctrls--right">
            <button type="button" className="lp-demo__ctrl" onClick={toggleCaptions} aria-pressed={captions} aria-label="Captions">
              {captions ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />}
            </button>
            <button type="button" className="lp-demo__ctrl" onClick={fullscreen} aria-label="Watch full screen">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ol className="lp-demo__chapters">
          {CHAPTERS.map((c, i) => {
            const end = CHAPTERS[i + 1]?.at ?? duration;
            const progress = Math.min(1, Math.max(0, (time - c.at) / (end - c.at)));
            const active = ended ? i === CHAPTERS.length - 1 : time >= c.at && time < end;
            return (
              <li key={c.title}>
                <button
                  type="button"
                  className={active ? 'is-active' : undefined}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => jump(c.at)}
                >
                  <span className="lp-demo__bar" aria-hidden>
                    <i style={{ transform: `scaleX(${progress})` }} />
                  </span>
                  <b>
                    <span>{i + 1}</span> {c.title}
                  </b>
                  <small>{c.text}</small>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </dialog>
  );
};

export default DemoModal;
