import { cache } from 'react';
import { getUpcomingEpisodes } from './episodes';
import { config } from '../../lib/config';
import type { Database } from '../db';

// Share this read between metadata and the server-rendered calendar in one request.
export const calendarView = cache(
  async (market: string, database?: Database) => {
    if (!config().tvmazeEnabled) return null;
    return getUpcomingEpisodes(market, 14, 150, database).catch(() => null);
  },
);
