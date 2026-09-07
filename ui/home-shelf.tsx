'use client';
import { useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { t } from '@/i18n/messages';
export function HomeShelf({
  title,
  intro,
  href,
  locale,
  children,
}: {
  title: string;
  intro?: string;
  href: string;
  locale: Locale;
  children: React.ReactNode;
}) {
  const rail = useRef<HTMLDivElement>(null);
  function move(direction: number) {
    const element = rail.current;
    if (element)
      element.scrollBy({
        left: direction * element.clientWidth * 0.85,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }
  return (
    <section className="section home-shelf">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {intro && <p className="muted">{intro}</p>}
        </div>
        <div className="shelf-actions">
          <a className="text-link" href={href}>
            {t(locale, 'browseAll')}
            <ArrowRight size={16} />
          </a>
          <button
            className="shelf-arrow"
            onClick={() => move(-1)}
            aria-label={t(locale, 'previous')}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            className="shelf-arrow"
            onClick={() => move(1)}
            aria-label={t(locale, 'next')}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <div className="poster-rail" ref={rail} role="region" aria-label={title}>
        {children}
      </div>
    </section>
  );
}
