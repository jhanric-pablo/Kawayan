import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './ui/chart';
import {
  ArrowDown, ArrowDownRight, ArrowUp, ArrowUpDown, ArrowUpRight, ChevronDown, Download, FileJson, FileSpreadsheet, GitCompareArrows, Image as ImageIcon, Trophy, X,
} from 'lucide-react';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { GeneratedPost } from '../types';
import { useToast } from './ui/Toast';
import { useFocusTrap } from '../utils/useFocusTrap';
import { PostChannels, postChannelsKey, readStored } from '../utils/workspaceFeed';
import { FacebookGlyph, InstagramGlyph } from './SocialAccounts';
import {
  COMPARE_METRICS, Day, Platform, PlatformFilter, PLATFORM_NAMES, PostStats,
  combineHistories, comparePosts, dailyHistory, growthCsv, isoDay, periods, postsCsv, postsInPeriod, summarize,
} from '../utils/insightsData';
import './insights.css';
import KwSelect from './ui/kw-select';

// 'year' = since January 1 (mockup "This year"); the numbers are "last N days".

/** Post rows shown before "Show all"; sorting still runs over every post. */
const ROW_PREVIEW = 5;
const RANGES = [7, 30, 90, 'year'] as const;
type Range = (typeof RANGES)[number];
const RANGE_LABEL: Record<string, string> = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', year: 'This year' };
const dayOfYear = (d: Date) => Math.max(1, Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 864e5) + 1);
type ChartMetric = 'followers' | 'reach' | 'interactions';
type SortKey = 'date' | 'reach' | 'interactions' | 'clicks' | 'engagementRate';

const MAX_COMPARE = 3;
const LETTERS = ['A', 'B', 'C'];
const CHART_METRICS: { key: ChartMetric; label: string }[] = [
  { key: 'followers', label: 'Followers' },
  { key: 'reach', label: 'Reach' },
  { key: 'interactions', label: 'Interactions' },
];
const GLYPHS: Record<Platform, React.FC<{ className?: string }>> = { facebook: FacebookGlyph, instagram: InstagramGlyph };

const num = (n: number) => Math.round(n).toLocaleString('en-PH');
const pct = (n: number) => `${n.toFixed(2)}%`;
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
const span = (ds: Day[]) => `${shortDate(ds[0].date)} – ${shortDate(ds[ds.length - 1].date)}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
/** KPI numbers like the mockup: 1,284 · 18.4k. */
const compactKpi = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : num(n));

function saveFile(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** +6.2% / −1.3 pts pill. `change` is a fraction, or percentage points when `points`. */
const Delta: React.FC<{ change: number; points?: boolean }> = ({ change, points }) => {
  const shown = points ? change : change * 100;
  const flat = Math.abs(shown) < 0.05;
  const Icon = shown > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`in-delta ${flat ? 'is-flat' : shown > 0 ? 'is-up' : 'is-down'}`} title="Compared with the previous period">
      {!flat && <Icon aria-hidden />}
      {flat ? (points ? '0 pts' : '0%') : `${shown > 0 ? '+' : '−'}${Math.abs(shown).toFixed(1)}${points ? ' pts' : '%'}`}
    </span>
  );
};

const Spark: React.FC<{ values: number[] }> = ({ values }) => {
  if (values.length < 2) return <svg className="in-spark" viewBox="0 0 100 30" aria-hidden />;
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [(i / Math.max(values.length - 1, 1)) * 100, 27 - ((v - min) / range) * 24]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg className="in-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,30 ${line} 100,30`} fill="color-mix(in srgb, var(--chart-ink) 7%, transparent)" />
      <polyline points={line} fill="none" stroke="var(--chart-ink)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

/** Day parts for "Best time to post". */
const DAY_PARTS = [
  { name: 'early morning', range: '5–9 AM', from: 5, to: 9 },
  { name: 'late morning', range: '9 AM–12 NN', from: 9, to: 12 },
  { name: 'lunchtime', range: '12–2 PM', from: 12, to: 14 },
  { name: 'afternoon', range: '2–5 PM', from: 14, to: 17 },
  { name: 'early evening', range: '5–8 PM', from: 17, to: 20 },
  { name: 'night', range: '8 PM–12 MN', from: 20, to: 24 },
];

const Thumb: React.FC<{ post: PostStats; className?: string }> = ({ post, className = 'in-thumb' }) => (
  <span className={className}>{post.imageUrl ? <img decoding="async" src={post.imageUrl} alt="" loading="lazy" /> : <ImageIcon aria-hidden />}</span>
);

interface ChartRow { label: string; prevLabel: string; cur: number; prev: number }


interface DownloadItem {
  title: string;
  desc: string;
  ext: string;
  Icon: React.ElementType;
  file: () => [name: string, body: string, type: string];
}

const DownloadMenu: React.FC<{ caption: string; items: DownloadItem[]; onDone: (name: string) => void }> = ({ caption, items, onDone }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: MouseEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const moveFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const els: HTMLElement[] = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = els.indexOf(document.activeElement as HTMLElement);
    els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
  };

  return (
    <div className="in-dl" ref={wrapRef}>
      <button ref={buttonRef} type="button" className="btn btn-outline btn-sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Download className="w-3.5 h-3.5" /> Export CSV <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="in-dl__menu" role="menu" aria-label="Download data" onKeyDown={moveFocus}>
          <div className="in-dl__head">{caption}</div>
          {items.map(({ title, desc, ext, Icon, file }) => (
            <button
              key={title}
              type="button"
              role="menuitem"
              className="in-dl__item"
              onClick={() => {
                const [name, body, type] = file();
                saveFile(name, body, type);
                setOpen(false);
                onDone(name);
              }}
            >
              <span className="in-dl__icon"><Icon /></span>
              <span>
                <span className="in-dl__t">{title}</span>
                <span className="in-dl__d">{desc}</span>
              </span>
              <span className="in-dl__ext">{ext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CompareDialog: React.FC<{ posts: PostStats[]; caption: string; onClose: () => void }> = ({ posts, caption, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  useFocusTrap(sheetRef, true);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { best, wins, winner } = comparePosts(posts);
  const letter = (p: PostStats) => LETTERS[posts.indexOf(p)];
  const runnerUp = posts.filter((p) => p !== winner).sort((a, b) => b.engagementRate - a.engagementRate)[0];
  const times = runnerUp.engagementRate ? winner.engagementRate / runnerUp.engagementRate : 1;
  const versus =
    winner.engagementRate === runnerUp.engagementRate
      ? `the same as Post ${letter(runnerUp)}'s, but it reached more people`
      : times >= 1.05
        ? `${times.toFixed(1)}× Post ${letter(runnerUp)}'s`
        : `just ahead of Post ${letter(runnerUp)}'s`;
  const hasScores = posts.some((p) => p.viralityScore != null);

  // Portalled: the page's fade-in animation makes its own stacking context, which would keep
  // the dialog under the sticky header.
  return createPortal(
    <div className="kw-overlay in-overlay" onClick={onClose}>
      <div ref={sheetRef} className="kw-sheet in-cmp" role="dialog" aria-modal="true" aria-labelledby="in-cmp-title" onClick={(e) => e.stopPropagation()}>
        <div className="in-cmp__head">
          <div>
            <h2 id="in-cmp-title">Compare posts</h2>
            <p>{caption}</p>
          </div>
          <button ref={closeRef} type="button" className="in-cmp__close" onClick={onClose} aria-label="Close comparison">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="in-cmp__body">
          <p className="in-verdict">
            <Trophy aria-hidden />
            <span>
              <b>Post {letter(winner)} · “{winner.topic}”</b> was the most effective. Its engagement rate of {pct(winner.engagementRate)} is {versus},
              and it led {wins(winner.id)} of {COMPARE_METRICS.length} metrics.
            </span>
          </p>

          <div className="in-cmp__grid" style={{ '--n': posts.length } as React.CSSProperties}>
            <div className="in-cmp__corner" />
            {posts.map((p, i) => {
              const Glyph = GLYPHS[p.platform];
              return (
                <div key={p.id} className={`in-cmp__post${p === winner ? ' is-winner' : ''}`}>
                  {p === winner && <span className="in-cmp__crown"><Trophy aria-hidden /> Most effective</span>}
                  <Thumb post={p} className="in-cmp__img" />
                  <div>
                    <div className="in-cmp__topic"><span className="in-cmp__letter">{LETTERS[i]}</span>{p.topic}</div>
                    <div className="in-cmp__caption">{p.caption}</div>
                  </div>
                  <div className="in-cmp__meta"><Glyph className="w-3.5 h-3.5" /> {PLATFORM_NAMES[p.platform]} · {shortDate(p.date)}</div>
                </div>
              );
            })}

            {COMPARE_METRICS.map((m) => {
              const isKey = m.key === 'engagementRate';
              const max = Math.max(...posts.map((p) => p[m.key] as number)) || 1;
              return (
                <React.Fragment key={m.key}>
                  <div className={`in-cmp__label${isKey ? ' is-key' : ''}`}>{m.label}</div>
                  {posts.map((p) => {
                    const v = p[m.key] as number;
                    const isBest = best[m.key].includes(p.id);
                    return (
                      <div key={p.id} className={`in-cmp__cell${isBest ? ' is-best' : ''}${isKey ? ' is-key' : ''}`}>
                        <div className="in-cmp__val">
                          {m.percent ? pct(v) : num(v)}
                          {isBest && <span className="in-chip is-top">Best</span>}
                        </div>
                        <div className="in-cmp__bar"><b style={{ width: `${(v / max) * 100}%` }} /></div>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {hasScores && (
              <>
                <div className="in-cmp__label" title="The score Kawayan's AI predicted when it wrote the post">Predicted (AI)</div>
                {posts.map((p) => (
                  <div key={p.id} className="in-cmp__cell in-cmp__muted">{p.viralityScore != null ? `${p.viralityScore} / 100` : '—'}</div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const InsightsDashboard: React.FC<{ userId: string }> = ({ userId }) => {
  const toast = useToast();
  const [today] = useState(() => new Date());
  const [range, setRange] = useState<Range>(30);
  const days = range === 'year' ? dayOfYear(today) : range;
  const [filter, setFilter] = useState<PlatformFilter>('all');
  const [metric, setMetric] = useState<ChartMetric>('reach');
  const [posts, setPosts] = useState<GeneratedPost[] | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 });
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [moreCols, setMoreCols] = useState(false);
  const [allRows, setAllRows] = useState(false);
  const closeCompare = useCallback(() => setComparing(false), []);

  useEffect(() => {
    let cancelled = false;
    new UniversalDatabaseService()
      .getUserPosts(userId)
      .then((p) => !cancelled && setPosts(p))
      .catch((e) => {
        console.error('Could not load posts for Insights', e);
        if (!cancelled) setPosts([]); // the examples still let the page demo
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const histories = useMemo(() => {
    const facebook = dailyHistory(userId, 'facebook', today);
    const instagram = dailyHistory(userId, 'instagram', today);
    return { facebook, instagram, all: combineHistories(facebook, instagram) };
  }, [userId, today]);

  const { current, previous } = periods(histories[filter], days);
  const kpis = summarize(current, previous);
  const byPlatform = (['facebook', 'instagram'] as Platform[]).map((platform) => {
    const p = periods(histories[platform], days);
    const [followers, reach] = summarize(p.current, p.previous);
    return { platform, followers, reach };
  });
  const chartData: ChartRow[] = current.map((d, i) => ({
    label: shortDate(d.date),
    prevLabel: shortDate(previous[i].date),
    cur: d[metric],
    prev: previous[i][metric],
  }));

  const rows = useMemo(() => (posts ? postsInPeriod(posts, userId, days, filter, today) : []), [posts, userId, days, filter, today]);
  const sorted = [...rows].sort(
    (a, b) => (sort.key === 'date' ? a.date.localeCompare(b.date) : (a[sort.key] as number) - (b[sort.key] as number)) * sort.dir,
  );
  const topId = rows.length > 1 ? comparePosts(rows).winner.id : null;

  // Avg reach score: the AI scores of the owner's real posts in this period vs the period before.
  const scoreIn = (from: string, to: string) => {
    const scored = (posts || []).filter((p) => p.date >= from && p.date <= to && typeof p.viralityScore === 'number');
    return scored;
  };
  const curFrom = current[0]?.date ?? '', curTo = current[current.length - 1]?.date ?? '';
  const prevFrom = previous[0]?.date ?? '', prevTo = previous[previous.length - 1]?.date ?? '';
  const scoredNow = scoreIn(curFrom, curTo).sort((a, b) => a.date.localeCompare(b.date));
  const scoredPrev = scoreIn(prevFrom, prevTo);
  const avg = (list: GeneratedPost[]) => (list.length ? Math.round(list.reduce((sum, p) => sum + (p.viralityScore || 0), 0) / list.length) : null);
  const avgNow = avg(scoredNow);
  const avgPrev = avg(scoredPrev);

  // Best time to post: the day part whose posts reached the most people on average.
  // Uses the time each post went out (or was scheduled for) on this device; needs 3+ such posts.
  const channels = readStored<PostChannels>(postChannelsKey(userId), {});
  const timed = rows
    .filter((r) => !r.example)
    .map((r) => {
      const post = (posts || []).find((p) => p.id === r.id);
      const iso = post?.publishedAt || channels[r.id]?.at;
      const hour = iso ? new Date(iso).getHours() : null;
      return hour == null || Number.isNaN(hour) ? null : { hour, reach: r.reach };
    })
    .filter((x): x is { hour: number; reach: number } => !!x);
  const bestPart = (() => {
    if (timed.length < 3) return null;
    const scored = DAY_PARTS.map((part) => {
      const inPart = timed.filter((t) => t.hour >= part.from && t.hour < part.to);
      return { part, n: inPart.length, avg: inPart.length ? inPart.reduce((s2, t) => s2 + t.reach, 0) / inPart.length : 0 };
    }).filter((x) => x.n > 0);
    return scored.sort((a, b) => b.avg - a.avg)[0] ?? null;
  })();
  const reachTotals = byPlatform.map(({ platform, reach }) => ({ platform, total: reach.current, change: reach.change }));
  const reachMax = Math.max(...reachTotals.map((r) => r.total), 1);
  const maxRate = Math.max(...rows.map((r) => r.engagementRate), 1);

  // Only posts still on screen count, so switching the period or platform drops the rest.
  const selectedPosts = selected.map((id) => rows.find((r) => r.id === id)).filter((p): p is PostStats => !!p);
  const selectedIds = selectedPosts.map((p) => p.id);
  const toggle = (id: string) =>
    setSelected(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : selectedIds.length < MAX_COMPARE ? [...selectedIds, id] : selectedIds);

  const scopeName = filter === 'all' ? 'Facebook & Instagram' : PLATFORM_NAMES[filter];
  const scope = `${days}d${filter === 'all' ? '' : `-${filter}`}`;
  const stamp = isoDay(today);
  const report = () => ({
    generatedAt: new Date().toISOString(),
    sampleData: true,
    platform: filter,
    period: { days, from: current[0].date, to: current[current.length - 1].date, previousFrom: previous[0].date, previousTo: previous[previous.length - 1].date },
    summary: kpis.map((k) => ({
      metric: k.key,
      label: k.label,
      current: round2(k.current),
      previous: round2(k.previous),
      change: round2(k.points ? k.change : k.change * 100),
      changeUnit: k.points ? 'points' : 'percent',
    })),
    platforms: byPlatform.map(({ platform, followers, reach }) => ({
      platform,
      followers: { current: followers.current, previous: followers.previous },
      reach: { current: reach.current, previous: reach.previous },
    })),
    daily: current.map((d, i) => ({ ...d, previous: previous[i] })),
    posts: rows.map(({ imageUrl: _image, ...p }) => p),
  });
  const downloads: DownloadItem[] = [
    {
      title: 'Post performance',
      desc: 'Each post in this period with its reach, interactions and clicks.',
      ext: 'CSV',
      Icon: FileSpreadsheet,
      file: () => [`kawayan-posts-${scope}-${stamp}.csv`, postsCsv(sorted), 'text/csv;charset=utf-8'],
    },
    {
      title: 'Growth by day',
      desc: 'Daily followers, reach and interactions beside the previous period.',
      ext: 'CSV',
      Icon: FileSpreadsheet,
      file: () => [`kawayan-growth-${scope}-${stamp}.csv`, growthCsv(current, previous), 'text/csv;charset=utf-8'],
    },
    {
      title: 'Full report',
      desc: 'Summary, platforms, daily numbers and posts in one file.',
      ext: 'JSON',
      Icon: FileJson,
      file: () => [`kawayan-insights-${scope}-${stamp}.json`, JSON.stringify(report(), null, 2), 'application/json'],
    },
  ];

  const sortTh = (key: SortKey, label: string, className = '') => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th className={className} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
        <button
          type="button"
          className={`in-sort${active ? ' is-active' : ''}`}
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}
        >
          {label} <Icon aria-hidden />
        </button>
      </th>
    );
  };

  const changeLine = (k: (typeof kpis)[number]) => {
    const diff = k.current - k.previous;
    const shown = k.key === 'followers' ? `${diff >= 0 ? '+' : '−'}${num(Math.abs(diff))}` : `${k.change >= 0 ? '+' : '−'}${Math.abs(k.change * 100).toFixed(0)}%`;
    const up = k.key === 'followers' ? diff >= 0 : k.change >= 0;
    return <><span className={up ? 'in-up' : 'in-down'}>{shown}</span> vs previous {days} days</>;
  };
  const metricName = CHART_METRICS.find((m) => m.key === metric)!.label;
  const chartConfig = {
    // Neutral lines; the green dot marks today, the one point that matters.
    cur: { label: span(current), color: 'var(--chart-ink)' },
    prev: { label: span(previous), color: 'var(--chart-muted)' },
  } satisfies ChartConfig;

  return (
    <div className="in animate-fade-in">
      {/* Header: title, date range, Export CSV */}
      <div className="kw-page-h">
        <div>
          <h1>Insights</h1>
          <p>How your pages are growing and which posts work best.</p>
        </div>
        <div className="in-controls">
          <KwSelect aria-label="Date range" className="w-auto! min-w-40" value={String(range)} onValueChange={(v) => setRange((v === 'year' ? 'year' : Number(v)) as Range)} options={RANGES.map((r) => ({ value: String(r), label: RANGE_LABEL[r] }))} />
          <KwSelect
            aria-label="Platform"
            className="w-auto! min-w-36"
            value={filter}
            onValueChange={(v) => setFilter(v as PlatformFilter)}
            options={[{ value: 'all', label: 'All platforms' }, { value: 'facebook', label: 'Facebook' }, { value: 'instagram', label: 'Instagram' }]}
          />
          {/* Phones get downloads from "More" at the bottom, so the filters fit on one row. */}
          <button
            type="button"
            className="btn btn-outline hidden sm:inline-flex"
            onClick={() => {
              const [name, body, type] = downloads[0].file();
              saveFile(name, body, type);
              toast.success(`Downloaded ${name}`);
            }}
          >
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </button>
        </div>
      </div>

      {/* 4 KPI cards with sparklines */}
      <div className="kw-stats">
        {kpis.filter((k) => k.key !== 'rate').map((k) => {
          return (
            <div key={k.key} className="card kw-stat">
              <div className="kw-stat__h">{k.label}</div>
              <b>{compactKpi(k.current)}</b>
              <small>{changeLine(k)}</small>
              <Spark values={current.map((d) => d[k.key as 'followers' | 'reach' | 'interactions'])} />
            </div>
          );
        })}
        <div className="card kw-stat">
          <div className="kw-stat__h">Avg reach score</div>
          <b>{avgNow ?? '—'}</b>
          <small>
            {avgNow == null ? 'No scored posts in this period' : avgPrev != null ? <><span className={avgNow >= avgPrev ? 'in-up' : 'in-down'}>{avgNow >= avgPrev ? '+' : '−'}{Math.abs(avgNow - avgPrev)}</span> vs previous {days} days</> : `From ${scoredNow.length} post${scoredNow.length > 1 ? 's' : ''}`}
          </small>
          <Spark values={scoredNow.map((p) => p.viralityScore || 0)} />
        </div>
      </div>

      {/* Daily reach | By platform + best time */}
      <div className="in-grid">
        <section className="card overflow-hidden">
          <div className="kw-card-h">
            <h3>Daily {metricName.toLowerCase()}</h3>
            <div className="in-legend">
              <span><i className="in-line" /> {span(current)}</span>
              <span><i className="in-line is-prev" /> {span(previous)}</span>
            </div>
          </div>
          <div className="px-3 pb-3 pt-4">
            <ChartContainer config={chartConfig} className="aspect-auto! h-[180px] w-full sm:h-[200px]">
              <AreaChart data={chartData} margin={{ top: 8, right: 10, bottom: 4, left: 4 }} accessibilityLayer>
                <defs>
                  <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-cur)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--color-cur)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} interval="preserveStartEnd" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) => compact.format(v)}
                  domain={metric === 'followers' ? ['auto', 'auto'] : [0, 'auto']}
                  label={{ value: metricName, angle: -90, position: 'insideLeft', offset: 2, style: { fill: 'var(--fg-muted)', fontSize: 11, textAnchor: 'middle' } }}
                />
                <ChartTooltip
                  cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
                  content={<ChartTooltipContent indicator="line" labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as ChartRow | undefined;
                    return row ? `${row.label} · vs ${row.prevLabel}` : '';
                  }} />}
                />
                <Area type="monotone" dataKey="prev" stroke="var(--color-prev)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} activeDot={false} isAnimationActive={false} />
                <Area
                  type="monotone"
                  dataKey="cur"
                  stroke="var(--color-cur)"
                  strokeWidth={2}
                  fill="url(#inFill)"
                  isAnimationActive={false}
                  dot={(props: any) =>
                    props.index === chartData.length - 1 ? (
                      <circle key="last" cx={props.cx} cy={props.cy} r={4} fill="var(--green)" stroke="var(--card)" strokeWidth={2} />
                    ) : (
                      <g key={props.index} />
                    )
                  }
                  activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--green)' }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="kw-card-h"><h3>By platform</h3></div>
          <div className="flex flex-col gap-5 p-5">
            <div className="in-hbar">
              {reachTotals.map(({ platform, total }) => {
                const Glyph = GLYPHS[platform];
                return (
                  <div key={platform} className="in-hbar__row">
                    <span className="in-hbar__name"><Glyph className="w-3.5 h-3.5" /> {PLATFORM_NAMES[platform]}</span>
                    <span className="in-hbar__track" aria-hidden><i style={{ transform: `scaleX(${total / reachMax})` }} /></span>
                    <span className="mono text-right">{compact.format(total)}</span>
                  </div>
                );
              })}
            </div>
            <hr className="border-(--border)" />
            <div className="flex flex-col gap-1.5">
              <span className="kw-label">Best time to post</span>
              <p className="text-sm text-(--fg-muted)">
                {bestPart
                  ? <>Your posts that went out in the <b className="text-(--fg)">{bestPart.part.name} ({bestPart.part.range})</b> reached the most people, about {num(bestPart.avg)} each.</>
                  : 'Kawayan suggests a time once at least 3 of your posts in this period have gone out.'}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="kw-card-h">
          <h3>Post performance</h3>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm in-hide-sm" aria-pressed={moreCols} onClick={() => setMoreCols((v) => !v)} title="Link clicks and engagement rate">
              {moreCols ? 'Fewer columns' : 'More columns'}
            </button>
            <span className="in-hide-sm text-xs text-(--fg-muted)">{selectedPosts.length < 2 ? `Pick ${2 - selectedPosts.length} to compare` : `${selectedPosts.length} picked`}</span>
            <button type="button" className="btn btn-outline btn-sm" disabled={selectedPosts.length < 2} onClick={() => setComparing(true)}>
              <GitCompareArrows className="w-3.5 h-3.5" /> Compare
            </button>
          </div>
        </div>
        <div className="in-table-wrap">
          <table className="in-table">
            <thead>
              <tr>
                <th><span className="sr-only">Compare</span></th>
                <th className="is-left">Post</th>
                {sortTh('date', 'Posted', 'in-hide-sm')}
                {sortTh('reach', 'Reach', 'in-hide-sm')}
                {sortTh('interactions', 'Interactions', 'in-hide-sm')}
                {moreCols && sortTh('clicks', 'Link clicks', 'in-hide-sm')}
                {moreCols && sortTh('engagementRate', 'Eng. rate')}
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {posts === null
                ? [0, 1, 2].map((i) => (
                    <tr key={i} className="is-locked">
                      <td colSpan={moreCols ? 8 : 6}><div className="in-skel" /></td>
                    </tr>
                  ))
                : (allRows ? sorted : sorted.slice(0, ROW_PREVIEW)).map((p) => {
                    const isSelected = selectedIds.includes(p.id);
                    const locked = !isSelected && selectedIds.length >= MAX_COMPARE;
                    const Glyph = GLYPHS[p.platform];
                    return (
                      <tr
                        key={p.id}
                        className={isSelected ? 'is-selected' : locked ? 'is-locked' : ''}
                        onClick={(e) => !locked && !(e.target as HTMLElement).closest('input') && toggle(p.id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            className="in-check"
                            checked={isSelected}
                            disabled={locked}
                            onChange={() => toggle(p.id)}
                            aria-label={`Compare “${p.topic}”`}
                            title={locked ? `You can compare up to ${MAX_COMPARE} posts` : undefined}
                          />
                        </td>
                        <td className="is-left">
                          <div className="in-post">
                            <Thumb post={p} />
                            <div className="in-post__body">
                              <div className="in-post__t">
                                <span>{p.topic}</span>
                                {p.id === topId && <span className="in-chip is-top">Top</span>}
                                {p.example && <span className="in-chip">Example</span>}
                              </div>
                              <div className="in-post__m"><Glyph className="w-3 h-3" /> {PLATFORM_NAMES[p.platform]} · {shortDate(p.date)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="in-hide-sm mono">{shortDate(p.date)}</td>
                        <td className="in-hide-sm">{num(p.reach)}</td>
                        <td className="in-hide-sm">{num(p.interactions)}</td>
                        {moreCols && <td className="in-hide-sm">{num(p.clicks)}</td>}
                        {moreCols && (
                          <td>
                            <span className="in-rate">
                              <span className="in-rate__bar in-hide-sm"><b style={{ width: `${(p.engagementRate / maxRate) * 100}%` }} /></span>
                              {pct(p.engagementRate)}
                            </span>
                          </td>
                        )}
                        <td>
                          {p.viralityScore != null ? <span className={`badge mono ${p.viralityScore >= 75 ? 'badge-green' : ''}`}>{p.viralityScore}</span> : <span className="text-(--fg-muted)">—</span>}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {posts && sorted.length > ROW_PREVIEW && (
            <button type="button" className="btn btn-ghost btn-sm m-2" onClick={() => setAllRows((v) => !v)} aria-expanded={allRows}>
              {allRows ? 'Show top 5' : `Show all ${sorted.length} posts`}
            </button>
          )}
        </div>
      </section>

      {/* More: the extras that aren't in the mockup's main layout */}
      <details className="card in-more">
        <summary>More: platform details, chart metric and other downloads</summary>
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="grid gap-3">
            <span className="kw-label">Chart shows</span>
            <div className="in-seg w-fit" role="group" aria-label="Chart metric">
              {CHART_METRICS.map((m) => (
                <button key={m.key} type="button" aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            <span className="kw-label mt-2">Downloads</span>
            <DownloadMenu caption={`${RANGE_LABEL[range]} · ${scopeName}`} items={downloads} onDone={(name) => toast.success(`Downloaded ${name}`)} />
            <p className="text-xs text-(--fg-muted)">Engagement rate {kpis.find((k) => k.key === 'rate') ? `${pct(kpis.find((k) => k.key === 'rate')!.current)} (previous ${pct(kpis.find((k) => k.key === 'rate')!.previous)})` : '—'}.</p>
          </div>
          <div className="in-plat">
            {byPlatform.map(({ platform, followers, reach }) => {
              const Glyph = GLYPHS[platform];
              return (
                <div key={platform} className={`in-plat__row${filter === platform ? ' is-active' : ''}`}>
                  <div className="in-plat__name"><Glyph /> {PLATFORM_NAMES[platform]}</div>
                  {[followers, reach].map((k) => (
                    <div key={k.key} className="in-plat__line">
                      <span>{k.label}</span>
                      <span>
                        {num(k.previous)}<span className="in-plat__arrow" aria-label="to">→</span><b>{num(k.current)}</b>
                      </span>
                      <Delta change={k.change} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </details>

      <p className="in-note">
        <i aria-hidden />
        <span>Demo data, generated for each account</span>
        <span>{span(current)} vs {span(previous)}</span>
      </p>

      {selectedPosts.length > 0 && (
        <div className="in-tray" role="region" aria-label="Posts to compare">
          <div className="in-tray__thumbs" aria-hidden>
            {Array.from({ length: MAX_COMPARE }, (_, i) =>
              selectedPosts[i] ? <Thumb key={i} post={selectedPosts[i]} className="" /> : <span key={i} className="is-empty" />,
            )}
          </div>
          <span className="in-tray__msg">
            {selectedPosts.length === 1 ? 'Pick one more' : <>{selectedPosts.length} <span className="in-hide-sm">posts </span>selected</>}
          </span>
          <button type="button" className="btn btn-ghost btn-sm in-tray__clear" onClick={() => setSelected([])}>Clear</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={selectedPosts.length < 2} onClick={() => setComparing(true)}>
            <GitCompareArrows className="w-3.5 h-3.5" /> Compare
          </button>
        </div>
      )}

      {comparing && selectedPosts.length >= 2 && (
        <CompareDialog
          posts={selectedPosts}
          caption={`${scopeName}, ${RANGE_LABEL[range].toLowerCase()}. Engagement rate decides the most effective post.`}
          onClose={closeCompare}
        />
      )}
    </div>
  );
};

export default InsightsDashboard;
