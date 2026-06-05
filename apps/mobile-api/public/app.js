const app = document.querySelector("#app");
let state = null;
let mode = localStorage.getItem("seniorguruRole") || "";
let view = "today";
let matches = [];
let circlePersonId = localStorage.getItem("seniorguruCirclePersonId") || "rita";
let circleState = null;

const views = {
  resident: ["today", "help", "medications", "people", "feed", "services", "events", "companion"],
  provider: ["onboarding", "dashboard", "requests", "bookings", "services", "reviews", "promotions"],
  circle: ["monitor", "safety", "assist", "permissions"]
};

const labels = {
  today: "Today", help: "Help", medications: "Medication", people: "Your People", feed: "Community Feed",
  services: "Services", events: "Events", companion: "Companion", dashboard: "Dashboard",
  onboarding: "Business Onboarding", requests: "Leads & Matches", bookings: "Bookings", reviews: "Reviews", promotions: "Promotions",
  monitor: "Monitor", safety: "Live Safety", assist: "Help Anita", permissions: "Permissions"
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {"Content-Type": "application/json", ...(options.headers || {})}
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

async function load() {
  state = await api("/api/state");
  circleState = await api(`/api/circle?personId=${circlePersonId}`);
  render();
}

async function mutate(path, payload, method = "POST") {
  state = await api(path, {method, body: JSON.stringify(payload)});
  toast("Updated");
  render();
}

function toast(text) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = text;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1800);
}

function initials(name) {
  return name.split(" ").map(part => part[0]).join("").slice(0, 2);
}

function iconFor(text) {
  const t = text.toLowerCase();
  if (t.includes("ride") || t.includes("transport")) return "🚙";
  if (t.includes("pharmacy") || t.includes("medicine") || t.includes("refill")) return "💊";
  if (t.includes("food")) return "🍽";
  if (t.includes("review")) return "★";
  if (t.includes("fall") || t.includes("sos")) return "SOS";
  if (t.includes("zone") || t.includes("stillness")) return "⚠";
  return "▣";
}

function render() {
  if (!mode) {
    app.innerHTML = renderRoleChooser();
    return;
  }
  if (mode === "resident" && !state.resident.onboardingComplete && view !== "residentOnboarding") {
    view = "residentOnboarding";
  }
  if (mode === "provider" && !state.business.onboardingComplete && view !== "onboarding") {
    view = "onboarding";
  }
  if (mode === "circle" && !localStorage.getItem("seniorguruCirclePersonId") && view !== "circleInvite") {
    view = "circleInvite";
  }
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand"><div class="mark">SG</div><div><h1>TheSeniorguru</h1><p>Your day. Your people. Your support.</p></div></div>
        <div class="switcher">
          <button class="chip ${mode === "resident" ? "active" : ""}" data-mode="resident">Resident app</button>
          <button class="chip ${mode === "circle" ? "active" : ""}" data-mode="circle">Trusted circle</button>
          <button class="chip ${mode === "provider" ? "active" : ""}" data-mode="provider">Provider workspace</button>
        </div>
      </header>
      <section class="workspace">
        ${renderRail()}
        <section class="stage">${mode === "resident" ? renderResident() : mode === "circle" ? renderCircle() : renderProvider()}</section>
      </section>
    </main>
  `;
}

function renderRoleChooser() {
  return `
    <main class="shell">
      <section class="entry">
        <div class="brand entry-brand"><div class="mark">SG</div><div><h1>TheSeniorguru</h1><p>Your day. Your people. Your support.</p></div></div>
        <div>
          <h2>How will you use TheSeniorguru?</h2>
          <p>This is the first step after downloading the app. We use it to start the right onboarding flow.</p>
        </div>
        <div class="role-grid">
          <button class="role-card" data-start-role="resident"><strong>I am a senior</strong><span>I will use this app daily for support, reminders, companionship, rides, services, safety, and community.</span></button>
          <button class="role-card" data-start-role="provider"><strong>I am a business</strong><span>I support seniors with services such as rides, medication delivery, home care, food, wellness, or community programs.</span></button>
          <button class="role-card" data-start-role="circle"><strong>I am a trusted person</strong><span>I was invited by a senior to monitor, check in, coordinate help, or support them with limited access.</span></button>
        </div>
      </section>
    </main>
  `;
}

function renderRail() {
  const pendingMeds = state.medications.filter(med => med.status !== "taken").length;
  const newRequests = state.requests.filter(req => req.status === "new").length;
  return `
    <aside class="rail">
      <h2>${mode === "resident" ? `Good morning, ${state.resident.name.split(" ")[0]} 👋` : mode === "circle" ? `${circleState.person.name}` : "CareRide Business"}</h2>
      <nav class="nav">
        ${views[mode].map(item => `<button class="${view === item ? "active" : ""}" data-view="${item}">${labels[item]}</button>`).join("")}
      </nav>
      <div class="summary-card">
        <span class="muted">${mode === "resident" ? "Open care items" : mode === "circle" ? "Open helper tasks" : "New service requests"}</span><br>
        <strong>${mode === "resident" ? pendingMeds : mode === "circle" ? circleState.tasks.filter(task => task.status === "open").length : newRequests}</strong>
      </div>
      <div class="summary-card">
        <span class="muted">${mode === "resident" ? "Trusted circle" : mode === "circle" ? "Permissions" : "Upcoming bookings"}</span><br>
        <strong>${mode === "resident" ? state.people.length : mode === "circle" ? circleState.permissions.length : state.bookings.length}</strong>
      </div>
      ${mode === "resident" ? `<button class="btn danger" style="width:100%;margin-top:18px" data-action="sos">SOS Emergency help</button>` : ""}
    </aside>
  `;
}

function renderResident() {
  if (view === "residentOnboarding") return residentOnboarding();
  if (!views.resident.includes(view)) view = "today";
  const map = {today, help, medications, people, feed, services, events, companion};
  return map[view]();
}

function renderProvider() {
  if (!state.business.onboardingComplete && view !== "onboarding") view = "onboarding";
  if (!views.provider.includes(view)) view = "dashboard";
  const map = {onboarding, dashboard, requests, bookings, services: providerServices, reviews, promotions};
  return map[view]();
}

function renderCircle() {
  if (view === "circleInvite") return circleInvite();
  if (!views.circle.includes(view)) view = "monitor";
  const map = {monitor, safety, assist, permissions};
  return map[view]();
}

function businessServices() {
  return state.services.filter(service => service.provider === state.business.name);
}

function entitlement() {
  if (state.business.plan === "paid") {
    return {
      title: "$100/month Growth",
      serviceLimit: "Unlimited",
      leads: `${state.business.leadQuota.usedThisMonth}/${state.business.leadQuota.paidPerMonth + state.business.leadQuota.topUps} leads this month`
    };
  }
  return {
    title: "Free",
    serviceLimit: "1 service",
    leads: `${state.business.leadQuota.usedThisYear}/${state.business.leadQuota.freePerYear} leads this year`
  };
}

function head(title, sub = "") {
  return `<div class="view-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div></div>`;
}

function residentOnboarding() {
  const senior = state.resident;
  return `${head("Senior Onboarding", "Personalize the daily app before the resident dashboard opens.")}
    <div class="content">
      <div class="wizard-progress">
        <span class="active">1 Profile</span><span class="active">2 Community</span><span class="active">3 Safety</span><span>4 Daily Support</span><span>5 Finish</span>
      </div>
      <div class="grid two">
        <div class="card">
          <h3>Tell us about you</h3>
          <div class="form">
            <label>Full name<input class="input" id="residentName" value="${senior.name}"></label>
            <label>Age<input class="input" id="residentAge" value="${senior.age}"></label>
            <label>Community or neighborhood<input class="input" id="residentCommunity" value="${senior.community}"></label>
            <label>How are you feeling today?<input class="input" id="residentMood" value="${senior.mood}"></label>
          </div>
        </div>
        <div class="card">
          <h3>Safety contacts</h3>
          <p class="muted">These are the people we can show in SOS and trusted-circle flows.</p>
          <textarea id="residentSos" rows="5">${senior.sosContacts.join(", ")}</textarea>
          <button class="btn primary" data-action="save-resident" style="margin-top:12px">Save profile</button>
        </div>
        <div class="card hero-card">
          <h3>What opens next</h3>
          <p>The daily senior app starts with medication reminders, rides, help requests, people, Guru companion, services, events, and SOS.</p>
        </div>
        <div class="card">
          <h3>Finish senior setup</h3>
          <p>We need name, age, community, and at least one safety contact.</p>
          <button class="btn primary" data-action="complete-resident">Complete senior onboarding</button>
        </div>
      </div>
    </div>`;
}

function circleInvite() {
  return `${head("Trusted Person Invite", "Trusted people join through an invite from a senior and receive limited access only.")}
    <div class="content grid two">
      <div class="card">
        <h3>Enter invite code</h3>
        <p class="muted">Demo invite codes: RITA-ANITA, ARJUN-ANITA, DRMEHTA-ANITA, SUNITA-ANITA.</p>
        <div class="form">
          <input class="input" id="inviteCode" value="RITA-ANITA">
          <button class="btn primary" data-action="accept-invite">Accept invite</button>
        </div>
      </div>
      <div class="card hero-card">
        <h3>Limited-access account</h3>
        <p>After accepting the invite, the trusted person sees only approved categories such as wellness, medication, rides, messages, or SOS.</p>
      </div>
    </div>`;
}

function onboarding() {
  const biz = state.business;
  const plan = entitlement();
  return `${head("Business Onboarding", "Set up the business profile, service area, services, and lead package before the provider workspace opens.")}
    <div class="content">
      <div class="wizard-progress">
        <span class="active">1 Business</span><span class="active">2 Audience</span><span class="active">3 Online</span><span class="${businessServices().length ? "active" : ""}">4 Services</span><span class="${biz.onboardingComplete ? "active" : ""}">5 Package</span>
      </div>
      <div class="grid two">
        <div class="card">
          <h3>Business details</h3>
          <div class="form">
            <label>Business name<input class="input" id="bizName" value="${biz.name}"></label>
            <label>Business owner<input class="input" id="bizOwner" value="${biz.owner}"></label>
            <label>Contact person<input class="input" id="bizContact" value="${biz.contactPerson}"></label>
            <label>Description<textarea id="bizDescription" rows="4">${biz.description}</textarea></label>
          </div>
        </div>
        <div class="card">
          <h3>Contact and online presence</h3>
          <div class="form">
            <label>Email<input class="input" id="bizEmail" value="${biz.email}"></label>
            <label>Phone<input class="input" id="bizPhone" value="${biz.phone}"></label>
            <label>Website<input class="input" id="bizWebsite" value="${biz.website}"></label>
            <label>Google Business Profile<input class="input" id="bizGoogle" value="${biz.googleBusinessProfile}"></label>
          </div>
        </div>
        <div class="card">
          <h3>Demographics and areas served</h3>
          <div class="form">
            <label>Demographics served<textarea id="bizDemographics" rows="4">${biz.demographics.join(", ")}</textarea></label>
            <label>Areas served<textarea id="bizAreas" rows="4">${biz.serviceAreas.join(", ")}</textarea></label>
            <button class="btn primary" data-action="save-business">Save business profile</button>
          </div>
        </div>
        <div class="card">
          <h3>Create services</h3>
          <p class="muted">Free package includes 1 service. More than 1 service requires the $100/month paid package.</p>
          <div class="form">
            <input class="input" id="serviceName" placeholder="Service name, e.g. Airport Rides">
            <input class="input" id="serviceCategory" placeholder="Category, e.g. Transportation">
            <input class="input" id="servicePrice" placeholder="Price, e.g. $35 - $60">
            <button class="btn primary" data-action="add-service">Add service</button>
          </div>
          <div style="margin-top:14px">${businessServices().map(service => `<div class="row"><div class="icon">${iconFor(service.category)}</div><div><strong>${service.name}</strong><br><span class="muted">${service.category} · ${service.price}</span></div><span class="tag ok">Active</span></div>`).join("")}</div>
        </div>
        <div class="card">
          <h3>Package</h3>
          <div class="plan-grid">
            <button class="plan ${biz.plan === "free" ? "selected" : ""}" data-plan="free"><strong>Free</strong><span>1 service</span><span>5 leads per year</span><span>$0</span></button>
            <button class="plan ${biz.plan === "paid" ? "selected" : ""}" data-plan="paid"><strong>$100/month</strong><span>More than 1 service</span><span>5 leads per month</span><span>Top up after limit</span></button>
          </div>
          <p><strong>Current:</strong> ${plan.title}<br><span class="muted">${plan.serviceLimit} · ${plan.leads}</span></p>
          <button class="btn" data-action="top-up">Add 5 lead top-up</button>
        </div>
        <div class="card hero-card">
          <h3>Finish onboarding</h3>
          <p>This checks required profile fields, Google Business Profile, demographics, service areas, and at least one service.</p>
          <button class="btn primary" data-action="complete-onboarding">Complete business onboarding</button>
          <p class="muted">${biz.onboardingComplete ? "Onboarding complete. Dashboard is unlocked." : "Dashboard stays gated until setup is complete."}</p>
        </div>
      </div>
    </div>`;
}

function permissionTag(permission) {
  const names = {wellness: "Wellness", medications: "Medication", rides: "Rides", messages: "Messages", sos: "SOS", safety: "Live Safety"};
  return `<span class="tag ok">${names[permission] || permission}</span>`;
}

function monitor() {
  return `${head("Trusted Circle Monitor", `${circleState.person.name} can help ${circleState.resident.name}, but only within approved permissions.`)}
    <div class="content">
      <div class="circle-selector card">
        <strong>Viewing as</strong>
        <select class="input" id="circlePerson">${state.people.map(person => `<option value="${person.id}" ${circlePersonId === person.id ? "selected" : ""}>${person.name} - ${person.role}</option>`).join("")}</select>
      </div>
      <div class="grid three">
        <div class="card"><h3>Resident snapshot</h3><div class="row"><div class="avatar">${initials(circleState.resident.name)}</div><div><strong>${circleState.resident.name}</strong><br><span class="muted">${circleState.resident.community}</span></div></div><p><strong>Mood:</strong> ${circleState.resident.mood}</p>${circleState.permissions.map(permissionTag).join(" ")}</div>
        <div class="card"><h3>Helper tasks</h3>${circleState.tasks.length ? circleState.tasks.map(task => `<div class="row"><div class="icon">${iconFor(task.type)}</div><div><strong>${task.type}</strong><br><span class="muted">${task.body}</span></div><button class="btn green" data-ack-task="${task.id}">${task.status}</button></div>`).join("") : "<p class='muted'>No assigned tasks.</p>"}</div>
        <div class="card"><h3>SOS scope</h3>${circleState.sosContacts.length ? circleState.sosContacts.map(contact => `<div class="row"><div class="icon green">🛡</div><strong>${contact}</strong><span class="tag ok">Visible</span></div>`).join("") : "<p class='muted'>SOS contacts are hidden for this person.</p>"}</div>
        <div class="card"><h3>Live safety</h3>${circleState.safety ? `<div class="row"><div class="icon green">📍</div><div><strong>${circleState.safety.location.label}</strong><br><span class="muted">${circleState.safety.movement.status} · battery ${circleState.safety.movement.phoneBattery}%</span></div><button class="btn" data-view="safety">Open</button></div>` : "<p class='muted'>Live safety tracking is not shared.</p>"}</div>
        <div class="card"><h3>Medication visibility</h3>${circleState.medications.length ? circleState.medications.map(med => `<div class="row"><div class="icon orange">💊</div><div><strong>${med.name}</strong><br><span class="muted">${med.time} · ${med.remaining} pills · ${med.status}</span></div></div>`).join("") : "<p class='muted'>Medication details are not shared.</p>"}</div>
        <div class="card"><h3>Ride visibility</h3>${circleState.bookings.length ? circleState.bookings.map(bookingRow).join("") : "<p class='muted'>Ride and booking details are not shared.</p>"}</div>
        <div class="card"><h3>Recent messages</h3>${circleState.messages.length ? circleState.messages.map(msg => `<div class="row"><div class="avatar">${initials(msg.from)}</div><div><strong>${msg.from}</strong><br><span>${msg.body}</span></div></div>`).join("") : "<p class='muted'>Messages are not shared.</p>"}</div>
      </div>
    </div>`;
}

function safety() {
  if (!circleState.safety) {
    return `${head("Live Safety", "This trusted person does not have live safety permission.")}
      <div class="content"><div class="card"><h3>Access limited</h3><p class="muted">The senior has not shared location, movement, or fall-detection data with this connected person.</p></div></div>`;
  }
  const safety = circleState.safety;
  const homeZone = safety.safeZones.find(zone => zone.id === "home") || safety.safeZones[0];
  return `${head("Live Safety", "Live location, movement analytics, dementia/memory-loss wandering support, and automatic SOS escalation.")}
    <div class="content">
      <div class="grid four">
        <div class="card"><span class="muted">Location</span><h3>${safety.location.label}</h3><p>${safety.location.lat}, ${safety.location.lng}<br>Accuracy ${safety.location.accuracyMeters}m</p></div>
        <div class="card"><span class="muted">Movement</span><h3>${safety.movement.status}</h3><p>${safety.movement.stepsLastHour} steps last hour<br>${safety.movement.stillMinutes} still minutes</p></div>
        <div class="card"><span class="muted">Fall confidence</span><h3>${Math.round(safety.fallDetection.confidence * 100)}%</h3><p>${safety.fallDetection.status}</p></div>
        <div class="card"><span class="muted">Safe zone</span><h3>${homeZone.status}</h3><p>${homeZone.name}<br>${homeZone.radiusMeters}m radius</p></div>
      </div>
      <div class="grid two" style="margin-top:16px">
        <div class="card live-map">
          <div class="map-pin">📍</div>
          <h3>${safety.location.label}</h3>
          <p>Live tracking ${safety.liveTrackingEnabled ? "enabled" : "disabled"} · updated ${new Date(safety.lastUpdated).toLocaleString()}</p>
        </div>
        <div class="card">
          <h3>Phone analytics simulation</h3>
          <p class="muted">In production this would come from phone sensors, GPS, accelerometer, gyroscope, and safe-zone rules. This demo lets us trigger the backend risk logic.</p>
          <div class="button-row">
            <button class="btn" data-safety-sim="normal">Normal movement</button>
            <button class="btn" data-safety-sim="wandering">Safe-zone exit</button>
            <button class="btn danger" data-safety-sim="fall">Likely fall</button>
            <button class="btn danger" data-safety-sim="stillness">Unusual stillness</button>
          </div>
        </div>
        <div class="card"><h3>Risk signals</h3>${safety.riskSignals.map(signal => `<div class="row"><div class="icon orange">⚠</div><div><strong>${signal.type}</strong><br><span class="muted">${signal.body}</span></div><span class="tag pending">${signal.severity}</span></div>`).join("")}</div>
        <div class="card"><h3>SOS events</h3>${safety.sosEvents.length ? safety.sosEvents.map(event => `<div class="row"><div class="icon red">SOS</div><div><strong>${event.type}</strong><br><span class="muted">${event.body}<br>Notified: ${event.notified.join(", ")}</span></div><span class="tag">${event.severity}</span></div>`).join("") : "<p class='muted'>No active SOS events.</p>"}</div>
      </div>
    </div>`;
}

function assist() {
  return `${head("Help Anita", "Connected people can assist, check in, and acknowledge tasks without becoming the resident account.")}
    <div class="content grid two">
      <div class="card">
        <h3>Send a check-in</h3>
        <p class="muted">Requires message permission.</p>
        <textarea id="circleMessage" rows="4">Hi Anita, checking in. Do you need help with anything today?</textarea>
        <button class="btn primary" data-action="circle-message" style="margin-top:12px">Send to Anita</button>
      </div>
      <div class="card">
        <h3>Assist queue</h3>
        ${circleState.tasks.length ? circleState.tasks.map(task => `<div class="row"><div class="icon">${iconFor(task.type)}</div><div><strong>${task.type}</strong><br><span class="muted">${task.body}</span></div><button class="btn green" data-ack-task="${task.id}">${task.status}</button></div>`).join("") : "<p class='muted'>No assigned tasks.</p>"}
      </div>
      <div class="card hero-card"><h3>Limited access rule</h3><p>This helper can monitor only granted categories. They cannot edit Anita's profile, confirm medication as Anita, change services, or access provider/business settings.</p></div>
      <div class="card"><h3>What they can do</h3><p>${circleState.permissions.map(permissionTag).join(" ")}</p></div>
    </div>`;
}

function permissions() {
  return `${head("Permissions", "Each connected person gets a different access profile.")}
    <div class="content grid two">
      ${state.people.map(person => `<div class="card"><div class="row"><div class="avatar">${initials(person.name)}</div><div><strong>${person.name}</strong><br><span class="muted">${person.role} · ${person.status}</span></div><button class="btn ${circlePersonId === person.id ? "primary" : ""}" data-circle-person="${person.id}">View as</button></div><p>${(person.permissions || []).map(permissionTag).join(" ")}</p></div>`).join("")}
    </div>`;
}

async function refreshCircle(personId = circlePersonId) {
  circlePersonId = personId;
  localStorage.setItem("seniorguruCirclePersonId", circlePersonId);
  circleState = await api(`/api/circle?personId=${circlePersonId}`);
}

function today() {
  const due = state.medications.find(med => med.status === "due") || state.medications[0];
  return `
    <div class="content phone-grid">
      <div class="phone"><div class="phone-inner">
        <h2>Today</h2>
        <p class="muted">Good morning,</p><h2>Anita 👋</h2>
        <div class="card"><div class="row"><div class="icon orange">💊</div><div><strong>${due.name}</strong><br><span class="muted">${due.time} · ${due.remaining} pills left</span></div><button class="btn primary" data-confirm-med="${due.id}">Taken</button></div></div>
        <h3>Next up</h3>
        <div class="card"><div class="row"><div class="icon">🚙</div><div><strong>Ride to Cardiology Appointment</strong><br><span class="muted">Tomorrow, 10:00 AM</span></div><button class="btn" data-view="help">Open</button></div></div>
        <h3>A little connection</h3>
        <div class="card"><div class="row"><div class="avatar">R</div><div><strong>Message from Rita</strong><br><span class="muted">Good morning Anita ☀</span></div><button class="btn" data-view="people">Call</button></div></div>
        <button class="btn danger" style="width:100%;margin-top:14px" data-action="sos">SOS Emergency help</button>
      </div>${bottomNav("today")}</div>
    </div>`;
}

function help() {
  return `${head("How can we help?", "Natural-language request matching backed by the local service scoring API.")}
    <div class="content grid two">
      <div class="card">
        <h3>Smart request</h3>
        <div class="form">
          <textarea id="need" rows="4">I need a ride to my doctor appointment tomorrow.</textarea>
          <button class="btn primary" data-action="match">Find matches</button>
        </div>
      </div>
      <div class="card">
        <h3>Matched for you</h3>
        ${(matches.length ? matches : state.services.filter(s => s.category === "Transportation")).slice(0, 4).map(service => `
          <div class="row"><div class="icon">${iconFor(service.category)}</div><div><strong>${service.name}</strong><br><span class="muted">${service.category} · ★ ${service.rating} · ${service.price}</span></div><button class="btn primary" data-book="${service.id}">Book</button></div>
        `).join("")}
      </div>
      <div class="card"><h3>Popular requests</h3>${["I need a ride", "I need help with medication", "I need food", "I feel lonely"].map(item => `<div class="row"><div class="icon">${iconFor(item)}</div><strong>${item}</strong><button class="btn" data-quick="${item}">Use</button></div>`).join("")}</div>
      <div class="card"><h3>Request status</h3>${state.requests.slice(0,4).map(requestRow).join("")}</div>
    </div>`;
}

function medications() {
  return `${head("Medication", "Confirm doses and request refills through API-backed workflows.")}
    <div class="content grid">
      ${state.medications.map(med => `
        <div class="card">
          <div class="row"><div class="icon orange">💊</div><div><strong>${med.name}</strong><br><span class="muted">${med.condition} · ${med.time}</span></div><span class="tag ${med.status === "taken" ? "ok" : "pending"}">${med.status}</span></div>
          <p><strong>${med.remaining}</strong> pills remaining</p>
          <button class="btn green" data-confirm-med="${med.id}">Yes, I took it</button>
          <button class="btn" data-refill="${med.id}">Request refill</button>
        </div>`).join("")}
      <div class="card"><h3>Refill queue</h3>${state.refills.length ? state.refills.map(item => `<div class="row"><div class="icon">💊</div><div><strong>${item.medication}</strong><br><span class="muted">${item.status}</span></div></div>`).join("") : "<p class='muted'>No active refills yet.</p>"}</div>
    </div>`;
}

function people() {
  return `${head("Your People", "Trusted circle, care contacts, and shared safety context.")}
    <div class="content grid">
      ${state.people.map(person => `<div class="card"><div class="row"><div class="avatar">${initials(person.name)}</div><div><strong>${person.name}</strong><br><span class="muted">${person.role} · ${person.status}</span></div><button class="btn">Call</button></div></div>`).join("")}
      <div class="card hero-card"><h3>Safety contacts</h3>${state.resident.sosContacts.map(contact => `<div class="row"><div class="icon green">🛡</div><strong>${contact}</strong><span class="tag ok">SOS</span></div>`).join("")}</div>
    </div>`;
}

function feed() {
  return `${head("Community Feed", "Posts and activity are code-native, creatable, and persisted.")}
    <div class="content grid two">
      <div class="card"><h3>Create post</h3><textarea id="postBody" rows="5" placeholder="What's on your mind?"></textarea><button class="btn primary" data-action="post" style="margin-top:12px">Post</button></div>
      ${state.posts.map(post => `<div class="card feed-post"><div class="row"><div class="avatar">${initials(post.author)}</div><div><strong>${post.author}</strong><br><span class="muted">Community</span></div></div><p>${post.body}</p><div class="fake-img">🌿</div><span>❤ ${post.likes} &nbsp; ◌ ${post.comments}</span></div>`).join("")}
    </div>`;
}

function services() {
  return `${head("Services", "Resident service discovery connected to booking creation.")}
    <div class="content grid">
      ${state.services.map(service => `<div class="card"><div class="row"><div class="icon">${iconFor(service.category)}</div><div><strong>${service.name}</strong><br><span class="muted">${service.category} · ★ ${service.rating}</span></div></div><p>${service.eta}<br>${service.price}</p><button class="btn primary" data-book="${service.id}">Book service</button></div>`).join("")}
    </div>`;
}

function events() {
  return `${head("Events & Activities", "Joinable local activities persisted through the API.")}
    <div class="content grid">
      ${state.events.map(event => `<div class="card"><div class="fake-img">${event.name.includes("Yoga") ? "🧘" : event.name.includes("Game") ? "🧩" : "🍽"}</div><h3>${event.name}</h3><p class="muted">with ${event.host}<br>${event.time}</p><button class="btn ${event.joined ? "green" : "primary"}" data-event="${event.id}">${event.joined ? "Joined" : "Join"}</button></div>`).join("")}
    </div>`;
}

function companion() {
  return `${head("Companion", "A lightweight Guru assistant flow with persisted conversation state.")}
    <div class="content grid two">
      <div class="card">
        <h3>Talk with Guru</h3>
        <div class="form"><textarea id="guruMessage" rows="4">I didn't sleep well last night.</textarea><button class="btn primary" data-action="message">Send</button></div>
      </div>
      <div class="card">${state.messages.slice(0,8).map(msg => `<div class="row"><div class="avatar">${initials(msg.from)}</div><div><strong>${msg.from}</strong><br><span>${msg.body}</span></div></div>`).join("")}</div>
    </div>`;
}

function dashboard() {
  const newReq = state.requests.filter(req => req.status === "new").length;
  const plan = entitlement();
  return `${head("Good morning, CareRide 👋", "Provider workspace connected to resident requests and booking state.")}
    <div class="content">
      <div class="grid four">
        <div class="card"><span class="muted">New Matches</span><h2>${newReq}</h2></div>
        <div class="card"><span class="muted">Messages</span><h2>${state.messages.length}</h2></div>
        <div class="card"><span class="muted">Upcoming Bookings</span><h2>${state.bookings.length}</h2></div>
        <div class="card"><span class="muted">${plan.title}</span><h2>${plan.leads}</h2></div>
      </div>
      <div class="grid" style="margin-top:16px">
        <div class="card"><h3>New Service Requests</h3>${state.requests.slice(0,5).map(requestRow).join("")}</div>
        <div class="card"><h3>Upcoming Bookings</h3>${state.bookings.slice(0,5).map(bookingRow).join("")}</div>
        <div class="card"><h3>Performance Overview</h3><div class="chart"><svg viewBox="0 0 380 190" width="100%" height="100%"><polyline points="20,160 72,138 124,118 176,90 228,72 280,66 334,38" fill="none" stroke="#714c86" stroke-width="4"/></svg></div></div>
      </div>
    </div>`;
}

function requests() {
  const plan = entitlement();
  return `${head("Leads & Matches", "Provider can convert incoming resident needs into bookings.")}
    <div class="content"><div class="card" style="margin-bottom:16px"><strong>${plan.title}</strong><p class="muted">${plan.leads}. Free package has 5 leads per year. Paid package has 5 leads per month, then top-up.</p></div><div class="grid two">${state.requests.map(req => `<div class="card"><div class="row"><div class="icon">${iconFor(req.type)}</div><div><strong>${req.type}</strong><br><span class="muted">${req.resident} · ${req.time} · ${req.distance}</span></div><span class="tag ${req.status === "new" ? "" : "ok"}">${req.status}</span></div><button class="btn primary" data-provider-book="${req.id}">Create booking</button></div>`).join("")}</div></div>`;
}

function bookings() {
  return `${head("Bookings", "Provider status changes update persisted booking records.")}
    <div class="content grid two">${state.bookings.map(booking => `<div class="card"><div class="row"><div class="icon">▣</div><div><strong>${booking.service}</strong><br><span class="muted">${booking.resident} · ${booking.time}</span></div><span class="tag ${booking.status === "confirmed" ? "ok" : "pending"}">${booking.status}</span></div><button class="btn green" data-booking-status="${booking.id}" data-status="confirmed">Confirm</button> <button class="btn" data-booking-status="${booking.id}" data-status="completed">Complete</button></div>`).join("")}</div>`;
}

function providerServices() {
  return `${head("Services You Offer", "Business service inventory used by resident matching.")}
    <div class="content grid">${businessServices().map(service => `<div class="card"><h3>${service.name}</h3><p>${service.category}<br>★ ${service.rating}<br>${service.price}</p><span class="tag ok">Active</span></div>`).join("")}</div>`;
}

function reviews() {
  return `${head("Customer Reviews", "Operational trust surface for provider quality.")}
    <div class="content grid two"><div class="card"><h2>4.8 ★★★★★</h2><p>Based on 128 reviews</p></div><div class="card"><div class="row"><div class="avatar">A</div><div><strong>Very punctual and kind driver.</strong><br><span class="muted">Made my hospital visit so easy. - Anita S.</span></div></div></div></div>`;
}

function promotions() {
  return `${head("Promotions", "Provider growth workflow tied to marketplace visibility.")}
    <div class="content grid two"><div class="card hero-card"><h3>Promote Your Business</h3><p>Reach more seniors and families in your area.</p><button class="btn primary" onclick="alert('Campaign drafted for CareRide')">Create Promotion</button></div><div class="card"><h3>Campaign logic</h3><p>Promotion campaigns can be attached to service categories and surfaced in resident service discovery.</p></div></div>`;
}

function requestRow(req) {
  return `<div class="row"><div class="icon">${iconFor(req.type)}</div><div><strong>${req.type}</strong><br><span class="muted">${req.time} · ${req.distance}</span></div><span class="tag ${req.status === "new" ? "" : "ok"}">${req.status}</span></div>`;
}

function bookingRow(booking) {
  return `<div class="row"><div class="icon">▣</div><div><strong>${booking.service}</strong><br><span class="muted">${booking.time} · ${booking.provider}</span></div><span class="tag ${booking.status === "confirmed" ? "ok" : "pending"}">${booking.status}</span></div>`;
}

function bottomNav(active) {
  return `<div class="bottom-nav">${["today", "help", "companion", "feed", "services"].map(item => `<button class="${active === item ? "active" : ""}" data-view="${item}">${labels[item]}</button>`).join("")}</div>`;
}

document.addEventListener("click", async event => {
  const startRole = event.target.closest("[data-start-role]");
  if (startRole) {
    mode = startRole.dataset.startRole;
    localStorage.setItem("seniorguruRole", mode);
    view = mode === "resident" ? "residentOnboarding" : mode === "circle" ? "circleInvite" : "onboarding";
    render();
    return;
  }
  const modeButton = event.target.closest("[data-mode]");
  if (modeButton) { mode = modeButton.dataset.mode; localStorage.setItem("seniorguruRole", mode); view = mode === "resident" ? "today" : mode === "circle" ? "monitor" : "dashboard"; render(); return; }
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) { view = viewButton.dataset.view; render(); return; }
  const confirm = event.target.closest("[data-confirm-med]");
  if (confirm) { await mutate("/api/medications/confirm", {id: confirm.dataset.confirmMed}); return; }
  const refill = event.target.closest("[data-refill]");
  if (refill) { await mutate("/api/refills", {medicationId: refill.dataset.refill}); return; }
  const book = event.target.closest("[data-book]");
  if (book) { await mutate("/api/bookings", {serviceId: book.dataset.book, label: "Ride requested", time: "Tomorrow, 10:00 AM"}); return; }
  const eventJoin = event.target.closest("[data-event]");
  if (eventJoin) { await mutate("/api/events/join", {id: eventJoin.dataset.event}); return; }
  const bookingStatus = event.target.closest("[data-booking-status]");
  if (bookingStatus) { await mutate(`/api/bookings/${bookingStatus.dataset.bookingStatus}`, {status: bookingStatus.dataset.status}, "PATCH"); return; }
  const providerBook = event.target.closest("[data-provider-book]");
  if (providerBook) {
    const req = state.requests.find(item => item.id === providerBook.dataset.providerBook);
    const service = state.services.find(item => item.provider === "CareRide") || state.services[0];
    await mutate("/api/bookings", {serviceId: service.id, label: req.type, time: req.time, consumeLead: true});
    return;
  }
  const planButton = event.target.closest("[data-plan]");
  if (planButton) {
    await mutate("/api/business/plan", {plan: planButton.dataset.plan}, "PATCH");
    return;
  }
  if (event.target.closest("[data-action='save-business']")) {
    await mutate("/api/business", {
      name: document.querySelector("#bizName").value,
      owner: document.querySelector("#bizOwner").value,
      contactPerson: document.querySelector("#bizContact").value,
      description: document.querySelector("#bizDescription").value,
      email: document.querySelector("#bizEmail").value,
      phone: document.querySelector("#bizPhone").value,
      website: document.querySelector("#bizWebsite").value,
      googleBusinessProfile: document.querySelector("#bizGoogle").value,
      demographics: document.querySelector("#bizDemographics").value,
      serviceAreas: document.querySelector("#bizAreas").value
    }, "PATCH");
    return;
  }
  if (event.target.closest("[data-action='add-service']")) {
    try {
      await mutate("/api/business/services", {
        name: document.querySelector("#serviceName").value,
        category: document.querySelector("#serviceCategory").value,
        price: document.querySelector("#servicePrice").value
      });
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (event.target.closest("[data-action='complete-onboarding']")) {
    try {
      await mutate("/api/business/complete", {});
      view = "dashboard";
      render();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (event.target.closest("[data-action='top-up']")) {
    await mutate("/api/business/top-up", {leads: 5});
    return;
  }
  if (event.target.closest("[data-action='save-resident']")) {
    await mutate("/api/resident", {
      name: document.querySelector("#residentName").value,
      age: document.querySelector("#residentAge").value,
      community: document.querySelector("#residentCommunity").value,
      mood: document.querySelector("#residentMood").value,
      sosContacts: document.querySelector("#residentSos").value
    }, "PATCH");
    return;
  }
  if (event.target.closest("[data-action='complete-resident']")) {
    try {
      await mutate("/api/resident/complete", {});
      view = "today";
      render();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  if (event.target.closest("[data-action='accept-invite']")) {
    try {
      circleState = await api("/api/circle/accept-invite", {method: "POST", body: JSON.stringify({inviteCode: document.querySelector("#inviteCode").value})});
      circlePersonId = circleState.person.id;
      localStorage.setItem("seniorguruCirclePersonId", circlePersonId);
      view = "monitor";
      toast("Invite accepted");
      render();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const circlePerson = event.target.closest("[data-circle-person]");
  if (circlePerson) {
    await refreshCircle(circlePerson.dataset.circlePerson);
    render();
    return;
  }
  const ackTask = event.target.closest("[data-ack-task]");
  if (ackTask) {
    circleState = await api("/api/circle/tasks/ack", {method: "POST", body: JSON.stringify({id: ackTask.dataset.ackTask})});
    state = await api("/api/state");
    toast("Task acknowledged");
    render();
    return;
  }
  if (event.target.closest("[data-action='circle-message']")) {
    try {
      circleState = await api("/api/circle/help-message", {method: "POST", body: JSON.stringify({personId: circlePersonId, body: document.querySelector("#circleMessage").value})});
      state = await api("/api/state");
      toast("Message sent");
      render();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const safetySim = event.target.closest("[data-safety-sim]");
  if (safetySim) {
    const scenarios = {
      normal: {movementStatus: "walking", stepsLastHour: 520, stillMinutes: 4, fallConfidence: 0.05, impactDetected: false, safeZoneStatus: "inside", location: {label: "Park View Community - Garden Walkway"}},
      wandering: {movementStatus: "walking", stepsLastHour: 1300, stillMinutes: 0, fallConfidence: 0.1, impactDetected: false, safeZoneStatus: "outside", location: {label: "Outside Park View safe zone - North entrance"}},
      fall: {movementStatus: "no movement after impact", stepsLastHour: 32, stillMinutes: 12, fallConfidence: 0.91, impactDetected: true, safeZoneStatus: "inside", location: {label: "Park View Community - Apartment hallway"}},
      stillness: {movementStatus: "still", stepsLastHour: 0, stillMinutes: 58, fallConfidence: 0.34, impactDetected: false, safeZoneStatus: "inside", location: {label: "Park View Community - Bedroom"}}
    };
    const result = await api("/api/safety/phone-analytics", {method: "POST", body: JSON.stringify(scenarios[safetySim.dataset.safetySim])});
    state = result.state;
    await refreshCircle(circlePersonId);
    toast("Phone analytics processed");
    render();
    return;
  }
  if (event.target.closest("[data-action='match']")) {
    const need = document.querySelector("#need").value;
    const result = await api("/api/help/match", {method: "POST", body: JSON.stringify({need})});
    matches = result.matches;
    toast(`${matches.length} matches found`);
    render();
    return;
  }
  const quick = event.target.closest("[data-quick]");
  if (quick) { document.querySelector("#need").value = quick.dataset.quick; return; }
  if (event.target.closest("[data-action='post']")) {
    await mutate("/api/posts", {body: document.querySelector("#postBody").value});
    return;
  }
  if (event.target.closest("[data-action='message']")) {
    await mutate("/api/messages", {body: document.querySelector("#guruMessage").value});
    return;
  }
  if (event.target.closest("[data-action='sos']")) {
    toast(`SOS routed to ${state.resident.sosContacts.join(", ")}`);
  }
});

document.addEventListener("change", async event => {
  if (event.target.id === "circlePerson") {
    await refreshCircle(event.target.value);
    render();
  }
});

load().catch(error => {
  app.innerHTML = `<main class="shell"><div class="card"><h1>Unable to start app</h1><p>${error.message}</p></div></main>`;
});
