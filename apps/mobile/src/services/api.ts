import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppRole = "resident" | "business" | "circle" | "superadmin";

const hostUri = Constants.expoConfig?.hostUri || "";
const localHost = hostUri.includes(":") ? hostUri.split(":")[0] : "localhost";
const defaultBaseUrl = localHost === "localhost" ? "" : `http://${localHost}:4187`;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  defaultBaseUrl;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("API base URL is not configured");
  const token = await AsyncStorage.getItem("authToken");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Request failed");
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export function patch(path: string, body: unknown) {
  return api(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function post(path: string, body: unknown = {}) {
  return api(path, { method: "POST", body: JSON.stringify(body) });
}

export async function saveAuthToken(token: string) {
  await AsyncStorage.setItem("authToken", token);
}
