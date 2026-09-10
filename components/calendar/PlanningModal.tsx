import React, { useEffect } from 'react';
import { ContentIdea } from '../../types';
import {
  Layers, X, RefreshCcw, Wand2, Loader2, ArrowRight, ChevronDown,
  Image as ImageIcon, Video, LayoutGrid, Type, Check, AlertTriangle, Sparkles,
} from 'lucide-react';
import './postComposer.css';
import './planningModal.css';

/**
 * PlanningModal — the month-level AI content-planning studio.
 *
 * Sits on the shared PostComposer dialog shell so month-planning and day-editing
 * feel like one product. Pure UI — every action maps to a handler that already
 * lives in ContentCalendar.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  monthLabel: string;
  planLabel: string;
  batchPostCount: number;
  monthlyPostCount: number;
  trialLimitReached: boolean;
  batchStrategy: string;
  onStrategyChange: (v: string) => void;
  loadingPlan: boolean;
  batchProgress: { current: number; total: number } | null;
  ideas: ContentIdea[];
  showBatchIdeas: boolean;
  onToggleIdeas: () => void;
  onGeneratePlan: () => void;
  onBatchGenerate: () => void;
  onUpdateIdea: (index: number, field: keyof ContentIdea, value: string | number) => void;
  onOpenDay: (day: number) => void;
}

type FmtKey = ContentIdea['format'];
const FORMATS: { key: FmtKey; label: string; Icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { key: 'Image', label: 'Image', Icon: ImageIcon, color: '#2B5748' },
  { key: 'Carousel', label: 'Carousel', Icon: LayoutGrid, color: '#9CB080' },
  { key: 'Video', label: 'Video', Icon: Video, color: '#D9791F' },
  { key: 'Text', label: 'Text', Icon: Type, color: '#5E7F63' },
];
const FMT_COLOR: Record<string, string> = Object.fromEntries(FORMATS.map((f) => [f.key, f.color]));

const STRATEGY_PRESETS = [
  'Seasonal & local specials',
  'New product launch',
  'Promo / limited-time sale',
  'Behind the scenes week',
  'Customer spotlights',
  'Educational tips & how-tos',
];

const FormatPicker: React.FC<{ value: FmtKey; onChange: (v: FmtKey) => void }> = ({ value, onChange }) => (
  <div className="pm-fmt" role="group" aria-label="Content format">
    {FORMATS.map((f) => (
      <button
        key={f.key}
        type="button"
        aria-pressed={value === f.key}
        className={`pm-fmt__opt${value === f.key ? ' is-active' : ''}`}
        style={{ ['--fmt' as string]: f.color }}
        onClick={() => onChange(f.key)}
      >
        <f.Icon className="w-3 h-3" />
        <span>{f.label}</span>
      </button>
    ))}
  </div>
);

const PlanningModal: React.FC<Props> = ({
  open,
  onClose,
  monthLabel,
  planLabel,
  batchPostCount,
  monthlyPostCount,
  trialLimitReached,
  batchStrategy,
  onStrategyChange,
  loadingPlan,
  batchProgress,
  ideas,
  showBatchIdeas,
  onToggleIdeas,
  onGeneratePlan,
  onBatchGenerate,
  onUpdateIdea,
  onOpenDay,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const monthShort = monthLabel.split(' ').map((p, i) => (i === 0 ? p.slice(0, 3) : p)).join(' ').toUpperCase();
  const progressLabel = batchProgress ? `Creating captions & visuals…` : 'Starting…';

  // Parse "September 2026" → real dates for the timeline + range labels
  const parsed = new Date(`${monthLabel} 1`);
  const validMonth = !Number.isNaN(parsed.getTime());
  const year = validMonth ? parsed.getFullYear() : new Date().getFullYear();
  const month = validMonth ? parsed.getMonth() : new Date().getMonth();
  const monShort = validMonth ? parsed.toLocaleDateString('en-US', { month: 'short' }) : '';
  const dow = (day: number) => {
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const dayNums = ideas.map((i) => i.day).filter((d) => Number.isFinite(d));
  const range =
    dayNums.length && monShort
      ? `${monShort} ${Math.min(...dayNums)} – ${monShort} ${Math.max(...dayNums)}`
      : '';
  const fmtCounts = FORMATS.map((f) => ({
    ...f,
    n: ideas.filter((i) => (i.format || 'Image') === f.key).length,
  }));

  const usagePct = batchPostCount > 0 ? Math.min(100, Math.round((monthlyPostCount / batchPostCount) * 100)) : 0;

  return (
    <div className="kw-composer-overlay" role="presentation">
      <div className="kw-composer-backdrop" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-title"
        className="kw-composer kw-composer--planning"
      >
        {/* ── Top bar ── */}
        <header className="kw-composer__bar">
          <div className="flex items-center gap-3 min-w-0">
            <span className="kw-composer__date">{monthShort}</span>
            <div className="min-w-0">
              <h2 id="planning-title" className="font-display text-lg font-bold text-[var(--fg)] truncate leading-tight">
                AI Content Planning
              </h2>
              <span className="text-xs text-[var(--fg-muted)]">
                {planLabel} plan · {monthlyPostCount}/{batchPostCount} posts used
                {ideas.length > 0 ? ` · ${ideas.length} idea${ideas.length === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          </div>

          <button type="button" onClick={onClose} aria-label="Close planning" className="kw-composer__close">
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* thin monthly-usage meter under the bar */}
        <div style={{ height: 3, background: 'var(--bg-alt)' }}>
          <div style={{ height: '100%', width: `${usagePct}%`, background: 'var(--primary)', transition: 'width 0.5s ease' }} />
        </div>

        {/* ── Body ── */}
        <div className="kw-composer__body">
          <div className="kw-composer__editor pm-editor">
            {trialLimitReached && (
              <div className="pm-banner">
                <AlertTriangle className="w-4 h-4" />
                <span><b>Trial limit reached</b> for {monthLabel}. Upgrade to Pro to keep batch-creating content.</span>
              </div>
            )}

            {/* Strategy */}
            <section>
              <label className="pm-label" htmlFor="kw-strategy">
                <Wand2 className="w-3.5 h-3.5" /> This month&apos;s content strategy
              </label>
              <textarea
                id="kw-strategy"
                className="pm-strategy__field"
                rows={3}
                value={batchStrategy}
                onChange={(e) => onStrategyChange(e.target.value)}
                placeholder='e.g. "Holiday sale promotion" or "Local organic bakery items launch"'
              />
              <div className="pm-chips">
                {STRATEGY_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`pm-chip${batchStrategy.trim() === s ? ' is-active' : ''}`}
                    onClick={() => onStrategyChange(batchStrategy.trim() === s ? '' : s)}
                  >
                    <Sparkles className="w-3 h-3" /> {s}
                  </button>
                ))}
              </div>
            </section>

            {/* Empty state */}
            {ideas.length === 0 && !loadingPlan && (
              <div className="pm-empty">
                <div className="pm-empty__icon"><Layers className="w-7 h-7" /></div>
                <h3>Plan the whole month</h3>
                <p>Turn your strategy into {batchPostCount} dated ideas, ready to edit and batch-create.</p>
                <ul className="pm-empty__list">
                  <li><Check className="w-4 h-4" /> {batchPostCount} dated content ideas</li>
                  <li><Check className="w-4 h-4" /> Editable titles, topics &amp; formats</li>
                  <li><Check className="w-4 h-4" /> One click → captions + visuals for all</li>
                </ul>
                <button type="button" onClick={onGeneratePlan} disabled={loadingPlan} className="pm-empty__cta">
                  <Wand2 className="w-4 h-4" /> Generate {batchPostCount} ideas
                </button>
              </div>
            )}

            {/* Loading skeleton (planning, no ideas yet) */}
            {ideas.length === 0 && loadingPlan && (
              <div className="pm-skel-wrap">
                <div className="pm-skel-head">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Drafting {batchPostCount} ideas around “{batchStrategy.trim() || 'your themes'}”…
                </div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div className="pm-skel" key={i}>
                    <div className="pm-skel__date pm-shimmer" style={{ animationDelay: `${i * 0.12}s` }} />
                    <div className="pm-skel__body pm-shimmer" style={{ animationDelay: `${i * 0.12 + 0.06}s` }} />
                  </div>
                ))}
              </div>
            )}

            {/* Plan + ideas */}
            {ideas.length > 0 && (
              <section>
                {/* Overview (new component) */}
                <div className="pm-overview">
                  <div className="pm-overview__head">
                    <span className="pm-overview__count">
                      {ideas.length} <span>{ideas.length === 1 ? 'idea' : 'ideas'} planned</span>
                    </span>
                    {range && <span className="pm-overview__range">{range}</span>}
                  </div>
                  <div className="pm-bar">
                    {fmtCounts.filter((f) => f.n > 0).map((f) => (
                      <div key={f.key} className="pm-bar__seg" style={{ flexGrow: f.n, background: f.color }} />
                    ))}
                  </div>
                  <div className="pm-legend">
                    {fmtCounts.map((f) => (
                      <span key={f.key} className={`pm-legend__item${f.n === 0 ? ' is-zero' : ''}`}>
                        <span className="pm-legend__dot" style={{ background: f.color }} />
                        {f.label} <span className="pm-legend__n">{f.n}</span>
                      </span>
                    ))}
                  </div>
                  <div className="pm-overview__foot">
                    <span className="pm-overview__hint">
                      {showBatchIdeas ? 'Fine-tune each idea below.' : 'Looks good? Batch-create them all.'}
                    </span>
                    <button type="button" onClick={onToggleIdeas} className={`pm-toggle${showBatchIdeas ? ' is-open' : ''}`}>
                      {showBatchIdeas ? 'Hide details' : 'Review & edit'}
                      <ChevronDown />
                    </button>
                  </div>
                </div>

                {/* Collapsed: quick day strip */}
                {!showBatchIdeas && (
                  <div className="pm-daystrip">
                    {ideas.map((idea, i) => (
                      <button
                        type="button"
                        key={`${idea.day}-${i}`}
                        className="pm-daypill"
                        onClick={() => onOpenDay(idea.day)}
                        title={idea.title}
                      >
                        <span className="pm-daypill__n">{idea.day}</span>
                        <i style={{ background: FMT_COLOR[idea.format] || '#2B5748' }} />
                        {idea.title || 'Untitled'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Expanded: full timeline editor */}
                {showBatchIdeas && (
                  <div className="pm-timeline" style={{ marginTop: 12 }}>
                    {ideas.map((idea, index) => (
                      <div key={`${idea.day}-${index}`} className="pm-idea">
                        <div className="pm-idea__date">
                          <span className="pm-idea__dow">{dow(idea.day)}</span>
                          <span className="pm-idea__num">{idea.day}</span>
                        </div>
                        <div className="pm-idea__body">
                          <div className="pm-idea__row">
                            <input
                              className="pm-idea__title"
                              value={idea.title}
                              onChange={(e) => onUpdateIdea(index, 'title', e.target.value)}
                              placeholder="Idea heading"
                            />
                            <button type="button" className="pm-open" onClick={() => onOpenDay(idea.day)}>
                              Open <ArrowRight />
                            </button>
                          </div>
                          <textarea
                            className="pm-idea__topic"
                            value={idea.topic}
                            onChange={(e) => onUpdateIdea(index, 'topic', e.target.value)}
                            rows={2}
                            placeholder="Topic / angle for this post"
                          />
                          <FormatPicker
                            value={idea.format}
                            onChange={(v) => onUpdateIdea(index, 'format', v)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        {/* ── Batch progress ── */}
        {batchProgress && (
          <div className="pm-progress">
            <div className="pm-progress__row">
              <span>{progressLabel}</span>
              <span>{batchProgress.current}/{batchProgress.total}</span>
            </div>
            <div className="pm-progress__track">
              <div
                className="pm-progress__fill"
                style={{ width: `${batchProgress.total ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="kw-composer__footer">
          <button
            type="button"
            onClick={onGeneratePlan}
            disabled={loadingPlan}
            className="kw-composer__footer-btn kw-composer__footer-btn--ghost"
          >
            {loadingPlan && !batchProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            {ideas.length > 0 ? 'Re-plan month' : 'Plan month'}
          </button>
          <button
            type="button"
            onClick={onBatchGenerate}
            disabled={loadingPlan || ideas.length === 0 || trialLimitReached}
            className="kw-composer__footer-btn kw-composer__footer-btn--primary"
          >
            {loadingPlan && batchProgress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {batchProgress.current}/{batchProgress.total}
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Batch create {ideas.length || batchPostCount}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PlanningModal;
