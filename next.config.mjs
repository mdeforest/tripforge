/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Tell Next.js not to bundle these packages — use the node_modules version
    // directly at runtime. Prisma's generated client includes a native binary
    // that webpack can't process, causing 60s+ compilation hangs.
    serverComponentsExternalPackages: [
      "@prisma/client",
      "bcryptjs",
      "@auth/prisma-adapter",
      "pdf-parse",
      "mammoth",
      "@anthropic-ai/sdk",
    ],
  },
};

export default nextConfig;
