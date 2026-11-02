import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import clsx from 'clsx';
import KawayanLogo from './KawayanLogo';
import { LEGAL_DOCS, LEGAL_UPDATED, LegalDocId, TOS_VERSION } from '../constants/termsOfService';

interface Props {
  doc: LegalDocId;
  onSwitch: (doc: LegalDocId) => void;
  onBack: () => void;
}

/**
 * Terms and Privacy as a real page (/terms, /privacy) rather than a pop-up:
 * the short version up top, a contents list that follows you down the page,
 * and a plain-language summary beside every section.
 */
const LegalPage: React.FC<Props> = ({ doc, onSwitch, onBack }) => {
  const { title, intro, highlights, sections } = LEGAL_DOCS[doc];
  const [active, setActive] = useState(sections[0].id);

  useEffect(() => {
    window.scrollTo(0, 0);
    setActive(sections[0].id);
    // The section whose heading most recently crossed the top third of the screen is "current".
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-15% 0px -70% 0px' },
    );
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [doc, sections]);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const other: LegalDocId = doc === 'terms' ? 'privacy' : 'terms';

  return (
    <div className="min-h-screen bg-(--bg) text-(--fg)">
      <header className="sticky top-0 z-40 border-b border-(--border) bg-(--bg)/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button type="button" onClick={onBack} aria-label="Kawayan home" className="inline-flex rounded-md p-1">
            <KawayanLogo size={17} />
          </button>
          <nav className="flex rounded-full border border-(--border) bg-(--card) p-1" aria-label="Legal documents">
            {(['terms', 'privacy'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onSwitch(d)}
                aria-current={d === doc ? 'page' : undefined}
                className={clsx(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 sm:text-sm',
                  d === doc ? 'bg-(--primary) text-(--on-accent)' : 'text-(--fg-muted) hover:text-(--fg)',
                )}
              >
                {d === 'terms' ? 'Terms' : 'Privacy'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {/* Title and the short version */}
        <section className="grid gap-8 border-b border-(--border) py-10 sm:py-14 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-14">
          <div>
            <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-(--fg-muted) hover:text-(--fg)">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Kawayan
            </button>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{title}</h1>
            <p className="mt-3 text-sm text-(--fg-subtle)">
              Updated {LEGAL_UPDATED}{doc === 'terms' && <> · Version {TOS_VERSION}</>}
            </p>
            <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-(--fg-muted)">{intro}</p>
          </div>

          <div className="rounded-2xl border border-(--border) bg-(--card) p-5 sm:p-6">
            <p className="eyebrow mb-4">The short version</p>
            <ul className="grid gap-4">
              {highlights.map((h) => (
                <li key={h} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-(--badge-bg) text-(--badge-text)" aria-hidden>
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="grid gap-10 pt-10 lg:grid-cols-[13rem_1fr] lg:gap-14">
          {/* Contents: follows you down the page on wide screens */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24" aria-label="On this page">
              <p className="eyebrow mb-3">On this page</p>
              <ol className="grid gap-0.5 border-l border-(--border)">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => jump(s.id)}
                      className={clsx(
                        '-ml-px w-full border-l-2 py-1.5 pl-3 text-left text-[13px] leading-snug transition-colors',
                        active === s.id ? 'border-(--primary) font-semibold text-(--fg)' : 'border-transparent text-(--fg-muted) hover:text-(--fg)',
                      )}
                    >
                      <span className="tabular-nums text-(--fg-subtle)">{i + 1}.</span> {s.title}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="grid gap-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="flex items-baseline gap-3 text-xl font-bold tracking-tight">
                  <span className="text-base tabular-nums text-(--fg-subtle)">{i + 1}.</span>
                  {s.title}
                </h2>
                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-10">
                  <div className="grid max-w-[65ch] gap-3 text-[15px] leading-relaxed text-(--fg-muted)">
                    {s.body.map((p) => <p key={p}>{p}</p>)}
                  </div>
                  <p className="order-first rounded-xl bg-(--bg-alt) px-4 py-3 text-sm leading-relaxed text-(--fg) xl:order-none xl:self-start">
                    <span className="mb-1 block text-2xs font-bold uppercase tracking-wider text-(--fg-subtle)">In short</span>
                    {s.summary}
                  </p>
                </div>
              </section>
            ))}

            <footer className="flex flex-col gap-3 rounded-2xl border border-(--border) bg-(--card) p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-(--fg-muted)">Questions? Ask us through Help and support inside the app.</p>
              <button type="button" onClick={() => onSwitch(other)} className="font-semibold text-(--primary) hover:underline">
                Read the {LEGAL_DOCS[other].title} →
              </button>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LegalPage;
