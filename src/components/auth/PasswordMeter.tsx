import React from 'react';

export function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: '' };
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  const score = Math.max(1, Math.min(4, s));
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] };
}

/** Four-bar strength readout shown once the user starts typing a password. */
const PasswordMeter: React.FC<{ password: string }> = ({ password }) => {
  if (!password) return null;
  const { score, label } = passwordStrength(password);
  return (
    <div className="ax-meter" data-score={score}>
      <div className="ax-meter__bars">
        {[0, 1, 2, 3].map((i) => <span key={i} className={i < score ? 'is-on' : ''} />)}
      </div>
      <span className="ax-meter__label">{label}</span>
    </div>
  );
};

export default PasswordMeter;
