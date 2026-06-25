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
      className="fixed inset-0 bg-[#0F172A]/10 dark:bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organic-dialog-title"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-[#0F172A] border border-[#0F172A]/10 dark:border-[#4D7CFF]/20 rounded-[2rem] p-8 max-w-md w-full shadow-[0_10px_40px_-10px_rgba(0,82,255,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] mx-4 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="organic-dialog-title"
          className="font-display text-lg font-semibold text-[#0F172A] dark:text-white mb-3 leading-snug"
          style={{ fontWeight: 600 }}
        >
          {isPrompt ? options.message : title}
        </h2>

        {!isPrompt && (
          <p className="font-sans text-sm text-[#0F172A]/70 dark:text-white/80 leading-relaxed whitespace-pre-wrap mb-6">
            {options.message}
          </p>
        )}

        {isPrompt && options.title && (
          <p className="font-sans text-xs text-[#0F172A] mb-4">{options.title}</p>
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
            className="rounded-full bg-white/40 dark:bg-black/20 border border-[#0F172A]/10 dark:border-[#4D7CFF]/20 px-6 py-3 text-sm text-[#0F172A] dark:text-white placeholder:text-[#0F172A]/45 dark:placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-[#64748B]/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0F172A] outline-none w-full transition-all duration-300 font-sans mb-6"
            aria-label={options.message}
          />
        )}

        <div className="flex flex-wrap justify-end gap-3">
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border-2 border-[#64748B]/50 dark:border-[#4D7CFF]/40 text-[#64748B] dark:text-[#4D7CFF] px-6 py-2.5 text-sm font-semibold hover:bg-[#64748B]/5 dark:hover:bg-[#4D7CFF]/10 transition-all duration-300"
            >
              {options.cancelLabel ?? 'Cancel'}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className="organic-btn-primary rounded-full px-6 py-2.5 text-sm font-semibold hover:scale-105 active:scale-95 transition-all duration-300 ease-out"
          >
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
