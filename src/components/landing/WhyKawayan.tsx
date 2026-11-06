import React, { useEffect, useRef, useState } from 'react';

const MEANINGS = [
  {
    word: 'kaway',
    gloss: 'to wave hello',
    value: 'Connection',
    points: [
      'Taglish captions that sound like your shop, not a robot.',
      'Your tone, audience and industry, set once in the brand survey.',
      'A reach score on every draft, so you can fix it before it goes out.',
    ],
  },
  {
    word: 'kawayan',
    gloss: 'bamboo',
    value: 'Growth',
    points: [
      'A month of Facebook and Instagram posts, planned in one go.',
      'Insights that compare your posts and show what worked.',
      'Scheduled posting that keeps going while you run the store.',
    ],
  },
];

/** Sample posts the Connection card types out, each followed by customer replies. */
const POSTS = [
  { shop: 'Aling Nena’s Bakery', text: 'Bagong luto na ang pandesal! Mainit pa, tara na bago maubos.', replies: ['Reserve po 10!', 'Sarap nito, solid.'] },
  { shop: 'Kusina ni Lola', text: 'Tag-ulan na naman. Perfect time para sa mainit na champorado.', replies: ['Meron pa po mamaya?', 'Order ako for 3!'] },
  { shop: 'Tea Tayo', text: 'Payday treat! Buy 1 take 1 sa lahat ng milk tea hanggang Linggo.', replies: ['Game, pupunta kami!', 'Open po kayo bukas?'] },
];

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Types a caption out letter by letter, shows the replies, then moves to the next shop. */
const TypingPost: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(() => (reducedMotion() ? POSTS[0].text.length : 0));
  const post = POSTS[index];
  const done = shown >= post.text.length;

  // Type only while the card is on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return setVisible(true);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion() || !visible) return;
    const timer = done
      ? setTimeout(() => { setIndex((i) => (i + 1) % POSTS.length); setShown(0); }, 3600)
      : setTimeout(() => setShown((n) => n + 1), 32);
    return () => clearTimeout(timer);
  }, [shown, done, visible]);

  return (
    <div ref={ref} className="lp-chat" aria-hidden="true">
      <div className="lp-chat__post">
        <div className="lp-chat__head">
          <span className="lp-chat__avatar">{post.shop.charAt(0)}</span>
          <span className="lp-chat__shop">{post.shop}</span>
          <span className="lp-chat__time">Just now</span>
        </div>
        <p className="lp-chat__text">
          {post.text.slice(0, shown)}
          {!done && <span className="lp-chat__caret" />}
        </p>
      </div>
      <div className="lp-chat__replies">
        {done && post.replies.map((r, i) => (
          <span key={`${index}-${i}`} className="lp-chat__reply" style={{ animationDelay: `${0.35 + i * 0.55}s` }}>{r}</span>
        ))}
      </div>
    </div>
  );
};

/** Four bamboo stalks, one per week, growing joint by joint and then swaying. */
const GrowingWeeks: React.FC = () => (
  <div className="lp-grow" aria-hidden="true">
    {[2, 3, 4, 5].map((joints, week) => (
      <div key={week} className="lp-grow__col">
        <div className="lp-grow__stalk" style={{ '--w': week } as React.CSSProperties}>
          <span className="lp-grow__leaf" />
          {Array.from({ length: joints }, (_, j) => (
            <i key={j} className="lp-grow__seg" style={{ '--j': joints - 1 - j } as React.CSSProperties} />
          ))}
        </div>
        <span className="lp-grow__label">Week {week + 1}</span>
      </div>
    ))}
  </div>
);

/**
 * "Why Kawayan AI?" as a dictionary entry that acts itself out:
 * "Kaway" waves hello, then "an" sprouts up and the word becomes bamboo.
 * The two cards below show each meaning happening in the app.
 */
const WhyKawayan: React.FC = () => (
  <section id="why" className="lp-why" aria-labelledby="why-title">
    <div className="lp-why__dots" aria-hidden="true" />

    <div className="lp-why__inner">
      <div className="text-center reveal">
        <h2 id="why-title" className="sr-only">Why Kawayan AI? Kaway means to wave hello. Kawayan means bamboo.</h2>

        <div className="lp-name" aria-hidden="true">
          <span className="lp-name__part lp-name__part--kaway">
            {'Kaway'.split('').map((ch, i) => <span key={i} style={{ '--i': i } as React.CSSProperties}>{ch}</span>)}
          </span>
          <span className="lp-name__part lp-name__part--an"><span>an</span></span>
          <span className="lp-name__br lp-name__br--kaway"><b>kaway</b> {MEANINGS[0].gloss}</span>
          <span className="lp-name__br lp-name__br--kawayan"><b>kawayan</b> {MEANINGS[1].gloss}</span>
        </div>

        <p className="lp-why__lede">
          One Tagalog word, two meanings. Both describe what we&rsquo;re building for Filipino businesses.
        </p>
      </div>

      <div className="lp-why__cols">
        {MEANINGS.map((m, i) => (
          <article key={m.word} className={`lp-why-col reveal reveal-d${i + 1}`}>
            <div className="lp-why-col__viz">{i === 0 ? <TypingPost /> : <GrowingWeeks />}</div>
            <h3 className="lp-why-col__title">{m.value}</h3>
            <p className="lp-why-col__from">from <i>{m.word}</i>, {m.gloss}</p>
            <ul className="lp-why-col__list">
              {m.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </article>
        ))}
      </div>

      <p className="lp-why__tag reveal reveal-d3">Grow local. Reach digital.</p>
    </div>
  </section>
);

export default WhyKawayan;
