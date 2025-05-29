const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const config = {
  nextjs: {
    command: 'npm',
    args: ['run', 'dev'],
    name: 'NextJS',
    color: '\x1b[36m' // Cyan
  },
  socketServer: {
    command: 'node',
    args: ['server.js'],
    name: 'Socket Server',
    color: '\x1b[33m' // Yellow
  },
  flaskResearchServer: {
    command: getCommand('python'),
    args: ['startup_api.py'],
    name: 'Research API',
    color: '\x1b[35m' // Magenta
  }
};

// Helper function to get the right Python command
function getCommand(cmd) {
  // On Windows, try to use python or python3
  if (os.platform() === 'win32') {
    try {
      // Check if python3 exists
      spawn('python3', ['-c', 'print("test")']);
      return 'python3';
    } catch (e) {
      return 'python';
    }
  }
  return cmd;
}

// Create a .env file if it doesn't exist
function ensureEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('\x1b[33m%s\x1b[0m', 'Creating default .env file...');
    
    const defaultEnv = `
# OpenAI API Key - Required for the research API
OPENAI_API_KEY=

# LLM Model Configuration
LLM_MODEL=gpt-4-turbo
LLM_TEMPERATURE=0.5

# SearXNG Configuration (for web search)
SEARXNG_INSTANCE=https://searx.be

# API Server Ports
PORT=9000
STARTUP_API_PORT=9001
    `.trim();
    
    fs.writeFileSync(envPath, defaultEnv);
    console.log('\x1b[31m%s\x1b[0m', 'Please add your OpenAI API key to the .env file');
    process.exit(1);
  }
}

// Start all servers
function startAllServers() {
  ensureEnvFile();
  
  console.log('\x1b[32m%s\x1b[0m', '🚀 Starting all servers...');
  
  Object.values(config).forEach(({ command, args, name, color }) => {
    const server = spawn(command, args, {
      stdio: 'pipe',
      shell: true
    });
    
    console.log(`${color}%s\x1b[0m`, `Starting ${name}...`);
    
    // Handle stdout
    server.stdout.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`${color}[${name}]\x1b[0m ${line}`);
        }
      });
    });
    
    // Handle stderr
    server.stderr.on('data', (data) => {
      const lines = data.toString().trim().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`${color}[${name} ERROR]\x1b[0m ${line}`);
        }
      });
    });
    
    // Handle server exit
    server.on('close', (code) => {
      console.log(`${color}[${name}]\x1b[0m Process exited with code ${code}`);
    });
    
    // Handle errors
    server.on('error', (err) => {
      console.error(`${color}[${name}]\x1b[0m Failed to start: ${err.message}`);
    });
  });
}

// Execute
startAllServers(); 