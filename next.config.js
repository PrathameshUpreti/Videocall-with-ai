/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode helps identify bugs early
  reactStrictMode: true,
  // Disable server-side rendering for specific paths that rely heavily on browser APIs
  experimental: {
    // Apply middleware only to specific paths
    optimizeCss: false,
    // Other experimental features
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.vercel.app'],
    },
  },
  // Proxy API requests to the MCP server
  async rewrites() {
    return [
      {
        source: '/mcp/:path*',
        destination: process.env.MCP_API_URL ? `${process.env.MCP_API_URL}/mcp/:path*` : 'http://localhost:5001/mcp/:path*',
      },
      // Socket.io server proxy
      {
        source: '/socket.io/:path*',
        destination: process.env.SOCKET_API_URL ? `${process.env.SOCKET_API_URL}/socket.io/:path*` : 'http://localhost:9000/socket.io/:path*'
      },
      // Flask research API proxy
      {
        source: '/api/startup-research/:path*',
        destination: process.env.RESEARCH_API_URL ? `${process.env.RESEARCH_API_URL}/api/startup-research/:path*` : 'http://localhost:9001/api/startup-research/:path*'
      }
    ];
  },
  images: {
    domains: ['crewai.io']
  }
};

module.exports = nextConfig; 