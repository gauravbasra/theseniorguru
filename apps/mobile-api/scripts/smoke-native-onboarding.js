const assert = require("assert");

const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:4187";

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${json.error || text}`);
  }
  return json;
}

async function main() {
  const photo = await request("/api/media/evidence", {
    method: "POST",
    body: JSON.stringify({
      subjectRole: "senior",
      evidenceType: "profile_photo",
      captureMethod: "camera",
      localUri: "file:///tmp/native-profile-photo.jpg",
      mimeType: "image/jpeg",
      fileName: "native-profile-photo.jpg",
      width: 1024,
      height: 768,
      durationMs: null,
      source: "expo-image-picker"
    })
  });

  assert.equal(photo.evidence.subjectRole, "senior");
  assert.equal(photo.evidence.evidenceType, "profile_photo");
  assert.equal(photo.evidence.captureMethod, "camera");
  assert.equal(photo.evidence.verificationStatus, "captured");
  assert.ok(photo.evidence.id, "evidence id should be returned");

  const wearable = await request("/api/wearables/connect", {
    method: "POST",
    body: JSON.stringify({
      provider: "Android Health Connect",
      source: "mobile-onboarding",
      nativeDiagnostics: {
        available: true,
        source: "android-health-connect",
        readings: [
          { capturedAt: new Date().toISOString(), source: "android-health-connect", heartRate: 72, stepsToday: 4120 }
        ]
      },
      requestedDataTypes: ["heartRate", "steps", "sleep"]
    })
  });

  assert.equal(wearable.connection.provider, "Android Health Connect");
  assert.equal(wearable.connection.status, "connected");
  assert.equal(wearable.healthConsent.granted, true);
  assert.ok(wearable.wearables.devices.some(device => device.id === "android_health_connect"), "connected Health Connect device should be persisted");

  console.log("Native onboarding smoke passed");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
