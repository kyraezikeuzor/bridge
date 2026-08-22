/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sunrise ships TypeScript source; transpile it for the Next.js bundler
  transpilePackages: ["@omelora/sunrise"],
};

export default nextConfig;
