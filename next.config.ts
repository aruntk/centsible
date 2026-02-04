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

  // Mark native modules as external to prevent bundling issues
  serverExternalPackages: ["better-sqlite3"],

  // Configure turbopack to resolve better-sqlite3 correctly
  turbopack: {
    resolveAlias: {
      // Ensure better-sqlite3 resolves to the actual package
      "better-sqlite3": "better-sqlite3",
    },
  },

  // Webpack config for non-turbopack builds
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize better-sqlite3 to prevent bundling issues
      config.externals = [...(config.externals || []), "better-sqlite3"];
    }
    return config;
  },
};

export default nextConfig;
