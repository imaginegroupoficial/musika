/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: { serverComponentsExternalPackages: ['sharp'] },
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }];
  },
};
export default nextConfig;
