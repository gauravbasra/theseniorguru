const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

const HEALTH_CONNECT_PERMISSIONS = [
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_OXYGEN_SATURATION',
  'android.permission.health.READ_RESPIRATORY_RATE',
  'android.permission.health.READ_HEART_RATE_VARIABILITY',
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
  'android.permission.health.READ_SLEEP'
];

function ensurePermission(androidManifest, permission) {
  AndroidConfig.Permissions.addPermission(androidManifest, permission);
}

function ensureHealthConnectQueries(androidManifest) {
  androidManifest.queries = androidManifest.queries || [{}];
  const queries = androidManifest.queries[0];
  queries.package = queries.package || [];
  const exists = queries.package.some(item => item.$ && item.$['android:name'] === 'com.google.android.apps.healthdata');
  if (!exists) {
    queries.package.push({ $: { 'android:name': 'com.google.android.apps.healthdata' } });
  }
}

module.exports = function withTheSeniorguruHealthConnect(config) {
  return withAndroidManifest(config, config => {
    const androidManifest = config.modResults;
    for (const permission of HEALTH_CONNECT_PERMISSIONS) ensurePermission(androidManifest, permission);
    ensureHealthConnectQueries(androidManifest.manifest);
    return config;
  });
};
