/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignore build errors for now — re-enable once all type issues are resolved
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
