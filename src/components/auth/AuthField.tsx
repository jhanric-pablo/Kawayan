import React from 'react';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  trailing?: React.ReactNode;
  required?: boolean;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
}

/**
 * Labelled input: the label sits above the field, always visible. Declared at module
 * scope (never inside a render) so the input keeps DOM identity and focus while typing.
 */
const AuthField: React.FC<Props> = ({
  id, label, value, onChange, type = 'text', trailing,
  required, autoComplete, autoFocus, inputMode, placeholder,
}) => (
  <div className="ax-field">
    <label htmlFor={id} className="ax-label">{label}</label>
    <div className={`ax-field__box${trailing ? ' ax-field__box--trailing' : ''}`}>
      <input
        id={id}
        className="ax-input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
      />
      {trailing && <div className="ax-trailing">{trailing}</div>}
    </div>
  </div>
);

export default AuthField;
