/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16 requires a turbopack config when a custom webpack config exists
  turbopack: {}, 
  webpack: (config) => {
    config.module.exprContextCritical = false;
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig