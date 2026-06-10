const { execSync } = require('child_process');
const fs = require('fs');

function run(label, command, options = {}) {
  try {
    const output = execSync(command, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', ...options }).trim();
    return { label, ok: true, output: output.split('\n').slice(0, 4).join('\n') };
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
    return { label, ok: false, output: output.split('\n').slice(0, 6).join('\n') || error.message };
  }
}

const checks = [
  run('Node', 'node --version'),
  run('NPM', 'npm --version'),
  run('Expo config', 'npx expo config --type public'),
  run('TypeScript', 'npm run typecheck'),
  run('CocoaPods', 'pod --version'),
  run('Java runtime', 'java -version'),
  run('Android Gradle wrapper', './gradlew --version', { cwd: 'android' })
];

const files = [
  { label: 'iOS HealthKit entitlement', path: 'ios/TheSeniorguru/TheSeniorguru.entitlements', contains: 'com.apple.developer.healthkit' },
  { label: 'iOS Health usage string', path: 'ios/TheSeniorguru/Info.plist', contains: 'NSHealthShareUsageDescription' },
  { label: 'Android Health Connect permissions', path: 'android/app/src/main/AndroidManifest.xml', contains: 'android.permission.health.READ_HEART_RATE' },
  { label: 'Android Health Connect package query', path: 'android/app/src/main/AndroidManifest.xml', contains: 'com.google.android.apps.healthdata' }
];

for (const file of files) {
  try {
    const body = fs.readFileSync(file.path, 'utf8');
    checks.push({ label: file.label, ok: body.includes(file.contains), output: file.path });
  } catch (error) {
    checks.push({ label: file.label, ok: false, output: error.message });
  }
}

const failed = checks.filter(check => !check.ok);
console.log(JSON.stringify({
  passed: failed.length === 0,
  checks,
  blockers: failed.map(check => ({ label: check.label, output: check.output }))
}, null, 2));
process.exit(failed.length ? 1 : 0);
