const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a random JWT secret
const generateJwtSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Path to .env.local file
const envFilePath = path.join(process.cwd(), '.env.local');

// Check if .env.local already exists
if (fs.existsSync(envFilePath)) {
  console.log('\x1b[33m%s\x1b[0m', '.env.local already exists. Skipping creation.');
} else {
  // Create .env.local file with MongoDB URI and JWT secret
  const envContent = `MONGODB_URI=mongodb://localhost:27017/video_call_app
JWT_SECRET=${generateJwtSecret()}`;

  try {
    fs.writeFileSync(envFilePath, envContent);
    console.log('\x1b[32m%s\x1b[0m', '.env.local file created successfully.');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error creating .env.local file:', error);
  }
}

console.log('\x1b[36m%s\x1b[0m', `
========================================
   Authentication System Setup Guide
========================================

1. Make sure MongoDB is installed and running
   - For local development: mongodb://localhost:27017
   - For production: Use MongoDB Atlas or another cloud provider

2. Environment Variables
   - .env.local file has been created with:
     * MONGODB_URI: mongodb://localhost:27017/video_call_app
     * JWT_SECRET: A randomly generated secret

3. Start the application
   - Run: npm run dev
   - The database and collections will be created automatically

4. Access the application
   - Open: http://localhost:3000
   - Register a new user to get started

========================================
`); 