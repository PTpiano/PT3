/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite (solo sviluppo locale) usa WASM e dipendenze opzionali che
  // Turbopack non riesce a risolvere: resta esterno al bundle server.
  // In produzione DATABASE_URL è sempre impostata, quindi non viene caricato.
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    remotePatterns: [
      // Immagini legacy ancora puntate dai dati esistenti (galleria/album):
      // restano validi finché non vengono ricaricate sul nuovo storage.
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.netlify.app",
        pathname: "/**",
      },
      // Nuovo storage: Vercel Blob (produzione) e file locali (sviluppo).
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          destination: "/index.html",
        },
      ],
    };
  },
  async headers() {
    return [
      {
        // Security headers per tutte le route
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
