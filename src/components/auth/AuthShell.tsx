import React from 'react';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from 'motion/react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import './authShell.css';
import KawayanLogo from '../KawayanLogo';

interface Props {
  onBack: () => void;
  title: string;
  /** Under the title: the "Already have an account? Sign in" switch, or a line of context. */
  subtitle?: React.ReactNode;
  darkMode?: boolean;
  toggleTheme?: () => void;
  /** Under the subtitle (the sign-up steps). */
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  /** Beside the form on wide screens (sign-up's "what happens next"). */
  aside?: React.ReactNode;
  /** 'center': one centred card on a dotted page (password reset). Default 'split'. */
  layout?: 'split' | 'center';
  /** Replaces "Home" in the top bar (sign-up's "Log in instead"). */
  barAction?: { label: string; onClick: () => void };
  children: React.ReactNode;
}

/** Sample images from the AI generator, for the panel beside the form. Decorative. */
const COLLAGE = ['/hero/ai/panaderia-1.jpg', '/hero/ai/milktea-2.jpg', '/hero/ai/carinderia-1.jpg'];

/**
 * Open page: logo top-left, the form centred, and an optional panel beside it.
 * Switching modes animates: the title slides, the form resizes, the panel glides in.
 * Shared by sign-in, sign-up, staff login and password reset.
 */
const AuthShell: React.FC<Props> = ({
  onBack, title, subtitle, darkMode, toggleTheme, headerExtra, footer, aside, layout = 'split', barAction, children,
}) => (
  <MotionConfig reducedMotion="user">
    <LazyMotion features={domMax} strict>
      <div className={layout === 'center' ? 'ax ax--center' : 'ax'}>
        <header className="ax__bar">
          <button type="button" className="ax__brand" onClick={onBack} aria-label="Kawayan home">
            <KawayanLogo size={17} />
          </button>
          <div className="ax__tools">
            {barAction ? (
              <button type="button" className="ax__back" onClick={barAction.onClick}>{barAction.label}</button>
            ) : (
              <button type="button" className="ax__back" onClick={onBack}>
                <ArrowLeft aria-hidden /> Home
              </button>
            )}
            {toggleTheme && (
              <m.button
                type="button"
                className="ax__theme"
                onClick={toggleTheme}
                whileTap={{ scale: 0.94 }}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun aria-hidden /> : <Moon aria-hidden />}
              </m.button>
            )}
          </div>
        </header>

        <main className="ax__stage">
          <m.section layout="position" className="ax__panel" transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="ax__head">
              <AnimatePresence mode="wait" initial={false}>
                <m.h1
                  key={title}
                  className="ax__title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {title}
                </m.h1>
              </AnimatePresence>
              {subtitle && <p className="ax__sub">{subtitle}</p>}
              {headerExtra}
            </div>
            {children}
            {footer}
          </m.section>
        </main>
        {layout === 'split' && (
          <aside className="ax__side" aria-hidden={aside ? undefined : true}>
            <AnimatePresence>{aside}</AnimatePresence>
            {!aside && (
              <div className="ax-collage">
                {COLLAGE.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}
              </div>
            )}
          </aside>
        )}
      </div>
    </LazyMotion>
  </MotionConfig>
);

export default AuthShell;
