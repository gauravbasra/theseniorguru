import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { getNativeHealthDiagnostics } from "./src/services/safety";

type Tab = "Guru" | "Today" | "Circle" | "Activities" | "Safety";
type Screen = Tab | "Journey" | "Medication" | "MedicationConfirm" | "Refill" | "Profile" | "Help" | "RideChat" | "RideMatches" | "RideStatus" | "PersonDetail" | "Feed" | "CreatePost" | "Notifications" | "Onboarding" | "Wellness" | "HealthTrends" | "HealthDevices" | "RiskInsights" | "FamilyHealth";
type Tone = "purple" | "green" | "orange" | "red" | "blue" | "soft";

type Role = "senior" | "circle" | "business";

type AppProfile = {
  name: string;
  preferredName: string;
  profilePhotoUri: string;
  profilePhotoEvidenceId: string;
};

type SeniorOnboarding = {
  name: string; preferredName: string; phone: string; email: string; dob: string; address: string; livingType: string;
  profilePhotoStatus: string; profilePhotoUri: string; profilePhotoEvidenceId: string; livenessStatus: string; livenessVideoUri: string; livenessEvidenceId: string; healthConcerns: string[]; medications: string; allergies: string;
  height: string; weight: string; bloodPressure: string; heartRate: string; mobility: string; wearableSources: string[]; wearableConnectionStatus: string;
  devicePermissions: string[]; musicApps: string[]; musicPreferences: string[]; circleInviteName: string; circleInviteRelation: string; circleInvitePhone: string;
  healthSharing: string; locationSharing: string; sosOrder: string; wakeTime: string; checkInTime: string;
};

type CircleOnboarding = {
  seniorName: string; name: string; relationship: string; phone: string; email: string; timezone: string; identityPhotoStatus: string; identityPhotoUri: string; identityPhotoEvidenceId: string; livenessStatus: string; livenessVideoUri: string; livenessEvidenceId: string;
  routineWindow: string; quietHours: string; emergencyOverride: string; alertTypes: string[]; visibility: string[]; escalationRole: string;
};

type BusinessOnboarding = {
  businessType: string; legalName: string; dba: string; ownerName: string; phone: string; email: string; website: string; address: string;
  ownerPhotoStatus: string; ownerPhotoUri: string; ownerPhotoEvidenceId: string; ownerLivenessStatus: string; ownerLivenessVideoUri: string; ownerLivenessEvidenceId: string; verificationDocs: string[]; services: string; pricing: string; availability: string;
  serviceRadius: string; serviceZips: string; serviceBoundary: string; maxLeads: string; leadTypes: string[]; communication: string[];
};

const seniorSteps = ["Welcome", "Live ID", "Profile", "Health", "Wearables", "Permissions", "Music", "Circle", "Privacy", "SOS", "Routine"];
const circleSteps = ["Invite", "Identity", "Rules", "Visibility", "Escalation"];
const businessSteps = ["Type", "Identity", "Verify", "Services", "Area", "Leads", "Trust"];

const PURPLE = "#6f3dcc";
const PURPLE_DARK = "#4f269f";
const DEEP = "#17142d";
const MUTED = "#6f6a7c";
const BG = "#fbfaff";
const LINE = "#ece8f6";
const SOFT = "#f4eefc";
const API_BASE = "https://mobile-api-nine.vercel.app";

function isPlaceholderProfileName(name?: string) {
  const normalized = String(name || "").trim().toLowerCase();
  return !normalized || normalized === "senior" || normalized === "resident" || normalized.startsWith("install-");
}

type ApiClient = {
  ready: boolean;
  error: string;
  user: any;
  get: (path: string) => Promise<any>;
  post: (path: string, payload?: any) => Promise<any>;
  patch: (path: string, payload?: any) => Promise<any>;
};

function useApiClient(): ApiClient {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem("tsg_installation_id_v1")
      .then(async existing => {
        const installationId = existing || `install-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (!existing) await AsyncStorage.setItem("tsg_installation_id_v1", installationId);
        return fetch(API_BASE + "/api/auth/device-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ installationId, role: "senior" })
        });
      })
      .then(async response => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Could not start session");
        if (alive) {
          setToken(json.token || "");
          setUser(json.user || null);
        }
      })
      .catch(err => alive && setError(err.message || "API session failed"));
    return () => { alive = false; };
  }, []);
  async function request(method: string, path: string, payload?: any) {
    if (!token) throw new Error(error || "API session is still starting. Try again in a moment.");
    const response = await fetch(API_BASE + path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    const text = await response.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      const preview = text ? text.slice(0, 160) : "Empty response";
      throw new Error(`API returned non-JSON response (${response.status}): ${preview}`);
    }
    if (!response.ok) throw new Error(json.error || "API request failed");
    return json;
  }
  return { ready: Boolean(token), error, user, get: (path) => request("GET", path), post: (path, payload) => request("POST", path, payload), patch: (path, payload) => request("PATCH", path, payload) };
}

async function runAction(label: string, action: () => Promise<any>, success: string) {
  try {
    await action();
    Alert.alert(label, success);
  } catch (err: any) {
    Alert.alert(label, err?.message || "Something went wrong.");
  }
}

let onboardingApiClient: ApiClient | null = null;
async function safePost(path: string, payload?: any) {
  if (!onboardingApiClient) throw new Error("Onboarding API is not ready yet.");
  return onboardingApiClient.post(path, payload);
}

async function uploadChunkedEvidence(input: {
  subjectRole: "senior" | "trust_circle" | "business_owner";
  evidenceType: "profile_photo" | "liveness_video";
  localUri: string;
  mimeType: string;
  fileName: string;
  base64Data: string;
  width?: number;
  height?: number;
  durationMs?: number | null;
}) {
  const chunkSize = 384 * 1024;
  const start = await safePost("/api/media/evidence-upload/start", {
    subjectRole: input.subjectRole,
    evidenceType: input.evidenceType,
    captureMethod: "camera",
    localUri: input.localUri,
    mimeType: input.mimeType,
    fileName: input.fileName,
    byteSize: Math.floor((input.base64Data.length * 3) / 4),
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    source: "expo-image-picker"
  });
  const uploadId = start.upload?.id;
  const totalChunks = Math.max(1, Math.ceil(input.base64Data.length / chunkSize));
  if (!uploadId) throw new Error("Upload session was not created.");
  for (let index = 0; index < totalChunks; index += 1) {
    await safePost("/api/media/evidence-upload/chunk", {
      uploadId,
      chunkIndex: index,
      totalChunks,
      base64Chunk: input.base64Data.slice(index * chunkSize, (index + 1) * chunkSize)
    });
  }
  return safePost("/api/media/evidence-upload/complete", { uploadId, totalChunks });
}

async function captureNativeEvidence(input: {
  subjectRole: "senior" | "trust_circle" | "business_owner";
  evidenceType: "profile_photo" | "liveness_video";
  mediaKind: "photo" | "video";
  onCaptured: (status: string, uri: string, evidenceId: string) => void;
  onProfileUpdated?: (uri: string, evidenceId: string) => void;
}) {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission needed", "Camera access is required to capture this verification item.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: input.mediaKind === "video" ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      allowsEditing: input.mediaKind === "photo",
      quality: 0.82,
      videoMaxDuration: input.mediaKind === "video" ? 8 : undefined
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    let base64Data = "";
    try {
      base64Data = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    } catch {
      base64Data = "";
    }
    const mimeType = asset.mimeType || (input.mediaKind === "video" ? "video/mp4" : "image/jpeg");
    const fileName = asset.fileName || `${input.evidenceType}.${input.mediaKind === "video" ? "mp4" : "jpg"}`;
    const durationMs = asset.duration ? Math.round(asset.duration) : null;
    const response = input.mediaKind === "video"
      ? await uploadChunkedEvidence({
        subjectRole: input.subjectRole,
        evidenceType: input.evidenceType,
        localUri: asset.uri,
        mimeType,
        fileName,
        base64Data,
        width: asset.width,
        height: asset.height,
        durationMs
      })
      : await safePost("/api/media/evidence", {
        subjectRole: input.subjectRole,
        evidenceType: input.evidenceType,
        captureMethod: "camera",
        localUri: asset.uri,
        mimeType,
        fileName,
        base64Data,
        width: asset.width,
        height: asset.height,
        durationMs,
        source: "expo-image-picker"
      });
    input.onCaptured(
      `${input.mediaKind === "video" ? "Video" : "Photo"} captured and saved for review`,
      asset.uri,
      response.evidence?.id || ""
    );
    if (input.subjectRole === "senior" && input.evidenceType === "profile_photo") {
      input.onProfileUpdated?.(asset.uri, response.evidence?.id || "");
    }
  } catch (err: any) {
    Alert.alert("Capture failed", err?.message || "Could not capture this verification item.");
  }
}

async function connectWearableProvider(provider: string, onConnected: (status: string) => void) {
  try {
    let nativeDiagnostics: any;
    try {
      nativeDiagnostics = await getNativeHealthDiagnostics();
    } catch (error: any) {
      nativeDiagnostics = { available: false, source: "native-health-detection", error: error?.message || "Native health detection failed safely.", readings: [] };
    }
    const requestedDataTypes = ["heartRate", "oxygenSaturation", "respiratoryRate", "hrv", "sleep", "calories", "steps"];
    const response = await safePost("/api/wearables/connect", {
      provider,
      source: "mobile-onboarding",
      nativeDiagnostics,
      requestedDataTypes
    });
    const status = response.connection?.status || "pending";
    onConnected(
      status === "connected"
        ? `${provider} detected and health consent recorded`
        : `No connected ${provider} data found yet. You can enable Health Connect / Apple Health permissions or pair a wearable in phone settings.`
    );
  } catch (err: any) {
    Alert.alert("Wearable setup failed", err?.message || "Could not connect this wearable source.");
  }
}

const MEDICATION_ID = "med_lisinopril";
const TRANSPORT_SERVICE_IDS: Record<string, string> = {
  CareRide: "3db24be2-30c5-44a7-87bb-e2f4646fb612",
  "Priya Cabs": "3db24be2-30c5-44a7-87bb-e2f4646fb612",
  "Senior Wheels": "3db24be2-30c5-44a7-87bb-e2f4646fb612",
  "Community Cab": "3db24be2-30c5-44a7-87bb-e2f4646fb612"
};

type RoutePoint = { label: string; lat: number; lng: number; placeId?: string };
type RideDraft = {
  pickupQuery: string;
  dropoffQuery: string;
  pickup: RoutePoint | null;
  dropoff: RoutePoint | null;
  scheduledDate: string;
  scheduledTime: string;
  riderPhone: string;
  contactPreference: "text" | "call";
  mobilityAid: string;
  accessibilityNeeds: string[];
  needsDoorToDoor: boolean;
  caregiverRidingAlong: boolean;
  assistanceNotes: string;
  pickupInstructions: string;
  dropoffInstructions: string;
  medicalSensitivityNotes: string;
  okToShareWithDriver: boolean;
  locationBias: { lat: number; lng: number } | null;
  route: any;
  options: any[];
  pricing: any;
  selectedMode: string;
  bookingId: string;
  status: any;
};

const initialRideDraft: RideDraft = {
  pickupQuery: "Use my current location",
  dropoffQuery: "Safeway near Highlands Ranch CO",
  pickup: null,
  dropoff: null,
  scheduledDate: "2026-06-08",
  scheduledTime: "10:30",
  riderPhone: "+1 555-123-4567",
  contactPreference: "text",
  mobilityAid: "none",
  accessibilityNeeds: ["door-to-door assistance"],
  needsDoorToDoor: true,
  caregiverRidingAlong: false,
  assistanceNotes: "",
  pickupInstructions: "Please call or text when arriving.",
  dropoffInstructions: "",
  medicalSensitivityNotes: "",
  okToShareWithDriver: true,
  locationBias: null,
  route: null,
  options: [],
  pricing: null,
  selectedMode: "local_partner",
  bookingId: "",
  status: null
};

function formatMoney(cents?: number) {
  if (!Number.isFinite(Number(cents))) return "Pending";
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function formatDistance(meters?: number) {
  if (!Number.isFinite(Number(meters))) return "Distance pending";
  const miles = Number(meters) / 1609.344;
  return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
}

function formatDuration(seconds?: number) {
  if (!Number.isFinite(Number(seconds))) return "Time pending";
  return `${Math.max(1, Math.round(Number(seconds) / 60))} min`;
}

function scheduledIso(draft: RideDraft) {
  const value = new Date(`${draft.scheduledDate}T${draft.scheduledTime}:00`);
  if (Number.isNaN(value.getTime())) throw new Error("Enter ride date as YYYY-MM-DD and time as HH:mm.");
  return value.toISOString();
}

function pointFromPlace(place: any, fallbackLabel: string): RoutePoint {
  const lat = Number(place?.lat);
  const lng = Number(place?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error(`Could not resolve ${fallbackLabel} to a mappable place.`);
  return {
    label: place.formattedAddress || place.description || place.name || place.primaryText || fallbackLabel,
    lat,
    lng,
    placeId: place.placeId
  };
}

async function resolvePlace(api: ApiClient, query: string, bias: { lat: number; lng: number } | null, fallbackLabel: string) {
  const search = await api.post("/api/places/autocomplete", {
    input: query,
    location: bias || undefined,
    radiusMeters: bias ? 30000 : 50000
  });
  const prediction = search.predictions?.[0];
  if (!prediction) throw new Error(`No Google Maps result found for ${query}. Try a more specific address.`);
  if (Number.isFinite(Number(prediction.lat)) && Number.isFinite(Number(prediction.lng))) return pointFromPlace(prediction, fallbackLabel);
  const details = await api.post("/api/places/details", { placeId: prediction.placeId });
  return pointFromPlace(details.place, fallbackLabel);
}

async function resolveTransportationServiceId(api: ApiClient) {
  try {
    const state = await api.get("/api/state");
    const service = (state.services || []).find((item: any) => {
      const text = `${item.name || ""} ${item.category || ""} ${item.providerName || ""}`.toLowerCase();
      return text.includes("transport") || text.includes("ride") || text.includes("cab");
    });
    if (service?.id) return service.id;
  } catch {
    // Fallback below keeps the current production seed usable if state read is unavailable.
  }
  return TRANSPORT_SERVICE_IDS.CareRide;
}

async function captureCurrentLocationForRide(draft: RideDraft, setRideDraft: React.Dispatch<React.SetStateAction<RideDraft>>) {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error("Location permission is needed to use your current pickup location.");
  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const point = {
    label: "Current location",
    lat: current.coords.latitude,
    lng: current.coords.longitude
  };
  setRideDraft(existing => ({
    ...existing,
    pickup: point,
    pickupQuery: "Current location",
    locationBias: { lat: point.lat, lng: point.lng }
  }));
}

async function prepareRideOptions(api: ApiClient, draft: RideDraft, setRideDraft: React.Dispatch<React.SetStateAction<RideDraft>>) {
  const pickup = draft.pickup || await resolvePlace(api, draft.pickupQuery.replace(/^Use my current location$/i, "Highlands Ranch CO"), draft.locationBias, "pickup");
  const bias = draft.locationBias || { lat: pickup.lat, lng: pickup.lng };
  const dropoff = draft.dropoff || await resolvePlace(api, draft.dropoffQuery, bias, "dropoff");
  const fulfillment = await api.post("/api/rides/fulfillment-options", {
    pickup,
    dropoff,
    serviceId: await resolveTransportationServiceId(api)
  });
  const recommendedMode = fulfillment.recommendedMode || fulfillment.options?.find((option: any) => option.available)?.mode || "local_partner";
  const quote = await api.post("/api/rides/pricing-quote", {
    pickup,
    dropoff,
    route: fulfillment.route,
    fulfillmentMode: recommendedMode,
    provider: recommendedMode
  });
  setRideDraft(existing => ({
    ...existing,
    pickup,
    dropoff,
    locationBias: bias,
    route: fulfillment.route,
    options: fulfillment.options || [],
    pricing: quote.pricing,
    selectedMode: recommendedMode
  }));
  return { pickup, dropoff, route: fulfillment.route, options: fulfillment.options || [], pricing: quote.pricing, selectedMode: recommendedMode };
}

async function createRideBooking(api: ApiClient, draft: RideDraft, mode: string, setRideDraft: React.Dispatch<React.SetStateAction<RideDraft>>) {
  const prepared = draft.route && draft.pickup && draft.dropoff && draft.pricing
    ? { pickup: draft.pickup, dropoff: draft.dropoff, route: draft.route, pricing: draft.pricing, selectedMode: draft.selectedMode }
    : await prepareRideOptions(api, draft, setRideDraft);
  const booking = await api.post("/api/bookings", {
    serviceId: await resolveTransportationServiceId(api),
    label: `Ride to ${prepared.dropoff.label}`,
    scheduledFor: scheduledIso(draft),
    pickup: prepared.pickup,
    dropoff: prepared.dropoff,
    fulfillmentMode: mode || prepared.selectedMode,
    paymentResponsibility: "senior",
    paymentStatus: "payment_required",
    rideIntake: {
      scheduledFor: scheduledIso(draft),
      riderPhone: draft.riderPhone,
      contactPreference: draft.contactPreference,
      accessibilityNeeds: draft.accessibilityNeeds,
      mobilityAid: draft.mobilityAid,
      needsDoorToDoor: draft.needsDoorToDoor,
      caregiverRidingAlong: draft.caregiverRidingAlong,
      assistanceNotes: draft.assistanceNotes,
      pickupInstructions: draft.pickupInstructions,
      dropoffInstructions: draft.dropoffInstructions,
      medicalSensitivityNotes: draft.medicalSensitivityNotes,
      okToShareWithDriver: draft.okToShareWithDriver
    }
  });
  setRideDraft(existing => ({ ...existing, bookingId: booking.booking?.id || "", status: booking, selectedMode: mode || prepared.selectedMode }));
  return booking;
}
async function bookRide(api: ApiClient, provider: string, label = "Ride to Dr. Mehta Clinic") {
  return api.post("/api/bookings", {
    serviceId: TRANSPORT_SERVICE_IDS[provider] || "careride",
    label,
    time: "Tomorrow, 10:30 AM",
    pickupLabel: "Park View Community",
    dropoffLabel: "Dr. Mehta Clinic",
    rideIntake: {
      scheduledPickupAt: "Tomorrow, 10:30 AM",
      riderPhone: "+1 555-123-4567",
      supportNeeds: ["door-to-door assistance"],
      driverNotes: "Senior rider may need standby support when exiting vehicle."
    }
  });
}

async function captureMedicineScan(api: ApiClient) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Camera permission is required for medication scan.");
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.82
  });
  if (result.canceled || !result.assets?.length) return { canceled: true };
  const asset = result.assets[0];
  return api.post("/api/guru/scans", {
    type: "medicine",
    label: "Medication scan from Guru",
    prompt: "Read this medication label and match it to the senior's medication inventory.",
    source: "mobile-camera",
    metadata: {
      localUri: asset.uri,
      mimeType: asset.mimeType || "image/jpeg",
      width: asset.width,
      height: asset.height
    }
  });
}

const journey = [
  { icon: "💊", title: "Medication", sub: "2 medicines due", time: "9:00 AM", done: true },
  { icon: "🏥", title: "Doctor Appointment", sub: "Dr. Mehta Clinic", time: "11:30 AM", done: false },
  { icon: "🍽️", title: "Lunch", sub: "With Rita", time: "1:00 PM", done: false },
  { icon: "🎵", title: "Music Time", sub: "Old Hindi Classics", time: "4:30 PM", done: false },
  { icon: "🚶", title: "Evening Walk", sub: "30 min walk", time: "6:00 PM", done: false }
];

const meds = [
  { name: "Amlodipine 5mg", reason: "For blood pressure", time: "9:00 AM", status: "Taken", icon: "💊" },
  { name: "Metformin 500mg", reason: "For diabetes", time: "9:00 AM", status: "Taken", icon: "🧴" },
  { name: "Vitamin D3 1000 IU", reason: "Tablet", time: "1:00 PM", status: "Pending", icon: "🟡" },
  { name: "Atorvastatin 10mg", reason: "For cholesterol", time: "8:00 PM", status: "Pending", icon: "🛡️" }
];

const circle = [
  { name: "Rita", relation: "Daughter", note: "Last spoke: Yesterday\nNext call: Today, 7:00 PM", photo: "👩🏽", tone: "red" as Tone },
  { name: "Amit", relation: "Son", note: "Last spoke: 2 days ago", photo: "👨🏽", tone: "blue" as Tone },
  { name: "Neha", relation: "Granddaughter", note: "Last spoke: Yesterday\nBirthday: Aug 12", photo: "👧🏽", tone: "orange" as Tone },
  { name: "Sunita", relation: "Caregiver", note: "Last visit: Today, 9:00 AM", photo: "👩🏾‍⚕️", tone: "green" as Tone }
];

const serviceCards = [
  { icon: "🚕", title: "Transportation", sub: "Book rides" },
  { icon: "🥗", title: "Food & Meals", sub: "Order food" },
  { icon: "💊", title: "Medication", sub: "Pharmacy, refills" },
  { icon: "🧹", title: "Home Help", sub: "Cleaning, repairs" },
  { icon: "👥", title: "Companionship", sub: "Talk, check-in" },
  { icon: "🩲", title: "Diapers & Care", sub: "Essentials" }
];

const activities = [
  { icon: "🪔", title: "Bhajan Sandhya", sub: "Today, 6:00 PM\nCommunity Hall" },
  { icon: "🎨", title: "Painting Class", sub: "May 10, 10:00 AM\nArt Room" },
  { icon: "🧘", title: "Yoga Session", sub: "May 11, 7:00 AM\nGarden" }
];

function useCurrentTab(screen: Screen): Tab {
  if (["Journey", "Medication", "MedicationConfirm", "Refill", "Onboarding", "Wellness", "HealthTrends", "HealthDevices", "FamilyHealth", "RiskInsights"].includes(screen)) return "Today";
  if (["Profile", "RideChat", "RideMatches", "RideStatus", "Help"].includes(screen)) return "Guru";
  if (["PersonDetail"].includes(screen)) return "Circle";
  if (["Feed", "CreatePost"].includes(screen)) return "Activities";
  return screen as Tab;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("Onboarding");
  const [chatText, setChatText] = useState("");
  const [rideDraft, setRideDraft] = useState<RideDraft>(initialRideDraft);
  const [appProfile, setAppProfileState] = useState<AppProfile>({ name: "", preferredName: "", profilePhotoUri: "", profilePhotoEvidenceId: "" });
  const api = useApiClient();
  const tab = useCurrentTab(screen);
  const setAppProfile = (next: AppProfile | ((current: AppProfile) => AppProfile)) => {
    setAppProfileState(current => {
      const value = typeof next === "function" ? (next as (current: AppProfile) => AppProfile)(current) : next;
      AsyncStorage.setItem("tsg_app_profile_v1", JSON.stringify(value)).catch(() => undefined);
      return value;
    });
  };

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("tsg_app_profile_v1"),
      AsyncStorage.getItem("tsg_onboarding_complete_v1")
    ])
      .then(([raw, onboardingComplete]) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setAppProfileState({
          name: String(parsed?.name || ""),
          preferredName: String(parsed?.preferredName || ""),
          profilePhotoUri: String(parsed?.profilePhotoUri || ""),
          profilePhotoEvidenceId: String(parsed?.profilePhotoEvidenceId || "")
        });
        if (onboardingComplete === "true" && !isPlaceholderProfileName(parsed?.name)) setScreen("Today");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!api.user || appProfile.name || appProfile.preferredName) return;
    const displayName = String(api.user.display_name || "");
    if (!displayName || isPlaceholderProfileName(displayName)) return;
    setAppProfile(current => ({ ...current, name: displayName, preferredName: displayName.split(" ")[0] || displayName }));
  }, [api.user, appProfile.name, appProfile.preferredName]);

  const content = useMemo(() => {
    switch (screen) {
      case "Guru": return <GuruScreen setScreen={setScreen} chatText={chatText} setChatText={setChatText} api={api} appProfile={appProfile} />;
      case "Circle": return <CircleScreen setScreen={setScreen} api={api} />;
      case "Activities": return <ActivitiesScreen setScreen={setScreen} api={api} />;
      case "Safety": return <SafetyScreen api={api} />;
      case "Journey": return <JourneyScreen setScreen={setScreen} />;
      case "Medication": return <MedicationScreen setScreen={setScreen} api={api} />;
      case "MedicationConfirm": return <MedicationConfirmScreen setScreen={setScreen} api={api} />;
      case "Refill": return <RefillScreen setScreen={setScreen} api={api} />;
      case "Help": return <HelpScreen setScreen={setScreen} api={api} />;
      case "RideChat": return <RideChatScreen setScreen={setScreen} api={api} rideDraft={rideDraft} setRideDraft={setRideDraft} />;
      case "RideMatches": return <RideMatchesScreen setScreen={setScreen} api={api} rideDraft={rideDraft} setRideDraft={setRideDraft} />;
      case "RideStatus": return <RideStatusScreen setScreen={setScreen} api={api} rideDraft={rideDraft} setRideDraft={setRideDraft} />;
      case "PersonDetail": return <PersonDetailScreen api={api} />;
      case "Feed": return <FeedScreen setScreen={setScreen} api={api} />;
      case "CreatePost": return <CreatePostScreen setScreen={setScreen} api={api} />;
      case "Notifications": return <NotificationsScreen setScreen={setScreen} api={api} />;
      case "Wellness": return <WellnessHomeScreen setScreen={setScreen} api={api} />;
      case "HealthTrends": return <HealthTrendsScreen setScreen={setScreen} api={api} />;
      case "HealthDevices": return <HealthDevicesScreen setScreen={setScreen} api={api} />;
      case "FamilyHealth": return <FamilyHealthScreen setScreen={setScreen} api={api} />;
      case "RiskInsights": return <RiskInsightsScreen setScreen={setScreen} api={api} />;
      case "Onboarding": return <OnboardingScreen setScreen={setScreen} api={api} appProfile={appProfile} setAppProfile={setAppProfile} />;
      case "Profile": return <ProfileScreen appProfile={appProfile} />;
      default: return <TodayScreen setScreen={setScreen} api={api} appProfile={appProfile} />;
    }
  }, [screen, chatText, api, rideDraft, appProfile]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <View style={styles.phoneCanvas}>
          {content}
          {screen !== "Onboarding" ? <BottomNav current={tab} onPress={(next) => setScreen(next)} /> : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function TodayScreen({ setScreen, api, appProfile }: { setScreen: (screen: Screen) => void; api: ApiClient; appProfile: AppProfile }) {
  const displayName = appProfile.preferredName || appProfile.name || api.user?.display_name?.split(" ")?.[0] || "there";
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Today" left="☰" right="🔔" badge="3" onLeft={() => setScreen("Onboarding")} onRight={() => setScreen("Notifications")} />
      <HeroCard>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.h2}>Good Morning, {displayName}! ☀️</Text>
            <Text style={styles.smallDark}>Thursday, May 8</Text>
          </View>
          <Avatar size={76} label="👵🏽" uri={appProfile.profilePhotoUri} />
        </View>
        <Pressable style={styles.askGuruBand} onPress={() => setScreen("Guru")}>
          <View>
            <Text style={styles.whiteTitle}>Ask Guru anything...</Text>
            <Text style={styles.whiteSub}>Tap to talk</Text>
          </View>
          <View style={styles.micCircle}><Text style={styles.micText}>🎙️</Text></View>
        </Pressable>
      </HeroCard>

      <SectionTitle title="Your Day" action="See all" onAction={() => setScreen("Journey")} />
      <Card>
        {journey.slice(0, 4).map((item, index) => (
          <Pressable key={item.title} style={[styles.timelineRow, index < 3 && styles.rowBorder]} onPress={() => item.title === "Medication" ? setScreen("MedicationConfirm") : item.title === "Doctor Appointment" ? setScreen("Help") : undefined}>
            <Text style={styles.timelineIcon}>{item.icon}</Text>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{item.time} – {item.title}</Text>
              <Text style={styles.rowSub}>{item.sub}</Text>
            </View>
            {item.done ? <Text style={styles.greenCheck}>✓</Text> : <Text style={styles.emptyDot}>○</Text>}
          </Pressable>
        ))}
      </Card>

      <Card style={styles.messageCard}>
        <View style={styles.rowCenter}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Message from Rita ❤️</Text>
            <Text style={styles.messageText}>Mom, I will call you at 7 PM. Take care and don't forget your walk! 😊</Text>
            <Text style={styles.mutedTiny}>10 mins ago</Text>
          </View>
          <Avatar size={52} label="👩🏽" />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Daily Wellness</Text>
        <Text style={styles.rowSub}>How are you feeling today?</Text>
        <View style={styles.moodRow}>
          {["Great", "Good", "Okay", "Not Good"].map((mood, i) => (
            <Pressable key={mood} style={styles.moodItem} onPress={() => runAction("Wellness", () => api.patch("/api/resident", { mood }), "Mood saved: " + mood)}>
              <Text style={styles.moodFace}>{["😊", "🙂", "😕", "😞"][i]}</Text>
              <Text style={styles.moodLabel}>{mood}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primaryButton} onPress={() => setScreen("Wellness")}><Text style={styles.primaryText}>Open Health Intelligence</Text></Pressable>
      </Card>
    </ScrollView>
  );
}

function GuruScreen({ setScreen, chatText, setChatText, api, appProfile }: { setScreen: (screen: Screen) => void; chatText: string; setChatText: (text: string) => void; api: ApiClient; appProfile: AppProfile }) {
  const [mode, setMode] = useState<"home" | "chat">("home");
  const [reply, setReply] = useState("I can help you with that. I found a few ride options and can create a real request task for follow-up.");
  const displayName = appProfile.preferredName || appProfile.name || api.user?.display_name?.split(" ")?.[0] || "friend";
  if (mode === "chat") {
    return (
      <View style={styles.fullScreen}>
        <TopBar title="Guru Companion" left="‹" right="🔊" onLeft={() => setMode("home")} />
        <ScrollView contentContainerStyle={styles.chatPad}>
          <View style={styles.userBubble}><Text style={styles.userBubbleText}>I need a ride to the doctor tomorrow at 11 AM</Text></View>
          <View style={styles.aiRow}>
            <Avatar size={34} label="👵🏽" uri={appProfile.profilePhotoUri} />
            <View style={styles.aiBubble}>
              <Text style={styles.aiText}>{reply}</Text>
            </View>
          </View>
          <Card>
            <Text style={styles.cardTitle}>Recommended Ride</Text>
            <View style={styles.rowCenter}>
              <View style={styles.serviceIcon}><Text>🚗</Text></View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Priya Cabs</Text>
                <Text style={styles.rowSub}>⭐ 4.8  · 128 rides</Text>
                <Text style={styles.rowSub}>Pickup: 10:30 AM</Text>
              </View>
              <Text style={styles.price}>$18</Text>
            </View>
            <View style={styles.twoActions}>
              <Pressable style={styles.outlineButton} onPress={() => setScreen("RideMatches")}><Text style={styles.outlineText}>View other options</Text></Pressable>
              <Pressable style={styles.primarySmall} onPress={() => setScreen("RideChat")}><Text style={styles.primaryText}>Book Now</Text></Pressable>
            </View>
          </Card>
        </ScrollView>
        <View style={styles.inputBar}>
          <TextInput value={chatText} onChangeText={setChatText} placeholder="Type your message..." style={styles.chatInput} />
          <Pressable style={styles.roundPurple} onPress={() => runAction("Guru", async () => { const result = await api.post("/api/guru/orchestrate", { message: chatText || "I need a ride tomorrow", screen: "Guru" }); setReply(result.reply || "Guru saved this request."); }, "Guru replied and saved the conversation.")}><Text style={styles.white}>➤</Text></Pressable>
        </View>
      </View>
    );
  }
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Guru Companion" left="‹" right="🔊" />
      <View style={styles.centerHero}>
        <Avatar size={128} label="👵🏽" big uri={appProfile.profilePhotoUri} />
        <Text style={styles.h1Center}>Namaste {displayName}! 🙏</Text>
        <Text style={styles.centerSub}>I'm your Guru. How can I help you today?</Text>
      </View>
      <View style={styles.quickGrid}>
        <QuickAction icon="🛟" title="I need help" onPress={() => setScreen("Help")} />
        <QuickAction icon="📞" title="Call Rita" onPress={() => Linking.openURL("tel:+15551234567")} />
        <QuickAction icon="🗓️" title="What's my plan today?" onPress={() => setScreen("Journey")} />
        <QuickAction icon="💊" title="Remind me meds" onPress={() => setScreen("Medication")} />
        <QuickAction icon="🎵" title="Play old songs" onPress={() => runAction("Music", () => api.post("/api/guru/tasks", { title: "Play old songs", source: "mobile_exact_ui", metadata: { workflow: "music" } }), "Music request saved.")} />
        <QuickAction icon="❤️" title="I feel lonely" onPress={() => runAction("Guru", () => api.post("/api/guru/orchestrate", { message: "I feel lonely", screen: "Guru" }), "Guru created a support conversation.")} />
      </View>
      <Pressable style={styles.voiceOrb} onPress={() => setMode("chat")}><Text style={styles.voiceOrbText}>🎙️⌁</Text></Pressable>
      <View style={styles.typeCameraRow}>
        <Pressable style={styles.pillButton} onPress={() => setMode("chat")}><Text style={styles.pillText}>⌕ Type</Text></Pressable>
        <Pressable style={styles.pillButton} onPress={() => runAction("Camera", () => captureMedicineScan(api), "Medication image captured and scan saved.")}><Text style={styles.pillText}>📷</Text></Pressable>
      </View>
    </ScrollView>
  );
}

function HelpServicesScreen({ setScreen }: { setScreen?: (screen: Screen) => void }) { return null; }

function ActivitiesScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Activities" left="‹" right="＋" onLeft={() => setScreen("Help")} onRight={() => runAction("Activity", () => api.post("/api/guru/tasks", { title: "Create activity suggestion", source: "mobile_exact_ui" }), "Activity request saved.")} />
      <SectionTitle title="Recommended for you" action="Feed" onAction={() => setScreen("Feed")} />
      <View style={styles.activityRow}>
        {activities.map((a) => (
          <View key={a.title} style={styles.activityCard}>
            <View style={styles.activityImage}><Text style={styles.activityEmoji}>{a.icon}</Text></View>
            <Text style={styles.activityTitle}>{a.title}</Text>
            <Text style={styles.activitySub}>{a.sub}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.sectionHeading}>Explore by category</Text>
      <View style={styles.categoryGrid}>
        {["🎵 Music", "🏋️ Fitness", "📋 Learning", "🎮 Games", "🪔 Spiritual", "👥 Social"].map((c) => <View key={c} style={styles.categoryCard}><Text style={styles.categoryText}>{c}</Text></View>)}
      </View>
    </ScrollView>
  );
}

function CircleScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="My Circle" left="‹" right="＋" onLeft={() => setScreen("Today")} onRight={() => runAction("Circle", () => api.post("/api/guru/tasks", { title: "Add trusted circle person", source: "mobile_exact_ui" }), "Circle add request saved.")} />
      <View style={styles.segment}><Text style={styles.segmentActive}>Family</Text><Text style={styles.segmentText}>Friends</Text><Text style={styles.segmentText}>Caregivers</Text></View>
      {circle.map((p) => (
        <Card key={p.name} style={styles.personCard}>
          <View style={styles.rowCenter}>
            <Avatar size={56} label={p.photo} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{p.name} ({p.relation}) {p.name === "Rita" ? "❤️" : ""}</Text>
              <Text style={styles.rowSub}>{p.note}</Text>
            </View>
            <Pressable style={styles.smallIconButton} onPress={() => Linking.openURL("tel:+15551234567")}><Text>📞</Text></Pressable>
            <Pressable style={styles.smallIconButton} onPress={() => setScreen("PersonDetail")}><Text>💬</Text></Pressable>
          </View>
        </Card>
      ))}
      <Card style={styles.familyMoments}>
        <SectionTitle title="Family Moments" action="See all" flush />
        <View style={styles.photoStrip}>
          {["👨‍👩‍👧", "🌳", "👵🏽👩🏽"].map((item, i) => <View key={i} style={styles.memoryPhoto}><Text style={styles.memoryEmoji}>{item}</Text></View>)}
        </View>
        <Text style={styles.rowTitle}>Rita's visit – May 3, 2025</Text>
      </Card>
    </ScrollView>
  );
}

function HelpScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Help & Services" left="‹" onLeft={() => setScreen("Guru")} />
      <View style={styles.searchBox}><Text style={styles.searchPlaceholder}>What do you need help with?</Text><Text style={styles.searchIcon}>⌕</Text></View>
      <SectionTitle title="Popular Services" action="See all" onAction={() => setScreen("Activities")} />
      <View style={styles.serviceGrid}>{serviceCards.map((s) => <Pressable key={s.title} style={{ width: "48%" }} onPress={() => s.title === "Transportation" ? setScreen("RideChat") : runAction("Service", () => api.post("/api/guru/tasks", { title: s.title + " help requested", source: "mobile_exact_ui", metadata: { service: s.title } }), s.title + " request saved.")}><ServiceCard {...s} /></Pressable>)}</View>
      <SectionTitle title="Recommended for you" />
      <Card>
        <View style={styles.rowCenter}>
          <View style={styles.serviceIcon}><Text>🚕</Text></View>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Ride to Dr. Mehta Clinic</Text>
            <Text style={styles.rowSub}>Tomorrow, 11:00 AM</Text>
            <Text style={styles.rowSub}>4.8 ⭐ · 128 rides</Text>
          </View>
          <Text style={styles.price}>$18</Text>
        </View>
        <Pressable style={[styles.primarySmall, { alignSelf: "flex-end", marginTop: 10 }]} onPress={() => setScreen("RideChat")}><Text style={styles.primaryText}>Book Now</Text></Pressable>
      </Card>
    </ScrollView>
  );
}

function SafetyScreen({ api }: { api: ApiClient }) {
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Safety Center" left="⚙️" onLeft={() => runAction("Safety", () => api.post("/api/guru/tasks", { title: "Review safety settings", source: "mobile_exact_ui" }), "Safety settings review saved.")} />
      <View style={styles.sosHero}>
        <Text style={styles.sosTitle}>Emergency SOS</Text>
        <Text style={styles.sosSub}>Tap to alert your circle</Text>
        <Pressable style={styles.sosCircle} onPress={() => runAction("SOS", () => api.post("/api/safety/voice-sos", { command: "Guru, call 911", confirmed: true, source: "mobile_safety_center" }), "Emergency SOS created and trusted circle notified.")}><Text style={styles.sosText}>SOS</Text></Pressable>
      </View>
      <Card>
        <View style={styles.rowCenter}>
          <Text style={styles.locationIcon}>📍</Text>
          <View style={styles.flex}><Text style={styles.cardTitle}>Share Live Location</Text><Text style={styles.rowSub}>Your location is shared with Rita, Amit, Sunita</Text></View>
          <View style={styles.toggleOn} />
        </View>
        <Text style={styles.linkText}>View on map ›</Text>
      </Card>
      <Card>
        <View style={styles.rowCenter}><Text>✅</Text><View style={styles.flex}><Text style={styles.cardTitle}>Daily Check-in</Text><Text style={styles.rowSub}>Checked in today at 9:15 AM</Text><Text style={styles.rowSub}>Next check-in: Tomorrow, 9:00 AM</Text></View><Text style={styles.greenBadge}>On Track</Text></View>
      </Card>
      <Card>
        <SectionTitle title="Safety Contacts" action="Edit" flush />
        {circle.slice(0, 3).map((p) => <View key={p.name} style={styles.contactLine}><Avatar size={38} label={p.photo} /><View style={styles.flex}><Text style={styles.rowTitle}>{p.name} ({p.relation})</Text><Text style={styles.rowSub}>+1 555-123-4567</Text></View><Text>📞</Text></View>)}
      </Card>
    </ScrollView>
  );
}

function JourneyScreen({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Daily Journey" left="☰" />
      <Text style={styles.dateText}>Today, May 8</Text>
      <View style={styles.segment}><Text style={styles.segmentActive}>Morning</Text><Text style={styles.segmentText}>Afternoon</Text><Text style={styles.segmentText}>Evening</Text><Text style={styles.segmentText}>Night</Text></View>
      <Card>{journey.map((item, index) => <Pressable key={item.title} style={[styles.timelineRow, index < journey.length - 1 && styles.rowBorder]} onPress={() => item.title === "Medication" ? setScreen("MedicationConfirm") : item.title === "Doctor Appointment" ? setScreen("Help") : undefined}><Text style={styles.timelineIcon}>{item.icon}</Text><View style={styles.flex}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.rowSub}>{item.sub}</Text></View><Text style={styles.timeText}>{item.time}</Text><Text style={item.done ? styles.greenCheck : styles.emptyDot}>{item.done ? "✓" : "○"}</Text></Pressable>)}</Card>
    </ScrollView>
  );
}

function MedicationScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Medication" left="‹" onLeft={() => setScreen("Today")} />
      <Text style={styles.dateText}>Today, May 8</Text>
      <View style={styles.weekRow}>{["Sun\n5", "Mon\n6", "Tue\n7", "Wed\n8", "Thu\n9", "Fri\n10", "Sat\n11"].map((d) => <View key={d} style={d.includes("Wed") ? styles.dayActive : styles.dayCell}><Text style={d.includes("Wed") ? styles.dayActiveText : styles.dayText}>{d}</Text></View>)}</View>
      <Card>{meds.map((m, i) => <Pressable key={m.name} onPress={() => setScreen("MedicationConfirm")} style={[styles.timelineRow, i < meds.length - 1 && styles.rowBorder]}><Text style={styles.timelineIcon}>{m.icon}</Text><View style={styles.flex}><Text style={styles.rowTitle}>{m.name}</Text><Text style={styles.rowSub}>{m.reason}</Text></View><Text style={styles.timeText}>{m.time}</Text><Text style={m.status === "Taken" ? styles.greenBadge : styles.pendingBadge}>{m.status}</Text></Pressable>)}</Card>
      <Pressable style={styles.primaryButton} onPress={() => setScreen("Refill")}><Text style={styles.primaryText}>Request Refill</Text></Pressable>
    </ScrollView>
  );
}

function ProfileScreen({ appProfile }: { appProfile: AppProfile }) {
  const displayName = appProfile.name || appProfile.preferredName || "Your profile";
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Profile" left="⚙️" right="⚙️" />
      <Card>
        <View style={styles.rowCenter}><Avatar size={70} label="👵🏽" uri={appProfile.profilePhotoUri} /><View style={styles.flex}><Text style={styles.rowTitle}>{displayName}</Text><Text style={styles.rowSub}>Member since Jan 2025</Text><Text style={styles.rowSub}>Profile completeness {appProfile.profilePhotoUri ? "90%" : "70%"}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: appProfile.profilePhotoUri ? "90%" : "70%" }]} /></View></View></View>
      </Card>
      {["♡ Health Profile", "♧ Emergency Contacts", "▣ Payment Methods", "⚙ Settings", "? Help & Support", "ⓘ About TheSeniorGuru"].map((x) => <Card key={x} style={styles.profileRow}><Text style={styles.rowTitle}>{x}</Text><Text style={styles.rowSub}>›</Text></Card>)}
    </ScrollView>
  );
}


function MedicationConfirmScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
    <TopBar title="Confirm medication" left="‹" onLeft={() => setScreen("Medication")} />
    <Card><Text style={styles.rowTitle}>Lisinopril 10mg</Text><Text style={styles.rowSub}>8:00 AM · 1 tablet</Text></Card>
    <View style={styles.centerHero}><Text style={styles.h1Center}>Did you take your medication?</Text><Text style={styles.moodFace}>💊</Text></View>
    <Pressable style={[styles.primaryButton, { backgroundColor: "#dff6e5" }]} onPress={() => runAction("Medication", () => api.post("/api/medications/confirm", { id: MEDICATION_ID }), "Medication confirmation saved.").then(() => setScreen("Medication"))}><Text style={[styles.primaryText, { color: "#207a36" }]}>✓ Yes, I took it</Text></Pressable>
    <Pressable style={styles.outlineButton} onPress={() => runAction("Medication", () => api.post("/api/medications/remind-later", { id: MEDICATION_ID, minutes: 30 }), "Reminder queued.")}><Text style={styles.outlineText}>Remind me later</Text></Pressable>
    <Pressable style={styles.outlineButton} onPress={() => runAction("Medication", () => api.post("/api/medications/skip-dose", { id: MEDICATION_ID, reason: "Resident skipped from mobile app" }), "Skip was logged for review.")}><Text style={styles.outlineText}>Skip this dose</Text></Pressable>
  </ScrollView>;
}

function RefillScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
    <TopBar title="Refill needed" left="‹" onLeft={() => setScreen("Medication")} />
    <Card><View style={styles.centerHero}><Text style={styles.moodFace}>💊</Text><Text style={styles.h1Center}>Lisinopril 10mg</Text><Text style={styles.centerSub}>5 pills remaining</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: "42%", backgroundColor: "#f39a2d" }]} /></View><Text style={styles.rowSub}>Running low. Please request a refill to stay on track.</Text></Card>
    <Pressable style={styles.primaryButton} onPress={() => runAction("Refill", () => api.post("/api/medications/refill-request", { medicationId: MEDICATION_ID, pharmacy: "HealthPlus Pharmacy", deliveryRequested: true }), "Refill request saved for pharmacy follow-up.")}><Text style={styles.primaryText}>Request Refill</Text></Pressable>
    <Pressable style={styles.outlineButton} onPress={() => runAction("Refill", () => api.post("/api/medications/remind-later", { id: MEDICATION_ID, minutes: 120 }), "Low stock reminder queued.").then(() => setScreen("Medication"))}><Text style={styles.outlineText}>Set low stock reminder</Text></Pressable>
  </ScrollView>;
}

function RideChatScreen({ setScreen, api, rideDraft, setRideDraft }: { setScreen: (screen: Screen) => void; api: ApiClient; rideDraft: RideDraft; setRideDraft: React.Dispatch<React.SetStateAction<RideDraft>> }) {
  const [busy, setBusy] = useState("");
  const update = (field: keyof RideDraft, value: any) => setRideDraft(current => ({ ...current, [field]: value }));
  const toggleNeed = (value: string) => setRideDraft(current => ({
    ...current,
    accessibilityNeeds: current.accessibilityNeeds.includes(value)
      ? current.accessibilityNeeds.filter(item => item !== value)
      : [...current.accessibilityNeeds, value]
  }));
  const run = async (label: string, action: () => Promise<void>) => {
    try {
      setBusy(label);
      await action();
    } catch (err: any) {
      Alert.alert(label, err?.message || "Ride step failed.");
    } finally {
      setBusy("");
    }
  };
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
    <TopBar title="Ride request" left="‹" onLeft={() => setScreen("Help")} />
    <Card style={styles.purplePanel}>
      <Text style={styles.cardTitle}>Guru needs these details before booking</Text>
      <Text style={styles.rowSub}>Pickup, drop-off, date, time, phone, accessibility, communication preference, and driver-share consent are required before any ride request is created.</Text>
    </Card>
    <Card>
      <Input label="Pickup" value={rideDraft.pickup?.label || rideDraft.pickupQuery} onChangeText={(v) => setRideDraft(current => ({ ...current, pickupQuery: v, pickup: null }))} />
      <View style={styles.twoActions}>
        <Pressable style={styles.outlineButton} onPress={() => run("Current location", () => captureCurrentLocationForRide(rideDraft, setRideDraft))}><Text style={styles.outlineText}>{busy === "Current location" ? "Locating..." : "Use current location"}</Text></Pressable>
        <Pressable style={styles.outlineButton} onPress={() => run("Resolve pickup", async () => { const pickup = await resolvePlace(api, rideDraft.pickupQuery, rideDraft.locationBias, "pickup"); setRideDraft(current => ({ ...current, pickup, locationBias: { lat: pickup.lat, lng: pickup.lng } })); })}><Text style={styles.outlineText}>Find pickup</Text></Pressable>
      </View>
      <Input label="Drop-off" value={rideDraft.dropoff?.label || rideDraft.dropoffQuery} onChangeText={(v) => setRideDraft(current => ({ ...current, dropoffQuery: v, dropoff: null }))} />
      <Pressable style={styles.outlineButton} onPress={() => run("Resolve drop-off", async () => { const bias = rideDraft.locationBias || rideDraft.pickup; const dropoff = await resolvePlace(api, rideDraft.dropoffQuery, bias ? { lat: bias.lat, lng: bias.lng } : null, "dropoff"); setRideDraft(current => ({ ...current, dropoff })); })}><Text style={styles.outlineText}>Find drop-off nearby</Text></Pressable>
    </Card>
    <Card>
      <View style={styles.twoCol}><Input label="Date" value={rideDraft.scheduledDate} onChangeText={(v) => update("scheduledDate", v)} /><Input label="Time" value={rideDraft.scheduledTime} onChangeText={(v) => update("scheduledTime", v)} /></View>
      <Input label="Phone for driver" value={rideDraft.riderPhone} onChangeText={(v) => update("riderPhone", v)} />
      <ChoiceGrid values={["text", "call"]} selected={[rideDraft.contactPreference]} onToggle={(v) => update("contactPreference", v as "text" | "call")} />
    </Card>
    <Card>
      <Text style={styles.rowTitle}>Accessibility and care support</Text>
      <ChoiceGrid values={["door-to-door assistance", "walker", "wheelchair", "extra pickup time", "caregiver riding along"]} selected={rideDraft.accessibilityNeeds} onToggle={toggleNeed} />
      <View style={styles.twoActions}>
        <Pressable style={[styles.outlineButton, rideDraft.needsDoorToDoor && styles.selectedOutline]} onPress={() => update("needsDoorToDoor", !rideDraft.needsDoorToDoor)}><Text style={styles.outlineText}>Door-to-door</Text></Pressable>
        <Pressable style={[styles.outlineButton, rideDraft.caregiverRidingAlong && styles.selectedOutline]} onPress={() => update("caregiverRidingAlong", !rideDraft.caregiverRidingAlong)}><Text style={styles.outlineText}>Caregiver rides</Text></Pressable>
      </View>
      <Input label="Mobility aid" value={rideDraft.mobilityAid} onChangeText={(v) => update("mobilityAid", v)} />
      <Input label="Pickup instructions" value={rideDraft.pickupInstructions} onChangeText={(v) => update("pickupInstructions", v)} />
      <Input label="Drop-off instructions" value={rideDraft.dropoffInstructions} onChangeText={(v) => update("dropoffInstructions", v)} />
      <Input label="Notes safe to share with driver" multiline value={rideDraft.assistanceNotes} onChangeText={(v) => update("assistanceNotes", v)} />
      <Pressable style={[styles.outlineButton, rideDraft.okToShareWithDriver && styles.selectedOutline]} onPress={() => update("okToShareWithDriver", !rideDraft.okToShareWithDriver)}><Text style={styles.outlineText}>{rideDraft.okToShareWithDriver ? "Driver sharing allowed" : "Driver sharing off"}</Text></Pressable>
    </Card>
    <Pressable style={styles.primaryButton} onPress={() => run("Ride estimate", async () => { await prepareRideOptions(api, rideDraft, setRideDraft); setScreen("RideMatches"); })}><Text style={styles.primaryText}>{busy === "Ride estimate" ? "Checking maps..." : "Get route, price, and ride options"}</Text></Pressable>
  </ScrollView>;
}

function RideMatchesScreen({ setScreen, api, rideDraft, setRideDraft }: { setScreen: (screen: Screen) => void; api: ApiClient; rideDraft: RideDraft; setRideDraft: React.Dispatch<React.SetStateAction<RideDraft>> }) {
  const [busyMode, setBusyMode] = useState("");
  const options = rideDraft.options.length ? rideDraft.options : [];
  const book = async (mode: string) => {
    try {
      setBusyMode(mode);
      await createRideBooking(api, rideDraft, mode, setRideDraft);
      setScreen("RideStatus");
    } catch (err: any) {
      Alert.alert("Book ride", err?.message || "Could not create ride booking.");
    } finally {
      setBusyMode("");
    }
  };
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
    <TopBar title="Ride options" left="‹" onLeft={() => setScreen("RideChat")} />
    <Card>
      <Text style={styles.cardTitle}>{rideDraft.pickup?.label || "Pickup pending"} → {rideDraft.dropoff?.label || "Drop-off pending"}</Text>
      <Text style={styles.rowSub}>{rideDraft.scheduledDate} at {rideDraft.scheduledTime}</Text>
      <Text style={styles.rowSub}>{formatDistance(rideDraft.route?.distanceMeters)} · {formatDuration(rideDraft.route?.durationSeconds)} · {rideDraft.route?.provider || "route pending"}</Text>
      <Text style={styles.price}>{formatMoney(rideDraft.pricing?.totalChargeCents)}</Text>
      <Text style={styles.rowSub}>Includes provider estimate, tax reserve, refund reserve, and platform margin before dispatch.</Text>
    </Card>
    {options.map((option: any) => <Card key={option.mode}>
      <View style={styles.rowCenter}>
        <View style={styles.serviceIcon}><Text>{option.mode?.includes("uber") ? "🚘" : option.mode?.includes("lyft") ? "🚙" : "🚕"}</Text></View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{option.displayName || option.mode?.replace(/_/g, " ")}</Text>
          <Text style={styles.rowSub}>{option.available ? "Available for this request" : option.reason || "Requires setup"}</Text>
          <Text style={option.available ? styles.greenBadge : styles.pendingBadge}>{option.lifecycleStatus || "pending"}</Text>
        </View>
        <Pressable style={styles.primarySmall} onPress={() => book(option.mode)} disabled={Boolean(busyMode)}>
          <Text style={styles.primaryText}>{busyMode === option.mode ? "Saving..." : "Request"}</Text>
        </Pressable>
      </View>
    </Card>)}
    {!options.length ? <Card><Text style={styles.rowTitle}>No options loaded</Text><Text style={styles.rowSub}>Go back and run the route estimate first.</Text></Card> : null}
    <Text style={styles.rowSub}>Uber Health and Lyft dispatch stay credential-gated until partner credentials are configured. Local partner/manual coordination can still create a payment-gated booking.</Text>
  </ScrollView>;
}

function RideStatusScreen({ setScreen, api, rideDraft, setRideDraft }: { setScreen: (screen: Screen) => void; api: ApiClient; rideDraft: RideDraft; setRideDraft: React.Dispatch<React.SetStateAction<RideDraft>> }) {
  const [busy, setBusy] = useState(false);
  const status = rideDraft.status?.booking ? rideDraft.status : rideDraft.status?.booking === undefined ? rideDraft.status : null;
  const booking = status?.booking || rideDraft.status?.booking || null;
  const timeline = status?.timeline || rideDraft.status?.fulfillment?.timeline || booking?.fulfillment_metadata?.timeline || [];
  const refresh = async () => {
    if (!rideDraft.bookingId) {
      Alert.alert("Ride status", "No ride booking has been created yet.");
      return;
    }
    try {
      setBusy(true);
      const next = await api.get(`/api/rides/bookings/${rideDraft.bookingId}/status`);
      setRideDraft(current => ({ ...current, status: next }));
    } catch (err: any) {
      Alert.alert("Ride status", err?.message || "Could not refresh ride status.");
    } finally {
      setBusy(false);
    }
  };
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
    <TopBar title="Ride status" left="‹" onLeft={() => setScreen("RideMatches")} />
    <View style={styles.centerHero}><Text style={styles.moodFace}>🚗</Text><Text style={styles.h1Center}>{rideDraft.bookingId ? "Ride request saved" : "Ride not requested yet"}</Text><Text style={styles.centerSub}>{rideDraft.scheduledDate} · {rideDraft.scheduledTime}</Text></View>
    <Card>
      <Text style={styles.cardTitle}>{rideDraft.pickup?.label || "Pickup pending"} → {rideDraft.dropoff?.label || "Drop-off pending"}</Text>
      <Text style={styles.rowSub}>Booking ID: {rideDraft.bookingId || "Not created"}</Text>
      <Text style={styles.rowSub}>Payment: {booking?.payment_status || rideDraft.status?.booking?.payment_status || "payment_required"}</Text>
      <Text style={styles.rowSub}>Lifecycle: {booking?.lifecycle_status || rideDraft.status?.booking?.lifecycle_status || "payment_required"}</Text>
      <Text style={styles.price}>{formatMoney((booking || rideDraft.status?.booking)?.total_charge_cents || rideDraft.pricing?.totalChargeCents)}</Text>
    </Card>
    <Card>{(timeline.length ? timeline : [
      { label: "Ride request created", status: rideDraft.bookingId ? "complete" : "waiting" },
      { label: "Payment required before dispatch", status: "current" },
      { label: "Provider dispatch", status: "waiting" },
      { label: "Driver assigned", status: "waiting" },
      { label: "Pickup, ride, drop-off", status: "waiting" }
    ]).map((item: any, i: number) => <View key={`${item.label}-${i}`} style={[styles.timelineRow, i < 4 && styles.rowBorder]}>
      <Text style={item.status === "complete" ? styles.greenCheck : styles.emptyDot}>{item.status === "complete" ? "✓" : "○"}</Text>
      <View style={styles.flex}><Text style={styles.rowTitle}>{item.label}</Text><Text style={styles.rowSub}>{item.status || "waiting"}{item.at ? ` · ${item.at}` : ""}</Text></View>
    </View>)}</Card>
    <View style={styles.twoActions}>
      <Pressable style={styles.outlineButton} onPress={refresh}><Text style={styles.outlineText}>{busy ? "Refreshing..." : "Refresh status"}</Text></Pressable>
      <Pressable style={styles.outlineButton} onPress={() => rideDraft.riderPhone ? Linking.openURL(`tel:${rideDraft.riderPhone}`) : undefined}><Text style={styles.outlineText}>Call rider</Text></Pressable>
    </View>
    <Pressable style={styles.primaryButton} onPress={() => setScreen("Help")}><Text style={styles.primaryText}>Back to Help</Text></Pressable>
  </ScrollView>;
}

function PersonDetailScreen({ api }: { api: ApiClient }) {
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}><TopBar title="Rita Sharma" left="‹" right="⋮" />
    <View style={styles.centerHero}><Avatar size={96} label="👩🏽" /><Text style={styles.h1Center}>Rita Sharma</Text><Text style={styles.centerSub}>Daughter</Text></View>
    <View style={styles.quickGrid}><QuickAction icon="📞" title="Call" onPress={() => Linking.openURL("tel:+15551234567")} /><QuickAction icon="💬" title="Message" onPress={() => runAction("Circle", () => api.post("/api/messages", { body: "Hi Rita, can you check in with me today?", recipient: "rita" }), "Message sent to Rita.")} /><QuickAction icon="🆘" title="Request help" onPress={() => runAction("Circle", () => api.post("/api/messages", { body: "Please ask Rita to help me today.", priority: "help_request", recipient: "rita" }), "Help message saved and routed.")} /><QuickAction icon="📋" title="Shared info" onPress={() => runAction("Shared info", () => api.post("/api/messages", { body: "Please review my shared care information.", recipient: "rita" }), "Shared-info message sent.")} /></View>
  </ScrollView>;
}

function FeedScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}><TopBar title="Community Feed" left="‹" right="＋" onLeft={() => setScreen("Activities")} onRight={() => setScreen("CreatePost")} />
    <View style={styles.segment}><Text style={styles.segmentActive}>For You</Text><Text style={styles.segmentText}>Following</Text><Text style={styles.segmentText}>My Posts</Text></View>
    <Card><Text style={styles.rowTitle}>Mary D.</Text><Text style={styles.rowSub}>2h ago</Text><Text style={styles.messageText}>Beautiful morning walk with my friends! ☀️🌿</Text><View style={styles.memoryPhoto}><Text style={styles.memoryEmoji}>🌳</Text></View><Text style={styles.rowSub}>❤️ 24   💬 6</Text></Card>
    <Card><Text style={styles.rowTitle}>Park View Community</Text><Text style={styles.messageText}>Community Lunch this Friday at 1 PM.</Text><Pressable style={styles.primaryButton} onPress={() => runAction("Event", () => api.post("/api/events/join", { id: "community_lunch", name: "Community Lunch" }), "Event RSVP saved.")}><Text style={styles.primaryText}>Interested</Text></Pressable></Card>
    <Pressable style={[styles.roundPurple, { position: "absolute", right: 22, bottom: 118 }]} onPress={() => setScreen("CreatePost")}><Text style={styles.white}>＋</Text></Pressable>
  </ScrollView>;
}

function CreatePostScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  const [body, setBody] = useState("");
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}><TopBar title="Create Post" left="‹" onLeft={() => setScreen("Feed")} />
    <TextInput style={[styles.card, { minHeight: 150, textAlignVertical: "top" }]} multiline placeholder="What's on your mind?" value={body} onChangeText={setBody} />
    {["📷 Photo / Video", "❓ Ask a question", "📣 Share update", "🔥 Inspire others"].map(x => <Card key={x}><Text style={styles.rowTitle}>{x}</Text></Card>)}
    <Pressable style={styles.primaryButton} onPress={() => runAction("Post", () => api.post("/api/posts", { body: body || "Community update", audience: "community" }), "Post submitted.").then(() => setScreen("Feed"))}><Text style={styles.primaryText}>Post</Text></Pressable>
  </ScrollView>;
}


function NotificationsScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  return <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}><TopBar title="Notifications" left="‹" onLeft={() => setScreen("Today")} />
    <Card><Text style={styles.rowTitle}>Medication reminder</Text><Text style={styles.rowSub}>Lisinopril 10mg was marked for follow-up.</Text><Pressable style={styles.primaryButton} onPress={() => runAction("Notifications", () => api.post("/api/guru/tasks", { title: "Acknowledge medication reminder", source: "mobile_exact_ui" }), "Notification acknowledged.")}><Text style={styles.primaryText}>Acknowledge</Text></Pressable></Card>
    <Card><Text style={styles.rowTitle}>Safety update</Text><Text style={styles.rowSub}>Daily check-in completed. Trusted circle can review safety updates.</Text><Pressable style={styles.outlineButton} onPress={() => setScreen("Safety")}><Text style={styles.outlineText}>Open Safety</Text></Pressable></Card>
  </ScrollView>;
}

function OnboardingScreen({ setScreen, api, appProfile, setAppProfile }: { setScreen: (screen: Screen) => void; api: ApiClient; appProfile: AppProfile; setAppProfile: (next: AppProfile | ((current: AppProfile) => AppProfile)) => void }) {
  useEffect(() => {
    onboardingApiClient = api;
    return () => {
      if (onboardingApiClient === api) onboardingApiClient = null;
    };
  }, [api]);
  const finishOnboarding = async () => {
    await AsyncStorage.setItem("tsg_onboarding_complete_v1", "true");
    setScreen("Today");
  };
  return <OnboardingHub onDone={finishOnboarding} appProfile={appProfile} setAppProfile={setAppProfile} />;
}

function OnboardingHub({ onDone, appProfile, setAppProfile }: { onDone: () => void | Promise<void>; appProfile: AppProfile; setAppProfile: (next: AppProfile | ((current: AppProfile) => AppProfile)) => void }) {
  const [role, setRole] = useState<Role>("senior");
  const [nameDraft, setNameDraft] = useState(isPlaceholderProfileName(appProfile.name) ? "" : appProfile.name);
  const [preferredDraft, setPreferredDraft] = useState(isPlaceholderProfileName(appProfile.preferredName) ? "" : appProfile.preferredName);
  if (isPlaceholderProfileName(appProfile.name)) {
    return (
      <View style={styles.obShell}>
        <View style={styles.obFrame}>
          <View style={styles.obHeader}>
            <Text style={styles.h1}>Welcome to TheSeniorGuru</Text>
            <Text style={styles.lede}>Let’s start with your name so Guru can personalize the setup for you.</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.obContent}>
            <Input label="Full name" value={nameDraft} onChangeText={setNameDraft} />
            <Input label="Preferred name" value={preferredDraft} onChangeText={setPreferredDraft} />
            <Note text="You can change profile details later in Settings. Primary identity fields may require review after verification." />
          </ScrollView>
          <View style={styles.obFooter}>
            <Pressable style={[styles.primaryButton, !nameDraft.trim() && styles.disabled]} disabled={!nameDraft.trim()} onPress={() => setAppProfile({ ...appProfile, name: nameDraft.trim(), preferredName: preferredDraft.trim() || nameDraft.trim().split(/\s+/)[0] || nameDraft.trim() })}><Text style={styles.primaryText}>Continue</Text></Pressable>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.obShell}>
      <View style={styles.obRoleSwitcher}>
        <OnboardingSegment active={role === "senior"} label="Senior" onPress={() => setRole("senior")} />
        <OnboardingSegment active={role === "circle"} label="Trust Circle" onPress={() => setRole("circle")} />
        <OnboardingSegment active={role === "business"} label="Business" onPress={() => setRole("business")} />
      </View>
      {role === "senior" ? <SeniorOnboardingFlow onDone={onDone} appProfile={appProfile} setAppProfile={setAppProfile} /> : null}
      {role === "circle" ? <CircleOnboardingFlow onDone={onDone} /> : null}
      {role === "business" ? <BusinessOnboardingFlow onDone={onDone} /> : null}
    </View>
  );
}

function SeniorOnboardingFlow({ onDone, appProfile, setAppProfile }: { onDone: () => void; appProfile: AppProfile; setAppProfile: (next: AppProfile | ((current: AppProfile) => AppProfile)) => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SeniorOnboarding>({
    name: appProfile.name, preferredName: appProfile.preferredName || appProfile.name.split(/\s+/)[0] || "", phone: "+1 555-123-4567", email: "", dob: "", address: "", livingType: "",
    profilePhotoStatus: "Not captured", profilePhotoUri: "", profilePhotoEvidenceId: "", livenessStatus: "Not captured", livenessVideoUri: "", livenessEvidenceId: "", healthConcerns: ["Blood Pressure"], medications: "Amlodipine 5mg at 9 AM\nMetformin 500mg at 9 AM", allergies: "Penicillin",
    height: "5'3\"", weight: "142 lb", bloodPressure: "128/78", heartRate: "72", mobility: "Walks independently", wearableSources: ["Apple Health"], wearableConnectionStatus: "Not connected",
    devicePermissions: ["Notifications"], musicApps: ["Spotify"], musicPreferences: ["Old Hindi Songs", "Bhajans"], circleInviteName: "", circleInviteRelation: "", circleInvitePhone: "",
    healthSharing: "Health summary only", locationSharing: "SOS only", sosOrder: "1 Rita, 2 Amit, 3 Community Staff, 4 911", wakeTime: "7:30 AM", checkInTime: "9:15 AM"
  });
  const update = (field: keyof SeniorOnboarding, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    if (field === "name") setAppProfile(current => ({ ...current, name: value }));
    if (field === "preferredName") setAppProfile(current => ({ ...current, preferredName: value }));
  };
  const updateEvidence = (statusField: keyof SeniorOnboarding, uriField: keyof SeniorOnboarding, evidenceField: keyof SeniorOnboarding) => (status: string, uri: string, evidenceId: string) => setForm(current => ({ ...current, [statusField]: status, [uriField]: uri, [evidenceField]: evidenceId }));
  const toggle = (field: keyof SeniorOnboarding, value: string) => setForm(current => {
    const list = current[field] as string[];
    return { ...current, [field]: list.includes(value) ? list.filter(item => item !== value) : [...list, value] };
  });
  const submit = async () => {
    const finalName = form.name.trim() || appProfile.name.trim();
    const finalPreferredName = form.preferredName.trim() || appProfile.preferredName.trim() || finalName.split(/\s+/)[0] || finalName;
    if (!finalName) throw new Error("Please enter your name before finishing setup.");
    const finalForm = { ...form, name: finalName, preferredName: finalPreferredName };
    setAppProfile(current => ({ ...current, name: finalName, preferredName: finalPreferredName }));
    await safePost("/api/onboarding/senior", finalForm);
    Alert.alert("Senior onboarding saved", "Guru now has the profile, health, device, music, circle, privacy and SOS setup.");
    await onDone();
  };
  return <OnboardingFrame title="Senior Setup" subtitle="Guru will help set up daily life, safety, health, and family support." steps={seniorSteps} step={step} setStep={setStep} onFinish={submit}>{renderSeniorStep(step, form, update, toggle, updateEvidence, setAppProfile)}</OnboardingFrame>;
}

function renderSeniorStep(step: number, form: SeniorOnboarding, update: (field: keyof SeniorOnboarding, value: string) => void, toggle: (field: keyof SeniorOnboarding, value: string) => void, updateEvidence: (statusField: keyof SeniorOnboarding, uriField: keyof SeniorOnboarding, evidenceField: keyof SeniorOnboarding) => (status: string, uri: string, evidenceId: string) => void, setAppProfile: (next: AppProfile | ((current: AppProfile) => AppProfile)) => void) {
  const displayName = form.preferredName || form.name || "there";
  if (step === 0) return <IntroPanel icon="🧡" title={`Namaste ${displayName}. I’m Guru.`} copy="I’ll help with medications, family, safety, rides, food, memories, and daily companionship." />;
  if (step === 1) return <View><EvidenceCard title="Profile photo" status={form.profilePhotoStatus} previewUri={form.profilePhotoUri} cta="Take live photo" onPress={() => captureNativeEvidence({ subjectRole: "senior", evidenceType: "profile_photo", mediaKind: "photo", onCaptured: updateEvidence("profilePhotoStatus", "profilePhotoUri", "profilePhotoEvidenceId"), onProfileUpdated: (uri, evidenceId) => setAppProfile(current => ({ ...current, profilePhotoUri: uri, profilePhotoEvidenceId: evidenceId })) })} /><EvidenceCard title="Liveness video" status={form.livenessStatus} previewUri={form.livenessVideoUri} cta="Record proof" onPress={() => captureNativeEvidence({ subjectRole: "senior", evidenceType: "liveness_video", mediaKind: "video", onCaptured: updateEvidence("livenessStatus", "livenessVideoUri", "livenessEvidenceId") })} /><Note text="These files are identity evidence. They are not public and are only used for safety, fraud prevention, and trusted care access." /></View>;
  if (step === 2) return <View><Input label="Full name" value={form.name} onChangeText={(v) => update("name", v)} /><Input label="Preferred name" value={form.preferredName} onChangeText={(v) => update("preferredName", v)} /><Input label="Phone" value={form.phone} onChangeText={(v) => update("phone", v)} /><Input label="Email" value={form.email} onChangeText={(v) => update("email", v)} /><Input label="Date of birth" value={form.dob} onChangeText={(v) => update("dob", v)} /><Input label="Address / community" value={form.address} onChangeText={(v) => update("address", v)} /><Input label="Living setup" value={form.livingType} onChangeText={(v) => update("livingType", v)} /></View>;
  if (step === 3) return <View><ChoiceGrid values={["Blood Pressure", "Diabetes", "Heart Health", "Memory Concerns", "Mobility", "Vision", "Hearing", "Food Restrictions"]} selected={form.healthConcerns} onToggle={(v) => toggle("healthConcerns", v)} /><Input label="Medications" multiline value={form.medications} onChangeText={(v) => update("medications", v)} /><Input label="Allergies" value={form.allergies} onChangeText={(v) => update("allergies", v)} /><View style={styles.twoCol}><Input label="Height" value={form.height} onChangeText={(v) => update("height", v)} /><Input label="Weight" value={form.weight} onChangeText={(v) => update("weight", v)} /></View><View style={styles.twoCol}><Input label="Blood pressure" value={form.bloodPressure} onChangeText={(v) => update("bloodPressure", v)} /><Input label="Heart rate" value={form.heartRate} onChangeText={(v) => update("heartRate", v)} /></View><Input label="Mobility" value={form.mobility} onChangeText={(v) => update("mobility", v)} /></View>;
  if (step === 4) return <WearableSetupPanel form={form} update={update} toggle={toggle} />;
  if (step === 5) return <View><ChoiceGrid values={["Location", "Notifications", "Microphone", "Camera", "Contacts", "Calendar", "Photos", "Motion"]} selected={form.devicePermissions} onToggle={(v) => toggle("devicePermissions", v)} /><Note text="Production app should request native permissions one at a time, right before use, with clear explanation." /></View>;
  if (step === 6) return <View><ChoiceGrid values={["Apple Music", "Spotify", "YouTube Music", "Amazon Music"]} selected={form.musicApps} onToggle={(v) => toggle("musicApps", v)} /><ChoiceGrid values={["Old Hindi Songs", "Bhajans", "Classical", "Ghazals", "Jazz", "Country", "Oldies", "Relaxing Music"]} selected={form.musicPreferences} onToggle={(v) => toggle("musicPreferences", v)} /></View>;
  if (step === 7) return <View><Input label="Invite name" value={form.circleInviteName} onChangeText={(v) => update("circleInviteName", v)} /><Input label="Relationship" value={form.circleInviteRelation} onChangeText={(v) => update("circleInviteRelation", v)} /><Input label="Phone" value={form.circleInvitePhone} onChangeText={(v) => update("circleInvitePhone", v)} /><Note text="Trust Circle members complete their own onboarding and verification before seeing any senior data." /></View>;
  if (step === 8) { const circleName = form.circleInviteName || "this trusted person"; return <View><PermissionRow title={`${circleName} can see health data`} value={form.healthSharing} onChange={(v) => update("healthSharing", v)} options={["No health data", "Health summary only", "Detailed analytics"]} /><PermissionRow title={`${circleName} can see location`} value={form.locationSharing} onChange={(v) => update("locationSharing", v)} options={["Never", "SOS only", "Always while caregiving"]} /><Note text="Default is privacy-first: no detailed health analytics unless the senior explicitly approves it." /></View>; }
  if (step === 9) return <View><Input label="SOS escalation order" multiline value={form.sosOrder} onChangeText={(v) => update("sosOrder", v)} /><SafetyPreview /></View>;
  return <View><Input label="Wake time" value={form.wakeTime} onChangeText={(v) => update("wakeTime", v)} /><Input label="Daily check-in time" value={form.checkInTime} onChangeText={(v) => update("checkInTime", v)} /><DailyPlanPreview /></View>;
}

function CircleOnboardingFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CircleOnboarding>({ seniorName: "", name: "", relationship: "", phone: "", email: "", timezone: "America/Denver", identityPhotoStatus: "Not captured", identityPhotoUri: "", identityPhotoEvidenceId: "", livenessStatus: "Not captured", livenessVideoUri: "", livenessEvidenceId: "", routineWindow: "9 AM - 8 PM", quietHours: "9 PM - 7 AM", emergencyOverride: "Yes", alertTypes: ["SOS", "Missed check-in"], visibility: ["Emergency alerts", "Medication adherence"], escalationRole: "Primary responder" });
  const update = (field: keyof CircleOnboarding, value: string) => setForm(current => ({ ...current, [field]: value }));
  const updateEvidence = (statusField: keyof CircleOnboarding, uriField: keyof CircleOnboarding, evidenceField: keyof CircleOnboarding) => (status: string, uri: string, evidenceId: string) => setForm(current => ({ ...current, [statusField]: status, [uriField]: uri, [evidenceField]: evidenceId }));
  const toggle = (field: keyof CircleOnboarding, value: string) => setForm(current => { const list = current[field] as string[]; return { ...current, [field]: list.includes(value) ? list.filter(item => item !== value) : [...list, value] }; });
  const submit = async () => { await safePost("/api/onboarding/trust-circle", form); Alert.alert("Trust Circle saved", "Messaging, alert, consent and visibility rules were saved."); onDone(); };
  return <OnboardingFrame title="Trust Circle Setup" subtitle="Set up who can help, when they should be contacted, and what they may see." steps={circleSteps} step={step} setStep={setStep} onFinish={submit}>{renderCircleStep(step, form, update, toggle, updateEvidence)}</OnboardingFrame>;
}

function renderCircleStep(step: number, form: CircleOnboarding, update: (field: keyof CircleOnboarding, value: string) => void, toggle: (field: keyof CircleOnboarding, value: string) => void, updateEvidence: (statusField: keyof CircleOnboarding, uriField: keyof CircleOnboarding, evidenceField: keyof CircleOnboarding) => (status: string, uri: string, evidenceId: string) => void) {
  if (step === 0) { const seniorName = form.seniorName || "A senior"; return <IntroPanel icon="💜" title={`${seniorName} invited you`} copy={`You are being added as a trusted support person. You will only see what ${seniorName} approves.`} />; }
  if (step === 1) return <View><Input label="Name" value={form.name} onChangeText={(v) => update("name", v)} /><Input label="Relationship" value={form.relationship} onChangeText={(v) => update("relationship", v)} /><Input label="Phone" value={form.phone} onChangeText={(v) => update("phone", v)} /><Input label="Email" value={form.email} onChangeText={(v) => update("email", v)} /><Input label="Timezone" value={form.timezone} onChangeText={(v) => update("timezone", v)} /><EvidenceCard title="Live photo" status={form.identityPhotoStatus} previewUri={form.identityPhotoUri} cta="Capture photo" onPress={() => captureNativeEvidence({ subjectRole: "trust_circle", evidenceType: "profile_photo", mediaKind: "photo", onCaptured: updateEvidence("identityPhotoStatus", "identityPhotoUri", "identityPhotoEvidenceId") })} /><EvidenceCard title="Liveness video" status={form.livenessStatus} previewUri={form.livenessVideoUri} cta="Record verification" onPress={() => captureNativeEvidence({ subjectRole: "trust_circle", evidenceType: "liveness_video", mediaKind: "video", onCaptured: updateEvidence("livenessStatus", "livenessVideoUri", "livenessEvidenceId") })} /></View>;
  if (step === 2) return <View><Input label="Routine message window" value={form.routineWindow} onChangeText={(v) => update("routineWindow", v)} /><Input label="Quiet hours" value={form.quietHours} onChangeText={(v) => update("quietHours", v)} /><PermissionRow title="Emergency override during quiet hours" value={form.emergencyOverride} onChange={(v) => update("emergencyOverride", v)} options={["Yes", "No"]} /><ChoiceGrid values={["SOS", "Missed check-in", "Medication missed", "Mood concern", "Location out of safe zone", "Appointment reminder"]} selected={form.alertTypes} onToggle={(v) => toggle("alertTypes", v)} /></View>;
  if (step === 3) return <View><ChoiceGrid values={["Emergency alerts", "Medication adherence", "Appointments", "Location during SOS", "Mood check-ins", "Detailed health analytics", "Tasks", "Messages"]} selected={form.visibility} onToggle={(v) => toggle("visibility", v)} /><Note text="Detailed health analytics requires explicit senior consent and should be revocable anytime." /></View>;
  return <View><PermissionRow title="Escalation role" value={form.escalationRole} onChange={(v) => update("escalationRole", v)} options={["Primary responder", "Backup responder", "Routine only", "Emergency only"]} /><SafetyPreview /></View>;
}

function BusinessOnboardingFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BusinessOnboarding>({ businessType: "Transportation", legalName: "Priya Cabs LLC", dba: "Priya Cabs", ownerName: "Rohit Mehta", phone: "+1 555-333-9999", email: "owner@priyacabs.com", website: "https://priyacabs.example", address: "Parker, CO", ownerPhotoStatus: "Not captured", ownerPhotoUri: "", ownerPhotoEvidenceId: "", ownerLivenessStatus: "Not captured", ownerLivenessVideoUri: "", ownerLivenessEvidenceId: "", verificationDocs: ["Business license"], services: "Local senior rides\nDoctor appointment rides\nAirport rides", pricing: "$18-$25 local ride\n$55+ airport ride", availability: "Mon-Sat 8 AM - 7 PM, same-day when available", serviceRadius: "15 miles", serviceZips: "80134, 80138, 80112", serviceBoundary: "Polygon drawn around Parker, Lone Tree, Centennial. Excludes Denver downtown.", maxLeads: "10/day", leadTypes: ["Transportation", "Doctor visits"], communication: ["App", "SMS"] });
  const update = (field: keyof BusinessOnboarding, value: string) => setForm(current => ({ ...current, [field]: value }));
  const updateEvidence = (statusField: keyof BusinessOnboarding, uriField: keyof BusinessOnboarding, evidenceField: keyof BusinessOnboarding) => (status: string, uri: string, evidenceId: string) => setForm(current => ({ ...current, [statusField]: status, [uriField]: uri, [evidenceField]: evidenceId }));
  const toggle = (field: keyof BusinessOnboarding, value: string) => setForm(current => { const list = current[field] as string[]; return { ...current, [field]: list.includes(value) ? list.filter(item => item !== value) : [...list, value] }; });
  const submit = async () => { await safePost("/api/onboarding/business", form); Alert.alert("Business onboarding saved", "Services, pricing, availability, verification and service area rules were saved."); onDone(); };
  return <OnboardingFrame title="Business Setup" subtitle="Only receive leads you are verified for, available for, and able to serve." steps={businessSteps} step={step} setStep={setStep} onFinish={submit}>{renderBusinessStep(step, form, update, toggle, updateEvidence)}</OnboardingFrame>;
}

function renderBusinessStep(step: number, form: BusinessOnboarding, update: (field: keyof BusinessOnboarding, value: string) => void, toggle: (field: keyof BusinessOnboarding, value: string) => void, updateEvidence: (statusField: keyof BusinessOnboarding, uriField: keyof BusinessOnboarding, evidenceField: keyof BusinessOnboarding) => (status: string, uri: string, evidenceId: string) => void) {
  if (step === 0) return <View><ChoiceGrid values={["Transportation", "Meals", "Pharmacy", "Cleaning", "Laundry", "Companionship", "Diapers", "Home Care", "Handyman"]} selected={[form.businessType]} onToggle={(v) => update("businessType", v)} /><Note text="Business accounts are matched only to relevant senior requests and service-area rules." /></View>;
  if (step === 1) return <View><Input label="Legal business name" value={form.legalName} onChangeText={(v) => update("legalName", v)} /><Input label="DBA" value={form.dba} onChangeText={(v) => update("dba", v)} /><Input label="Owner name" value={form.ownerName} onChangeText={(v) => update("ownerName", v)} /><Input label="Phone" value={form.phone} onChangeText={(v) => update("phone", v)} /><Input label="Email" value={form.email} onChangeText={(v) => update("email", v)} /><Input label="Website" value={form.website} onChangeText={(v) => update("website", v)} /><Input label="Business address" value={form.address} onChangeText={(v) => update("address", v)} /></View>;
  if (step === 2) return <View><EvidenceCard title="Owner live photo" status={form.ownerPhotoStatus} previewUri={form.ownerPhotoUri} cta="Capture owner photo" onPress={() => captureNativeEvidence({ subjectRole: "business_owner", evidenceType: "profile_photo", mediaKind: "photo", onCaptured: updateEvidence("ownerPhotoStatus", "ownerPhotoUri", "ownerPhotoEvidenceId") })} /><EvidenceCard title="Owner liveness video" status={form.ownerLivenessStatus} previewUri={form.ownerLivenessVideoUri} cta="Record owner video" onPress={() => captureNativeEvidence({ subjectRole: "business_owner", evidenceType: "liveness_video", mediaKind: "video", onCaptured: updateEvidence("ownerLivenessStatus", "ownerLivenessVideoUri", "ownerLivenessEvidenceId") })} /><ChoiceGrid values={["Business license", "Insurance", "Background checks", "Driver license", "Care certification", "Pharmacy license", "W-9"]} selected={form.verificationDocs} onToggle={(v) => toggle("verificationDocs", v)} /></View>;
  if (step === 3) return <View><Input label="Services offered" multiline value={form.services} onChangeText={(v) => update("services", v)} /><Input label="Pricing" multiline value={form.pricing} onChangeText={(v) => update("pricing", v)} /><Input label="Availability" multiline value={form.availability} onChangeText={(v) => update("availability", v)} /></View>;
  if (step === 4) return <View><MapBoundaryMock /><Input label="Service radius" value={form.serviceRadius} onChangeText={(v) => update("serviceRadius", v)} /><Input label="ZIP codes served" value={form.serviceZips} onChangeText={(v) => update("serviceZips", v)} /><Input label="Map boundary notes" multiline value={form.serviceBoundary} onChangeText={(v) => update("serviceBoundary", v)} /><Note text="Matching engine must hard-filter out leads outside this polygon/radius/ZIP coverage." /></View>;
  if (step === 5) return <View><Input label="Max leads per day" value={form.maxLeads} onChangeText={(v) => update("maxLeads", v)} /><ChoiceGrid values={["Transportation", "Doctor visits", "Airport rides", "Meals", "Cleaning", "Companionship", "Recurring requests", "Urgent requests"]} selected={form.leadTypes} onToggle={(v) => toggle("leadTypes", v)} /><ChoiceGrid values={["App", "SMS", "Email", "Phone call"]} selected={form.communication} onToggle={(v) => toggle("communication", v)} /></View>;
  return <View><TrustScorePreview /><Note text="Business ads should appear as helpful support inside matching, events, essentials, and service discovery — not loud banners." /></View>;
}

function WearableSetupPanel({ form, update, toggle }: { form: SeniorOnboarding; update: (field: keyof SeniorOnboarding, value: string) => void; toggle: (field: keyof SeniorOnboarding, value: string) => void }) {
  const [detecting, setDetecting] = useState(false);
  const detect = async () => {
    try {
      setDetecting(true);
      let diagnostics: any;
      try {
        diagnostics = await getNativeHealthDiagnostics();
      } catch (error: any) {
        diagnostics = { available: false, source: "native-health-detection", error: error?.message || "Native health source unavailable.", readings: [] };
      }
      const provider = diagnostics.source === "android-health-connect" ? "Android Health Connect" : diagnostics.source === "ios-healthkit" ? "Apple Health" : form.wearableSources[0] || "Native Health";
      if (!form.wearableSources.includes(provider)) toggle("wearableSources", provider);
      await connectWearableProvider(provider, status => update("wearableConnectionStatus", status));
    } finally {
      setDetecting(false);
    }
  };
  return (
    <View>
      <ChoiceGrid values={["Apple Health", "Android Health Connect", "Fitbit", "Garmin", "Oura", "Samsung Health"]} selected={form.wearableSources} onToggle={(v) => toggle("wearableSources", v)} />
      <Card>
        <Text style={styles.rowTitle}>Connected health and wearable detection</Text>
        <Text style={styles.rowSub}>{form.wearableConnectionStatus}</Text>
        <View style={styles.twoActions}>
          <Pressable style={styles.outlineButton} onPress={detect}><Text style={styles.outlineText}>{detecting ? "Detecting..." : "Auto-detect from phone"}</Text></Pressable>
          <Pressable style={styles.outlineButton} onPress={() => Linking.openSettings()}><Text style={styles.outlineText}>Open phone settings</Text></Pressable>
        </View>
      </Card>
      <Note text="Guru reads already-connected Apple Health or Android Health Connect data after permission. Bluetooth pairing is handled in phone settings or the wearable’s own app, then Guru can detect synced health data." />
      <HealthPreview />
    </View>
  );
}

function OnboardingFrame({ title, subtitle, steps, step, setStep, onFinish, children }: { title: string; subtitle: string; steps: string[]; step: number; setStep: (step: number) => void; onFinish: () => void | Promise<void>; children: React.ReactNode }) {
  const atEnd = step === steps.length - 1;
  const [finishing, setFinishing] = useState(false);
  const handlePrimary = async () => {
    if (!atEnd) {
      setStep(Math.min(steps.length - 1, step + 1));
      return;
    }
    if (finishing) return;
    try {
      setFinishing(true);
      await onFinish();
    } catch (err: any) {
      Alert.alert("Finish setup failed", err?.message || "Could not complete onboarding. Please try again.");
    } finally {
      setFinishing(false);
    }
  };
  return (
    <View style={styles.obFrame}>
      <View style={styles.obHeader}>
        <Text style={styles.h1}>{title}</Text>
        <Text style={styles.lede}>{subtitle}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} /></View>
        <Text style={styles.obStepText}>{step + 1} of {steps.length}: {steps[step]}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.obContent}>{children}</ScrollView>
      <View style={styles.obFooter}>
        <Pressable style={[styles.secondaryButton, step === 0 && styles.disabled]} disabled={step === 0} onPress={() => setStep(Math.max(0, step - 1))}><Text style={styles.secondaryText}>Back</Text></Pressable>
        <Pressable style={[styles.primaryButton, finishing && styles.disabled]} disabled={finishing} onPress={handlePrimary}><Text style={styles.primaryText}>{finishing ? "Saving..." : atEnd ? "Finish Setup" : "Continue"}</Text></Pressable>
      </View>
    </View>
  );
}

function OnboardingSegment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable style={[styles.obSegment, active && styles.obSegmentActive]} onPress={onPress}><Text style={[styles.obSegmentText, active && styles.obSegmentTextActive]}>{label}</Text></Pressable>; }
function Input({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) { return <View style={styles.inputWrap}><Text style={styles.inputLabel}>{label}</Text><TextInput style={[styles.input, multiline && styles.textArea]} value={value} onChangeText={onChangeText} multiline={multiline} /></View>; }
function ChoiceGrid({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) { return <View style={styles.choiceGrid}>{values.map(value => <Pressable key={value} style={[styles.choicePill, selected.includes(value) && styles.choicePillActive]} onPress={() => onToggle(value)}><Text style={[styles.choiceText, selected.includes(value) && styles.choiceTextActive]}>{value}</Text></Pressable>)}</View>; }
function EvidenceCard({ title, status, cta, onPress, previewUri }: { title: string; status: string; cta: string; onPress: () => void; previewUri?: string }) { return <Card><View style={styles.messageRow}><View style={styles.cameraFrame}>{previewUri ? <Image source={{ uri: previewUri }} style={styles.evidencePreview} alt={`${title} preview`} /> : <Text style={styles.serviceEmoji}>📷</Text>}</View><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowSub}>{status}</Text></View><Pressable style={styles.miniButton} onPress={onPress}><Text style={styles.primaryText}>{cta}</Text></Pressable></View></Card>; }
function Note({ text }: { text: string }) { return <View style={styles.note}><Text style={styles.rowSub}>{text}</Text></View>; }
function IntroPanel({ icon, title, copy }: { icon: string; title: string; copy: string }) { return <View style={styles.introPanel}><Text style={styles.introIcon}>{icon}</Text><Text style={styles.h1}>{title}</Text><Text style={styles.lede}>{copy}</Text></View>; }
function PermissionRow({ title, value, options, onChange }: { title: string; value: string; options: string[]; onChange: (value: string) => void }) { return <Card><Text style={styles.rowTitle}>{title}</Text><View style={styles.choiceGrid}>{options.map(option => <Pressable key={option} style={[styles.choicePill, value === option && styles.choicePillActive]} onPress={() => onChange(option)}><Text style={[styles.choiceText, value === option && styles.choiceTextActive]}>{option}</Text></Pressable>)}</View></Card>; }

function WellnessHomeScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  const health = useHealthStory(api);
  const displayName = api.user?.display_name && api.user.display_name !== "Senior" ? api.user.display_name.split(" ")[0] : "Anita";
  const state = health.state;
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <View style={styles.healthHeroPurple}>
        <TopBar title="TheSeniorGuru" left="☰" right="" />
        <View style={styles.healthHeroRow}>
          <View style={styles.flex}>
            <Text style={styles.healthHeroGreeting}>Good morning,</Text>
            <Text style={styles.healthHeroName}>{displayName} ☀️</Text>
            <Text style={styles.healthHeroSub}>Here is your health status for today.</Text>
          </View>
          <Avatar size={72} label="👵🏽" />
        </View>
        <View style={styles.stableCard}>
          <Text style={styles.shieldIcon}>🛡️</Text>
          <View style={styles.flex}>
            <Text style={styles.mutedTiny}>You are</Text>
            <Text style={styles.stableTitle}>{state.label}</Text>
            <View style={styles.confidenceRow}><Text style={styles.confidenceLabel}>Health Confidence</Text><Text style={styles.confidenceBadge}>{state.confidence}%</Text></View>
            <Text style={styles.rowSub}>{state.message}</Text>
          </View>
        </View>
      </View>

      <SectionTitle title="Today's Highlights" />
      <Card>{health.highlights.map((item, index) => <HealthSignalRow key={item.label} item={item} border={index < health.highlights.length - 1} />)}</Card>

      <Card style={styles.guruInsightCard}>
        <Text style={styles.insightTitle}>✦ Guru Insight</Text>
        <View style={styles.rowCenter}>
          <Text style={[styles.messageText, styles.flex]}>{health.guruInsight}</Text>
          <Avatar size={70} label="👵🏽" />
        </View>
      </Card>

      <View style={styles.quickGrid}>
        <QuickAction icon="◎" title="Wellness contributors" onPress={() => setScreen("HealthTrends")} />
        <QuickAction icon="♡" title="Vitals monitor" onPress={() => setScreen("HealthDevices")} />
        <QuickAction icon="👨‍👩‍👧" title="Family health view" onPress={() => setScreen("FamilyHealth")} />
        <QuickAction icon="⚠" title="Risk timeline" onPress={() => setScreen("RiskInsights")} />
      </View>
    </ScrollView>
  );
}

function HealthTrendsScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  const health = useHealthStory(api);
  const contributors = health.contributors;
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Wellness Contributors" left="‹" right="ⓘ" onLeft={() => setScreen("Wellness")} />
      <RangeTabs />
      <View style={styles.scoreRingWrap}>
        <View style={styles.scoreRing}><Text style={styles.scoreRingNumber}>{health.score}</Text><Text style={styles.scoreRingLabel}>Wellness Score</Text><Text style={styles.scoreRingGood}>{health.score >= 80 ? "Doing Well" : health.score >= 65 ? "Watch Today" : "Needs Support"}</Text></View>
      </View>
      <View style={styles.trendNote}><Text style={styles.trendArrow}>↗</Text><Text style={styles.rowSub}>Your score is {health.delta >= 0 ? "higher" : "lower"} than last week ({health.delta >= 0 ? "+" : ""}{health.delta} points)</Text></View>
      <SectionTitle title="What's contributing to your score" />
      <Card>{contributors.map((item, index) => <ContributorRow key={item.label} item={item} border={index < contributors.length - 1} />)}<LegendRow /></Card>
    </ScrollView>
  );
}

function HealthDevicesScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  const health = useHealthStory(api);
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Vitals Monitor" left="‹" right="ⓘ" onLeft={() => setScreen("Wellness")} />
      <RangeTabs />
      {health.vitals.map(vital => <VitalMonitorCard key={vital.label} vital={vital} />)}
      <View style={styles.vitalLegend}><Text style={styles.legendDotGreen}>●</Text><Text style={styles.rowSub}>In Range</Text><Text style={styles.legendDotAmber}>●</Text><Text style={styles.rowSub}>Watch</Text><Text style={styles.legendDotRed}>●</Text><Text style={styles.rowSub}>Out of Range</Text></View>
    </ScrollView>
  );
}

function FamilyHealthScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  const health = useHealthStory(api);
  const displayName = api.user?.display_name && api.user.display_name !== "Senior" ? api.user.display_name : "Anita Sharma";
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Family Health View" left="‹" right="🔔" onLeft={() => setScreen("Wellness")} />
      <View style={styles.familyHero}>
        <Avatar size={58} label="👵🏽" />
        <View style={styles.flex}><Text style={styles.familyName}>{displayName}</Text><Text style={styles.whiteSub}>Last check-in: Today, 8:12 AM</Text><Text style={styles.whiteSub}>Health Confidence</Text><View style={styles.familyConfidenceTrack}><View style={[styles.familyConfidenceFill, { width: `${health.state.confidence}%` as any }]} /></View></View>
        <Text style={styles.familyStablePill}>{health.state.short}</Text>
      </View>
      <SectionTitle title="Today's Summary" />
      <Card>{health.familySummary.map((item, index) => <FamilySummaryRow key={item.label} item={item} border={index < health.familySummary.length - 1} />)}</Card>
      <Card style={styles.changedCard}><Text style={styles.insightTitle}>What changed?</Text><View style={styles.rowCenter}><Text style={[styles.rowSub, styles.flex]}>{health.changedText}</Text><Sparkline /></View></Card>
      <Card style={styles.actionCard}><Text style={styles.actionTitle}>💡 Recommended Action</Text><Text style={styles.rowSub}>{health.recommendedAction}</Text></Card>
      <Card style={styles.guruInsightCard}><Text style={styles.insightTitle}>✦ Guru Note</Text><View style={styles.rowCenter}><Text style={[styles.messageText, styles.flex]}>{health.familyNote}</Text><Avatar size={62} label="👵🏽" /></View></Card>
    </ScrollView>
  );
}

function RiskInsightsScreen({ setScreen, api }: { setScreen: (screen: Screen) => void; api: ApiClient }) {
  const health = useHealthStory(api);
  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
      <TopBar title="Risk Intelligence" left="‹" right="ⓘ" onLeft={() => setScreen("Wellness")} />
      <View style={styles.segment}><Text style={styles.segmentActive}>Timeline</Text><Text style={styles.segmentText}>Risk Overview</Text></View>
      <View style={styles.riskHero}><View><Text style={styles.rowSub}>Overall Risk Level</Text><Text style={styles.riskLevel}>{health.riskLevel}</Text><Text style={styles.rowSub}>{health.riskMessage}</Text></View><Text style={styles.riskShield}>🛡️</Text></View>
      <SectionTitle title="Risk Timeline" />
      <View style={styles.timelineWrap}>{health.timeline.map((item, index) => <RiskTimelineItem key={`${item.date}-${item.title}`} item={item} last={index === health.timeline.length - 1} />)}</View>
      <Card style={styles.guruInsightCard}><Text style={styles.insightTitle}>✦ Guru Analysis</Text><View style={styles.rowCenter}><Text style={[styles.messageText, styles.flex]}>{health.riskAnalysis}</Text><Avatar size={62} label="👵🏽" /></View></Card>
    </ScrollView>
  );
}

function useHealthStory(api: ApiClient) {
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  useEffect(() => {
    if (!api.ready) return;
    let alive = true;
    Promise.all([
      api.get("/api/health/senior/self/summary"),
      api.get("/api/health/senior/self/trends?range=30d"),
      api.get("/api/health/senior/self/alerts")
    ]).then(([summaryData, trendData, alertData]) => {
      if (!alive) return;
      setSummary(summaryData); setTrends(trendData); setAlerts(alertData.alerts || []);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [api.ready]);
  const scoreRow = summary?.score || {};
  const metric = summary?.metric || {};
  const score = Math.round(Number(scoreRow.wellness_score || 82));
  const risk = String(scoreRow.risk_level || (alerts.length ? "watch" : "info"));
  const confidence = Math.max(62, Math.min(97, score + (risk === "info" ? 5 : -4)));
  const state = risk === "critical" ? { label: "Needs Help Now", short: "Urgent", confidence, message: "A serious signal needs immediate attention." } : risk === "high" ? { label: "Check-In Suggested", short: "Watch", confidence, message: "A few signals changed and Guru recommends a check-in." } : risk === "watch" ? { label: "Watch Today", short: "Watch", confidence, message: "No emergency, but a gentle check-in may help." } : { label: "Stable Today", short: "Stable", confidence, message: "No immediate concerns" };
  const highlights = [
    { icon: "🛌", label: "Sleep Recovery", value: metric.sleep_minutes ? minutesToSleep(metric.sleep_minutes) : "7h 14m", status: Number(scoreRow.sleep_score || 82) >= 75 ? "Good" : "Watch", tone: Number(scoreRow.sleep_score || 82) >= 75 ? "green" : "amber" },
    { icon: "🚶", label: "Activity & Mobility", value: `${metric.steps || 4280} steps`, status: Number(scoreRow.activity_score || 78) >= 75 ? "Good" : "Watch", tone: Number(scoreRow.activity_score || 78) >= 75 ? "green" : "amber" },
    { icon: "💊", label: "Medication Adherence", value: `${Math.round(Number(metric.medication_adherence_percent || 100))}% on track`, status: Number(scoreRow.medication_score || 92) >= 85 ? "Excellent" : "Watch", tone: Number(scoreRow.medication_score || 92) >= 85 ? "green" : "amber" },
    { icon: "🙂", label: "Mood", value: metric.mood_score ? `${metric.mood_score}/100` : "Good", status: "Positive", tone: "green" },
    { icon: "💧", label: "Hydration", value: "5 of 8 glasses", status: "Good", tone: "green" }
  ];
  const contributors = [
    { icon: "🌙", label: "Sleep Recovery", status: highlights[0].status, delta: Math.round(Number(scoreRow.sleep_score || 82) - 64), tone: highlights[0].tone },
    { icon: "🚶", label: "Activity / Mobility", status: highlights[1].status, delta: Math.round(Number(scoreRow.activity_score || 78) - 63), tone: highlights[1].tone },
    { icon: "💊", label: "Medication Adherence", status: highlights[2].status, delta: Math.round(Number(scoreRow.medication_score || 92) - 72), tone: highlights[2].tone },
    { icon: "🙂", label: "Mood & Mind", status: "Good", delta: Math.round(Number(scoreRow.mood_score || 78) - 66), tone: "green" },
    { icon: "❤️", label: "Heart Health", status: Number(scoreRow.heart_score || 88) >= 75 ? "Good" : "Watch", delta: Math.round(Number(scoreRow.heart_score || 88) - 71), tone: Number(scoreRow.heart_score || 88) >= 75 ? "green" : "amber" }
  ];
  const vitals = [
    { icon: "❤️", label: "Resting Heart Rate", value: metric.resting_heart_rate || metric.heart_rate_avg || 72, unit: "bpm", normal: "30-day baseline: 69 bpm", status: vitalStatus(Number(metric.resting_heart_rate || metric.heart_rate_avg || 72), 45, 105) },
    { icon: "💚", label: "Heart Rate Variability", value: metric.hrv || 48, unit: "ms", normal: "30-day baseline: 44 ms", status: "Good" },
    { icon: "💧", label: "Blood Oxygen (SpO₂)", value: metric.oxygen_saturation || 97, unit: "%", normal: "Normal range: 95 - 100%", status: vitalStatus(Number(metric.oxygen_saturation || 97), 95, 100, true) },
    { icon: "🫁", label: "Respiratory Rate", value: metric.respiratory_rate || 16, unit: "/min", normal: "Normal range: 12 - 20", status: vitalStatus(Number(metric.respiratory_rate || 16), 12, 20) },
    { icon: "🌡", label: "Body Temperature", value: "98.3", unit: "°F", normal: "Normal range: 97.5 - 99.5", status: "Normal" },
    { icon: "💓", label: "Blood Pressure", value: "118 / 76", unit: "mmHg", normal: "Normal range: < 130/80", status: "Normal" }
  ];
  const openAlertTypes = new Set(alerts.map(a => a.alert_type));
  const timeline = [
    { date: "Today", title: risk === "info" ? "Normal" : "Watch Signal", body: risk === "info" ? "All vitals and activities in normal range." : "Guru detected signals that may need a check-in.", tone: risk === "info" ? "green" : "amber" },
    { date: "May 12", title: openAlertTypes.has("low_activity") ? "Reduced Activity" : "Normal", body: openAlertTypes.has("low_activity") ? "Steps were below the usual range." : "Activity stayed in expected range.", tone: openAlertTypes.has("low_activity") ? "amber" : "green" },
    { date: "May 11", title: openAlertTypes.has("missed_medication_pattern") ? "Missed Medication" : "Medication On Track", body: openAlertTypes.has("missed_medication_pattern") ? "Evening medication may have been missed." : "Medication rhythm is on track.", tone: openAlertTypes.has("missed_medication_pattern") ? "red" : "green" },
    { date: "May 10", title: openAlertTypes.has("low_sleep") ? "Low Sleep" : "Sleep Stable", body: openAlertTypes.has("low_sleep") ? "Sleep was below the usual range." : "Sleep stayed close to baseline.", tone: openAlertTypes.has("low_sleep") ? "purple" : "green" },
    { date: "May 9", title: "Normal", body: "All vitals and activities in normal range.", tone: "green" }
  ];
  return {
    score, delta: Math.max(-8, Math.min(9, (trends?.scores || []).length - 1 ? score - Math.round(Number((trends.scores || [])[0]?.wellness_score || score)) : 6)), state, highlights, contributors, vitals, timeline,
    familySummary: [
      { icon: "💊", label: "Medication", value: Number(metric.medication_adherence_percent || 100) >= 90 ? "All taken" : "Check", tone: Number(metric.medication_adherence_percent || 100) >= 90 ? "green" : "amber" },
      { icon: "🌙", label: "Sleep", value: metric.sleep_minutes ? minutesToSleep(metric.sleep_minutes) : "7h 14m", tone: Number(scoreRow.sleep_score || 82) >= 75 ? "green" : "amber" },
      { icon: "🚶", label: "Activity", value: `${metric.steps || 4280} steps`, tone: Number(scoreRow.activity_score || 78) >= 75 ? "green" : "amber" },
      { icon: "❤️", label: "Heart Rate", value: `${metric.resting_heart_rate || metric.heart_rate_avg || 72} bpm resting`, tone: Number(scoreRow.heart_score || 88) >= 75 ? "green" : "amber" },
      { icon: "🙂", label: "Mood", value: "Good", tone: "green" },
      { icon: "💧", label: "Hydration", value: "Good", tone: "green" }
    ],
    guruInsight: risk === "info" ? "You slept well and completed your medication rhythm. A short walk today would improve your mobility score." : "Guru noticed a few changes. A gentle check-in and light activity may help today.",
    changedText: risk === "info" ? "Activity is steady and vitals are in normal range." : "Activity is lower than usual and one or more health signals need review.",
    recommendedAction: risk === "info" ? "Encourage a short walk today and check in this evening." : "Please check in, confirm medication, and review activity today.",
    familyNote: risk === "info" ? "Overall doing well. No immediate concerns." : "A check-in is recommended. Guru is watching for repeat signals before escalating further.",
    riskLevel: risk === "info" ? "Low" : risk === "watch" ? "Watch" : risk === "high" ? "Elevated" : "Urgent",
    riskMessage: risk === "info" ? "No urgent concerns" : "Care action recommended",
    riskAnalysis: risk === "info" ? "Trend improving. Keep up the good routine." : "Signals are being monitored with false-alarm protection before broader escalation."
  };
}

function minutesToSleep(value: any) { const mins = Number(value || 0); return `${Math.floor(mins / 60)}h ${mins % 60}m`; }
function vitalStatus(value: number, low: number, high: number, inclusive = false) { if (inclusive ? value >= low && value <= high : value >= low && value <= high) return "Normal"; return "Watch"; }
function RangeTabs() { return <View style={styles.rangeTabs}>{["Today", "7 Days", "30 Days", "90 Days"].map((t, i) => <Text key={t} style={i === 0 ? styles.rangeTabActive : styles.rangeTab}>{t}</Text>)}</View>; }
function HealthSignalRow({ item, border }: { item: any; border?: boolean }) { return <View style={[styles.healthSignalRow, border && styles.rowBorder]}><Text style={styles.signalIcon}>{item.icon}</Text><View style={styles.flex}><Text style={styles.rowTitle}>{item.label}</Text><Text style={styles.rowSub}>{item.value}</Text></View><Text style={item.tone === "green" ? styles.statusGreen : styles.statusAmber}>{item.status}</Text><Text style={item.tone === "green" ? styles.dotGreen : styles.dotAmber}>●</Text></View>; }
function ContributorRow({ item, border }: { item: any; border?: boolean }) { return <View style={[styles.healthSignalRow, border && styles.rowBorder]}><Text style={styles.signalIcon}>{item.icon}</Text><View style={styles.flex}><Text style={styles.rowTitle}>{item.label}</Text></View><Text style={item.tone === "green" ? styles.statusPillGreen : styles.statusPillAmber}>{item.status}</Text><Text style={styles.rowTitle}>{item.delta >= 0 ? "+" : ""}{item.delta}</Text></View>; }
function FamilySummaryRow({ item, border }: { item: any; border?: boolean }) { return <View style={[styles.healthSignalRow, border && styles.rowBorder]}><Text style={styles.signalIcon}>{item.icon}</Text><Text style={[styles.rowTitle, styles.flex]}>{item.label}</Text><Text style={styles.rowTitle}>{item.value}</Text><Text style={item.tone === "green" ? styles.greenCheck : styles.pendingBadge}>{item.tone === "green" ? "✓" : "!"}</Text></View>; }
function VitalMonitorCard({ vital }: { vital: any }) { return <Card><View style={styles.rowCenter}><Text style={styles.signalIcon}>{vital.icon}</Text><View style={styles.flex}><Text style={styles.rowTitle}>{vital.label}</Text><Text style={styles.vitalValue}>{vital.value} <Text style={styles.vitalUnit}>{vital.unit}</Text></Text><Text style={styles.rowSub}>{vital.normal}</Text></View><View><Text style={vital.status === "Normal" || vital.status === "Good" ? styles.statusGreen : styles.statusAmber}>{vital.status}</Text><Sparkline /></View></View></Card>; }
function Sparkline() { return <View style={styles.sparkline}><View style={styles.sparkBandRed} /><View style={styles.sparkBandGreen} /><Text style={styles.sparkDots}>•—•—●—•</Text></View>; }
function LegendRow() { return <View style={styles.legendRow}><Text style={styles.legendDotGreen}>●</Text><Text style={styles.rowSub}>Helping</Text><Text style={styles.legendDotAmber}>●</Text><Text style={styles.rowSub}>Neutral</Text><Text style={styles.legendDotRed}>●</Text><Text style={styles.rowSub}>Needs Attention</Text></View>; }
function RiskTimelineItem({ item, last }: { item: any; last: boolean }) { return <View style={styles.riskTimelineRow}><View style={styles.riskRail}><Text style={item.tone === "green" ? styles.riskDotGreen : item.tone === "red" ? styles.riskDotRed : item.tone === "purple" ? styles.riskDotPurple : styles.riskDotAmber}>{item.tone === "green" ? "✓" : "!"}</Text>{!last ? <View style={styles.riskLine} /> : null}</View><Text style={styles.timelineDate}>{item.date}</Text><Card style={styles.timelineCard}><Text style={item.tone === "green" ? styles.statusGreen : item.tone === "red" ? styles.statusRed : styles.statusAmber}>{item.title}</Text><Text style={styles.rowSub}>{item.body}</Text></Card></View>; }
function HealthPreview() { return <Card style={styles.purplePanel}><Text style={styles.rowTitle}>Health charts enabled after connection</Text><Text style={styles.rowSub}>Steps, heart rate, sleep, mobility, falls, oxygen saturation, blood pressure, glucose and 7/30/90 day trends.</Text></Card>; }
function SafetyPreview() { return <Card><Text style={styles.rowTitle}>Escalation Preview</Text><Text style={styles.rowSub}>1. Notify Rita immediately\n2. Call Amit if no response in 3 minutes\n3. Notify community staff\n4. Call 911 for emergency override</Text></Card>; }
function DailyPlanPreview() { return <Card style={styles.purplePanel}><Text style={styles.rowTitle}>Guru will build the Daily Journey</Text><Text style={styles.rowSub}>Morning meds, meals, family calls, activities, hydration, walks, music and safety check-ins.</Text></Card>; }
function MapBoundaryMock() { return <View style={styles.mapMock}><Text style={styles.mapText}>🗺️ Draw service area boundary</Text><View style={styles.mapPolygon}><Text style={styles.primaryText}>Parker + Lone Tree + Centennial</Text></View></View>; }
function TrustScorePreview() { return <Card style={styles.purplePanel}><Text style={styles.h3}>Trust Score</Text><Text style={styles.rowSub}>✅ Live owner verification\n✅ Business license\n✅ Insurance\n✅ Background checks\n✅ Service area verified</Text></Card>; }

function TopBar({ title, left, right, badge, onLeft, onRight }: { title: string; left?: string; right?: string; badge?: string; onLeft?: () => void; onRight?: () => void }) {
  return <View style={styles.topBar}><Pressable onPress={onLeft}><Text style={styles.topIcon}>{left || ""}</Text></Pressable><Text style={styles.topTitle}>{title}</Text><Pressable style={styles.rightWrap} onPress={onRight}>{right ? <Text style={styles.topIcon}>{right}</Text> : null}{badge ? <Text style={styles.badge}>{badge}</Text> : null}</Pressable></View>;
}

function BottomNav({ current, onPress }: { current: Tab; onPress: (tab: Tab) => void }) {
  const tabs: { key: Tab; icon: string }[] = [{ key: "Guru", icon: "♟" }, { key: "Today", icon: "▣" }, { key: "Circle", icon: "♧" }, { key: "Activities", icon: "⌁" }, { key: "Safety", icon: "◈" }];
  return <View style={styles.bottomNav}>{tabs.map((t) => <Pressable key={t.key} style={styles.navItem} onPress={() => onPress(t.key)}><Text style={[styles.navIcon, current === t.key && styles.navActive]}>{t.icon}</Text><Text style={[styles.navLabel, current === t.key && styles.navActive]}>{t.key}</Text></Pressable>)}</View>;
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) { return <View style={[styles.card, style]}>{children}</View>; }
function HeroCard({ children }: { children: React.ReactNode }) { return <View style={styles.heroCard}>{children}</View>; }
function Avatar({ size, label, big, uri }: { size: number; label: string; big?: boolean; uri?: string }) {
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>{uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} alt="Profile photo" /> : <Text style={[styles.avatarText, { fontSize: big ? 72 : size * 0.48 }]}>{label}</Text>}</View>;
}
function SectionTitle({ title, action, onAction, flush }: { title: string; action?: string; onAction?: () => void; flush?: boolean }) { return <View style={[styles.sectionTitle, flush && { marginTop: 0 }]}><Text style={styles.sectionHeading}>{title}</Text>{action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>; }
function QuickAction({ icon, title, onPress }: { icon: string; title: string; onPress: () => void }) { return <Pressable style={styles.quickAction} onPress={onPress}><Text style={styles.quickIcon}>{icon}</Text><Text style={styles.quickTitle}>{title}</Text></Pressable>; }
function ServiceCard({ icon, title, sub }: { icon: string; title: string; sub: string }) { return <View style={styles.serviceCard}><Text style={styles.serviceEmoji}>{icon}</Text><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowSub}>{sub}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, phoneCanvas: { flex: 1, backgroundColor: BG }, screen: { flex: 1, backgroundColor: BG }, fullScreen: { flex: 1, backgroundColor: BG }, scrollPad: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 108 },
  topBar: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }, topTitle: { fontSize: 18, fontWeight: "800", color: DEEP }, topIcon: { fontSize: 24, color: DEEP, minWidth: 28 }, rightWrap: { minWidth: 34, alignItems: "center" }, badge: { position: "absolute", top: -5, right: -3, backgroundColor: "#ef2633", color: "#fff", width: 18, height: 18, borderRadius: 9, textAlign: "center", fontSize: 11, fontWeight: "900" },
  h2: { fontSize: 19, color: DEEP, fontWeight: "900" }, h1Center: { marginTop: 14, color: DEEP, fontSize: 22, fontWeight: "900", textAlign: "center" }, smallDark: { marginTop: 8, color: "#3f3a4f", fontSize: 13 }, centerSub: { color: DEEP, textAlign: "center", marginTop: 6, fontWeight: "600" }, centerHero: { alignItems: "center", paddingTop: 12, paddingBottom: 16 },
  heroCard: { backgroundColor: "#f3edff", borderRadius: 18, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: LINE }, heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, askGuruBand: { marginTop: 12, borderRadius: 16, padding: 18, backgroundColor: PURPLE, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, whiteTitle: { color: "#fff", fontSize: 18, fontWeight: "900" }, whiteSub: { color: "#eee7ff", marginTop: 5, fontWeight: "600" }, micCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, micText: { fontSize: 28 },
  avatar: { backgroundColor: "#eadfff", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" }, avatarText: { lineHeight: 80 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: LINE, shadowColor: "#4c2c82", shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, messageCard: {}, rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 }, flex: { flex: 1 }, rowBorder: { borderBottomWidth: 1, borderBottomColor: LINE }, timelineRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }, timelineIcon: { fontSize: 24, width: 34 }, rowTitle: { color: DEEP, fontWeight: "900", fontSize: 14 }, rowSub: { color: MUTED, fontSize: 12, lineHeight: 18, marginTop: 2 }, cardTitle: { color: DEEP, fontSize: 16, fontWeight: "900" }, messageText: { marginTop: 8, color: DEEP, lineHeight: 20 }, mutedTiny: { marginTop: 8, color: MUTED, fontSize: 11 }, greenCheck: { color: "#27a33d", borderWidth: 1, borderColor: "#66c973", width: 24, height: 24, textAlign: "center", borderRadius: 12, fontWeight: "900" }, emptyDot: { color: MUTED, fontSize: 20 }, timeText: { color: MUTED, fontSize: 12, marginRight: 4 },
  sectionTitle: { marginTop: 4, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionHeading: { color: DEEP, fontSize: 16, fontWeight: "900" }, sectionAction: { color: PURPLE, fontSize: 13, fontWeight: "800" },
  moodRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 }, moodItem: { alignItems: "center" }, moodFace: { fontSize: 30 }, moodLabel: { color: DEEP, fontSize: 11, marginTop: 5, fontWeight: "600" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, quickAction: { width: "48%", minHeight: 70, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 14, flexDirection: "row", alignItems: "center", gap: 9 }, quickIcon: { fontSize: 22 }, quickTitle: { flex: 1, color: DEEP, fontWeight: "800", fontSize: 13 }, voiceOrb: { alignSelf: "center", marginTop: 22, width: 72, height: 72, borderRadius: 36, backgroundColor: PURPLE, alignItems: "center", justifyContent: "center", shadowColor: PURPLE, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8 }, voiceOrbText: { color: "#fff", fontSize: 26, fontWeight: "900" }, typeCameraRow: { flexDirection: "row", justifyContent: "center", gap: 28, marginTop: 12 }, pillButton: { minWidth: 96, height: 38, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center" }, pillText: { color: DEEP, fontWeight: "700" },
  chatPad: { padding: 22, paddingBottom: 90 }, userBubble: { alignSelf: "flex-end", maxWidth: "78%", backgroundColor: PURPLE, padding: 14, borderRadius: 14, marginBottom: 18 }, userBubbleText: { color: "#fff", fontWeight: "700", lineHeight: 20 }, aiRow: { flexDirection: "row", gap: 10, marginBottom: 14 }, aiBubble: { flex: 1, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 14 }, aiText: { color: DEEP, lineHeight: 20, marginBottom: 8, fontWeight: "600" }, inputBar: { position: "absolute", left: 16, right: 16, bottom: 82, height: 52, borderRadius: 26, borderWidth: 1, borderColor: LINE, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 6 }, chatInput: { flex: 1, color: DEEP }, roundPurple: { width: 42, height: 42, borderRadius: 21, backgroundColor: PURPLE, alignItems: "center", justifyContent: "center" }, white: { color: "#fff" },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, serviceCard: { width: "48%", minHeight: 124, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 14, justifyContent: "center" }, serviceEmoji: { fontSize: 32, marginBottom: 12 }, serviceIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: SOFT, alignItems: "center", justifyContent: "center" }, price: { color: DEEP, fontWeight: "900", fontSize: 16 }, primarySmall: { minWidth: 104, minHeight: 38, backgroundColor: PURPLE, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }, primaryButton: { marginTop: 10, minHeight: 52, backgroundColor: PURPLE, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 }, primaryText: { color: "#fff", fontWeight: "900", textAlign: "center" }, outlineButton: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8 }, selectedOutline: { backgroundColor: "#f2e9ff", borderColor: PURPLE }, outlineText: { color: PURPLE, fontWeight: "800", textAlign: "center" }, twoActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  searchBox: { height: 48, backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: LINE, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", marginBottom: 18 }, searchPlaceholder: { color: "#9a94a7", flex: 1 }, searchIcon: { fontSize: 22, color: DEEP },
  segment: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 4 }, segmentActive: { backgroundColor: PURPLE, color: "#fff", overflow: "hidden", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 10, fontWeight: "900" }, segmentText: { color: DEEP, paddingHorizontal: 12, fontWeight: "700" }, personCard: { padding: 12 }, smallIconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: SOFT, alignItems: "center", justifyContent: "center" }, familyMoments: { backgroundColor: "#f7f0ff" }, photoStrip: { flexDirection: "row", gap: 10, marginBottom: 12 }, memoryPhoto: { flex: 1, height: 86, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, memoryEmoji: { fontSize: 34 },
  sosHero: { backgroundColor: "#f82727", borderRadius: 22, paddingVertical: 24, alignItems: "center", marginBottom: 16 }, sosTitle: { color: "#fff", fontSize: 20, fontWeight: "900" }, sosSub: { color: "#ffe8e8", marginTop: 4, fontWeight: "600" }, sosCircle: { width: 112, height: 112, borderRadius: 56, borderWidth: 8, borderColor: "rgba(255,255,255,.55)", backgroundColor: "#ee3a2f", alignItems: "center", justifyContent: "center", marginTop: 18 }, sosText: { color: "#fff", fontSize: 28, fontWeight: "900" }, toggleOn: { width: 46, height: 26, borderRadius: 13, backgroundColor: PURPLE }, linkText: { color: DEEP, marginTop: 12, fontWeight: "800" }, greenBadge: { backgroundColor: "#e8f9e9", color: "#1b8a2f", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 11, fontWeight: "900" }, pendingBadge: { backgroundColor: "#f1e8ff", color: PURPLE, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 11, fontWeight: "900" }, locationIcon: { fontSize: 22 }, contactLine: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  dateText: { textAlign: "center", color: DEEP, marginTop: -8, marginBottom: 14, fontWeight: "700", fontSize: 12 }, weekRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }, dayCell: { alignItems: "center", padding: 8 }, dayActive: { alignItems: "center", backgroundColor: PURPLE, borderRadius: 16, padding: 8, width: 44 }, dayText: { color: DEEP, textAlign: "center", lineHeight: 20 }, dayActiveText: { color: "#fff", textAlign: "center", lineHeight: 20, fontWeight: "900" },
  activityRow: { flexDirection: "row", gap: 10, marginBottom: 20 }, activityCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 10 }, activityImage: { height: 84, borderRadius: 12, backgroundColor: SOFT, alignItems: "center", justifyContent: "center", marginBottom: 8 }, activityEmoji: { fontSize: 34 }, activityTitle: { color: DEEP, fontWeight: "900", fontSize: 12 }, activitySub: { color: MUTED, fontSize: 10, lineHeight: 14, marginTop: 4 }, categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, categoryCard: { width: "31%", height: 78, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center" }, categoryText: { color: DEEP, fontWeight: "800", textAlign: "center", fontSize: 12 },
  profileRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 }, progressTrack: { height: 5, backgroundColor: SOFT, borderRadius: 99, marginTop: 8 }, progressFill: { width: "80%", height: 5, backgroundColor: PURPLE, borderRadius: 99 },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 82, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: LINE, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingBottom: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, navItem: { alignItems: "center", gap: 4 }, navIcon: { color: "#8a8794", fontSize: 20 }, navLabel: { color: "#8a8794", fontSize: 11, fontWeight: "700" }, navActive: { color: PURPLE, fontWeight: "900" },
  h1: { fontSize: 28, fontWeight: "900", color: DEEP, lineHeight: 34 }, h3: { fontSize: 16, fontWeight: "900", color: DEEP }, lede: { color: MUTED, fontSize: 15, lineHeight: 22, marginTop: 6 }, caption: { color: MUTED, fontSize: 12, marginTop: 3 },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  obShell: { flex: 1, padding: 14, paddingBottom: 18, backgroundColor: BG }, obRoleSwitcher: { flexDirection: "row", backgroundColor: "white", borderRadius: 18, padding: 5, borderWidth: 1, borderColor: LINE, marginBottom: 12 }, obSegment: { flex: 1, paddingVertical: 11, borderRadius: 14, alignItems: "center" }, obSegmentActive: { backgroundColor: PURPLE }, obSegmentText: { color: MUTED, fontWeight: "900", fontSize: 12 }, obSegmentTextActive: { color: "white" },
  obFrame: { flex: 1, backgroundColor: "white", borderRadius: 26, borderWidth: 1, borderColor: LINE, overflow: "hidden" }, obHeader: { padding: 18, backgroundColor: "#f7f2ff", borderBottomWidth: 1, borderBottomColor: LINE }, obStepText: { color: PURPLE, fontWeight: "900", marginTop: 8 }, obContent: { padding: 16, paddingBottom: 24 }, obFooter: { flexDirection: "row", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: LINE, backgroundColor: "white" }, disabled: { opacity: 0.4 },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: "white", borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }, secondaryText: { color: PURPLE, fontWeight: "900" },
  inputWrap: { flex: 1, minWidth: 130, marginBottom: 12 }, inputLabel: { color: DEEP, fontWeight: "900", marginBottom: 7 }, input: { borderWidth: 1, borderColor: LINE, borderRadius: 16, backgroundColor: "#fff", paddingHorizontal: 14, minHeight: 48, color: DEEP }, textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" }, twoCol: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginVertical: 8 }, choicePill: { borderRadius: 999, borderWidth: 1, borderColor: LINE, backgroundColor: "white", paddingHorizontal: 13, paddingVertical: 10 }, choicePillActive: { backgroundColor: PURPLE, borderColor: PURPLE }, choiceText: { color: DEEP, fontWeight: "800" }, choiceTextActive: { color: "white" },
  cameraFrame: { width: 64, height: 64, borderRadius: 18, backgroundColor: SOFT, alignItems: "center", justifyContent: "center", overflow: "hidden" }, evidencePreview: { width: 64, height: 64 }, miniButton: { backgroundColor: PURPLE, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 10, maxWidth: 120 }, note: { backgroundColor: "#fff7e8", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#f1dec1", marginVertical: 8 }, introPanel: { alignItems: "center", padding: 22, backgroundColor: "#f6f0ff", borderRadius: 24, borderWidth: 1, borderColor: LINE }, introIcon: { fontSize: 58, marginBottom: 10 },
  mapMock: { height: 190, borderRadius: 22, backgroundColor: "#eaf2ff", borderWidth: 1, borderColor: LINE, marginBottom: 12, padding: 16, justifyContent: "space-between" }, mapText: { color: DEEP, fontWeight: "900" }, mapPolygon: { alignSelf: "center", width: "78%", height: 92, borderRadius: 42, borderWidth: 4, borderColor: PURPLE_DARK, backgroundColor: "rgba(111,61,204,0.35)", alignItems: "center", justifyContent: "center", padding: 12 }, purplePanel: { backgroundColor: "#f5efff" },
  healthHeroPurple: { marginHorizontal: -22, marginTop: -8, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22, backgroundColor: PURPLE, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  healthHeroRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 }, healthHeroGreeting: { color: "#fff", fontSize: 17, fontWeight: "700" }, healthHeroName: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 }, healthHeroSub: { color: "#f0e9ff", fontSize: 14, fontWeight: "700", marginTop: 9 },
  stableCard: { marginTop: 18, backgroundColor: "#f8fff4", borderColor: "#8ed18a", borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: "row", gap: 14, alignItems: "center" }, shieldIcon: { fontSize: 42 }, stableTitle: { color: "#188823", fontSize: 22, fontWeight: "900", marginVertical: 5 },
  confidenceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }, confidenceLabel: { backgroundColor: "#eef2ec", color: DEEP, overflow: "hidden", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: "800" }, confidenceBadge: { backgroundColor: "#45aa35", color: "#fff", overflow: "hidden", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "900" },
  healthSignalRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }, signalIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#f3eefc", textAlign: "center", lineHeight: 38, fontSize: 20, overflow: "hidden" },
  statusGreen: { color: "#128817", fontSize: 12, fontWeight: "900" }, statusAmber: { color: "#d08a00", fontSize: 12, fontWeight: "900" }, statusRed: { color: "#e5432c", fontSize: 12, fontWeight: "900" }, dotGreen: { color: "#40aa35", fontSize: 18 }, dotAmber: { color: "#edaa13", fontSize: 18 },
  statusPillGreen: { backgroundColor: "#e8f8e7", color: "#168218", overflow: "hidden", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: "900" }, statusPillAmber: { backgroundColor: "#fff2cf", color: "#be7b00", overflow: "hidden", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: "900" },
  guruInsightCard: { backgroundColor: "#f7f2ff", borderColor: "#d7c6ff" }, insightTitle: { color: PURPLE_DARK, fontWeight: "900", fontSize: 14, marginBottom: 10 },
  rangeTabs: { flexDirection: "row", borderWidth: 1, borderColor: "#ddd5ee", borderRadius: 15, padding: 3, backgroundColor: "#fff", marginBottom: 18 }, rangeTab: { flex: 1, textAlign: "center", color: MUTED, paddingVertical: 9, fontSize: 12, fontWeight: "700" }, rangeTabActive: { flex: 1, textAlign: "center", color: PURPLE, paddingVertical: 9, borderWidth: 1, borderColor: PURPLE, borderRadius: 12, fontSize: 12, fontWeight: "900" },
  scoreRingWrap: { alignItems: "center", marginVertical: 14 }, scoreRing: { width: 220, height: 220, borderRadius: 110, borderWidth: 14, borderColor: "#64bd50", backgroundColor: "#fbfff8", alignItems: "center", justifyContent: "center", shadowColor: "#53b64a", shadowOpacity: 0.18, shadowRadius: 20 }, scoreRingNumber: { color: DEEP, fontSize: 58, fontWeight: "900" }, scoreRingLabel: { color: MUTED, fontSize: 15, marginTop: 4 }, scoreRingGood: { color: "#24a23a", fontSize: 16, fontWeight: "900", marginTop: 8 },
  trendNote: { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 16 }, trendArrow: { color: "#25a235", fontSize: 30, fontWeight: "900" }, legendRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, justifyContent: "center" }, legendDotGreen: { color: "#35a833" }, legendDotAmber: { color: "#e8a50c" }, legendDotRed: { color: "#e43c2d" },
  vitalLegend: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 7, marginTop: 4, marginBottom: 18 }, vitalValue: { color: "#111024", fontSize: 30, fontWeight: "900", marginVertical: 5 }, vitalUnit: { color: DEEP, fontSize: 13, fontWeight: "800" },
  sparkline: { width: 106, height: 52, borderRadius: 8, overflow: "hidden", justifyContent: "center", alignItems: "center" }, sparkBandRed: { position: "absolute", left: 0, right: 0, top: 0, height: 17, backgroundColor: "#ffe0dd" }, sparkBandGreen: { position: "absolute", left: 0, right: 0, bottom: 0, height: 18, backgroundColor: "#e8f7e7" }, sparkDots: { color: "#34415c", fontSize: 15, fontWeight: "900" },
  familyHero: { backgroundColor: PURPLE, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }, familyName: { color: "#fff", fontWeight: "900", fontSize: 16 }, familyStablePill: { backgroundColor: "#dff8cf", color: "#1b8825", overflow: "hidden", borderRadius: 13, paddingHorizontal: 11, paddingVertical: 7, fontWeight: "900", fontSize: 12 }, familyConfidenceTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.28)", borderRadius: 99, marginTop: 6 }, familyConfidenceFill: { height: 8, backgroundColor: "#a9e775", borderRadius: 99 },
  changedCard: { backgroundColor: "#fbf9ff", borderColor: "#dcd1ff" }, actionCard: { backgroundColor: "#fffaf0", borderColor: "#f3dca7" }, actionTitle: { color: "#a86c00", fontWeight: "900", marginBottom: 8 },
  riskHero: { backgroundColor: "#f3fff2", borderColor: "#80ca75", borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, riskLevel: { color: "#15881e", fontSize: 30, fontWeight: "900", marginVertical: 3 }, riskShield: { fontSize: 58 },
  timelineWrap: { marginBottom: 12 }, riskTimelineRow: { flexDirection: "row", alignItems: "stretch", gap: 10 }, riskRail: { width: 28, alignItems: "center" }, riskLine: { flex: 1, width: 2, backgroundColor: "#d9d3e9", marginVertical: 2 }, riskDotGreen: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#32aa3d", color: "#fff", textAlign: "center", lineHeight: 24, overflow: "hidden", fontWeight: "900" }, riskDotAmber: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#f1a90d", color: "#fff", textAlign: "center", lineHeight: 24, overflow: "hidden", fontWeight: "900" }, riskDotRed: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#ee562f", color: "#fff", textAlign: "center", lineHeight: 24, overflow: "hidden", fontWeight: "900" }, riskDotPurple: { width: 24, height: 24, borderRadius: 12, backgroundColor: PURPLE, color: "#fff", textAlign: "center", lineHeight: 24, overflow: "hidden", fontWeight: "900" }, timelineDate: { width: 52, color: DEEP, fontWeight: "800", fontSize: 11, paddingTop: 6 }, timelineCard: { flex: 1, padding: 13 },
  scoreBarRow: { marginTop: 14 }, scoreBarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }, scoreBarTrack: { height: 10, borderRadius: 99, backgroundColor: "#eee8f7", overflow: "hidden" }, scoreBarFill: { height: 10, borderRadius: 99 },
  barChart: { height: 150, flexDirection: "row", alignItems: "flex-end", gap: 10, paddingTop: 18 }, barColumn: { flex: 1, height: 130, justifyContent: "flex-end", alignItems: "center" }, barFill: { width: "100%", minHeight: 8, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: PURPLE }, barLabel: { color: MUTED, fontSize: 10, marginTop: 7, fontWeight: "700" },

});
