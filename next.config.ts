import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vercel's adapter packages its own output; standalone is for containers.
  output: process.env.VERCEL === '1' ? undefined : 'standalone',
  trailingSlash: true,
  poweredByHeader: false,
};

export default nextConfig;
