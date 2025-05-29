const { spawn } = require('child_process');
const path = require('path');
const { platform } = require('os');
const { exit } = require('process');

// Determine OS-specific command for Python
const isPythonCommand = platform() === 'win32' ? 'python' : 'python3';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

console.log(`${colors.cyan}Starting Video Call App servers...${colors.reset}`);

// Start Node.js server
const nodeServer = spawn('node', ['server.js'], {
  stdio: 'pipe',
  shell: true,
});

// Start MCP server
const mcpServer = spawn(isPythonCommand, ['mcp_server.py'], {
  stdio: 'pipe',
  shell: true,
});

// Start Next.js dev server
const nextServer = spawn('npx', ['next', 'dev'], {
  stdio: 'pipe',
  shell: true,
});

// Handle Node.js server output
nodeServer.stdout.on('data', (data) => {
  console.log(`${colors.green}[Node Server] ${colors.reset}${data.toString().trim()}`);
});

nodeServer.stderr.on('data', (data) => {
  console.error(`${colors.red}[Node Server Error] ${colors.reset}${data.toString().trim()}`);
});

// Handle MCP server output
mcpServer.stdout.on('data', (data) => {
  console.log(`${colors.blue}[MCP Server] ${colors.reset}${data.toString().trim()}`);
});

mcpServer.stderr.on('data', (data) => {
  console.error(`${colors.red}[MCP Server Error] ${colors.reset}${data.toString().trim()}`);
});

// Handle Next.js server output
nextServer.stdout.on('data', (data) => {
  console.log(`${colors.magenta}[Next.js] ${colors.reset}${data.toString().trim()}`);
});

nextServer.stderr.on('data', (data) => {
  console.error(`${colors.red}[Next.js Error] ${colors.reset}${data.toString().trim()}`);
});

// Handle process exit
nodeServer.on('close', (code) => {
  console.log(`${colors.yellow}Node.js server exited with code ${code}${colors.reset}`);
});

mcpServer.on('close', (code) => {
  console.log(`${colors.yellow}MCP server exited with code ${code}${colors.reset}`);
});

nextServer.on('close', (code) => {
  console.log(`${colors.yellow}Next.js server exited with code ${code}${colors.reset}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log(`${colors.yellow}Shutting down all servers...${colors.reset}`);
  nodeServer.kill();
  mcpServer.kill();
  nextServer.kill();
  
  setTimeout(() => {
    console.log(`${colors.green}All servers terminated successfully.${colors.reset}`);
    process.exit(0);
  }, 1000);
});

console.log(`${colors.cyan}All servers started. Press Ctrl+C to stop all servers.${colors.reset}`);
console.log(`${colors.green}Node.js server running on port 3001${colors.reset}`);
console.log(`${colors.blue}MCP server running on port 5001${colors.reset}`);
console.log(`${colors.magenta}Next.js server running on port 3000${colors.reset}`);
console.log(`${colors.cyan}Open http://localhost:3000 in your browser${colors.reset}`); 