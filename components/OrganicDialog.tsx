import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type OrganicDialogType = 'alert' | 'confirm' | 'prompt';

export interface OrganicDialogOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  okLabel?: string;
}

type ActiveDialog = {
  type: OrganicDialogType;
  options: OrganicDialogOptions;
};

type Resolver =
  | { kind: 'alert'; resolve: () => void }
  | { kind: 'confirm'; resolve: (value: boolean) => void }
  | { kind: 'prompt'; resolve: (value: string | null) => void };

function normalizeOptions(input: OrganicDialogOptions | string): OrganicDialogOptions {
  return typeof input === 'string' ? { message: input } : input;
}

interface OrganicDialogContextValue {
  alert: (input: OrganicDialogOptions | string) => Promise<void>;
  confirm: (input: OrganicDialogOptions | string) => Promise<boolean>;
  prompt: (input: OrganicDialogOptions | string) => Promise<string | null>;
}

const OrganicDialogContext = createContext<OrganicDialogContextValue | null>(null);

export const useOrganicDialog = (): OrganicDialogContextValue => {
  const ctx = useContext(OrganicDialogContext);
  if (!ctx) {
    throw new Error('useOrganicDialog must be used within OrganicDialogProvider');
  }
  return ctx;
};

const OrganicDialogModal: React.FC<{
  dialog: ActiveDialog;
  inputValue: string;
  setInputValue: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ dialog, inputValue, setInputValue, onConfirm, onCancel }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { type, options } = dialog;

  useEffect(() => {
    if (type === 'prompt') {
      inputRef.current?.focus();
    }
  }, [type]);

  const title =
    options.title ??
    (type === 'alert' ? 'Notice' : type === 'confirm' ? 'Please Confirm' : 'Enter Value');

  const showCancel = type !== 'alert';
  const confirmLabel =
    options.confirmLabel ?? options.okLabel ?? (type === 'alert' ? 'OK' : 'Confirm');

  const isPrompt = type === 'prompt';

  return (
    <div
      className="kw-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organic-dialog-title"
      onClick={onCancel}
    >
      <div
        className="kw-sheet p-6 sm:p-7 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="organic-dialog-title"
          className="font-display text-lg font-semibold mb-2 leading-snug"
          style={{ color: 'var(--fg)' }}
        >
          {isPrompt ? options.message : title}
        </h2>

        {!isPrompt && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap mb-6" style={{ color: 'var(--fg-muted)' }}>
            {options.message}
          </p>
        )}

        {isPrompt && options.title && (
          <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>{options.title}</p>
        )}

        {isPrompt && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
              }
            }}
            placeholder={options.placeholder ?? 'Type here…'}
            className="input mb-6"
            aria-label={options.message}
          />
        )}

        <div className="flex flex-wrap justify-end gap-2.5">
          {showCancel && (
            <button type="button" onClick={onCancel} className="btn btn-outline">
              {options.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button type="button" onClick={onConfirm} className="btn btn-primary">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const OrganicDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeDialog, setActiveDialog] = useState<ActiveDialog | null>(null);
  const [inputValue, setInputValue] = useState('');
  const resolverRef = useRef<Resolver | null>(null);

  const closeDialog = useCallback((cleanupInput = true) => {
    setActiveDialog(null);
    if (cleanupInput) setInputValue('');
    resolverRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    const resolver = resolverRef.current;
    if (!resolver) return;
    if (resolver.kind === 'alert') {
      resolver.resolve();
    } else if (resolver.kind === 'confirm') {
      resolver.resolve(false);
    } else {
      resolver.resolve(null);
    }
    closeDialog();
  }, [closeDialog]);

  const handleConfirm = useCallback(() => {
    const resolver = resolverRef.current;
    if (!resolver || !activeDialog) return;

    if (resolver.kind === 'alert') {
      resolver.resolve();
    } else if (resolver.kind === 'confirm') {
      resolver.resolve(true);
    } else {
      const trimmed = inputValue.trim();
      resolver.resolve(trimmed || null);
    }
    closeDialog();
  }, [activeDialog, closeDialog, inputValue]);

  useEffect(() => {
    if (!activeDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDialog, handleCancel]);

  const alert = useCallback(
    (input: OrganicDialogOptions | string) =>
      new Promise<void>((resolve) => {
        const options = normalizeOptions(input);
        resolverRef.current = { kind: 'alert', resolve };
        setActiveDialog({ type: 'alert', options });
      }),
    []
  );

  const confirm = useCallback(
    (input: OrganicDialogOptions | string) =>
      new Promise<boolean>((resolve) => {
        const options = normalizeOptions(input);
        resolverRef.current = { kind: 'confirm', resolve };
        setActiveDialog({ type: 'confirm', options });
      }),
    []
  );

  const prompt = useCallback(
    (input: OrganicDialogOptions | string) =>
      new Promise<string | null>((resolve) => {
        const options = normalizeOptions(input);
        setInputValue(options.defaultValue ?? '');
        resolverRef.current = { kind: 'prompt', resolve };
        setActiveDialog({ type: 'prompt', options });
      }),
    []
  );

  return (
    <OrganicDialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {activeDialog && (
        <OrganicDialogModal
          dialog={activeDialog}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </OrganicDialogContext.Provider>
  );
};

export default OrganicDialogProvider;
