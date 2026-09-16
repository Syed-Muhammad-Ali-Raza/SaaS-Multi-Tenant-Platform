/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.NEXT_STANDALONE === "true" ? { output: "standalone" } : {}),
  transpilePackages: ["saas-shared"],
};

export default nextConfig;