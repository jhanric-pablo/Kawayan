import React, { useState } from 'react';
import { PanelLeft } from 'lucide-react';
import clsx from 'clsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useSidebar } from '../ui/sidebar';

/** Shared by the owner shell (DashboardLayout) and the admin console: shadcn Sidebar glue. */

export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

/**
 * Names an icon-only (collapsed) sidebar item. Expanded sidebars show the text, so the tip stays hidden there.
 * A real tooltip rather than `title`: native ones can stay stuck on screen after a click re-renders the page.
 */
export const SideTip: React.FC<{ label: string; show: boolean; children: React.ReactElement }> = ({ label, show, children }) => (
  <Tooltip>
    <TooltipTrigger render={children} />
    <TooltipContent side="right" sideOffset={10} className={clsx('font-medium', !show && 'hidden')}>{label}</TooltipContent>
  </Tooltip>
);

const SIDE_KEY = 'kawayan_sidebar_open';
/** Collapsed or open, per device. Starts collapsed on narrow tablets when nothing is saved. */
export function readSideOpen(): boolean {
  try {
    const v = localStorage.getItem(SIDE_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    /* storage blocked */
  }
  return typeof window === 'undefined' || window.innerWidth >= 1024;
}
export function writeSideOpen(open: boolean) {
  try {
    localStorage.setItem(SIDE_KEY, open ? '1' : '0');
  } catch {
    /* storage blocked */
  }
}

/** Hands the sidebar context to the layout (which renders the provider, so can't read it directly). */
export const SidebarBridge: React.FC<{ sidebarRef: React.MutableRefObject<ReturnType<typeof useSidebar> | null> }> = ({ sidebarRef }) => {
  sidebarRef.current = useSidebar();
  return null;
};

/** Top-bar toggle: collapses the desktop sidebar, or opens the phone drawer. */
export const SideToggle: React.FC = () => {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      className="kw-icon-btn"
      onClick={toggleSidebar}
      aria-label={isMobile ? 'Open menu' : open ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
      title={isMobile ? undefined : `${open ? 'Collapse' : 'Expand'} sidebar (${MOD_KEY}B)`}
      aria-expanded={isMobile ? openMobile : open}
    >
      <PanelLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
    </button>
  );
};


/** [open, setOpen] for the desktop sidebar, saved on this device. */
export function useSideOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(() => readSideOpen());
  return [open, (next: boolean) => { setOpen(next); writeSideOpen(next); }];
}
