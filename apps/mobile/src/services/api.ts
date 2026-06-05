import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppRole = "resident" | "business" | "circle" | "superadmin";

const hostUri = Constants.expoConfig?.hostUri || "";
const localHost = hostUri.includes(":") ? hostUri.split(":")[0] : "localhost";
const defaultBaseUrl = localHost === "localhost" ? "http://localhost:4187" : `http://${localHost}:4187`;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  defaultBaseUrl ||
  "http://10.0.2.2:4187";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem("authToken");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Request failed");
  return json;
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
