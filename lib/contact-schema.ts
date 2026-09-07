import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(3).max(160),
  locale: z.enum(['de', 'fr', 'it', 'es', 'en']),
  market: z.string().regex(/^[a-z]{2}$/),
  titleId: z
    .string()
    .regex(/^(movie|tv):\d+$/)
    .optional(),
  message: z.string().trim().min(10).max(3000),
  email: z.string().trim().pipe(z.email().max(254)),
  website: z.literal('').optional(),
});
