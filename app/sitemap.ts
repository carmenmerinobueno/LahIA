import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/precios', '/legal/aviso-legal', '/legal/privacidad', '/legal/cookies', '/legal/condiciones'].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p ? 'yearly' : 'weekly',
    priority: p ? 0.3 : 1,
  }));
}
