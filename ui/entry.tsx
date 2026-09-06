'use client';
import { useState } from 'react';
import { ArrowRight, Globe2 } from 'lucide-react';
import { Brand } from './brand';
import { Choice } from './select';
import {
  locales,
  languageNames,
  countryName,
  markets,
  type Locale,
} from '@/i18n/config';
const copy = {
  de: [
    'Ein guter Abend beginnt mit einem guten Film.',
    'Finde heraus, wo du Filme und Serien schauen kannst. In deinem Land, mit deinen Abos.',
    'Sprache',
    'Streaming-Land',
    'Filme entdecken',
    'Dein Kino. Deine Wahl.',
    'Sprache und Streaming-Land kannst du jederzeit unabhängig ändern.',
  ],
  fr: [
    'Une belle soirée commence par un bon film.',
    'Trouvez où regarder films et séries. Dans votre pays, avec vos abonnements.',
    'Langue',
    'Pays de streaming',
    'Découvrir les films',
    'Votre cinéma. Votre choix.',
    'Vous pouvez changer la langue et le pays indépendamment à tout moment.',
  ],
  it: [
    'Una bella serata inizia con un bel film.',
    'Scopri dove guardare film e serie. Nel tuo paese, con i tuoi abbonamenti.',
    'Lingua',
    'Paese di streaming',
    'Scopri i film',
    'Il tuo cinema. La tua scelta.',
    'Puoi cambiare lingua e paese indipendentemente in qualsiasi momento.',
  ],
  es: [
    'Una buena noche empieza con una buena película.',
    'Descubre dónde ver películas y series. En tu país, con tus suscripciones.',
    'Idioma',
    'País de streaming',
    'Descubrir películas',
    'Tu cine. Tu elección.',
    'Puedes cambiar el idioma y el país de forma independiente en cualquier momento.',
  ],
  en: [
    'A great night starts with a great film.',
    'Find where to watch films and TV shows. In your country, with your subscriptions.',
    'Language',
    'Streaming country',
    'Discover films',
    'Your cinema. Your choice.',
    'You can change your language and streaming country independently at any time.',
  ],
} as const;
export function Entry() {
  const [l, setL] = useState<Locale>('en');
  const [m, setM] = useState('de');
  const c = copy[l];
  return (
    <div className="entry" lang={l}>
      <header className="container entry-header">
        <Brand />
        <span className="eyebrow">
          <Globe2 size={16} /> DE · FR · IT · ES · EN
        </span>
      </header>
      <main id="main" className="container entry-main">
        <p className="eyebrow gold">{c[5]}</p>
        <h1>{c[0]}</h1>
        <p className="entry-description">{c[1]}</p>
        <div className="entry-choice">
          <Choice
            label={c[2]}
            value={l}
            options={locales.map((value) => ({
              value,
              label: languageNames[value],
            }))}
            onChange={(v) => setL(v as Locale)}
          />
          <Choice
            label={c[3]}
            value={m}
            options={markets.map((value) => ({
              value,
              label: countryName(l, value),
            }))}
            onChange={setM}
          />
          <a
            className="button primary"
            href={`/${l}/${m}/`}
            onClick={() => {
              try {
                localStorage.setItem(
                  'cineradar:context',
                  JSON.stringify({ locale: l, market: m }),
                );
              } catch {}
            }}
          >
            {c[4]}
            <ArrowRight size={19} />
          </a>
        </div>
        <p className="hint">{c[6]}</p>
        <div className="entry-rule" aria-hidden="true">
          <span>01</span>
          <span>02</span>
          <span>03</span>
        </div>
      </main>
      <footer className="container entry-footer">
        Cineradar{' '}
        <span>TMDb · Streaming Availability API by Movie of the Night</span>
      </footer>
    </div>
  );
}
