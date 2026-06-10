const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function patchFile(relativePath, replacements) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`[native-compat] Skipping missing file: ${relativePath}`);
    return;
  }

  let source = fs.readFileSync(filePath, 'utf8');
  let next = source;
  for (const [from, to] of replacements) {
    next = next.replace(from, to);
  }

  if (next !== source) {
    fs.writeFileSync(filePath, next);
    console.log(`[native-compat] Patched ${relativePath}`);
  } else {
    console.log(`[native-compat] Already compatible: ${relativePath}`);
  }
}

patchFile('node_modules/expo-modules-core/android/src/main/java/expo/modules/adapters/react/permissions/PermissionsService.kt', [
  [
    'return requestedPermissions.contains(permission)',
    'return requestedPermissions?.contains(permission) ?: false'
  ]
]);

patchFile('node_modules/expo-sensors/android/src/main/java/expo/modules/sensors/services/BaseSensorService.kt', [
  [
    'requestedPermissions.contains(Manifest.permission.HIGH_SAMPLING_RATE_SENSORS)',
    'requestedPermissions?.contains(Manifest.permission.HIGH_SAMPLING_RATE_SENSORS) ?: false'
  ]
]);
