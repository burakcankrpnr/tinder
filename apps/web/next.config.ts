import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

loadEnvConfig(path.resolve(__dirname, '../..'));

const mediaUrl = new URL(process.env.NEXT_PUBLIC_MEDIA_URL ?? 'http://localhost:9000/dating-media');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@dating/ui'],
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  images: {
    remotePatterns: [
      {
        protocol: mediaUrl.protocol === 'https:' ? 'https' : 'http',
        hostname: mediaUrl.hostname,
        port: mediaUrl.port,
        pathname: `${mediaUrl.pathname.replace(/\/$/, '')}/**`,
      },
    ],
  },
};

export default nextConfig;
