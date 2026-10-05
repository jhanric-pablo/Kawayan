import React, { useEffect, useState } from 'react';
import { Info, Loader2, Plus } from 'lucide-react';
import { socialService, SocialAccount, SocialPlatform } from '../services/socialService';
import { useOrganicDialog } from './OrganicDialog';
import { useToast } from './ui/Toast';

type GlyphProps = { className?: string };

export const FacebookGlyph: React.FC<GlyphProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#1877F2" aria-hidden>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const InstagramGlyph: React.FC<GlyphProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#E4405F" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
    <circle cx="12" cy="12" r="4.25" />
    <circle cx="17.4" cy="6.6" r="0.6" fill="#E4405F" stroke="none" />
  </svg>
);

export const TikTokGlyph: React.FC<GlyphProps> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const PLATFORMS: { id: SocialPlatform; name: string; detail: string; Glyph: React.FC }[] = [
  { id: 'facebook', name: 'Facebook', detail: 'Publishes to a Facebook Page you manage.', Glyph: FacebookGlyph },
  { id: 'instagram', name: 'Instagram', detail: 'Works with Instagram Business and Creator accounts.', Glyph: InstagramGlyph },
];

const BrandTile: React.FC<{ children: React.ReactNode; muted?: boolean }> = ({ children, muted }) => (
  <div
    className="w-10 h-10 shrink-0 rounded-[var(--r)] flex items-center justify-center"
    style={{
      border: '1px solid var(--border)',
      background: 'var(--card)',
      color: muted ? 'var(--fg-subtle)' : 'var(--fg)',
    }}
  >
    {children}
  </div>
);

const SocialAccounts: React.FC = () => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      setAccounts(await socialService.listAccounts());
      setLoadError('');
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Back from the platform's login: Zernio appends ?connected=<platform> or ?error=...
    const params = new URLSearchParams(window.location.search);
    if (params.has('social')) {
      const name = params.get('social');
      if (params.get('connected')) toast.success(`${name} connected`);
      else if (params.get('error')) toast.error(`Could not connect ${name}: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    loadAccounts();
  }, []);

  const handleConnect = async (platform: SocialPlatform) => {
    setBusy(platform);
    try {
      await socialService.connect(platform);
    } catch (e: any) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  const handleDisconnect = async (account: SocialAccount) => {
    const ok = await dialog.confirm(
      `Disconnect @${account.username}? Posts scheduled to this ${account.platform} account will no longer be published.`
    );
    if (!ok) return;
    setBusy(account.id);
    try {
      await socialService.disconnect(account.id);
      toast.success(`@${account.username} disconnected`);
      await loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const unavailable = !!loadError;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-head__title">Connected accounts</h1>
          <p className="page-head__sub">
            Link your pages once. Post now and Schedule in the calendar will then publish to them for you.
          </p>
        </div>
      </div>

      {loadError && (
        <div
          className="flex items-start gap-3 rounded-[var(--r-lg)] px-4 py-3"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}
          role="status"
        >
          <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--fg-muted)' }} />
          <p className="flex-1 text-sm" style={{ color: 'var(--fg-muted)' }}>{loadError}</p>
          <button onClick={loadAccounts} className="text-sm font-semibold shrink-0" style={{ color: 'var(--primary)' }}>
            Try again
          </button>
        </div>
      )}

      <div className="surface overflow-hidden">
        {PLATFORMS.map((p, i) => {
          const linked = accounts.filter((a) => a.platform === p.id);
          return (
            <div key={p.id} className="px-4 sm:px-5 py-4" style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}>
              <div className="flex items-start gap-3 sm:gap-4">
                <BrandTile><p.Glyph /></BrandTile>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{p.name}</p>
                  <p className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>{p.detail}</p>
                </div>
                <button
                  onClick={() => handleConnect(p.id)}
                  disabled={loading || unavailable || busy === p.id}
                  className="btn btn-outline btn-sm shrink-0"
                >
                  {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : linked.length > 0 && <Plus className="w-3.5 h-3.5" />}
                  {linked.length > 0 ? 'Add' : 'Connect'}
                </button>
              </div>

              {/* Indented to line up with the platform name (40px tile + 16px gap). */}
              {loading ? (
                <div className="mt-3 ml-[52px] sm:ml-14 h-3 w-32 rounded animate-pulse" style={{ background: 'var(--bg-alt)' }} />
              ) : (
                linked.length > 0 && (
                  <ul className="mt-3 ml-[52px] sm:ml-14 space-y-2">
                    {linked.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-[13px]">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: a.isActive ? 'var(--primary)' : 'var(--warning)' }}
                          aria-hidden
                        />
                        <span className="min-w-0 sm:flex sm:items-center sm:gap-2">
                          <span className="block font-medium truncate" style={{ color: 'var(--fg)' }}>@{a.username}</span>
                          {!a.isActive && (
                            <span className="block whitespace-nowrap text-xs" style={{ color: 'var(--fg-muted)' }}>Reconnect needed</span>
                          )}
                        </span>
                        <button
                          onClick={() => handleDisconnect(a)}
                          disabled={busy === a.id}
                          className="ml-auto shrink-0 text-xs font-medium hover:underline disabled:opacity-50"
                          style={{ color: 'var(--fg-muted)' }}
                        >
                          {busy === a.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          );
        })}

        <div className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
          <BrandTile muted><TikTokGlyph /></BrandTile>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>TikTok</p>
            <p className="text-[13px]" style={{ color: 'var(--fg-subtle)' }}>
              TikTok reviews apps before they can post publicly. We'll add it once Kawayan is approved.
            </p>
          </div>
          <span className="text-xs font-medium shrink-0 py-1.5 whitespace-nowrap" style={{ color: 'var(--fg-subtle)' }}>
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
};

export default SocialAccounts;
