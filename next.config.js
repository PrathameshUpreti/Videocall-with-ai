/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode helps identify bugs early
  reactStrictMode: true,
  // Disable server-side rendering for specific paths that rely heavily on browser APIs
  experimental: {
    // Apply middleware only to specific paths
    optimizeCss: true,
    // Other experimental features
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  // Proxy API requests to the MCP server
  async rewrites() {
    return [
      {
        source: '/mcp/:path*',
        destination: 'http://localhost:5001/mcp/:path*',
      },
      // Socket.io server proxy
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:9000/socket.io/:path*'
      },
      // Flask research API proxy
      {
        source: '/api/startup-research/:path*',
        destination: 'http://localhost:9001/api/startup-research/:path*'
      }
    ];
  },
  images: {
    domains: ['crewai.io']
  }
};

module.exports = nextConfig; 