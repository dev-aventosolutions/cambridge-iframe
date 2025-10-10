/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Static export
  output: 'export',

  // ✅ Custom headers
  async headers() {
    return [
      {
        source: "/(.*)", // all routes
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:3000 https://alphalogisticspk.com",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM http://localhost:3000", // optional, older browsers
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
