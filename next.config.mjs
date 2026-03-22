/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/Gork-ai',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Removed the 'eslint' block that caused the warning
};

export default nextConfig;
