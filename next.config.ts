import type { NextConfig } from "next";

const isMobileBuild = process.env.BUILD_TARGET === "mobile";

const nextConfig: NextConfig = {
  // Use 'export' for Capacitor mobile builds (static HTML/JS/CSS)
  // Use 'standalone' for Electron desktop builds (requires Node.js server)
  output: isMobileBuild ? "export" : "standalone",

  // For static export, we need to disable image optimization
  // since it requires a server
  ...(isMobileBuild && {
    images: {
      unoptimized: true,
    },
    // Trailing slashes help with static file serving
    trailingSlash: true,
  }),

  // Empty turbopack config to silence the warning about missing turbopack config
  // when webpack config is present
  turbopack: {},
};

export default nextConfig;
