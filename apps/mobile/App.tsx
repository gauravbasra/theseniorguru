import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { api, AppRole, patch, post, saveAuthToken } from "./src/services/api";
import { initLocalDb, loadCirclePerson, loadRole, saveCirclePerson, saveRole } from "./src/services/localStore";
import { addSafeZone, requestSafetyPermissions, getNativeHealthDiagnostics, setHealthConsent, simulateSafetyEvent, startSafetyMonitoring, syncHealthVitals, syncNativeHealthVitals, syncWearableTelemetry, triggerVoiceSos } from "./src/services/safety";
import seedState from "./src/seedState";
import { colors, radius } from "./src/theme/tokens";

type Screen =
  | "role"
  | "residentOnboarding"
  | "residentHome"
  | "residentHelp"
  | "residentPeople"
  | "residentFeed"
  | "residentServices"
  | "residentSafety"
  | "notifications"
  | "sosEvents"
  | "businessOnboarding"
  | "businessHome"
  | "businessLeads"
  | "businessServices"
  | "businessPackage"
  | "circleInvite"
  | "circleSafety"
  | "circleAssist"
  | "circlePermissions"
  | "superadminHome"
  | "superadminAudit";

const residentTabs: [Screen, string][] = [["residentHome", "Today"], ["residentHelp", "Help"], ["residentPeople", "Companion"], ["residentFeed", "Feed"], ["residentServices", "More"]];
const businessTabs: [Screen, string][] = [["businessHome", "Dashboard"], ["businessLeads", "Leads"], ["businessServices", "Services"], ["businessPackage", "Package"]];
const circleTabs: [Screen, string][] = [["circleSafety", "Safety"], ["circleAssist", "Assist"], ["circlePermissions", "Access"]];
const superadminTabs: [Screen, string][] = [["superadminHome", "Approvals"], ["superadminAudit", "Audit"]];

const devEmails: Record<AppRole, string> = {
  resident: "anita@theseniorguru.local",
  business: "rohit@careride.local",
  circle: "rita@theseniorguru.local",
  superadmin: "admin@theseniorguru.local"
};

function cloneSeedState() {
  return JSON.parse(JSON.stringify(seedState));
}

function fallbackCircleView(appState: any, personId: string) {
  const person = appState.people?.find((item: any) => item.id === personId) || appState.people?.[0] || { id: "rita", name: "Rita Sharma", permissions: ["safety", "sos", "medications", "rides", "messages", "wellness"] };
  const permissions = new Set(person.permissions || []);
  return {
    person,
    resident: {
      name: appState.resident?.name || "Anita Sharma",
      community: appState.resident?.community || "Park View Community",
      mood: permissions.has("wellness") ? appState.resident?.mood || "Okay" : "Hidden"
    },
    permissions: person.permissions || [],
    medications: permissions.has("medications") ? appState.medications || [] : [],
    bookings: permissions.has("rides") ? appState.bookings || [] : [],
    requests: permissions.has("rides") ? appState.requests || [] : [],
    messages: permissions.has("messages") ? (appState.messages || []).slice(0, 5) : [],
    sosContacts: permissions.has("sos") ? appState.resident?.sosContacts || [] : [],
    safety: permissions.has("safety") || permissions.has("sos") ? appState.safety : null,
    healthVitals: permissions.has("wellness") || permissions.has("safety") ? appState.healthVitals : null,
    wearables: permissions.has("safety") || permissions.has("sos") ? appState.wearables : null,
    notifications: permissions.has("sos") || permissions.has("safety") ? (appState.notificationQueue || []).filter((item: any) => item.personId === person.id).slice(0, 20) : [],
    tasks: (appState.circleTasks || []).filter((task: any) => task.assignedTo === person.id)
  };
}

export default function App() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [screen, setScreen] = useState<Screen>("role");
  const [state, setState] = useState<any>(null);
  const [circleState, setCircleState] = useState<any>(null);
  const [circlePersonId, setCirclePersonId] = useState("rita");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const personId = (await loadCirclePerson()) || circlePersonId;
    try {
      const nextState = await api<any>("/api/state");
      setState(nextState);
      setCirclePersonId(personId);
      setCircleState(await api(`/api/circle?personId=${personId}`));
      return nextState;
    } catch {
      const fallbackState = state || cloneSeedState();
      setState(fallbackState);
      setCirclePersonId(personId);
      setCircleState(fallbackCircleView(fallbackState, personId));
      return fallbackState;
    }
  }

  useEffect(() => {
    let stopSafety: undefined | (() => void);
    async function boot() {
      let savedRole: AppRole | null = null;
      let nextState = cloneSeedState();
      try {
        await initLocalDb();
        savedRole = null;
        if (savedRole) await ensureDevSession(savedRole);
        nextState = await refresh();
      } catch {
        setState(nextState);
        setCircleState(fallbackCircleView(nextState, circlePersonId));
      } finally {
        setRole(savedRole);
        if (!savedRole) setScreen("role");
        if (savedRole === "resident") setScreen(nextState.resident.onboardingComplete ? "residentHome" : "residentOnboarding");
        if (savedRole === "business") setScreen(nextState.business.onboardingComplete ? "businessHome" : "businessOnboarding");
        if (savedRole === "circle") setScreen((await loadCirclePerson()) ? "circleSafety" : "circleInvite");
        if (savedRole === "superadmin") setScreen("superadminHome");
        setLoading(false);
      }
      try {
        await requestSafetyPermissions();
        stopSafety = await startSafetyMonitoring();
      } catch {
        // The simulator path still works if a local device does not grant native permissions.
      }
    }
    boot();
    return () => stopSafety?.();
  }, []);

  async function chooseRole(nextRole: AppRole) {
    await ensureDevSession(nextRole);
    await saveRole(nextRole);
    const currentState = state || cloneSeedState();
    if (!state) setState(currentState);
    setRole(nextRole);
    if (nextRole === "resident") setScreen(currentState.resident.onboardingComplete ? "residentHome" : "residentOnboarding");
    if (nextRole === "business") setScreen(currentState.business.onboardingComplete ? "businessHome" : "businessOnboarding");
    if (nextRole === "circle") setScreen("circleInvite");
    if (nextRole === "superadmin") setScreen("superadminHome");
  }

  async function ensureDevSession(nextRole: AppRole) {
    try {
      const session: any = await api("/api/auth/dev-session", { method: "POST", body: JSON.stringify({ email: devEmails[nextRole] }) });
      if (session.token) await saveAuthToken(session.token);
    } catch {
      // JSON demo mode does not expose auth; production DB mode does.
    }
  }

  if (loading || !state) {
    return <SafeAreaProvider><SafeAreaView style={styles.center}><ActivityIndicator color={colors.purple} /><Text style={styles.copy}>Starting TheSeniorguru...</Text></SafeAreaView></SafeAreaProvider>;
  }

  const activeTabs =
    role === "resident" && screen !== "role" && screen !== "residentOnboarding" ? residentTabs :
    role === "business" && screen !== "role" && screen !== "businessOnboarding" ? businessTabs :
    role === "circle" && screen !== "role" && screen !== "circleInvite" ? circleTabs :
    role === "superadmin" && screen !== "role" ? superadminTabs :
    null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <View style={styles.appShell}>
          <ScrollView key={screen} contentContainerStyle={[styles.page, activeTabs && styles.pageWithBottomNav]}>
            <Header role={role} onOpenNotifications={() => setScreen("notifications")} onOpenSos={() => setScreen("sosEvents")} />
            {screen === "role" && <RoleScreen onChoose={chooseRole} />}
            {screen === "residentOnboarding" && <ResidentOnboarding state={state} onDone={async () => { await refresh(); setScreen("residentHome"); }} />}
            {screen === "residentHome" && <ResidentHome state={state} onRefresh={refresh} />}
            {screen === "residentHelp" && <ResidentHelp state={state} onRefresh={refresh} />}
            {screen === "residentPeople" && <ResidentPeople state={state} />}
            {screen === "residentFeed" && <ResidentFeed />}
            {screen === "residentServices" && <ResidentServices state={state} onRefresh={refresh} />}
            {screen === "residentSafety" && <ResidentSafety state={state} onRefresh={refresh} />}
            {screen === "notifications" && <NotificationsPage state={state} circleState={circleState} onRefresh={refresh} />}
            {screen === "sosEvents" && <SosEventsPage state={state} circleState={circleState} circlePersonId={circlePersonId} onRefresh={refresh} />}
            {screen === "businessOnboarding" && <BusinessOnboarding state={state} onDone={async () => { await refresh(); setScreen("businessHome"); }} />}
            {screen === "businessHome" && <BusinessHome state={state} />}
            {screen === "businessLeads" && <BusinessLeads state={state} onRefresh={refresh} />}
            {screen === "businessServices" && <BusinessServices state={state} onRefresh={refresh} />}
            {screen === "businessPackage" && <BusinessPackage state={state} onRefresh={refresh} />}
            {screen === "circleInvite" && <CircleInvite onAccepted={async personId => { await saveCirclePerson(personId); setCirclePersonId(personId); await refresh(); setScreen("circleSafety"); }} />}
            {screen === "circleSafety" && <CircleSafety circleState={circleState} onRefresh={refresh} />}
            {screen === "circleAssist" && <CircleAssist circleState={circleState} personId={circlePersonId} onRefresh={refresh} />}
            {screen === "circlePermissions" && <CirclePermissions state={state} circlePersonId={circlePersonId} onPick={async personId => { await saveCirclePerson(personId); setCirclePersonId(personId); await refresh(); }} />}
            {screen === "superadminHome" && <SuperadminHome />}
            {screen === "superadminAudit" && <SuperadminAudit />}
            {role && <Pressable style={styles.secondaryButton} onPress={() => setScreen("role")}><Text style={styles.secondaryText}>Change role</Text></Pressable>}
          </ScrollView>
          {activeTabs && <Tabs tabs={activeTabs} active={screen} onChange={setScreen} />}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Header({ role, onOpenNotifications, onOpenSos }: { role: AppRole | null; onOpenNotifications: () => void; onOpenSos: () => void }) {
  const showNotifications = role === "resident" || role === "circle" || role === "business" || role === "superadmin";
  const showSos = role === "resident" || role === "circle";
  return (
    <View style={styles.header}>
      <View style={styles.logoMark}><Text style={styles.logoHeart}>♡</Text><Text style={styles.logoDotOne}>●</Text><Text style={styles.logoDotTwo}>●</Text></View>
      <View style={styles.headerText}>
        <Text style={styles.brand}>TheSeniorguru</Text>
        <Text style={styles.brandSub}>Your day. Your people. Your support.</Text>
      </View>
      {showNotifications ? <View style={styles.headerActions}>
        <Pressable hitSlop={10} style={styles.topIconButton} onPress={onOpenNotifications}><Text style={styles.topIconText}>🔔</Text></Pressable>
        {showSos ? <Pressable hitSlop={10} style={[styles.topIconButton, styles.sosIconButton]} onPress={onOpenSos}><Text style={styles.topIconText}>SOS</Text></Pressable> : null}
      </View> : null}
    </View>
  );
}

function Tabs({ tabs, active, onChange }: { tabs: [Screen, string][]; active: Screen; onChange: (screen: Screen) => void }) {
  return <View style={styles.bottomNav}>{tabs.map(([value, label]) => <Pressable key={value} style={styles.bottomItem} onPress={() => onChange(value)}><Text style={[styles.bottomIcon, active === value && styles.bottomIconActive]}>{navIcon(label)}</Text><Text style={[styles.bottomText, active === value && styles.bottomTextActive]}>{label}</Text></Pressable>)}</View>;
}

function navIcon(label: string) {
  if (label === "Today" || label === "Dashboard" || label === "Approvals") return "⌂";
  if (label === "Help" || label === "Assist") return "⌕";
  if (label === "People" || label === "Companion" || label === "Access") return "♙";
  if (label === "Feed") return "▣";
  if (label === "More") return "☰";
  if (label === "Services") return "▣";
  if (label === "Safety") return "🛡";
  if (label === "Leads") return "☷";
  if (label === "Package") return "$";
  return "•";
}

function RoleScreen({ onChoose }: { onChoose: (role: AppRole) => void }) {
  return (
    <View>
      <View style={styles.heroIntro}>
        <Text style={styles.h1}>How will you use TheSeniorguru?</Text>
        <Text style={styles.copy}>Choose the right app experience after download.</Text>
      </View>
      <RoleCard title="I am a senior" body="Daily support, reminders, companionship, rides, services, safety, and community." onPress={() => onChoose("resident")} />
      <RoleCard title="I am a business" body="Offer services to seniors, define areas served, plans, leads, and packages." onPress={() => onChoose("business")} />
      <RoleCard title="I am a trusted person" body="Use an invite code to monitor and help a senior with limited access." onPress={() => onChoose("circle")} />
    </View>
  );
}

function RoleCard({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return <Pressable style={styles.roleCard} onPress={onPress}><View style={styles.roleIcon}><Text style={styles.roleIconText}>{title.includes("senior") ? "☀" : title.includes("business") ? "▣" : title.includes("trusted") ? "♡" : "★"}</Text></View><View style={styles.roleCopy}><Text style={styles.h2}>{title}</Text><Text style={styles.copy}>{body}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

function ResidentOnboarding({ state, onDone }: { state: any; onDone: () => void }) {
  const [name, setName] = useState(state.resident.name);
  const [age, setAge] = useState(String(state.resident.age));
  const [community, setCommunity] = useState(state.resident.community);
  const [sosContacts, setSosContacts] = useState(state.resident.sosContacts.join(", "));
  const profile = state.resident.healthProfile || {};
  const primaryCondition = profile.primaryCondition || {};
  const allergyProfile = profile.allergyProfile || {};
  const mobilityProfile = profile.mobilityProfile || {};
  const memoryProfile = profile.memoryProfile || {};
  const carePreferences = profile.carePreferences || {};
  const [conditionName, setConditionName] = useState(primaryCondition.name || "High blood pressure");
  const [conditionStatus, setConditionStatus] = useState(primaryCondition.status || "Active and monitored");
  const [conditionSeverity, setConditionSeverity] = useState(primaryCondition.severity || "Moderate");
  const [diagnosedWhen, setDiagnosedWhen] = useState(primaryCondition.diagnosedWhen || "Several years ago");
  const [symptomsToWatch, setSymptomsToWatch] = useState((primaryCondition.symptomsToWatch || ["Dizziness", "Shortness of breath", "Chest discomfort"]).join(", "));
  const [careTeamNotes, setCareTeamNotes] = useState(primaryCondition.careTeamNotes || "Please speak calmly and confirm symptoms before escalating.");
  const [allergen, setAllergen] = useState(allergyProfile.allergen || "None known");
  const [allergyReaction, setAllergyReaction] = useState(allergyProfile.reaction || "No reaction reported");
  const [allergySeverity, setAllergySeverity] = useState(allergyProfile.severity || "None");
  const [allergyInstructions, setAllergyInstructions] = useState(allergyProfile.instructions || "If a new rash, swelling, or breathing issue appears, contact trusted circle and clinician.");
  const [assistiveDevice, setAssistiveDevice] = useState(mobilityProfile.assistiveDevice || "None at home, cane outdoors");
  const [fallHistory, setFallHistory] = useState(mobilityProfile.fallHistory || "No fall in last 90 days");
  const [transferSupport, setTransferSupport] = useState(mobilityProfile.transferSupport || "Can stand and sit independently");
  const [walkingTolerance, setWalkingTolerance] = useState(mobilityProfile.walkingTolerance || "Short community walks with rest breaks");
  const [homeRiskAreas, setHomeRiskAreas] = useState((mobilityProfile.homeRiskAreas || ["Bathroom", "Front steps", "Night hallway"]).join(", "));
  const [wanderingRisk, setWanderingRisk] = useState(memoryProfile.wanderingRisk || "Low, monitor at night");
  const [confusionTriggers, setConfusionTriggers] = useState((memoryProfile.confusionTriggers || ["Missed sleep", "New places", "Medication changes"]).join(", "));
  const [reassuranceStyle, setReassuranceStyle] = useState(memoryProfile.reassuranceStyle || "Use Anita's name, explain slowly, offer one choice at a time.");
  const [routineAnchors, setRoutineAnchors] = useState((memoryProfile.routineAnchors || ["Morning tea", "Medication after breakfast", "Evening call with Rita"]).join(", "));
  const [preferredHospital, setPreferredHospital] = useState(carePreferences.preferredHospital || "City Care Hospital");
  const [emergencyInstructions, setEmergencyInstructions] = useState(carePreferences.emergencyInstructions || "Call 911 for chest pain, severe breathing difficulty, suspected stroke, fall with injury, or unresponsiveness.");
  const firstMed = state.medications?.[0] || {};
  const [medName, setMedName] = useState(firstMed.name || "Lisinopril");
  const [medCondition, setMedCondition] = useState(firstMed.condition || "Blood Pressure");
  const [medStrength, setMedStrength] = useState(firstMed.strength || "10mg");
  const [doseQuantity, setDoseQuantity] = useState(String(firstMed.doseQuantity || 1));
  const [medTime, setMedTime] = useState(firstMed.time || "8:00 AM");
  const [frequency, setFrequency] = useState(firstMed.frequency || "Once daily");
  const [remaining, setRemaining] = useState(String(firstMed.remaining ?? 30));
  const [refillThreshold, setRefillThreshold] = useState(String(firstMed.refillThreshold ?? 5));
  const [prescriber, setPrescriber] = useState(firstMed.prescriber || "Dr. Mehta");
  const [pharmacy, setPharmacy] = useState(firstMed.pharmacy || "HealthPlus Pharmacy");

  async function complete() {
    await post("/api/resident/health-onboarding", {
      name,
      age,
      community,
      sosContacts,
      healthProfile: {
        primaryCondition: {
          name: conditionName,
          status: conditionStatus,
          severity: conditionSeverity,
          diagnosedWhen,
          symptomsToWatch: symptomsToWatch.split(",").map(item => item.trim()).filter(Boolean),
          careTeamNotes
        },
        allergyProfile: {
          allergen,
          reaction: allergyReaction,
          severity: allergySeverity,
          instructions: allergyInstructions
        },
        mobilityProfile: {
          assistiveDevice,
          fallHistory,
          transferSupport,
          walkingTolerance,
          homeRiskAreas: homeRiskAreas.split(",").map(item => item.trim()).filter(Boolean)
        },
        memoryProfile: {
          wanderingRisk,
          confusionTriggers: confusionTriggers.split(",").map(item => item.trim()).filter(Boolean),
          reassuranceStyle,
          routineAnchors: routineAnchors.split(",").map(item => item.trim()).filter(Boolean)
        },
        carePreferences: {
          preferredHospital,
          emergencyInstructions
        }
      },
      medications: [{
        id: firstMed.id,
        name: medName,
        condition: medCondition,
        strength: medStrength,
        doseQuantity: Number(doseQuantity),
        time: medTime,
        frequency,
        remaining: Number(remaining),
        refillThreshold: Number(refillThreshold),
        prescriber,
        pharmacy
      }]
    });
    await post("/api/resident/complete");
    await onDone();
  }

  return <View>
    <Text style={styles.flowLabel}>Flow 1 · Onboarding</Text>
    <Card title="Welcome to TheSeniorGuru">
      <RemoteImage uri="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=520&h=360&fit=crop&crop=faces" style={styles.onboardingHeroImage} />
      <Text style={styles.copy}>Support, companionship and care, all in one place.</Text>
      <PrimaryButton label="Create Account" onPress={() => Alert.alert("Onboarding", "Continue to profile details below.")} />
      <Text style={styles.centerLink}>Sign In</Text>
    </Card>
    <Card title="Tell us about you">
      <Text style={styles.copy}>So we can personalize your experience.</Text>
      <Field label="Full name" value={name} onChangeText={setName} />
      <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
      <Field label="Community" value={community} onChangeText={setCommunity} />
      <Field label="Medical preferences" value={conditionName} onChangeText={setConditionName} />
    </Card>
    <Card title="Add your trusted circle">
      <Text style={styles.copy}>People you trust, always just a tap away.</Text>
      {["Add Daughter · Rita Sharma", "Add Son · Arjun Sharma", "Add Friend · Susan Patel", "Add Caregiver · Meena Joshi"].map(item => <CompactRow key={item} title={item} action="+" />)}
    </Card>
    <Card title="Set up for your safety">
      <Text style={styles.copy}>We’ll be there when you need us most.</Text>
      <CompactRow title="SOS Contacts" subtitle={sosContacts} action="›" />
      <CompactRow title="Medical Information" subtitle={`${conditionName}, ${allergen}`} action="›" />
      <CompactRow title="Preferred Hospital" subtitle={preferredHospital} action="›" />
    </Card>
    <Card title="Health profile" icon="♡" tint="peach"><Text style={styles.copy}>We ask these gently so support can feel personal, safe, and respectful.</Text><Field label="Current status" value={conditionStatus} onChangeText={setConditionStatus} /><Field label="Severity / support level" value={conditionSeverity} onChangeText={setConditionSeverity} /><Field label="When was this diagnosed?" value={diagnosedWhen} onChangeText={setDiagnosedWhen} /><Field label="Symptoms trusted people should watch for" value={symptomsToWatch} onChangeText={setSymptomsToWatch} multiline /><Field label="How should caregivers respond?" value={careTeamNotes} onChangeText={setCareTeamNotes} multiline /><SectionTitle title="Allergies and reactions" /><Field label="Allergen" value={allergen} onChangeText={setAllergen} /><Field label="Reaction" value={allergyReaction} onChangeText={setAllergyReaction} /><Field label="Severity" value={allergySeverity} onChangeText={setAllergySeverity} /><Field label="Emergency allergy instructions" value={allergyInstructions} onChangeText={setAllergyInstructions} multiline /><SectionTitle title="Mobility and memory support" /><Field label="Assistive device" value={assistiveDevice} onChangeText={setAssistiveDevice} /><Field label="Recent fall history" value={fallHistory} onChangeText={setFallHistory} /><Field label="Standing, sitting, transfer support" value={transferSupport} onChangeText={setTransferSupport} /><Field label="Wandering risk" value={wanderingRisk} onChangeText={setWanderingRisk} /><Field label="Best reassurance style" value={reassuranceStyle} onChangeText={setReassuranceStyle} multiline /><Field label="When should we escalate immediately?" value={emergencyInstructions} onChangeText={setEmergencyInstructions} multiline /></Card>
    <Card title="Medication inventory" icon="💊" tint="orange"><Text style={styles.copy}>Add at least one medication with dose, timing, quantity, and refill threshold before reminders start.</Text><Field label="Medication name" value={medName} onChangeText={setMedName} /><Field label="Used for / condition" value={medCondition} onChangeText={setMedCondition} /><Field label="Strength / power" value={medStrength} onChangeText={setMedStrength} /><Field label="Dose quantity" value={doseQuantity} onChangeText={setDoseQuantity} keyboardType="number-pad" /><Field label="Time to take" value={medTime} onChangeText={setMedTime} /><Field label="Frequency" value={frequency} onChangeText={setFrequency} /><Field label="Pills/tablets remaining" value={remaining} onChangeText={setRemaining} keyboardType="number-pad" /><Field label="Refill alert when remaining reaches" value={refillThreshold} onChangeText={setRefillThreshold} keyboardType="number-pad" /><Field label="Prescribing doctor" value={prescriber} onChangeText={setPrescriber} /><Field label="Preferred pharmacy" value={pharmacy} onChangeText={setPharmacy} /><PrimaryButton label="Finish setup" onPress={complete} /></Card>
  </View>;
}

function ResidentHome({ state, onRefresh }: { state: any; onRefresh: () => void }) {
  const pendingMedication = state.medications.find((med: any) => med.status !== "taken");
  const due = pendingMedication || state.medications[0];
  const allTaken = !pendingMedication;
  async function confirmMed() {
    if (allTaken) return;
    await post("/api/medications/confirm", { id: due.id });
    await onRefresh();
  }
  async function respondToCall(request: any, status: "accepted" | "declined") {
    await post(`/api/resident/call-requests/${request.id}/respond`, { status, message: status === "accepted" ? "I can talk now." : "Please message me instead." });
    await onRefresh();
    Alert.alert("Trusted circle", `Call request ${status}.`);
  }
  async function replyToTrusted(message: any) {
    await post("/api/resident/circle-message", { trustedUserId: message.trusted_user_id, body: "Thank you, I am okay." });
    await onRefresh();
    Alert.alert("Trusted circle", "Reply sent.");
  }
  const latestTrustedMessage = (state.circleMessages || [])[0];
  const pendingCall = (state.circleCallRequests || []).find((request: any) => request.status === "requested");
  return (
    <View>
      <TopPhoneBar />
      <View style={styles.screenTopRow}>
        <View>
          <Text style={styles.eyebrow}>Good morning,</Text>
          <Text style={styles.h1}>{state.resident.name.split(" ")[0]} 👋</Text>
        </View>
        <RemoteImage uri="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&h=160&fit=crop&crop=faces" style={styles.profilePhoto} />
      </View>
      <Pressable style={styles.referenceMedicationCard} onPress={confirmMed}>
        <View style={styles.smallIllustration}><Text style={styles.softIconText}>💊</Text></View>
        <View style={styles.referenceMedicationCopy}>
          <Text style={styles.actionTitle}>Medication due now</Text>
          <Text style={styles.muted}>{due.time || "8:00 AM"} · {due.doseQuantity || 1} tablet</Text>
        </View>
        <Text style={styles.referenceTiny}>{allTaken ? "Taken" : `${due.remaining} left`}</Text>
      </Pressable>
      <PrimaryButton label={allTaken ? "I've taken it" : "I've taken it"} onPress={confirmMed} disabled={allTaken} />
      <SectionTitle title="Next up" />
      <ImageActionCard image="https://images.unsplash.com/photo-1549924231-f129b911e442?w=300&h=220&fit=crop" title="Ride to Cardiology Appointment" subtitle="Tomorrow, 10:00 AM" button="Open" onPress={() => Alert.alert("Ride", "Opening ride details")} />
      <SectionTitle title="A little connection" />
      <ImageActionCard image="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=220&h=220&fit=crop&crop=faces" title="Message from Rita" subtitle="Good morning Anita ☀" button="Call" onPress={() => Alert.alert("Call", "Calling Rita")} />
      <Card title="Trusted circle requests" icon="♡">
        {pendingCall ? <View style={styles.eventRow}><Text style={styles.body}>{pendingCall.trusted_name || "Trusted person"} requested a {pendingCall.channel} call</Text><Text style={styles.muted}>{pendingCall.message || "Would like to connect."}</Text><ButtonRow labels={[["Accept", "accepted"], ["Decline", "declined"]]} onPress={(value: "accepted" | "declined") => respondToCall(pendingCall, value)} /></View> : <Text style={styles.muted}>No pending call requests.</Text>}
        {latestTrustedMessage ? <View style={styles.eventRow}><Text style={styles.body}>Latest message from {latestTrustedMessage.trusted_name || "trusted circle"}</Text><Text style={styles.muted}>{latestTrustedMessage.body}</Text><PrimaryButton label="Reply I'm okay" onPress={() => replyToTrusted(latestTrustedMessage)} /></View> : null}
      </Card>
      <SectionTitle title="Today’s activity" />
      <ImageFeatureCard image="https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=420&h=280&fit=crop" title="Morning Stretch with Meena" subtitle="10:30 AM · Clubhouse" />
      <SectionTitle title="Wellness snapshot" />
      <View style={styles.wellnessGrid}>
        <RingMetric label="Sleep" value="7h 10m" percent={76} color="#6a3f7a" />
        <RingMetric label="Steps" value="3,842" percent={64} color="#e28a20" />
        <RingMetric label="Meals" value="1,640 cal" percent={82} color="#3f8c55" />
      </View>
      <SectionTitle title="Medication" />
      <MedicationMiniFlow medication={due} refillRequests={state.refillRequests || []} onConfirm={confirmMed} onRefresh={onRefresh} allTaken={allTaken} />
      <Pressable style={styles.sosButton}><Text style={styles.sosBig}>SOS</Text><Text style={styles.sosText}>Emergency help</Text></Pressable>
    </View>
  );
}

function ResidentHelp({ state, onRefresh }: { state: any; onRefresh: () => void }) {
  const [need, setNeed] = useState("I need a ride to my doctor tomorrow.");
  const [pickup, setPickup] = useState("Park View Community");
  const [dropoff, setDropoff] = useState("City Care Hospital");
  const [pickupPoint, setPickupPoint] = useState<any>({ label: "Park View Community", lat: 43.1001, lng: -79.1001 });
  const [dropoffPoint, setDropoffPoint] = useState<any>({ label: "City Care Hospital", lat: 43.1189, lng: -79.1252 });
  const [pickupSuggestions, setPickupSuggestions] = useState<any[]>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<any[]>([]);
  const [validationSummary, setValidationSummary] = useState("");
  const [fulfillmentMode, setFulfillmentMode] = useState("uber_health");
  const [matches, setMatches] = useState<any[]>([]);
  async function findMatches() {
    const result: any = await post("/api/help/match", { need });
    setMatches(result.matches);
  }
  async function book(serviceId: string) {
    await post("/api/bookings", {
      serviceId,
      label: need,
      time: "Tomorrow, 10:00 AM",
      fulfillmentMode,
      pickup: pickupPoint,
      dropoff: dropoffPoint
    });
    await onRefresh();
    Alert.alert("TheSeniorguru", "Request sent and booking created.");
  }
  async function searchPlaces(kind: "pickup" | "dropoff", input: string) {
    const result: any = await post("/api/places/autocomplete", { input });
    if (kind === "pickup") setPickupSuggestions(result.predictions || []);
    else setDropoffSuggestions(result.predictions || []);
  }
  async function choosePlace(kind: "pickup" | "dropoff", prediction: any) {
    const result: any = await post("/api/places/details", { placeId: prediction.placeId });
    const point = { label: result.place.formattedAddress || prediction.description, lat: result.place.lat, lng: result.place.lng, placeId: prediction.placeId };
    if (kind === "pickup") {
      setPickup(point.label);
      setPickupPoint(point);
      setPickupSuggestions([]);
    } else {
      setDropoff(point.label);
      setDropoffPoint(point);
      setDropoffSuggestions([]);
    }
  }
  async function validateAddresses() {
    const pickupValidation: any = await post("/api/address/validate", { address: pickup });
    const dropoffValidation: any = await post("/api/address/validate", { address: dropoff });
    setValidationSummary(`Pickup ${pickupValidation.addressComplete ? "verified" : "needs review"} · Drop-off ${dropoffValidation.addressComplete ? "verified" : "needs review"}`);
  }
  const visible = matches.length ? matches : state.services.slice(0, 3);
  return (
    <View>
      <TopPhoneBar />
      <Text style={styles.h1}>How can we help you today?</Text>
      <View style={styles.searchPill}><TextInput value={need} onChangeText={setNeed} style={styles.searchInput} placeholder="What do you need today?" /><Text style={styles.mic}>🎙</Text></View>
      <Card title="Ride details" icon="🚙" tint="peach">
        <Field label="Pickup" value={pickup} onChangeText={(value: string) => { setPickup(value); setPickupPoint({ label: value, lat: pickupPoint.lat, lng: pickupPoint.lng }); }} />
        <PrimaryButton label="Search pickup address" onPress={() => searchPlaces("pickup", pickup)} />
        {pickupSuggestions.map(item => <Pressable key={item.placeId} style={styles.suggestionRow} onPress={() => choosePlace("pickup", item)}><Text style={styles.body}>{item.primaryText}</Text><Text style={styles.muted}>{item.secondaryText}</Text></Pressable>)}
        <Field label="Drop-off" value={dropoff} onChangeText={(value: string) => { setDropoff(value); setDropoffPoint({ label: value, lat: dropoffPoint.lat, lng: dropoffPoint.lng }); }} />
        <PrimaryButton label="Search drop-off address" onPress={() => searchPlaces("dropoff", dropoff)} />
        {dropoffSuggestions.map(item => <Pressable key={item.placeId} style={styles.suggestionRow} onPress={() => choosePlace("dropoff", item)}><Text style={styles.body}>{item.primaryText}</Text><Text style={styles.muted}>{item.secondaryText}</Text></Pressable>)}
        <PrimaryButton label="Validate ride addresses" onPress={validateAddresses} />
        {validationSummary ? <Text style={styles.safeText}>{validationSummary}</Text> : null}
        <Text style={styles.muted}>Google Places powers suggestions; Google Address Validation checks whether pickup/drop-off need review.</Text>
      </Card>
      <Card title="Ride fulfillment" icon="🧭">
        <Text style={styles.muted}>TheSeniorguru coordinates rides. Uber Health is preferred when configured; local senior transport is fallback.</Text>
        <ButtonRow labels={[["Uber Health", "uber_health"], ["Local partner", "local_partner"], ["Manual", "manual_coordination"]]} onPress={setFulfillmentMode} />
        <Text style={styles.safeText}>Selected: {fulfillmentMode.replace("_", " ")}</Text>
      </Card>
      <SectionTitle title="Popular requests" />
      {["I need a ride", "I need medication help", "I need food", "I need cleaning", "I need diapers", "Feeling lonely"].map(item => <ActionCard key={item} icon={item.includes("ride") ? "🚙" : item.includes("med") ? "💊" : item.includes("food") ? "🍽" : item.includes("lonely") ? "♡" : "▣"} title={item} subtitle="" button="›" onPress={() => setNeed(item)} />)}
      <Card title="Help Assistant" icon="🤖">
        <ChatBubble align="right" text="I need a ride tomorrow." meta="You · 10:30 AM" />
        <ChatBubble text="Sure, I can help with that. Where would you like to go?" meta="Guru · 10:30 AM" />
        <ChatBubble align="right" text="Doctor appointment." meta="You · 10:31 AM" />
        <ChatBubble text="Great. I found 3 transportation options for you." meta="Guru · 10:31 AM" />
        <PrimaryButton label="Find matches" onPress={findMatches} />
      </Card>
      <SectionTitle title="Matched for you" />
      {visible.map((service: any) => <ServiceCard key={service.id} service={service} onPress={() => book(service.id)} />)}
      <Card title="Request status" icon="🚙">
        <Text style={styles.body}>Ride requested</Text>
        <Text style={styles.muted}>Tomorrow, May 25 · 10:00 AM</Text>
        {["Request received", "Driver assigned", "Driver arriving", "Completed"].map((item, index) => <WellnessRow key={item} label={item} value={index < 2 ? "✓" : "○"} status={index === 0 ? "10:31 AM" : index === 1 ? "10:32 AM" : index === 2 ? "9:45 AM" : "Pending"} />)}
      </Card>
    </View>
  );
}

function ResidentPeople({ state }: { state: any }) {
  return (
    <View>
      <TopPhoneBar />
      <Text style={styles.h1}>Your People</Text>
      <View style={styles.segment}><Text style={styles.segmentActive}>My Circle</Text><Text style={styles.segmentText}>Nearby</Text></View>
      {state.people.map((person: any, index: number) => <PersonRow key={person.id} person={person} image={[
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=220&h=220&fit=crop&crop=faces",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=220&h=220&fit=crop&crop=faces",
        "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=220&h=220&fit=crop&crop=faces",
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=220&h=220&fit=crop&crop=faces"
      ][index % 4]} />)}
      <PrimaryButton label="+ Add to your circle" onPress={() => Alert.alert("Circle", "Opening add person flow")} />
      <Card title="Companion" tint="peach">
        <View style={styles.companionHero}>
          <View>
            <Text style={styles.h2}>Talk with Guru</Text>
            <Text style={styles.copy}>Your AI companion</Text>
          </View>
          <RemoteImage uri="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=260&h=220&fit=crop" style={styles.robotImage} />
        </View>
      </Card>
      <Card title="Chat with Guru">
        <ChatBubble align="right" text="I didn't sleep well last night." meta="You · 8:35 AM" />
        <ChatBubble text="I'm sorry to hear that. Want to talk about what kept you awake?" meta="Guru · 8:35 AM" />
        <ChatBubble align="right" text="Just too many thoughts." meta="You · 8:36 AM" />
        <ChatBubble text="I understand. Take a deep breath with me." meta="Guru · 8:36 AM" />
      </Card>
    </View>
  );
}

function ResidentFeed() {
  return (
    <View>
      <TopPhoneBar />
      <Text style={styles.h1}>Community Feed</Text>
      <View style={styles.segment}><Text style={styles.segmentActive}>For You</Text><Text style={styles.segmentText}>Following</Text><Text style={styles.segmentText}>Local</Text></View>
      <FeedPost name="Meena Sharma" time="2h ago" text="Lovely morning walk with the group 🌿" image="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=520&h=340&fit=crop" />
      <FeedPost name="Park View Community" time="5h ago" text="Join us for a Bhajan Evening this Saturday at 6 PM." image="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=520&h=340&fit=crop" cta="Interested" />
      <Card title="Create Post">
        <View style={styles.postInput}><Text style={styles.muted}>What’s on your mind?</Text></View>
        {["Photo / Video", "Ask a question", "Share update", "Inspire others"].map(item => <WellnessRow key={item} label={item} value="›" status="Anyone in community" />)}
        <PrimaryButton label="Post" onPress={() => Alert.alert("Community", "Creating post")} />
      </Card>
    </View>
  );
}

function ResidentServices({ state, onRefresh }: { state: any; onRefresh: () => void }) {
  async function book(serviceId: string, name: string) {
    await post("/api/bookings", {
      serviceId,
      label: name,
      time: "Tomorrow, 10:00 AM",
      pickup: { label: "Park View Community", lat: 43.1001, lng: -79.1001 },
      dropoff: { label: "City Care Hospital", lat: 43.1189, lng: -79.1252 }
    });
    await onRefresh();
    Alert.alert("TheSeniorguru", "Service booked.");
  }
  return (
    <View>
      <TopPhoneBar />
      <Text style={styles.h1}>Services</Text>
      <View style={styles.searchPill}><Text style={styles.muted}>⌕ Search services...</Text></View>
      <SectionTitle title="AI matched for you" />
      {state.services.slice(0, 3).map((service: any) => <ServiceCard key={service.id} service={service} onPress={() => book(service.id, service.name)} />)}
      <SectionTitle title="Browse categories" />
      <View style={styles.categoryGrid}>{["Transport", "Medications", "Food", "Home Care", "Essentials", "More"].map(cat => <View key={cat} style={styles.category}><Text style={styles.categoryIcon}>{cat === "Transport" ? "🚙" : cat === "Medications" ? "💊" : cat === "Food" ? "🍽" : "▣"}</Text><Text style={styles.categoryText}>{cat}</Text></View>)}</View>
      <SectionTitle title="Events & Activities" />
      <View style={styles.segment}><Text style={styles.segmentActive}>Upcoming</Text><Text style={styles.segmentText}>My Events</Text></View>
      <EventCard title="Chair Yoga" host="with Meena" time="Today, 10:30 AM" image="https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=300&h=260&fit=crop" />
      <EventCard title="Memory Game Challenge" host="Community Room" time="Tomorrow, 4:00 PM" image="https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=300&h=260&fit=crop" />
      <EventCard title="Community Lunch" host="Park View Community" time="Friday, 12:30 PM" image="https://images.unsplash.com/photo-1551218808-94e220e084d2?w=300&h=260&fit=crop" />
      <SectionTitle title="Safety Monitor" />
      <MiniMap safety={state.safety} />
      <VoiceSosCard compact onCommand={async command => {
        await triggerVoiceSos(command);
        await onRefresh();
        Alert.alert("Voice SOS routed", command);
      }} />
    </View>
  );
}

function ResidentSafety({ state, onRefresh }: { state: any; onRefresh: () => void }) {
  const safety = state.safety;
  const health = state.healthVitals?.summary || {};
  const latestHealth = state.healthVitals?.latestSummary || health;
  const consent = state.healthConsent || { granted: false, dataTypes: [], source: null };
  const wearables = state.wearables || { devices: [], proximity: {}, latestSummary: {} };
  const [nativeDiagnostic, setNativeDiagnostic] = useState<any>(null);
  const medTaken = state.medications.filter((med: any) => med.status === "taken").length;
  const medTotal = Math.max(1, state.medications.length);
  async function simulate(kind: "normal" | "wandering" | "fall" | "stillness") {
    await simulateSafetyEvent(kind);
    await onRefresh();
  }
  async function voiceSos(command: string) {
    const result: any = await triggerVoiceSos(command);
    await onRefresh();
    Alert.alert("Voice SOS routed", `${result.sosEvent.command}\n${result.sosEvent.route}`);
  }
  async function syncVitals() {
    const result: any = await syncHealthVitals();
    await onRefresh();
    Alert.alert("Health sync complete", `Risk level: ${result.healthVitals.summary.riskLevel}`);
  }
  async function syncNativeVitals() {
    const result: any = await syncNativeHealthVitals();
    await onRefresh();
    setNativeDiagnostic(result.nativeHealth);
    Alert.alert(result.synced ? "Native health sync complete" : "Native health unavailable", result.synced ? result.nativeHealth.source : (result.nativeHealth.error || "No native health readings available on this device."));
  }
  async function runNativeDiagnostics() {
    const result: any = await getNativeHealthDiagnostics();
    setNativeDiagnostic(result);
    Alert.alert(result.available ? "Native health available" : "Native health unavailable", result.available ? `${result.source}: ${result.readings.length} reading set(s)` : (result.error || "No native health readings available on this device."));
  }
  async function updateHealthConsent(granted: boolean) {
    const result: any = await setHealthConsent(granted);
    await onRefresh();
    Alert.alert("Health consent updated", granted ? `${result.healthConsent.dataTypes.length} data types granted.` : "Health sync permission revoked.");
  }
  async function syncWearables(kind: "normal" | "sos" | "fall" | "away") {
    const result: any = await syncWearableTelemetry(kind);
    await onRefresh();
    Alert.alert("Wearable sync complete", `Risk level: ${result.wearables.latestSummary.riskLevel}`);
  }
  async function addDefaultSafeZone() {
    const result: any = await addSafeZone({ name: "Park View Community", lat: 43.1, lng: -79.1, radiusMeters: 180 });
    await onRefresh();
    Alert.alert("Safe zone saved", `${result.safeZone.name} is now monitored by backend geofencing.`);
  }
  return (
    <View>
      <TopPhoneBar />
      <Text style={styles.h1}>Safety</Text>
      <MiniMap safety={safety} />
      <Card title="Safe zone setup" icon="📍" tint="peach">
        <Text style={styles.muted}>Backend geofencing compares live phone coordinates against approved zones. The app cannot fake inside or outside status.</Text>
        <WellnessRow label="Active zones" value={String(safety.safeZones?.length || 0)} status={safety.safeZones?.[0]?.name || "No zone configured"} />
        <PrimaryButton label="Add Park View safe zone" onPress={addDefaultSafeZone} />
      </Card>
      <SectionTitle title="Wearable safety devices" />
      <Card title="Sync wearable telemetry" icon="⌚">
        <Text style={styles.muted}>Use these mobile actions to test Apple Watch, BLE tag, SOS button, and proximity ingestion.</Text>
        <ButtonRow labels={[["Normal", "normal"], ["SOS press", "sos"], ["Watch fall", "fall"], ["Away", "away"]]} onPress={syncWearables} />
      </Card>
      {(wearables.devices?.length ? wearables.devices : [
        { id: "apple_watch_anita", name: "Apple Watch", status: "connected", batteryPercent: 82, signal: "Fall detection, heart rate, SOS", lastSeenAt: "Live" },
        { id: "home_tag_anita", name: "Home proximity tag", status: "connected", batteryPercent: 64, signal: "Room proximity, night movement, exit alerts", lastSeenAt: "18 sec ago" }
      ]).map((device: any, index: number) => (
        <WearableDeviceCard
          key={device.id}
          name={device.name}
          status={device.status === "connected" ? "Connected" : "Disconnected"}
          battery={`${device.batteryPercent}%`}
          signal={device.signal}
          lastSeen={device.lastSeenAt === "Live" || device.lastSeenAt === "18 sec ago" ? device.lastSeenAt : "Synced"}
          accent={index === 0 ? "#6a3f7a" : "#e28a20"}
        />
      ))}
      <Card title="Wearable risk engine" icon="🛡">
        <WellnessRow label="Connected devices" value={String(wearables.latestSummary?.connectedCount ?? 0)} status="Backend computed" />
        <WellnessRow label="Proximity" value={wearables.proximity?.currentZone || "unknown"} status={wearables.latestSummary?.proximityRisk || "unknown"} />
        <WellnessRow label="Risk level" value={wearables.latestSummary?.riskLevel || "unknown"} status={(wearables.latestSummary?.riskReasons || []).join(", ") || "No wearable risk"} />
      </Card>
      <ProximityBand />
      <Card title="SOS routing" icon="🚨" tint="peach">
        <WellnessRow label="Primary source" value="Watch + phone" status="Cross-checking" />
        <WellnessRow label="Escalation" value="Rita, Arjun, 911" status="Severe only" />
        <WellnessRow label="False alarm guard" value="30 sec confirm" status="Tap to cancel" />
      </Card>
      <VoiceSosCard onCommand={voiceSos} />
      <SectionTitle title="Health analytics" />
      <View style={styles.analyticsGrid}>
        <RingMetric label="Movement" value={safety.movement.status} percent={72} color="#e28a20" />
        <RingMetric label="Sleep" value="7h 10m" percent={76} color="#6a3f7a" />
        <RingMetric label="Food" value="1,640 cal" percent={82} color="#3f8c55" />
        <RingMetric label="Meds" value={`${medTaken}/${medTotal}`} percent={Math.round((medTaken / medTotal) * 100)} color="#d95f4f" />
      </View>
      <SectionTitle title="HealthKit / Health Connect vitals" />
      <Card title="Health data consent" icon="♡">
        <WellnessRow label="Permission" value={consent.granted ? "Granted" : "Not granted"} status={consent.source || "No source selected"} />
        <WellnessRow label="Allowed data" value={String((consent.dataTypes || []).length)} status={(consent.dataTypes || []).join(", ") || "No health data allowed"} />
        <ButtonRow labels={[["Grant Health Sync", true], ["Revoke", false]]} onPress={updateHealthConsent} />
      </Card>
      <Card title="Native health diagnostics" icon="▣">
        <Text style={styles.muted}>Run this on an iOS or Android dev client to verify native HealthKit / Health Connect availability before syncing data.</Text>
        <PrimaryButton label="Run native diagnostics" onPress={runNativeDiagnostics} />
        {nativeDiagnostic ? <View style={styles.eventRow}><Text style={styles.body}>{nativeDiagnostic.source} · {nativeDiagnostic.available ? "available" : "unavailable"}</Text><Text style={styles.muted}>{nativeDiagnostic.error || `${nativeDiagnostic.readings?.length || 0} reading set(s) returned`}</Text>{(nativeDiagnostic.readings || []).slice(0, 1).map((reading: any, index: number) => <Text key={index} style={styles.muted}>HR {metricText(reading.heartRate)} · O2 {metricText(reading.oxygenSaturation)} · RR {metricText(reading.respiratoryRate)} · Steps {metricText(reading.stepsToday)}</Text>)}</View> : null}
      </Card>
      <PrimaryButton label="Sync native HealthKit / Health Connect" onPress={syncNativeVitals} />
      <PrimaryButton label="Use local health sync fallback" onPress={syncVitals} />
      <View style={styles.vitalsGrid}>
        <VitalTile label="Heart rate" value={metricText(health.heartRateAvg)} unit="bpm" status={state.healthVitals?.lastSyncedAt ? "Synced average" : "Not synced"} color="#d95f4f" />
        <VitalTile label="Oxygen" value={metricText(health.oxygenAvg)} unit="%" status={state.healthVitals?.lastSyncedAt ? "Synced SpO2" : "Not synced"} color="#3f8c55" />
        <VitalTile label="Breathing" value={metricText(health.respiratoryRateAvg)} unit="/min" status={state.healthVitals?.lastSyncedAt ? "Synced rhythm" : "Not synced"} color="#6a3f7a" />
        <VitalTile label="HRV" value={metricText(health.hrvAvg)} unit="ms" status={state.healthVitals?.lastSyncedAt ? "Synced recovery" : "Not synced"} color="#e28a20" />
      </View>
      <Card title="Clinical wellness trends" icon="♡" tint="peach">
        <WellnessRow label="Resting heart rate" value={`${metricText(health.heartRateAvg)} bpm`} status="Backend average" />
        <WellnessRow label="Blood oxygen" value={`${metricText(health.oxygenAvg)}%`} status="Backend average" />
        <WellnessRow label="Respiratory rate" value={`${metricText(health.respiratoryRateAvg)}/min`} status="Backend average" />
        <WellnessRow label="Immediate risk" value={latestHealth.riskLevel || "unknown"} status={(latestHealth.riskReasons || []).join(", ") || "No risk reasons"} />
      </Card>
      <Card title="Health data sources" icon="▣">
        <WellnessRow label="iPhone / Apple Watch" value="HealthKit" status="iOS source" />
        <WellnessRow label="Android / Wear OS" value="Health Connect" status="Android source" />
        <WellnessRow label="BLE pendant / tag" value="Proximity + SOS" status="Safety source" />
        <WellnessRow label="Senior consent" value="Required" status="Per data type" />
      </Card>
      <Card title="Movement pattern" icon="⌁">
        <TrendChart values={[18, 26, 21, 36, 42, 31, 54, 48, 62, 44, 38, 52]} color="#6a3f7a" />
        <Text style={styles.muted}>Walking rhythm is steady. Last stillness window: {safety.movement.stillMinutes} minutes.</Text>
      </Card>
      <Card title="Sleep and recovery" icon="☾" tint="peach">
        <TrendChart values={[68, 72, 54, 76, 70, 82, 74]} color="#e28a20" />
        <Text style={styles.muted}>Sleep quality is stable. If night wandering is detected, Rita and Arjun can be alerted.</Text>
      </Card>
      <Card title="Nutrition and medication" icon="🍽">
        <WellnessRow label="Breakfast" value="420 cal" status="Logged" />
        <WellnessRow label="Lunch" value="610 cal" status="Logged" />
        <WellnessRow label="Water" value="5 cups" status="Good" />
        <WellnessRow label="Medication adherence" value={`${Math.round((medTaken / medTotal) * 100)}%`} status="Today" />
      </Card>
      <Card title="Risk detection" icon="🛡">
        <WellnessRow label="Fall confidence" value={`${Math.round(safety.fallDetection.confidence * 100)}%`} status={safety.fallDetection.status} />
        <WellnessRow label="Safe zone" value={safety.safeZones[0]?.status || "unknown"} status={safety.safeZones[0]?.name || "Home"} />
        <WellnessRow label="Phone battery" value={`${safety.movement.phoneBattery}%`} status="Live" />
        <WellnessRow label="Wearable confidence" value="94%" status="Watch + proximity" />
      </Card>
      <Card title="Test safety detection" icon="⚠">
        <Text style={styles.muted}>These simulations call the same backend endpoint used by phone sensors.</Text>
        <ButtonRow labels={[["Normal", "normal"], ["Wandering", "wandering"], ["Likely fall", "fall"], ["Stillness", "stillness"]]} onPress={simulate} />
      </Card>
      <Card title="Trusted people" icon="♡">
        {state.people.map((person: any) => <View key={person.id} style={styles.eventRow}><Text style={styles.body}>{person.name}</Text><Text style={styles.muted}>{person.role} · Invite: {person.inviteCode}</Text><Text style={styles.muted}>Access: {(person.permissions || []).join(", ")}</Text></View>)}
      </Card>
      <Card title="SOS events">
        {safety.sosEvents.length ? safety.sosEvents.slice(0, 4).map((event: any) => <View key={event.id} style={styles.eventRow}><Text style={styles.body}>{event.type} · {event.severity}</Text><Text style={styles.muted}>{event.body}</Text><Text style={styles.muted}>Notified: {event.notified.join(", ")}</Text></View>) : <Text style={styles.muted}>No active SOS events.</Text>}
      </Card>
    </View>
  );
}

function BusinessOnboarding({ state, onDone }: { state: any; onDone: () => void }) {
  const biz = state.business;
  const [name, setName] = useState(biz.name);
  const [contactPerson, setContactPerson] = useState(biz.contactPerson);
  const [email, setEmail] = useState(biz.email);
  const [phone, setPhone] = useState(biz.phone);
  const [website, setWebsite] = useState(biz.website);
  const [googleBusinessProfile, setGoogleBusinessProfile] = useState(biz.googleBusinessProfile);
  const [serviceAreas, setServiceAreas] = useState(biz.serviceAreas.join(", "));
  const [demographics, setDemographics] = useState(biz.demographics.join(", "));

  async function complete() {
    await post("/api/business/onboarding", {
      name,
      contactPerson,
      email,
      phone,
      website,
      googleBusinessProfile,
      serviceAreas: serviceAreas.split(",").map(item => item.trim()).filter(Boolean),
      demographics: demographics.split(",").map(item => item.trim()).filter(Boolean)
    });
    await onDone();
  }

  return <Card title="Business onboarding"><Field label="Business name" value={name} onChangeText={setName} /><Field label="Contact person" value={contactPerson} onChangeText={setContactPerson} /><Field label="Email" value={email} onChangeText={setEmail} /><Field label="Phone" value={phone} onChangeText={setPhone} /><Field label="Website" value={website} onChangeText={setWebsite} /><Field label="Google Business Profile" value={googleBusinessProfile} onChangeText={setGoogleBusinessProfile} /><Field label="Demographics served" value={demographics} onChangeText={setDemographics} /><Field label="Areas served" value={serviceAreas} onChangeText={setServiceAreas} /><PrimaryButton label="Complete business onboarding" onPress={complete} /></Card>;
}

function BusinessHome({ state }: { state: any }) {
  const plan = state.business.plan === "paid" ? "$100/month Growth" : "Free";
  return <View><Text style={styles.h1}>{state.business.name}</Text><MetricRow items={[["Requests", state.requests.length], ["Bookings", state.bookings.length], ["Plan", plan]]} /><Card title="Business profile"><Text style={styles.body}>{state.business.description}</Text><Text style={styles.muted}>Areas: {state.business.serviceAreas.join(", ")}</Text></Card></View>;
}

function BusinessLeads({ state, onRefresh }: { state: any; onRefresh: () => void }) {
  const service = state.services.find((item: any) => item.provider === state.business.name) || state.services[0];
  async function acceptLead(request: any) {
    await post("/api/bookings", { leadId: request.id, serviceId: request.serviceId || service.id, label: request.type, time: request.time, consumeLead: true });
    await onRefresh();
    Alert.alert("TheSeniorguru", "Lead accepted and booking created.");
  }
  async function updateRefill(request: any, status: string) {
    await patch(`/api/business/refill-requests/${request.id}`, { status, dispensedQuantity: status === "completed" ? 30 : undefined });
    await onRefresh();
    Alert.alert("Refill updated", `Marked as ${status}.`);
  }
  return <View><Text style={styles.h1}>Leads</Text>{state.requests.map((request: any) => <Card key={request.id} title={request.type}><Text style={styles.body}>{request.resident} · {request.time}</Text><Text style={styles.muted}>{request.pickup?.label || "Pickup pending"} → {request.dropoff?.label || "Drop-off pending"}</Text><Text style={styles.muted}>{request.distance} · {request.duration || "ETA pending"} · {request.status}</Text><PrimaryButton label="Accept lead" onPress={() => acceptLead(request)} /></Card>)}<SectionTitle title="Medication refill requests" />{(state.refillRequests || []).length ? state.refillRequests.map((request: any) => <Card key={request.id} title={request.medication_name || "Medication refill"} icon="💊"><Text style={styles.body}>{request.resident_name} · {request.strength || ""}</Text><Text style={styles.muted}>Remaining: {request.remaining_count} · Status: {request.status}</Text><ButtonRow labels={[["Accept", "accepted"], ["Ready", "ready"], ["Completed", "completed"]]} onPress={(status: string) => updateRefill(request, status)} /></Card>) : <Card title="Medication refill requests"><Text style={styles.muted}>No refill requests yet.</Text></Card>}</View>;
}

function BusinessServices({ state, onRefresh }: { state: any; onRefresh: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Transportation");
  const [price, setPrice] = useState("$35 - $60");
  const services = state.services.filter((item: any) => item.provider === state.business.name);
  async function addService() {
    await post("/api/business/services", { name, category, priceLabel: price });
    setName("");
    await onRefresh();
    Alert.alert("TheSeniorguru", "Service submitted for superadmin approval.");
  }
  return <View><Text style={styles.h1}>Services</Text><Card title="Add service"><Text style={styles.muted}>Free package allows 1 service. More services require the $100/month plan.</Text><Field label="Service name" value={name} onChangeText={setName} /><Field label="Category" value={category} onChangeText={setCategory} /><Field label="Price" value={price} onChangeText={setPrice} /><PrimaryButton label="Add service" onPress={addService} /></Card>{services.map((service: any) => <Card key={service.id} title={service.name}><Text style={styles.body}>{service.category}</Text><Text style={styles.muted}>{service.price}</Text></Card>)}</View>;
}

function BusinessPackage({ state, onRefresh }: { state: any; onRefresh: () => void }) {
  async function setPlan(plan: "free" | "paid") {
    try {
      const result: any = await patch("/api/business/plan", { plan });
      await onRefresh();
      if (result.checkoutUrl) {
        await Linking.openURL(result.checkoutUrl);
        Alert.alert("Stripe Checkout opened", "Complete payment in Stripe. The Growth package activates after Stripe confirms the subscription.");
        return;
      }
      Alert.alert("TheSeniorguru", plan === "paid" ? "Growth package activated." : "Free package selected.");
    } catch (error: any) {
      Alert.alert("Package action needed", error.message || "Package change could not be completed.");
    }
  }
  async function topUp() {
    try {
      await post("/api/business/top-up", { leads: 5 });
      await onRefresh();
      Alert.alert("TheSeniorguru", "Lead top-up added.");
    } catch (error: any) {
      Alert.alert("Top-up action needed", error.message || "Top-up could not be completed.");
    }
  }
  const quota = state.business.leadQuota;
  return <View><Text style={styles.h1}>Package</Text><Card title="Free"><Text style={styles.body}>1 service · 5 leads per year</Text><PrimaryButton label="Use free package" onPress={() => setPlan("free")} /></Card><Card title="$100/month Growth"><Text style={styles.body}>More than 1 service · 5 leads per month · top-ups after limit</Text><PrimaryButton label="Upgrade to paid" onPress={() => setPlan("paid")} /></Card><Card title="Lead usage"><Text style={styles.muted}>Year: {quota.usedThisYear}/{quota.freePerYear}</Text><Text style={styles.muted}>Month: {quota.usedThisMonth}/{quota.paidPerMonth + quota.topUps}</Text><PrimaryButton label="Add 5 lead top-up" onPress={topUp} /></Card></View>;
}

function NotificationsPage({ state, circleState, onRefresh }: { state: any; circleState: any; onRefresh: () => void }) {
  const [liveNotifications, setLiveNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const residentNotifications = state.notificationQueue || [];
  const circleNotifications = circleState?.notifications || [];
  const notifications = liveNotifications.length ? liveNotifications : (circleNotifications.length ? circleNotifications : residentNotifications);

  useEffect(() => {
    api<any>("/api/notifications")
      .then(result => setLiveNotifications(result.notifications || []))
      .catch(() => setLiveNotifications(circleNotifications.length ? circleNotifications : residentNotifications))
      .finally(() => setLoadingNotifications(false));
  }, []);

  async function markDelivered(id: string) {
    await post(`/api/notifications/${id}/mark-delivered`, {});
    const result: any = await api("/api/notifications");
    setLiveNotifications(result.notifications || []);
    await onRefresh();
    Alert.alert("Notification", "Marked as delivered.");
  }

  return (
    <View>
      <TopPhoneBar />
      <Text style={styles.h1}>Notifications</Text>
      <Text style={styles.copy}>Important care updates, delivery alerts, and safety messages in one place.</Text>
      <Card title="Notification center" icon="🔔" tint="peach">
        {loadingNotifications ? <ActivityIndicator color={colors.purple} /> : notifications.length ? notifications.slice(0, 20).map((item: any) => (
          <View key={item.id} style={styles.eventRow}>
            <Text style={styles.body}>{String(item.channel || "push").toUpperCase()} · {item.status || "queued"}</Text>
            <Text style={styles.muted}>{item.eventType || item.type || "care-update"} · {item.personName || state.resident?.name || "Anita Sharma"}</Text>
            <Text style={styles.muted}>{item.body || "Care notification received."}</Text>
            {item.latest_attempt || item.latestAttempt ? <Text style={styles.muted}>Last delivery: {(item.latest_attempt || item.latestAttempt).provider} · {(item.latest_attempt || item.latestAttempt).status}</Text> : null}
            {item.status === "queued" ? <Pressable style={styles.smallPrimary} onPress={() => markDelivered(item.id)}><Text style={styles.primaryText}>Mark delivered</Text></Pressable> : <Text style={styles.selected}>Delivered by {item.provider || "notification provider"}</Text>}
          </View>
        )) : <Text style={styles.muted}>No notifications yet.</Text>}
      </Card>
    </View>
  );
}

function SosEventsPage({ state, circleState, circlePersonId, onRefresh }: { state: any; circleState: any; circlePersonId: string; onRefresh: () => void }) {
  const safety = circleState?.safety || state.safety || { sosEvents: [], location: { label: "Park View Community", accuracyMeters: 18 }, safeZones: [{ status: "inside" }], movement: { status: "steady", stillMinutes: 0, phoneBattery: 80 }, fallDetection: { confidence: 0, status: "clear" } };
  const events = safety.sosEvents || [];

  async function ackSos(id: string) {
    await post(`/api/sos-events/${id}/ack`, { personId: circlePersonId });
    await onRefresh();
  }

  async function escalateSos(id: string) {
    await post(`/api/sos-events/${id}/escalate`, { personId: circlePersonId });
    await onRefresh();
  }

  return (
    <View>
      <TopPhoneBar />
      <Text style={styles.h1}>SOS Events</Text>
      <Text style={styles.copy}>Separate emergency event history, current alerts, and acknowledgement actions.</Text>
      <MiniMap safety={safety} />
      <Card title="Active and recent SOS" icon="🚨" tint="orange">
        {events.length ? events.slice(0, 20).map((event: any) => (
          <View key={event.id} style={styles.eventRow}>
            <Text style={styles.body}>{event.type} · {event.severity} · {event.status}</Text>
            <Text style={styles.muted}>{event.body}</Text>
            <Text style={styles.muted}>Notified: {(event.notified || []).join(", ") || "Trusted circle"}</Text>
            {event.status === "active" ? <ButtonRow labels={[["Acknowledge", event.id], ["Escalate", `escalate:${event.id}`]]} onPress={(value: string) => value.startsWith("escalate:") ? escalateSos(value.replace("escalate:", "")) : ackSos(value)} /> : <Text style={styles.selected}>{event.acknowledgedBy ? `Acknowledged by ${event.acknowledgedBy}` : event.escalatedBy ? `Escalated by ${event.escalatedBy}` : "Resolved action recorded"}</Text>}
          </View>
        )) : <Text style={styles.muted}>No active SOS events.</Text>}
      </Card>
    </View>
  );
}

function CircleInvite({ onAccepted }: { onAccepted: (personId: string) => void }) {
  const [inviteCode, setInviteCode] = useState("RITA-ANITA");
  async function accept() {
    const result: any = await post("/api/circle/accept-invite", { inviteCode });
    await onAccepted(result.person.id);
  }
  return <Card title="Trusted person invite"><Text style={styles.copy}>Enter the invite code sent by the senior. Demo: RITA-ANITA, ARJUN-ANITA, DRMEHTA-ANITA, SUNITA-ANITA.</Text><Field label="Invite code" value={inviteCode} onChangeText={setInviteCode} /><PrimaryButton label="Accept invite" onPress={accept} /></Card>;
}

function CircleSafety({ circleState, onRefresh }: { circleState: any; onRefresh: () => void }) {
  const safety = circleState?.safety || { location: { label: "Park View Community", accuracyMeters: 18 }, safeZones: [{ status: "inside" }], movement: { status: "steady", stillMinutes: 0, phoneBattery: 80 }, fallDetection: { confidence: 0, status: "clear" }, sosEvents: [] };
  const health = circleState?.healthVitals?.summary || {};
  const latestHealth = circleState?.healthVitals?.latestSummary || health;

  async function simulate(kind: string) {
    await simulateSafetyEvent(kind as any);
    await onRefresh();
  }

  async function pingSenior() {
    await post("/api/circle/help-message", { body: "Rita checked in and pinged Anita from trusted circle." });
    await onRefresh();
    Alert.alert("Ping sent", "Anita has been pinged and the care log was updated.");
  }
  async function contactSenior(channel: string) {
    if (channel === "chat") {
      await post("/api/circle/help-message", { body: "Rita started a chat check-in from trusted circle." });
      await onRefresh();
      Alert.alert("Chat sent", "Anita received your chat check-in.");
      return;
    }
    await post("/api/circle/call-request", { channel, message: `Rita requested a ${channel} call.` });
    await onRefresh();
    Alert.alert("Call request sent", `${channel.charAt(0).toUpperCase()}${channel.slice(1)} request sent to Anita.`);
  }

  return (
    <View>
      <TopPhoneBar />
      <Text style={styles.h1}>Live Safety</Text>
      <Text style={styles.copy}>Trusted circle view for location tracing and quick contact. Voice SOS commands stay with the senior app.</Text>
      <MiniMap safety={safety} />
      <Card title="Local tracing" icon="📍" tint="peach">
        <WellnessRow label="Current zone" value={safety.location?.label || "Park View Community"} status={safety.safeZones?.[0]?.status || "inside"} />
        <WellnessRow label="Movement" value={safety.movement?.status || "steady"} status={`${safety.movement?.stillMinutes ?? 0} min stillness`} />
        <WellnessRow label="Accuracy" value={`${safety.location?.accuracyMeters ?? 18}m`} status="Live phone + wearable trace" />
      </Card>
      <Card title="Reach Anita" icon="♡">
        <Text style={styles.copy}>Use soft contact actions first unless there is an active SOS event.</Text>
        <ButtonRow labels={[["Ping", "ping"], ["Chat", "chat"], ["Voice", "voice"], ["Video", "video"]]} onPress={(value: string) => value === "ping" ? pingSenior() : contactSenior(value)} />
        {(circleState?.callRequests || []).slice(0, 2).map((request: any) => <Text key={request.id} style={styles.muted}>{request.channel} call · {request.status}</Text>)}
      </Card>
      <SectionTitle title="Connected devices" />
      <WearableDeviceCard name="Apple Watch" status="Connected" battery="82%" signal="Fall detection, heart rate, SOS" lastSeen="Live" accent="#6a3f7a" />
      <WearableDeviceCard name="Home proximity tag" status="Near Anita" battery="64%" signal="Room proximity, night exit alerts" lastSeen="18 sec ago" accent="#e28a20" />
      <Card title="Escalation path" icon="🚨" tint="peach">
        <WellnessRow label="If fall detected" value="Rita first" status="Immediate push" />
        <WellnessRow label="If no response" value="Arjun + SOS" status="2 min escalation" />
        <WellnessRow label="If severe vitals" value="Emergency" status="Auto-create SOS" />
      </Card>
      <SectionTitle title="Shared health signals" />
      <View style={styles.vitalsGrid}>
        <VitalTile label="Heart rate" value={metricText(health.heartRateAvg)} unit="bpm" status="Shared average" color="#d95f4f" />
        <VitalTile label="Oxygen" value={metricText(health.oxygenAvg)} unit="%" status="Shared SpO2" color="#3f8c55" />
        <VitalTile label="Breathing" value={metricText(health.respiratoryRateAvg)} unit="/min" status="Shared rhythm" color="#6a3f7a" />
        <VitalTile label="Sleep" value={sleepText(health.sleepMinutes)} unit="" status={`Risk: ${latestHealth.riskLevel || "unknown"}`} color="#e28a20" />
      </View>
      <View style={styles.analyticsGrid}>
        <RingMetric label="Fall risk" value={`${Math.round((safety.fallDetection?.confidence || 0) * 100)}%`} percent={Math.round((safety.fallDetection?.confidence || 0) * 100)} color="#d95f4f" />
        <RingMetric label="Movement" value={safety.movement?.status || "steady"} percent={68} color="#6a3f7a" />
      </View>
      <Card title="Movement trend" icon="⌁"><TrendChart values={[12, 20, 18, 28, 46, 40, 34, 52, 49, 58]} color="#6a3f7a" /><Text style={styles.muted}>Use this to spot wandering, stillness, or sudden activity shifts.</Text></Card>
      <Card title="Phone and wearable simulation"><ButtonRow labels={[["Normal", "normal"], ["Wandering", "wandering"], ["Likely fall", "fall"], ["Stillness", "stillness"]]} onPress={simulate} /></Card>
    </View>
  );
}

function CircleAssist({ circleState, personId, onRefresh }: { circleState: any; personId: string; onRefresh: () => void }) {
  const [message, setMessage] = useState("Hi Anita, checking in. Do you need help today?");
  async function sendMessage() {
    await post("/api/circle/help-message", { body: message });
    await onRefresh();
  }
  async function ack(id: string) {
    await post("/api/circle/tasks/ack", { id });
    await onRefresh();
  }
  return <View><Text style={styles.h1}>Assist Anita</Text><Card title="Send check-in"><Field label="Message" value={message} onChangeText={setMessage} multiline /><PrimaryButton label="Send message" onPress={sendMessage} /></Card><Card title="Recent messages">{(circleState?.messages || []).length ? circleState.messages.slice(0, 5).map((item: any) => <Text key={item.id} style={styles.muted}>{item.body} · {item.status}</Text>) : <Text style={styles.muted}>No messages yet.</Text>}</Card><Card title="Call requests">{(circleState?.callRequests || []).length ? circleState.callRequests.slice(0, 5).map((item: any) => <Text key={item.id} style={styles.muted}>{item.channel} · {item.status}</Text>) : <Text style={styles.muted}>No call requests yet.</Text>}</Card>{(circleState?.tasks || []).map((task: any) => <Card key={task.id} title={task.type}><Text style={styles.body}>{task.body}</Text><Text style={styles.muted}>Status: {task.status}</Text><PrimaryButton label="Acknowledge" onPress={() => ack(task.id)} /></Card>)}</View>;
}

function CirclePermissions({ state, circlePersonId, onPick }: { state: any; circlePersonId: string; onPick: (personId: string) => void }) {
  return <View><Text style={styles.h1}>Access</Text>{state.people.map((person: any) => <Pressable key={person.id} onPress={() => onPick(person.id)}><Card title={person.name}><Text style={styles.body}>{person.role} · {person.status}</Text><Text style={styles.muted}>{(person.permissions || []).join(", ")}</Text><Text style={circlePersonId === person.id ? styles.selected : styles.muted}>{circlePersonId === person.id ? "Current trusted-person view" : "Tap to view as this person"}</Text></Card></Pressable>)}</View>;
}

function SuperadminHome() {
  const [queue, setQueue] = useState<any>({ businesses: [], services: [] });
  const [loaded, setLoaded] = useState(false);
  async function load() {
    const result: any = await api("/api/superadmin/approvals");
    setQueue(result);
    setLoaded(true);
  }
  async function approveBusiness(id: string) {
    await post(`/api/superadmin/businesses/${id}/approve`, { notes: "Approved from mobile superadmin." });
    await load();
  }
  async function rejectBusiness(id: string) {
    await post(`/api/superadmin/businesses/${id}/reject`, { notes: "Rejected from mobile superadmin." });
    await load();
  }
  async function approveService(id: string) {
    await post(`/api/superadmin/services/${id}/approve`, { notes: "Approved from mobile superadmin." });
    await load();
  }
  useEffect(() => { load().catch(error => Alert.alert("Superadmin", error.message)); }, []);
  if (!loaded) return <Card title="Superadmin approvals"><ActivityIndicator color={colors.purple} /></Card>;
  return (
    <View>
      <Text style={styles.h1}>Approval Gates</Text>
      <Card title="Pending businesses">
        {queue.businesses.length ? queue.businesses.map((business: any) => <View key={business.id} style={styles.eventRow}><Text style={styles.body}>{business.name}</Text><Text style={styles.muted}>{business.email} · {business.status}</Text><ButtonRow labels={[["Approve", business.id], ["Reject", `reject:${business.id}`]]} onPress={(value: string) => value.startsWith("reject:") ? rejectBusiness(value.replace("reject:", "")) : approveBusiness(value)} /></View>) : <Text style={styles.muted}>No pending businesses.</Text>}
      </Card>
      <Card title="Pending services">
        {queue.services.length ? queue.services.map((service: any) => <View key={service.id} style={styles.eventRow}><Text style={styles.body}>{service.name}</Text><Text style={styles.muted}>{service.category} · {service.status}</Text><PrimaryButton label="Approve service" onPress={() => approveService(service.id)} /></View>) : <Text style={styles.muted}>No pending services.</Text>}
      </Card>
    </View>
  );
}

function SuperadminAudit() {
  const [logs, setLogs] = useState<any[]>([]);
  const [deliveryResult, setDeliveryResult] = useState<any>(null);
  useEffect(() => {
    api<any>("/api/superadmin/audit-logs")
      .then(result => setLogs(result.logs || []))
      .catch(error => Alert.alert("Audit logs", error.message));
  }, []);
  async function processNotifications() {
    const result: any = await post("/api/notifications/process", { limit: 20 });
    setDeliveryResult(result);
    Alert.alert("Delivery processor", `${result.delivered.length} notifications delivered.`);
  }
  return <View><Text style={styles.h1}>Audit Logs</Text><Card title="Notification providers" icon="▣"><Text style={styles.muted}>Process queued push, SMS, and call records through provider adapters.</Text><PrimaryButton label="Process queued notifications" onPress={processNotifications} />{deliveryResult ? <View style={styles.eventRow}><Text style={styles.body}>Delivered {deliveryResult.delivered.length}</Text><Text style={styles.muted}>Remaining queued: {deliveryResult.remainingQueued}</Text>{deliveryResult.delivered.slice(0, 4).map((item: any) => <Text key={item.id} style={styles.muted}>{item.channel} · {item.provider} · {item.status}</Text>)}</View> : null}</Card>{logs.length ? logs.map(log => <Card key={log.id} title={log.action}><Text style={styles.body}>{log.entityType || log.entity_type} · {log.severity}</Text><Text style={styles.muted}>{log.details || "No details"}</Text><Text style={styles.muted}>{new Date(log.createdAt || log.created_at).toLocaleString()}</Text></Card>) : <Card title="Audit logs"><Text style={styles.muted}>No logs loaded yet.</Text></Card>}</View>;
}

function MetricRow({ items }: { items: [string, any][] }) {
  return <View style={styles.metricRow}>{items.map(([label, value]) => <View key={label} style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>)}</View>;
}

function TopPhoneBar() {
  return <View style={styles.phoneStatus}><Text style={styles.statusText}>9:41</Text><Text style={styles.statusText}>◼︎ ◼︎ ●</Text></View>;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ActionCard({ icon, title, subtitle, button, onPress, avatar }: { icon: string; title: string; subtitle: string; button: string; onPress: () => void; avatar?: boolean }) {
  return (
    <View style={styles.actionCard}>
      <View style={avatar ? styles.avatar : styles.softIcon}><Text style={avatar ? styles.avatarText : styles.softIconText}>{icon}</Text></View>
      <View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text>{subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}</View>
      <Pressable style={button === "›" ? styles.chevronButton : styles.pillButton} onPress={onPress}><Text style={styles.pillButtonText}>{button}</Text></Pressable>
    </View>
  );
}

function IllustratedCard({ title, subtitle, art }: { title: string; subtitle: string; art: string }) {
  return <View style={styles.illustratedCard}><View><Text style={styles.actionTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View><Text style={styles.art}>{art}</Text></View>;
}

function ServiceCard({ service, onPress }: { service: any; onPress: () => void }) {
  return <View style={styles.serviceCard}><View style={styles.serviceInfo}><Text style={styles.actionTitle}>{service.name}</Text><Text style={styles.muted}>{service.category}</Text><Text style={styles.star}>★ {service.rating}</Text><Text style={styles.muted}>{service.price} · {service.eta}</Text><Pressable style={styles.smallPrimary} onPress={onPress}><Text style={styles.primaryText}>Book</Text></Pressable></View><View style={styles.serviceArt}><Text style={styles.art}>{service.category?.includes("Medicine") ? "💊" : "🚙"}</Text></View></View>;
}

function MiniMap({ safety }: { safety: any }) {
  const outside = safety.safeZones[0]?.status === "outside";
  return (
    <View style={styles.mapCard}>
      <View style={styles.mapGrid}>
        <View style={styles.safeZoneCircle} />
        <View style={[styles.mapPin, outside && styles.mapPinAlert]}><Text style={styles.mapPinText}>📍</Text></View>
        <View style={styles.mapRoadOne} />
        <View style={styles.mapRoadTwo} />
      </View>
      <View style={styles.mapInfo}>
        <Text style={styles.actionTitle}>{safety.location.label}</Text>
        <Text style={styles.muted}>Accuracy {safety.location.accuracyMeters}m · Safe zone {safety.safeZones[0]?.status}</Text>
        <Text style={outside ? styles.alertText : styles.safeText}>{outside ? "Outside safe zone" : "Inside Park View Community"}</Text>
      </View>
    </View>
  );
}

function WearableDeviceCard({ name, status, battery, signal, lastSeen, accent }: { name: string; status: string; battery: string; signal: string; lastSeen: string; accent: string }) {
  return (
    <View style={styles.deviceCard}>
      <View style={[styles.deviceHalo, { backgroundColor: accent }]}>
        <Text style={styles.deviceIcon}>{name.includes("Watch") ? "⌚" : "◉"}</Text>
      </View>
      <View style={styles.deviceCopy}>
        <View style={styles.deviceTopLine}>
          <Text style={styles.actionTitle}>{name}</Text>
          <Text style={styles.deviceStatus}>{status}</Text>
        </View>
        <Text style={styles.muted}>{signal}</Text>
        <View style={styles.deviceMetaRow}>
          <Text style={styles.deviceMeta}>Battery {battery}</Text>
          <Text style={styles.deviceMeta}>Seen {lastSeen}</Text>
        </View>
      </View>
    </View>
  );
}

function ProximityBand() {
  return (
    <View style={styles.proximityCard}>
      <View>
        <Text style={styles.actionTitle}>Proximity and room awareness</Text>
        <Text style={styles.muted}>Wearables and home tags cover the moments when the phone is charging, forgotten, or in another room.</Text>
      </View>
      <View style={styles.roomTrack}>
        {["Bedroom", "Hall", "Kitchen", "Door"].map((room, index) => (
          <View key={room} style={styles.roomStep}>
            <View style={[styles.roomDot, index === 1 && styles.roomDotActive, index === 3 && styles.roomDotAlert]} />
            <Text style={styles.roomText}>{room}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function VoiceSosCard({ compact, onCommand }: { compact?: boolean; onCommand?: (command: string) => void }) {
  const commands = compact ? ["Guru, call emergency", "Guru, I need an ambulance"] : ["Guru, call emergency", "Guru, I need an ambulance", "Guru, call Rita now"];
  return (
    <Card title="Voice SOS commands" icon="🎙">
      <Text style={styles.copy}>If Anita cannot reach the phone, the app listens for approved emergency phrases on-device.</Text>
      <Pressable style={styles.voiceCommand} onPress={() => onCommand?.("Guru, call emergency")}>
        <Text style={styles.voicePhrase}>"Guru, call emergency"</Text>
        <Text style={styles.voiceRoute}>Dial 911 + notify trusted circle</Text>
      </Pressable>
      <Pressable style={styles.voiceCommand} onPress={() => onCommand?.("Guru, I need an ambulance")}>
        <Text style={styles.voicePhrase}>"Guru, I need an ambulance"</Text>
        <Text style={styles.voiceRoute}>Start ambulance SOS workflow</Text>
      </Pressable>
      {!compact && (
        <Pressable style={styles.voiceCommand} onPress={() => onCommand?.("Guru, call Rita now")}>
          <Text style={styles.voicePhrase}>"Guru, call Rita now"</Text>
          <Text style={styles.voiceRoute}>Call trusted person first</Text>
        </Pressable>
      )}
      {compact ? null : (
        <View style={styles.voiceCommand}>
          <Text style={styles.voicePhrase}>Tap a phrase to test routing</Text>
          <Text style={styles.voiceRoute}>Creates real SOS event, message, and trusted-person task</Text>
        </View>
      )}
      <WellnessRow label="Confirmation window" value="10 sec" status="Cancels false alarms" />
      <WellnessRow label="No response after prompt" value="Escalate" status="Call + push + SMS" />
    </Card>
  );
}

function VitalTile({ label, value, unit, status, color }: { label: string; value: string; unit: string; status: string; color: string }) {
  return (
    <View style={styles.vitalTile}>
      <View style={[styles.vitalPulse, { backgroundColor: color }]} />
      <Text style={styles.vitalLabel}>{label}</Text>
      <View style={styles.vitalValueRow}>
        <Text style={[styles.vitalValue, { color }]}>{value}</Text>
        <Text style={styles.vitalUnit}>{unit}</Text>
      </View>
      <Text style={styles.vitalStatus}>{status}</Text>
    </View>
  );
}

function metricText(value: any) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? "--" : String(value);
}

function sleepText(minutes: any) {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return "--";
  return `${Math.floor(value / 60)}h ${value % 60}m`;
}

function RingMetric({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <View style={styles.ringMetric}>
      <View style={[styles.ringOuter, { borderColor: color }]}>
        <Text style={[styles.ringPercent, { color }]}>{Math.min(99, Math.max(0, percent))}%</Text>
      </View>
      <Text style={styles.ringValue}>{value}</Text>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

function TrendChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return <View style={styles.chart}>{values.map((value, index) => <View key={`${value}-${index}`} style={styles.chartSlot}><View style={[styles.chartBar, { height: 18 + (value / max) * 70, backgroundColor: color }]} /></View>)}</View>;
}

function WellnessRow({ label, value, status }: { label: string; value: string; status: string }) {
  return <View style={styles.wellnessRow}><View><Text style={styles.body}>{label}</Text><Text style={styles.muted}>{status}</Text></View><Text style={styles.wellnessValue}>{value}</Text></View>;
}

function ButtonRow({ labels, onPress }: { labels: [string, any][]; onPress: (value: any) => void }) {
  return <View style={styles.buttonRow}>{labels.map(([label, value]) => <Pressable key={label} style={styles.smallButton} onPress={() => onPress(value)}><Text style={styles.smallButtonText}>{label}</Text></Pressable>)}</View>;
}

function CompactRow({ title, subtitle, action }: { title: string; subtitle?: string; action: string }) {
  return (
    <View style={styles.compactRow}>
      <View style={styles.compactIcon}><Text style={styles.compactIconText}>{title.includes("SOS") ? "▣" : title.includes("Medical") ? "♡" : title.includes("Hospital") ? "⌂" : "●"}</Text></View>
      <View style={styles.actionText}><Text style={styles.compactTitle}>{title}</Text>{subtitle ? <Text style={styles.tinyMuted}>{subtitle}</Text> : null}</View>
      <Text style={styles.chevron}>{action}</Text>
    </View>
  );
}

function MedicationMiniFlow({ medication, refillRequests, onConfirm, onRefresh, allTaken }: { medication: any; refillRequests: any[]; onConfirm: () => void; onRefresh: () => void; allTaken: boolean }) {
  const activeRefill = (refillRequests || []).find(request => request.medication_id === medication.id && !["completed", "rejected"].includes(request.status));
  async function requestRefill() {
    try {
      await post("/api/medications/refill-request", { medicationId: medication.id, notes: `Refill requested from mobile app for ${medication.name}` });
      await onRefresh();
      Alert.alert("Refill requested", "We created the refill request and notified the care provider when available.");
    } catch (error: any) {
      Alert.alert("Refill request", error.message || "Could not create refill request.");
    }
  }
  return (
    <View>
      <Card title="Medications">
        <View style={styles.segment}><Text style={styles.segmentActive}>My meds</Text><Text style={styles.segmentText}>History</Text></View>
        {[
          [medication.name || "Lisinopril", medication.condition || "Blood Pressure", allTaken ? "✓" : "Pending"],
          ["Metformin 500mg", "Diabetes", "Pending"],
          ["Atorvastatin 20mg", "Cholesterol", "Pending"]
        ].map(([name, condition, status]) => <CompactRow key={name} title={name} subtitle={condition} action={status} />)}
      </Card>
      <Card title="Confirm medication" icon="💊">
        <Text style={styles.centerQuestion}>Did you take your medication?</Text>
        <PrimaryButton label={allTaken ? "Yes, I took it" : "Yes, I took it"} onPress={onConfirm} disabled={allTaken} />
        <Pressable style={styles.outlineButton}><Text style={styles.outlineText}>Remind me later</Text></Pressable>
        <Pressable style={styles.outlineButton}><Text style={styles.outlineText}>Skip this dose</Text></Pressable>
      </Card>
      <Card title="Refill needed" tint="peach">
        <RemoteImage uri="https://images.unsplash.com/photo-1588776814546-1ffcf47267a6?w=420&h=260&fit=crop" style={styles.medBottleImage} />
        <Text style={styles.body}>{medication.name || "Lisinopril"} {medication.strength || "10mg"}</Text>
        <Text style={styles.muted}>{medication.remaining || 5} pills remaining</Text>
        {activeRefill ? <Text style={styles.selected}>Refill status: {activeRefill.status}</Text> : <PrimaryButton label="Request Refill" onPress={requestRefill} />}
        <Text style={styles.centerLink}>Set low stock reminder</Text>
      </Card>
    </View>
  );
}

function RemoteImage({ uri, style }: { uri: string; style: any }) {
  return <Image source={{ uri }} style={style} resizeMode="cover" />;
}

function ImageActionCard({ image, title, subtitle, button, onPress }: { image: string; title: string; subtitle: string; button: string; onPress: () => void }) {
  return (
    <Pressable style={styles.imageActionCard} onPress={onPress}>
      <RemoteImage uri={image} style={styles.actionThumb} />
      <View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View>
      <View style={styles.pillButton}><Text style={styles.pillButtonText}>{button}</Text></View>
    </Pressable>
  );
}

function ImageFeatureCard({ image, title, subtitle }: { image: string; title: string; subtitle: string }) {
  return (
    <View style={styles.illustratedCard}>
      <View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.muted}>{subtitle}</Text></View>
      <RemoteImage uri={image} style={styles.featureThumb} />
    </View>
  );
}

function PersonRow({ person, image }: { person: any; image: string }) {
  return (
    <Pressable style={styles.personRow} onPress={() => Alert.alert("Contact", person.name)}>
      <RemoteImage uri={image} style={styles.personPhoto} />
      <View style={styles.actionText}><Text style={styles.actionTitle}>{person.name}</Text><Text style={styles.muted}>{person.role} · {person.status}</Text></View>
      <Text style={styles.callIcon}>☎</Text>
    </Pressable>
  );
}

function ChatBubble({ text, meta, align }: { text: string; meta: string; align?: "right" }) {
  return (
    <View style={[styles.chatBubble, align === "right" && styles.chatBubbleRight]}>
      <Text style={styles.chatText}>{text}</Text>
      <Text style={styles.chatMeta}>{meta}</Text>
    </View>
  );
}

function FeedPost({ name, time, text, image, cta }: { name: string; time: string; text: string; image: string; cta?: string }) {
  return (
    <Card title={name}>
      <Text style={styles.muted}>{time}</Text>
      <Text style={styles.body}>{text}</Text>
      <RemoteImage uri={image} style={styles.feedImage} />
      <View style={styles.feedMeta}><Text style={styles.muted}>♥ 24</Text><Text style={styles.muted}>○ 6</Text><Text style={styles.chevron}>{cta || "›"}</Text></View>
      {cta ? <PrimaryButton label={cta} onPress={() => Alert.alert("Event", cta)} /> : null}
    </Card>
  );
}

function EventCard({ title, host, time, image }: { title: string; host: string; time: string; image: string }) {
  return (
    <View style={styles.eventCard}>
      <View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.muted}>{host}</Text><Text style={styles.muted}>{time}</Text><View style={styles.smallPrimary}><Text style={styles.primaryText}>Join</Text></View></View>
      <RemoteImage uri={image} style={styles.eventImage} />
    </View>
  );
}

function Card({ title, children, icon, tint }: { title: string; children: React.ReactNode; icon?: string; tint?: "orange" | "peach" }) {
  return <View style={[styles.card, tint === "peach" && styles.peachCard]}>{icon ? <View style={styles.cardHeader}><View style={tint === "orange" ? styles.orangeIcon : styles.softIcon}><Text style={styles.softIconText}>{icon}</Text></View><Text style={styles.h2}>{title}</Text></View> : <Text style={styles.h2}>{title}</Text>}{children}</View>;
}

function Field(props: any) {
  return <View style={styles.field}><Text style={styles.label}>{props.label}</Text><TextInput style={styles.input} placeholderTextColor={colors.muted} {...props} /></View>;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  async function wrapped() {
    if (disabled) return;
    try { await onPress(); }
    catch (error: any) { Alert.alert("TheSeniorguru", error.message); }
  }
  return <Pressable disabled={disabled} style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]} onPress={wrapped}><Text style={styles.primaryText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff7f0" },
  appShell: { flex: 1, position: "relative", backgroundColor: "#fff7f0" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff7f0", gap: 12 },
  page: { padding: 14, paddingBottom: 24, gap: 10, backgroundColor: "#fff7f0" },
  pageWithBottomNav: { paddingBottom: 104 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 4, minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, zIndex: 20, elevation: 4 },
  topIconButton: { width: 54, height: 54, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fffaf5", alignItems: "center", justifyContent: "center" },
  sosIconButton: { backgroundColor: "#fff0ef", borderColor: "#f1c2bd" },
  topIconText: { color: colors.purple, fontWeight: "900", fontSize: 13 },
  mark: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  markText: { color: "white", fontWeight: "900" },
  logoMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#fff0d9", borderWidth: 1, borderColor: "#efd7bd", alignItems: "center", justifyContent: "center", position: "relative" },
  logoHeart: { color: "#6f3f7d", fontSize: 23, fontWeight: "900", marginTop: 1 },
  logoDotOne: { position: "absolute", color: "#f0a250", fontSize: 8, left: 7, top: 5 },
  logoDotTwo: { position: "absolute", color: "#4b245f", fontSize: 8, right: 7, top: 5 },
  brand: { fontSize: 25, color: "#3b174c", fontWeight: "900", flexShrink: 1, letterSpacing: -0.8 },
  brandSub: { color: "#3b174c", fontSize: 12, lineHeight: 15 },
  screenTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 14 },
  profilePhoto: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: "#fffdf9" },
  phoneStatus: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  statusText: { color: "#11091f", fontSize: 11, fontWeight: "900" },
  eyebrow: { color: "#7b7182", fontSize: 15, marginBottom: 3 },
  h1: { fontSize: 28, lineHeight: 32, color: "#12091f", fontWeight: "900", letterSpacing: -1, flexShrink: 1, marginBottom: 12 },
  h2: { fontSize: 17, color: "#12091f", fontWeight: "900", marginBottom: 6, flexShrink: 1 },
  body: { fontSize: 14, color: "#12091f", lineHeight: 20, flexShrink: 1, fontWeight: "700" },
  copy: { fontSize: 13, color: "#756b7c", lineHeight: 19, flexShrink: 1 },
  muted: { color: "#756b7c", fontSize: 13, lineHeight: 18, flexShrink: 1 },
  selected: { color: colors.purple, fontSize: 14, lineHeight: 21, fontWeight: "900" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  tabActive: { backgroundColor: colors.purple, borderColor: colors.purple },
  tabText: { color: colors.purple, fontWeight: "900" },
  tabTextActive: { color: "white" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 70, backgroundColor: "rgba(255,250,245,0.98)", borderTopWidth: 1, borderColor: "rgba(68,43,78,0.12)", flexDirection: "row", justifyContent: "space-around", paddingTop: 7, paddingBottom: 10, zIndex: 10 },
  bottomItem: { alignItems: "center", minWidth: 54 },
  bottomIcon: { color: "#6f6577", fontSize: 17, fontWeight: "900" },
  bottomIconActive: { color: "#6a3f7a" },
  bottomText: { color: "#6f6577", fontSize: 11, fontWeight: "800", marginTop: 2 },
  bottomTextActive: { color: "#6a3f7a" },
  heroIntro: { paddingVertical: 16 },
  roleCard: { width: "100%", backgroundColor: "#fffdf9", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "rgba(68,43,78,0.12)", marginTop: 10, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#392743", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  roleIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#f1e6f3", alignItems: "center", justifyContent: "center" },
  roleIconText: { fontSize: 22 },
  roleCopy: { flex: 1, minWidth: 0 },
  chevron: { color: "#6a3f7a", fontSize: 26, fontWeight: "900" },
  card: { width: "100%", backgroundColor: "#fffdf9", borderRadius: 17, padding: 14, borderWidth: 1, borderColor: "rgba(68,43,78,0.11)", marginBottom: 10, minWidth: 0, shadowColor: "#392743", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  peachCard: { backgroundColor: "#ffead0" },
  onboardingHeroImage: { width: "100%", height: 170, borderRadius: 17, backgroundColor: "#f1e4d4", marginBottom: 12 },
  centerLink: { color: "#4d2860", fontSize: 12, fontWeight: "900", textAlign: "center", marginTop: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  referenceMedicationCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fffdf9", borderRadius: 17, padding: 12, borderWidth: 1, borderColor: "rgba(68,43,78,0.1)", shadowColor: "#392743", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  referenceMedicationCopy: { flex: 1, minWidth: 0 },
  referenceTiny: { color: "#6a3f7a", fontSize: 11, fontWeight: "900" },
  smallIllustration: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#ffe5bd", alignItems: "center", justifyContent: "center" },
  field: { gap: 7, marginBottom: 12, minWidth: 0 },
  label: { color: colors.muted, fontWeight: "800" },
  input: { backgroundColor: "#fffaf5", borderWidth: 1, borderColor: "rgba(68,43,78,0.12)", borderRadius: 12, padding: 11, color: colors.ink, minWidth: 0, fontSize: 13 },
  suggestionRow: { backgroundColor: "#fffaf5", borderWidth: 1, borderColor: "rgba(68,43,78,0.11)", borderRadius: 12, padding: 11, marginBottom: 8 },
  primaryButton: { backgroundColor: "#71447f", padding: 12, borderRadius: 13, alignItems: "center", marginTop: 8 },
  primaryButtonDisabled: { backgroundColor: "#b9a7bf" },
  primaryText: { color: "white", fontWeight: "900", textAlign: "center" },
  secondaryButton: { padding: 14, alignItems: "center" },
  secondaryText: { color: colors.purple, fontWeight: "900" },
  metricRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  metric: { flexGrow: 1, minWidth: 96, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.line },
  metricValue: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  smallButton: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.purpleSoft },
  smallButtonText: { color: colors.purple, fontWeight: "900" },
  compactRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fffaf5", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: "rgba(68,43,78,0.08)", marginTop: 9 },
  compactIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#efe5f3" },
  compactIconText: { color: "#6a3f7a", fontSize: 13, fontWeight: "900" },
  compactTitle: { color: "#12091f", fontSize: 13, fontWeight: "900" },
  tinyMuted: { color: "#756b7c", fontSize: 11, lineHeight: 15, flexShrink: 1 },
  centerQuestion: { color: "#12091f", fontSize: 18, lineHeight: 24, fontWeight: "900", textAlign: "center", marginVertical: 12 },
  outlineButton: { borderWidth: 1, borderColor: "rgba(68,43,78,0.13)", backgroundColor: "#fffdf9", borderRadius: 13, padding: 11, alignItems: "center", marginTop: 8 },
  outlineText: { color: "#4d2860", fontWeight: "900", fontSize: 13 },
  medBottleImage: { width: "100%", height: 145, borderRadius: 15, backgroundColor: "#f1e4d4", marginBottom: 12 },
  eventRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginTop: 12, minWidth: 0 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#12091f", marginTop: 10, marginBottom: 8 },
  softIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#efe5f3", alignItems: "center", justifyContent: "center" },
  orangeIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#ffe5bd", alignItems: "center", justifyContent: "center" },
  softIconText: { fontSize: 22, fontWeight: "900", color: "#6a3f7a" },
  actionCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fffdf9", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(68,43,78,0.11)", marginBottom: 12, shadowColor: "#392743", shadowOpacity: 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  imageActionCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fffdf9", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(68,43,78,0.11)", marginBottom: 12, shadowColor: "#392743", shadowOpacity: 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  actionThumb: { width: 58, height: 58, borderRadius: 16, backgroundColor: "#f1e4d4" },
  featureThumb: { width: 88, height: 88, borderRadius: 18, backgroundColor: "#f1e4d4" },
  actionText: { flex: 1, minWidth: 0 },
  actionTitle: { color: "#12091f", fontSize: 15, fontWeight: "900", lineHeight: 19 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#d69b65", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontSize: 18, fontWeight: "900" },
  pillButton: { borderWidth: 1, borderColor: "rgba(68,43,78,0.14)", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: "#fffaf7" },
  chevronButton: { padding: 8 },
  pillButtonText: { color: "#6a3f7a", fontWeight: "900", fontSize: 16 },
  illustratedCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff1dd", borderRadius: 17, padding: 14, borderWidth: 1, borderColor: "rgba(68,43,78,0.09)", marginBottom: 10 },
  art: { fontSize: 46 },
  sosButton: { backgroundColor: "#ee6768", borderRadius: 15, padding: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  sosBig: { color: "white", fontSize: 22, fontWeight: "900" },
  sosText: { color: "white", fontWeight: "800" },
  flowLabel: { color: "#4d2860", fontSize: 13, fontWeight: "900", textTransform: "uppercase", marginBottom: 10 },
  searchPill: { minHeight: 46, backgroundColor: "#fffdf9", borderRadius: 15, borderWidth: 1, borderColor: "rgba(68,43,78,0.11)", paddingHorizontal: 13, flexDirection: "row", alignItems: "center", marginBottom: 10 },
  searchInput: { flex: 1, color: "#12091f", fontSize: 14 },
  mic: { fontSize: 20 },
  segment: { flexDirection: "row", gap: 10, marginBottom: 12 },
  segmentActive: { backgroundColor: "#efe5f3", color: "#6a3f7a", fontWeight: "900", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  segmentText: { color: "#756b7c", fontWeight: "800", paddingHorizontal: 16, paddingVertical: 9 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fffdf9", borderRadius: 18, padding: 13, borderWidth: 1, borderColor: "rgba(68,43,78,0.1)", marginBottom: 10 },
  personPhoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#d69b65" },
  callIcon: { color: "#6a3f7a", fontSize: 20, fontWeight: "900" },
  companionHero: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  robotImage: { width: 106, height: 92, borderRadius: 22, backgroundColor: "#f1e6f3" },
  chatBubble: { alignSelf: "flex-start", maxWidth: "82%", backgroundColor: "#fff6eb", borderRadius: 16, padding: 12, marginBottom: 9, borderWidth: 1, borderColor: "rgba(68,43,78,0.08)" },
  chatBubbleRight: { alignSelf: "flex-end", backgroundColor: "#efe5f3" },
  chatText: { color: "#12091f", fontSize: 14, fontWeight: "800", lineHeight: 20 },
  chatMeta: { color: "#756b7c", fontSize: 10, marginTop: 4, fontWeight: "800" },
  serviceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff6eb", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "rgba(68,43,78,0.11)", marginBottom: 12 },
  serviceInfo: { flex: 1, minWidth: 0 },
  serviceArt: { width: 86, height: 86, borderRadius: 16, backgroundColor: "#f1e4d4", alignItems: "center", justifyContent: "center", marginLeft: 10 },
  star: { color: "#e28a20", fontWeight: "900", marginTop: 5 },
  smallPrimary: { alignSelf: "flex-start", backgroundColor: "#71447f", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, marginTop: 10 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  category: { width: "30%", minWidth: 92, alignItems: "center", backgroundColor: "#fffdf9", borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "rgba(68,43,78,0.1)" },
  categoryIcon: { fontSize: 22, marginBottom: 6 },
  categoryText: { color: "#12091f", fontSize: 12, fontWeight: "800", textAlign: "center" },
  wellnessGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  feedImage: { width: "100%", height: 170, borderRadius: 16, marginTop: 12, backgroundColor: "#f1e4d4" },
  feedMeta: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
  postInput: { minHeight: 112, borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,43,78,0.1)", backgroundColor: "#fffaf5", padding: 14, marginBottom: 12 },
  eventCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fffdf9", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "rgba(68,43,78,0.1)", marginBottom: 12, shadowColor: "#392743", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  eventImage: { width: 92, height: 92, borderRadius: 16, backgroundColor: "#f1e4d4" },
  analyticsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  ringMetric: { flexGrow: 1, minWidth: 116, backgroundColor: "#fffdf9", borderRadius: 18, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(68,43,78,0.1)", shadowColor: "#392743", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  ringOuter: { width: 66, height: 66, borderRadius: 33, borderWidth: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#fffaf5", marginBottom: 8 },
  ringPercent: { fontSize: 15, fontWeight: "900" },
  ringValue: { color: "#12091f", fontSize: 15, fontWeight: "900", textAlign: "center" },
  ringLabel: { color: "#756b7c", fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 2 },
  mapCard: { backgroundColor: "#fffdf9", borderRadius: 22, padding: 14, borderWidth: 1, borderColor: "rgba(68,43,78,0.1)", marginBottom: 14, shadowColor: "#392743", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  mapGrid: { height: 230, borderRadius: 18, overflow: "hidden", backgroundColor: "#f1e6f3", position: "relative", marginBottom: 12 },
  safeZoneCircle: { position: "absolute", width: 168, height: 168, borderRadius: 84, borderWidth: 2, borderColor: "rgba(106,63,122,0.28)", backgroundColor: "rgba(106,63,122,0.08)", left: 88, top: 42 },
  mapPin: { position: "absolute", width: 56, height: 56, borderRadius: 28, backgroundColor: "#fffdf9", alignItems: "center", justifyContent: "center", left: 140, top: 86, shadowColor: "#392743", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  mapPinAlert: { backgroundColor: "#ffe1df" },
  mapPinText: { fontSize: 28 },
  mapRoadOne: { position: "absolute", left: -30, top: 148, width: 430, height: 18, backgroundColor: "rgba(255,255,255,0.74)", transform: [{ rotate: "-18deg" }] },
  mapRoadTwo: { position: "absolute", left: 168, top: -20, width: 18, height: 300, backgroundColor: "rgba(255,255,255,0.68)", transform: [{ rotate: "22deg" }] },
  mapInfo: { paddingHorizontal: 4, paddingBottom: 2 },
  alertText: { color: "#d95f4f", fontSize: 14, fontWeight: "900", marginTop: 6 },
  safeText: { color: "#3f8c55", fontSize: 14, fontWeight: "900", marginTop: 6 },
  deviceCard: { flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "#fffdf9", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "rgba(68,43,78,0.11)", marginBottom: 12, shadowColor: "#392743", shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  deviceHalo: { width: 58, height: 58, borderRadius: 22, alignItems: "center", justifyContent: "center", shadowColor: "#392743", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  deviceIcon: { color: "white", fontSize: 26, fontWeight: "900" },
  deviceCopy: { flex: 1, minWidth: 0 },
  deviceTopLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 },
  deviceStatus: { color: "#3f8c55", fontSize: 12, fontWeight: "900", backgroundColor: "#e8f4e6", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, overflow: "hidden", flexShrink: 0, minWidth: 82, textAlign: "center" },
  deviceMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  deviceMeta: { color: "#6a3f7a", fontSize: 12, fontWeight: "900", backgroundColor: "#f1e6f3", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, overflow: "hidden" },
  proximityCard: { backgroundColor: "#fff1dd", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(68,43,78,0.1)", marginBottom: 14 },
  roomTrack: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16 },
  roomStep: { alignItems: "center", flex: 1 },
  roomDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#d9c6de", marginBottom: 7 },
  roomDotActive: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#6a3f7a", marginTop: -3 },
  roomDotAlert: { backgroundColor: "#ee6768" },
  roomText: { color: "#756b7c", fontSize: 11, fontWeight: "900", textAlign: "center" },
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  vitalTile: { width: "48%", minWidth: 148, backgroundColor: "#fffdf9", borderRadius: 18, padding: 15, borderWidth: 1, borderColor: "rgba(68,43,78,0.11)", shadowColor: "#392743", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  vitalPulse: { width: 12, height: 12, borderRadius: 6, marginBottom: 10 },
  vitalLabel: { color: "#756b7c", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  vitalValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 5, marginTop: 5 },
  vitalValue: { fontSize: 31, lineHeight: 36, fontWeight: "900", letterSpacing: -1 },
  vitalUnit: { color: "#756b7c", fontSize: 14, fontWeight: "900", marginBottom: 5 },
  vitalStatus: { color: "#12091f", fontSize: 13, fontWeight: "800", marginTop: 8 },
  voiceCommand: { backgroundColor: "#fff6eb", borderRadius: 16, padding: 13, borderWidth: 1, borderColor: "rgba(68,43,78,0.09)", marginTop: 10 },
  voicePhrase: { color: "#12091f", fontSize: 16, fontWeight: "900", lineHeight: 22 },
  voiceRoute: { color: "#6a3f7a", fontSize: 13, fontWeight: "900", marginTop: 4 },
  chart: { height: 116, flexDirection: "row", alignItems: "flex-end", gap: 7, paddingVertical: 12, paddingHorizontal: 4 },
  chartSlot: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  chartBar: { width: "78%", borderRadius: 999, opacity: 0.78 },
  wellnessRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(68,43,78,0.09)", paddingTop: 12, marginTop: 12, gap: 12 },
  wellnessValue: { color: "#6a3f7a", fontSize: 16, fontWeight: "900" }
});
