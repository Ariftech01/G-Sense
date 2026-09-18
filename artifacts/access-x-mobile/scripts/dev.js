const os = require('os');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function getActiveLanIp() {
  const ifaces = os.networkInterfaces();
  let candidate = null;

  for (const [name, addrs] of Object.entries(ifaces)) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('vmware') || lowerName.includes('virtual') || lowerName.includes('vethernet')) {
      continue;
    }
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        if (lowerName.includes('wi-fi') || lowerName.includes('wireless') || lowerName.includes('wlan')) {
          return addr.address;
        }
        if (!candidate) candidate = addr.address;
      }
    }
  }

  return candidate || '127.0.0.1';
}

const lanIp = getActiveLanIp();
console.log(`\n==================================================`);
console.log(`[G Sense] Binding Expo to Wi-Fi IP: ${lanIp}`);
console.log(`[G Sense] API Server Target: http://${lanIp}:5000`);
console.log(`==================================================\n`);

process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
process.env.EXPO_PUBLIC_DOMAIN = `${lanIp}:5000`;
process.env.EXPO_PUBLIC_API_URL = `http://${lanIp}:5000`;

// Update root .env so backend and mobile remain synchronized
try {
  const rootEnvPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(rootEnvPath)) {
    let content = fs.readFileSync(rootEnvPath, 'utf8');
    content = content.replace(/^EXPO_PUBLIC_DOMAIN=.*/m, `EXPO_PUBLIC_DOMAIN=${lanIp}:5000`);
    content = content.replace(/^EXPO_PUBLIC_API_URL=.*/m, `EXPO_PUBLIC_API_URL=http://${lanIp}:5000`);
    fs.writeFileSync(rootEnvPath, content, 'utf8');
  }
} catch {
  // ignore
}

const args = ['exec', 'expo', 'start', ...process.argv.slice(2)];
const expoProcess = spawn('pnpm', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
  cwd: path.resolve(__dirname, '..'),
});

expoProcess.on('exit', (code) => {
  process.exit(code ?? 0);
});
