import React from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import clsx from 'clsx';

export type IslandTone = 'success' | 'error' | 'info';
export interface IslandAction {
  label: string;
  onClick: () => void;
}

const DOT: Record<IslandTone, string> = {
  success: 'bg-mint-400',
  info: 'bg-mint-400',
  error: 'bg-red-500',
};

/** Top-centre pill for session and system events. Every toast in the app renders as one. */
const DynamicIslandAlert: React.FC<{
  message: string;
  tone: IslandTone;
  action?: IslandAction;
  onDismiss: () => void;
}> = ({ message, tone, action, onDismiss }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className="pointer-events-auto flex max-w-full items-center gap-3 rounded-[1.4rem] border border-zinc-700/50 bg-zinc-900/90 py-1.5 pl-4 pr-1.5 text-[13px] font-medium text-zinc-100 shadow-xl backdrop-blur-md animate-island-in motion-reduce:animate-none"
  >
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      <span className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden', DOT[tone])} />
      <span className={clsx('relative inline-flex h-2 w-2 rounded-full', DOT[tone])} />
    </span>
    <span className="min-w-0 flex-1 py-1 leading-snug">{message}</span>
    {action && (
      <button
        type="button"
        onClick={() => {
          action.onClick();
          onDismiss();
        }}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold text-mint-400 transition-colors hover:bg-white/10"
      >
        {action.label}
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
    )}
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
    >
      <X className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  </div>
);

export default DynamicIslandAlert;
