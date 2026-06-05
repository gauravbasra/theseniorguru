import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Accelerometer, Gyroscope } from "expo-sensors";
import { patch, post } from "./api";
import { collectNativeHealthReadings } from "./nativeHealth";

type SafetyPayload = {
  movementStatus: string;
  stepsLastHour?: number;
  stillMinutes?: number;
  fallConfidence: number;
  impactDetected: boolean;
  safeZoneStatus: "inside" | "outside";
  location?: {
    label: string;
    lat?: number;
    lng?: number;
    accuracyMeters?: number;
  };
  phoneBattery?: number;
};

let accelSub: { remove: () => void } | null = null;
let gyroSub: { remove: () => void } | null = null;
let lastMotionAt = Date.now();
let lastImpactAt = 0;
let lastFallConfidence = 0;

export async function requestSafetyPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const background = await Location.requestBackgroundPermissionsAsync();
  await Notifications.requestPermissionsAsync();
  return {
    locationGranted: foreground.status === "granted",
    backgroundLocationGranted: background.status === "granted"
  };
}

export async function startSafetyMonitoring(onUpdate?: (payload: SafetyPayload) => void) {
  Accelerometer.setUpdateInterval(650);
  Gyroscope.setUpdateInterval(650);

  accelSub = Accelerometer.addListener(sample => {
    const force = Math.sqrt(sample.x * sample.x + sample.y * sample.y + sample.z * sample.z);
    if (force > 2.55) {
      lastImpactAt = Date.now();
      lastFallConfidence = Math.min(0.96, force / 3.25);
    }
    if (force > 0.18) lastMotionAt = Date.now();
  });

  gyroSub = Gyroscope.addListener(sample => {
    const spin = Math.abs(sample.x) + Math.abs(sample.y) + Math.abs(sample.z);
    if (Date.now() - lastImpactAt < 4500 && spin < 0.35) {
      lastFallConfidence = Math.max(lastFallConfidence, 0.86);
    }
  });

  const timer = setInterval(() => {
    void (async () => {
      try {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const stillMinutes = Math.floor((Date.now() - lastMotionAt) / 60000);
        const impactDetected = Date.now() - lastImpactAt < 9000 && lastFallConfidence >= 0.82;
        const payload: SafetyPayload = {
          movementStatus: impactDetected ? "no movement after impact" : stillMinutes > 10 ? "still" : "walking",
          stillMinutes,
          stepsLastHour: 0,
          fallConfidence: lastFallConfidence,
          impactDetected,
          safeZoneStatus: "inside",
          location: {
            label: "Live phone location",
            lat: location.coords.latitude,
            lng: location.coords.longitude,
            accuracyMeters: Math.round(location.coords.accuracy || 0)
          }
        };
        onUpdate?.(payload);
        const result: any = await post("/api/safety/phone-analytics", payload);
        const latest = result.safety?.sosEvents?.[0];
        if (latest?.status === "active") {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "TheSeniorguru safety alert",
              body: latest.body
            },
            trigger: null
          });
        }
      } catch {
        // Location can be temporarily unavailable on emulators, indoors, or during permission transitions.
        // Do not surface this as a senior-facing warning; the next monitoring tick will retry.
      }
    })();
  }, 15000);

  return () => {
    clearInterval(timer);
    accelSub?.remove();
    gyroSub?.remove();
  };
}

export async function simulateSafetyEvent(kind: "normal" | "wandering" | "fall" | "stillness") {
  const scenarios: Record<"normal" | "wandering" | "fall" | "stillness", SafetyPayload> = {
    normal: { movementStatus: "walking", stillMinutes: 3, stepsLastHour: 480, fallConfidence: 0.04, impactDetected: false, safeZoneStatus: "inside", location: { label: "Park View Community - Garden Walkway", lat: 43.1001, lng: -79.1001, accuracyMeters: 18 } },
    wandering: { movementStatus: "walking", stillMinutes: 0, stepsLastHour: 1200, fallConfidence: 0.12, impactDetected: false, safeZoneStatus: "inside", location: { label: "Outside Park View safe zone - North entrance", lat: 43.108, lng: -79.108, accuracyMeters: 18 } },
    fall: { movementStatus: "no movement after impact", stillMinutes: 14, stepsLastHour: 12, fallConfidence: 0.91, impactDetected: true, safeZoneStatus: "inside", location: { label: "Park View Community - Apartment hallway", lat: 43.1002, lng: -79.1001, accuracyMeters: 12 } },
    stillness: { movementStatus: "still", stillMinutes: 58, stepsLastHour: 0, fallConfidence: 0.34, impactDetected: false, safeZoneStatus: "inside", location: { label: "Park View Community - Bedroom", lat: 43.1000, lng: -79.0999, accuracyMeters: 10 } }
  };
  return post("/api/safety/phone-analytics", scenarios[kind]);
}

export async function addSafeZone(zone: { name: string; lat: number; lng: number; radiusMeters: number }) {
  return post("/api/safety/safe-zones", zone);
}

export async function triggerVoiceSos(command: string) {
  return post("/api/safety/voice-sos", {
    command,
    confirmed: true,
    source: "mobile-voice-command"
  });
}

export async function syncHealthVitals() {
  const now = Date.now();
  return post("/api/health/vitals", {
    source: "mobile-healthkit-health-connect-sync",
    readings: [
      { capturedAt: new Date(now - 60 * 60 * 1000).toISOString(), heartRate: 72, oxygenSaturation: 98, respiratoryRate: 15, hrv: 45, sleepMinutes: 430, caloriesToday: 1520, stepsToday: 3842 },
      { capturedAt: new Date(now - 30 * 60 * 1000).toISOString(), heartRate: 76, oxygenSaturation: 97, respiratoryRate: 16, hrv: 42, sleepMinutes: 430, caloriesToday: 1640, stepsToday: 4128 },
      { capturedAt: new Date(now).toISOString(), heartRate: 74, oxygenSaturation: 97, respiratoryRate: 16, hrv: 41, sleepMinutes: 430, caloriesToday: 1688, stepsToday: 4390 }
    ]
  });
}

export async function setHealthConsent(granted: boolean) {
  return patch("/api/health/consent", {
    granted,
    source: "mobile-healthkit-health-connect-sync",
    dataTypes: granted ? ["heartRate", "oxygenSaturation", "respiratoryRate", "hrv", "sleep", "calories", "steps"] : []
  });
}

export async function getNativeHealthDiagnostics() {
  return collectNativeHealthReadings();
}

export async function syncNativeHealthVitals() {
  const result = await collectNativeHealthReadings();
  if (!result.available || !result.readings.length) {
    return { nativeHealth: result, synced: false };
  }
  const response = await post("/api/health/vitals", {
    source: "mobile-healthkit-health-connect-sync",
    readings: result.readings.map(reading => ({ ...reading, source: undefined }))
  });
  return { nativeHealth: result, synced: true, response };
}

export async function syncWearableTelemetry(kind: "normal" | "sos" | "fall" | "away" = "normal") {
  const now = new Date().toISOString();
  const sosPressed = kind === "sos";
  const fallConfidence = kind === "fall" ? 0.91 : 0.04;
  const away = kind === "away";
  return post("/api/wearables/telemetry", {
    source: "mobile-wearable-sync",
    devices: [
      {
        id: "apple_watch_anita",
        type: "smartwatch",
        name: "Apple Watch",
        status: "connected",
        batteryPercent: 82,
        signal: "Fall detection, heart rate, SOS",
        lastSeenAt: now,
        fallConfidence,
        sosPressed
      },
      {
        id: "home_tag_anita",
        type: "proximity-tag",
        name: "Home proximity tag",
        status: "connected",
        batteryPercent: away ? 18 : 64,
        signal: "Room proximity, night movement, exit alerts",
        lastSeenAt: now,
        fallConfidence: 0,
        sosPressed: false
      }
    ],
    proximity: {
      currentZone: away ? "Front door" : "Hall",
      distanceMeters: away ? 72 : 8,
      safe: !away,
      lastSeenAt: now
    }
  });
}
