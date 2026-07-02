import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLICSUPABASE_URL: process.env.NEXT_PUBLICSUPABASE_URL || process.env.VITE_PUBLICSUPABASE_URL || '',
    NEXT_PUBLICSUPABASE_ANON_KEY:
      process.env.NEXT_PUBLICSUPABASE_ANON_KEY || process.env.VITE_PUBLICSUPABASE_ANON_KEY || '',
  },
  reactStrictMode: true,
};

export default nextConfig;
