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
  children: React.ReactNode;
}

/**
 * Open page: logo top-left, the form centred, and an optional panel beside it.
 * Switching modes animates: the title slides, the form resizes, the panel glides in.
 * Shared by sign-in, sign-up, staff login and password reset.
 */
const AuthShell: React.FC<Props> = ({
  onBack, title, subtitle, darkMode, toggleTheme, headerExtra, footer, aside, children,
}) => (
  <MotionConfig reducedMotion="user">
    <LazyMotion features={domMax} strict>
      <div className="ax">
        <header className="ax__bar">
          <button type="button" className="ax__brand" onClick={onBack} aria-label="Kawayan home">
            <KawayanLogo size={17} />
          </button>
          <div className="ax__tools">
            <button type="button" className="ax__back" onClick={onBack}>
              <ArrowLeft aria-hidden /> Home
            </button>
            {toggleTheme && (
              <m.button
                type="button"
                className="ax__theme"
                onClick={toggleTheme}
                whileTap={{ scale: 0.88, rotate: -20 }}
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun aria-hidden /> : <Moon aria-hidden />}
              </m.button>
            )}
          </div>
        </header>

        <main className="ax__stage">
          <m.section layout className="ax__panel" transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
            <div className="ax__head">
              <AnimatePresence mode="wait" initial={false}>
                <m.h1
                  key={title}
                  className="ax__title"
                  initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                  transition={{ duration: 0.22 }}
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
          <AnimatePresence>{aside}</AnimatePresence>
        </main>
      </div>
    </LazyMotion>
  </MotionConfig>
);

export default AuthShell;
