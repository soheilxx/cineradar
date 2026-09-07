import { z } from 'zod';
export const filterSchema = z.object({
  q: z.string().max(120).optional(),
  type: z.enum(['movie', 'tv']).optional(),
  genre: z.string().max(30).optional(),
  provider: z.string().max(100).optional(),
  offerType: z
    .enum(['subscription', 'addon', 'free', 'rent', 'buy'])
    .optional(),
  quality: z.enum(['sd', 'hd', 'qhd', 'uhd']).optional(),
  audio: z.string().max(3).optional(),
  subtitles: z.string().max(3).optional(),
  maxMinutes: z.coerce.number().int().min(1).max(600).optional(),
  year: z.coerce.number().int().min(1880).max(2200).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  sort: z.enum(['relevance', 'title', 'year', 'latest', 'trending']).optional(),
  mine: z.string().max(2000).optional(),
  scope: z.enum(['new', 'leaving', 'free', 'finder']).optional(),
});
