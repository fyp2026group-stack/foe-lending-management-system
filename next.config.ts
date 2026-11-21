import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
    }];
  },
};

export default config;
