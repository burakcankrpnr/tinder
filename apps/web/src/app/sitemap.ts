import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

const PUBLIC_PATHS = [
  '/',
  '/about',
  '/how-it-works',
  '/pricing',
  '/safety',
  '/community-guidelines',
  '/terms',
  '/privacy',
  '/contact',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, publicEnv.appUrl).toString(),
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.6,
  }));
}
