import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vercel's adapter packages its own output; standalone is for containers.
  output: process.env.VERCEL === '1' ? undefined : 'standalone',
  // Middleware preserves catalog slashes and short editorial URLs separately.
  // Global trailingSlash also rewrites canonical metadata, so leave it disabled.
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
};

export default nextConfig;
