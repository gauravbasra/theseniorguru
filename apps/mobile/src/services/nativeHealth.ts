import { Platform } from "react-native";

declare const require: any;

type NativeHealthReading = {
  capturedAt: string;
  source: string;
  heartRate?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  hrv?: number;
  sleepMinutes?: number;
  caloriesToday?: number;
  stepsToday?: number;
};

type NativeHealthResult = {
  available: boolean;
  source: string;
  error?: string;
  readings: NativeHealthReading[];
};

function todayRange() {
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function numberOrUndefined(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
}

export async function collectNativeHealthReadings(): Promise<NativeHealthResult> {
  if (Platform.OS === "ios") return collectIosHealthKit();
  if (Platform.OS === "android") return collectAndroidHealthConnect();
  return { available: false, source: "unsupported-platform", error: "Native health APIs are available on iOS and Android devices only.", readings: [] };
}

async function collectIosHealthKit(): Promise<NativeHealthResult> {
  try {
    const healthModule = require("react-native-health");
    const appleHealthKit = healthModule.default || healthModule;
    const permissions = {
      permissions: {
        read: [
          appleHealthKit.Constants.Permissions.HeartRate,
          appleHealthKit.Constants.Permissions.RespiratoryRate,
          appleHealthKit.Constants.Permissions.OxygenSaturation,
          appleHealthKit.Constants.Permissions.HeartRateVariability,
          appleHealthKit.Constants.Permissions.StepCount,
          appleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          appleHealthKit.Constants.Permissions.SleepAnalysis
        ],
        write: []
      }
    };
    await new Promise<void>((resolve, reject) => {
      appleHealthKit.initHealthKit(permissions, (error: string) => error ? reject(new Error(error)) : resolve());
    });
    const range = todayRange();
    const [heartRate, oxygen, respiratory, hrv, steps, calories, sleep] = await Promise.all([
      getMostRecentIosSample(appleHealthKit, "getHeartRateSamples", range, "value"),
      getMostRecentIosSample(appleHealthKit, "getOxygenSaturationSamples", range, "value"),
      getMostRecentIosSample(appleHealthKit, "getRespiratoryRateSamples", range, "value"),
      getMostRecentIosSample(appleHealthKit, "getHeartRateVariabilitySamples", range, "value"),
      getIosQuantity(appleHealthKit, "getStepCount", range),
      getIosQuantity(appleHealthKit, "getActiveEnergyBurned", range),
      getIosSleepMinutes(appleHealthKit, range)
    ]);
    return {
      available: true,
      source: "ios-healthkit",
      readings: [{ capturedAt: new Date().toISOString(), source: "ios-healthkit", heartRate, oxygenSaturation: oxygen, respiratoryRate: respiratory, hrv, stepsToday: steps, caloriesToday: calories, sleepMinutes: sleep }]
    };
  } catch (error: any) {
    return { available: false, source: "ios-healthkit", error: error.message || "HealthKit is unavailable", readings: [] };
  }
}

async function getMostRecentIosSample(appleHealthKit: any, method: string, range: any, field: string) {
  if (typeof appleHealthKit[method] !== "function") return undefined;
  const samples = await new Promise<any[]>((resolve, reject) => {
    appleHealthKit[method](range, (error: string, results: any[]) => error ? reject(new Error(error)) : resolve(results || []));
  });
  return numberOrUndefined(samples[0]?.[field]);
}

async function getIosQuantity(appleHealthKit: any, method: string, range: any) {
  if (typeof appleHealthKit[method] !== "function") return undefined;
  const result = await new Promise<any>((resolve, reject) => {
    appleHealthKit[method](range, (error: string, results: any) => error ? reject(new Error(error)) : resolve(results));
  });
  return numberOrUndefined(result?.value);
}

async function getIosSleepMinutes(appleHealthKit: any, range: any) {
  if (typeof appleHealthKit.getSleepSamples !== "function") return undefined;
  const samples = await new Promise<any[]>((resolve, reject) => {
    appleHealthKit.getSleepSamples(range, (error: string, results: any[]) => error ? reject(new Error(error)) : resolve(results || []));
  });
  const minutes = samples.reduce((sum, sample) => {
    const start = new Date(sample.startDate).getTime();
    const end = new Date(sample.endDate).getTime();
    return Number.isFinite(start) && Number.isFinite(end) ? sum + Math.max(0, end - start) / 60000 : sum;
  }, 0);
  return Math.round(minutes) || undefined;
}

async function collectAndroidHealthConnect(): Promise<NativeHealthResult> {
  try {
    const hc = require("react-native-health-connect");
    const initialize = (hc as any).initialize;
    const requestPermission = (hc as any).requestPermission;
    const readRecords = (hc as any).readRecords;
    if (typeof initialize === "function") await initialize();
    if (typeof requestPermission === "function") {
      await requestPermission([
        { accessType: "read", recordType: "HeartRate" },
        { accessType: "read", recordType: "OxygenSaturation" },
        { accessType: "read", recordType: "RespiratoryRate" },
        { accessType: "read", recordType: "HeartRateVariabilityRmssd" },
        { accessType: "read", recordType: "Steps" },
        { accessType: "read", recordType: "ActiveTotalCaloriesBurned" },
        { accessType: "read", recordType: "SleepSession" }
      ]);
    }
    const range = todayRange();
    const timeRangeFilter = { operator: "between", startTime: range.startDate, endTime: range.endDate };
    const [heartRate, oxygen, respiratory, hrv, steps, calories, sleep] = await Promise.all([
      readHealthConnectRecord(readRecords, "HeartRate", timeRangeFilter),
      readHealthConnectRecord(readRecords, "OxygenSaturation", timeRangeFilter),
      readHealthConnectRecord(readRecords, "RespiratoryRate", timeRangeFilter),
      readHealthConnectRecord(readRecords, "HeartRateVariabilityRmssd", timeRangeFilter),
      readHealthConnectRecord(readRecords, "Steps", timeRangeFilter),
      readHealthConnectRecord(readRecords, "ActiveTotalCaloriesBurned", timeRangeFilter),
      readHealthConnectSleep(readRecords, timeRangeFilter)
    ]);
    return {
      available: true,
      source: "android-health-connect",
      readings: [{ capturedAt: new Date().toISOString(), source: "android-health-connect", heartRate, oxygenSaturation: oxygen, respiratoryRate: respiratory, hrv, stepsToday: steps, caloriesToday: calories, sleepMinutes: sleep }]
    };
  } catch (error: any) {
    return { available: false, source: "android-health-connect", error: error.message || "Health Connect is unavailable", readings: [] };
  }
}

async function readHealthConnectRecord(readRecords: any, recordType: string, timeRangeFilter: any) {
  if (typeof readRecords !== "function") return undefined;
  const result = await readRecords(recordType, { timeRangeFilter });
  const records = result?.records || [];
  if (!records.length) return undefined;
  const latest = records[records.length - 1];
  if (Array.isArray(latest.samples) && latest.samples.length) return numberOrUndefined(latest.samples[latest.samples.length - 1].beatsPerMinute ?? latest.samples[latest.samples.length - 1].value);
  return numberOrUndefined(latest.count ?? latest.energy?.inKilocalories ?? latest.percentage ?? latest.rate ?? latest.beatsPerMinute ?? latest.value);
}

async function readHealthConnectSleep(readRecords: any, timeRangeFilter: any) {
  if (typeof readRecords !== "function") return undefined;
  const result = await readRecords("SleepSession", { timeRangeFilter });
  const records = result?.records || [];
  const minutes = records.reduce((sum: number, record: any) => {
    const start = new Date(record.startTime).getTime();
    const end = new Date(record.endTime).getTime();
    return Number.isFinite(start) && Number.isFinite(end) ? sum + Math.max(0, end - start) / 60000 : sum;
  }, 0);
  return Math.round(minutes) || undefined;
}
