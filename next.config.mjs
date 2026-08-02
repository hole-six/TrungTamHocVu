/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production/QA builds isolated from `next dev`. On Windows, running
  // both against the default `.next` directory can delete each other's route
  // chunks and surface random MODULE_NOT_FOUND errors at runtime.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
