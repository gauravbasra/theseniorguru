import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppRole } from "./api";

export async function initLocalDb() {
  await AsyncStorage.getItem("safety_events");
}

export async function saveRole(role: AppRole) {
  await AsyncStorage.setItem("role", role);
}

export async function loadRole(): Promise<AppRole | null> {
  return (await AsyncStorage.getItem("role")) as AppRole | null;
}

export async function saveCirclePerson(personId: string) {
  await AsyncStorage.setItem("circlePersonId", personId);
}

export async function loadCirclePerson() {
  return AsyncStorage.getItem("circlePersonId");
}

export function cacheSafetyEvent(event: { id: string; type: string; severity: string; body: string; createdAt: string }) {
  AsyncStorage.getItem("safety_events")
    .then(raw => {
      const events = raw ? JSON.parse(raw) : [];
      const next = [event, ...events.filter((item: any) => item.id !== event.id)].slice(0, 50);
      return AsyncStorage.setItem("safety_events", JSON.stringify(next));
    })
    .catch(() => undefined);
}
