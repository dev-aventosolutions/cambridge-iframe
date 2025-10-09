// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)", 
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:3000 https://alphalogisticspk.com", 
          },
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM http://localhost:3000", 
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
