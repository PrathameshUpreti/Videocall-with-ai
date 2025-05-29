const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

// Generate self-signed certificates
const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, { days: 365 });

// Create certs directory if it doesn't exist
if (!fs.existsSync('certs')) {
  fs.mkdirSync('certs');
}

// Write certificate files
fs.writeFileSync(path.join('certs', 'key.pem'), pems.private);
fs.writeFileSync(path.join('certs', 'cert.pem'), pems.cert);

console.log('Self-signed certificates generated in the certs directory'); 