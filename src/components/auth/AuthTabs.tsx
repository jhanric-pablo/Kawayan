import React from 'react';

interface Props {
  isSignUp: boolean;
  onChange: (isSignUp: boolean) => void;
}

/** Sign in ⇄ Create account segmented control with a sliding indicator. */
const AuthTabs: React.FC<Props> = ({ isSignUp, onChange }) => (
  <div className="ax-tabs" role="tablist">
    <span
      className="ax-tabs__ink"
      aria-hidden="true"
      style={{ transform: `translateX(${isSignUp ? '100%' : '0'})` }}
    />
    <button
      type="button"
      role="tab"
      aria-selected={!isSignUp}
      className={!isSignUp ? 'is-active' : ''}
      onClick={() => onChange(false)}
    >
      Sign in
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={isSignUp}
      className={isSignUp ? 'is-active' : ''}
      onClick={() => onChange(true)}
    >
      Create account
    </button>
  </div>
);

export default AuthTabs;
