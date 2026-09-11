import React, { useState } from 'react';
import { ViewState } from '../../types';
import { ValidationService } from '../../services/validationService';
import { ArrowRight, Lock, Eye, EyeOff } from 'lucide-react';
import './authScreen.css';

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
    <div className="af-screen">
      <div className="af-grid">
        <button type="button" className="af-back" onClick={() => onNavigate(ViewState.LANDING)}>
          ← Kawayan
        </button>

        <div className="af-formwrap" style={{ gridColumn: '1 / -1' }}>
          <div className="af-formcard">
            <p className="af-formcard__title">Set a new password</p>

            {done ? (
              <>
                <p className="af-sub">Your password has been updated.</p>
                <button type="button" className="af-submit" onClick={() => onNavigate(ViewState.LOGIN)}>
                  <span>Go to sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <form onSubmit={submit} className="af-form">
                <div className="af-field af-field--icon">
                  <span className="af-field__icon" aria-hidden="true"><Lock /></span>
                  <input
                    id="rp-pw"
                    className="af-input"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder=" "
                    required
                    autoComplete="new-password"
                  />
                  <label htmlFor="rp-pw" className="af-label">New password</label>
                  <div className="af-trailing">
                    <button type="button" className="af-show" tabIndex={-1} onClick={() => setShow((s) => !s)}
                      aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                  <span className="af-underline" aria-hidden="true" />
                </div>

                <div className="af-field af-field--icon">
                  <span className="af-field__icon" aria-hidden="true"><Lock /></span>
                  <input
                    id="rp-confirm"
                    className="af-input"
                    type={show ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder=" "
                    required
                    autoComplete="new-password"
                  />
                  <label htmlFor="rp-confirm" className="af-label">Confirm password</label>
                  <span className="af-underline" aria-hidden="true" />
                </div>

                {errors.length > 0 && (
                  <div className="af-error">
                    <strong>Password needs</strong>
                    <ul>{errors.map((er, i) => <li key={i}>{er}</li>)}</ul>
                  </div>
                )}
                {error && <div className="af-error">{error}</div>}

                <button type="submit" className="af-submit" disabled={loading}>
                  <span>{loading ? 'Just a sec…' : 'Update password'}</span>
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <button type="button" className="af-alt" onClick={() => onNavigate(ViewState.LOGIN)}>
                  ← Back to sign in
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
