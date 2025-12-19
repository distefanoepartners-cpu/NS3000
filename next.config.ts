import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ← Ignora errori ESLint durante il build
  },
  typescript: {
    ignoreBuildErrors: true, // ← Ignora errori TypeScript
  }
}

export default nextConfig