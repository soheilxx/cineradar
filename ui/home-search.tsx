'use client';
import { useState } from 'react';
import { Search as SearchIcon, Sparkles } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import { homeSearchCopy } from '@/content/home-search';
import { identifyCopy } from '@/content/identify';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search } from './search';
import { IdentifyExperience } from './identify-experience';
import { useHydrated } from './use-hydrated';

export function HomeSearch({
  locale,
  market,
  aiEnabled,
  examples,
}: {
  locale: Locale;
  market: string;
  aiEnabled: boolean;
  examples: readonly string[];
}) {
  const [mode, setMode] = useState<'title' | 'identify'>('title');
  const [identifyOpened, setIdentifyOpened] = useState(false);
  const ready = useHydrated();
  return (
    <Tabs
      className="home-search"
      value={mode}
      onValueChange={(value) => {
        if (!ready || (value !== 'title' && value !== 'identify')) return;
        if (value === 'identify') setIdentifyOpened(true);
        setMode(value);
      }}
    >
      <TabsList
        className="home-search-tabs"
        aria-label={homeSearchCopy.modes[locale]}
        activateOnFocus={false}
      >
        <TabsTrigger
          className="home-search-tab"
          value="title"
          disabled={!ready}
        >
          <SearchIcon size={17} aria-hidden="true" />
          {homeSearchCopy.titleSearch[locale]}
        </TabsTrigger>
        <TabsTrigger
          className="home-search-tab"
          value="identify"
          disabled={!ready}
        >
          <Sparkles size={17} aria-hidden="true" />
          {identifyCopy[locale].promo}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        className="home-search-panel"
        value="title"
        keepMounted
        hidden={mode !== 'title'}
      >
        <label className="home-search-label" htmlFor="home-title-search">
          {homeSearchCopy.titleLabel[locale]}
        </label>
        <Search
          locale={locale}
          market={market}
          inputId="home-title-search"
          placeholder={homeSearchCopy.placeholder[locale]}
          active={mode === 'title'}
        />
      </TabsContent>
      <TabsContent
        className="home-search-panel"
        value="identify"
        keepMounted
        hidden={mode !== 'identify'}
      >
        {identifyOpened && (
          <IdentifyExperience
            key={`${locale}:${market}`}
            locale={locale}
            market={market}
            aiEnabled={aiEnabled}
            examples={examples}
            variant="home"
            active={mode === 'identify'}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
