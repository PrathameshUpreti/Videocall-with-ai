// Troubleshoot deployment script
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

console.log('Vercel Deployment Troubleshooter');
console.log('================================');

// Check TypeScript configuration
try {
  const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
  console.log('TypeScript configuration loaded successfully');
  console.log('Strict mode:', tsConfig.compilerOptions.strict);
  console.log('StrictNullChecks:', tsConfig.compilerOptions.strictNullChecks);
} catch (err) {
  console.error('Error loading TypeScript configuration:', err.message);
}

// Test TypeScript compilation
console.log('\nTesting TypeScript compilation...');
try {
  child_process.execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('TypeScript compilation successful');
} catch (err) {
  console.error('TypeScript compilation failed');
}

// Check package dependencies
console.log('\nChecking package dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log('Next.js version:', packageJson.dependencies.next);
  console.log('React version:', packageJson.dependencies.react);
  console.log('Clerk version:', packageJson.dependencies['@clerk/nextjs']);
  
  // Check for version conflicts
  const nextVersion = packageJson.dependencies.next.replace('^', '');
  const clerkVersion = packageJson.dependencies['@clerk/nextjs'].replace('^', '');
  
  console.log(`\nChecking if Next.js ${nextVersion} is compatible with Clerk ${clerkVersion}...`);
  // This is a simplified check - in a real script you would check against known compatibility data
  
} catch (err) {
  console.error('Error checking package dependencies:', err.message);
}

console.log('\nDeployment Troubleshooting Complete');
console.log('================================'); 