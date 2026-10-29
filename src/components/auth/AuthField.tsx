import React from 'react';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

/**
 * Floating-label input. Declared at module scope (never inside a render) so
 * the input keeps DOM identity and focus while the user types.
 */
const AuthField: React.FC<Props> = ({
  id, label, value, onChange, type = 'text', icon, trailing,
  required, autoComplete, autoFocus, inputMode,
}) => (
  <div className={`ax-field${icon ? '' : ' ax-field--plain'}${trailing ? ' ax-field--trailing' : ''}`}>
    {icon && <span className="ax-field__icon" aria-hidden="true">{icon}</span>}
    <input
      id={id}
      className="ax-input"
      type={type}
      value={value}
      onChange={onChange}
      placeholder=" "
      required={required}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      inputMode={inputMode}
    />
    <label htmlFor={id} className="ax-label">{label}</label>
    {trailing && <div className="ax-trailing">{trailing}</div>}
  </div>
);

export default AuthField;
