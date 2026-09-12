import React, { useState } from 'react';
import { ViewState } from '../../types';
import { ValidationService } from '../../services/validationService';
import { ArrowRight, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import AuthShell from './AuthShell';
import AuthField from './AuthField';
import PasswordMeter from './PasswordMeter';

interface Props {
  token: string | null;
  onNavigate: (view: ViewState) => void;
}

const ResetPassword: React.FC<Props> = ({ token, onNavigate }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrors([]);

    if (!token) { setError('Missing reset token. Request a new link.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    const v = ValidationService.validatePassword(password);
    if (!v.isValid) { setErrors(v.errors); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to reset password.'); return; }
      setDone(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      onBack={() => onNavigate(ViewState.LANDING)}
      eyebrow="Account recovery"
      title={done ? <>You’re all <em>set.</em></> : <>Set a new <em>password.</em></>}
      subtitle={done
        ? 'Your password has been updated — sign in to pick up where you left off.'
        : 'Choose something strong you haven’t used elsewhere.'}
      footer={
        <div className="ax__foot">
          <span className="ax__foot-item"><ShieldCheck /> This link expires in 1 hour</span>
        </div>
      }
    >
      {done ? (
        <div className="ax-form">
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => onNavigate(ViewState.LOGIN)}>
            <span>Go to sign in</span>
            <ArrowRight />
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="ax-form">
          <AuthField
            id="rp-pw"
            label="New password"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            autoComplete="new-password"
            icon={<Lock />}
            trailing={
              <button
                type="button"
                className="ax-eye"
                tabIndex={-1}
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            }
          />
          <PasswordMeter password={password} />

          <AuthField
            id="rp-confirm"
            label="Confirm password"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            icon={<Lock />}
          />

          {errors.length > 0 && (
            <div className="ax-error">
              <strong>Password needs</strong>
              <ul>{errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
            </div>
          )}
          {error && <div className="ax-error">{error}</div>}

          <div className="ax-actions">
            <button type="submit" className="ax-btn ax-btn--primary" disabled={loading}>
              <span>{loading ? 'Just a sec…' : 'Update password'}</span>
              {!loading && <ArrowRight />}
            </button>
          </div>

          <button type="button" className="ax-link" onClick={() => onNavigate(ViewState.LOGIN)}>
            ← Back to sign in
          </button>
        </form>
      )}
    </AuthShell>
  );
};

export default ResetPassword;
