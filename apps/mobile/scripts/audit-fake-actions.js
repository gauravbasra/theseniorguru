const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "App.tsx");
const source = fs.readFileSync(appPath, "utf8");

const forbiddenGenericTaskPatterns = [
  { label: "medication confirmation", pattern: /Medication confirmed:[\s\S]{0,180}\/api\/guru\/tasks/ },
  { label: "medication reminder", pattern: /Remind Anita later[\s\S]{0,180}\/api\/guru\/tasks/ },
  { label: "medication skip", pattern: /Medication skipped:[\s\S]{0,180}\/api\/guru\/tasks/ },
  { label: "refill request", pattern: /Request refill[\s\S]{0,180}\/api\/guru\/tasks/ },
  { label: "ride booking", pattern: /Ride requested[\s\S]{0,180}\/api\/guru\/tasks/ },
  { label: "event interest", pattern: /Interested in Community Lunch[\s\S]{0,180}\/api\/guru\/tasks/ },
  { label: "message trusted circle", pattern: /Message Rita[\s\S]{0,180}\/api\/guru\/tasks/ },
  { label: "medicine camera scan", pattern: /Scan intent created/ }
];

const missing = [];
for (const check of forbiddenGenericTaskPatterns) {
  if (check.pattern.test(source)) missing.push(check.label);
}

if (!source.includes('/api/medications/confirm')) missing.push("domain medication confirm endpoint");
if (!source.includes('/api/medications/remind-later')) missing.push("domain medication remind-later endpoint");
if (!source.includes('/api/medications/skip-dose')) missing.push("domain medication skip-dose endpoint");
if (!source.includes('/api/medications/refill-request')) missing.push("domain refill endpoint");
if (!source.includes('/api/bookings')) missing.push("domain booking endpoint");
if (!source.includes('/api/events/join')) missing.push("domain event join endpoint");
if (!source.includes('/api/messages')) missing.push("domain message endpoint");
if (!source.includes('launchCameraAsync')) missing.push("native camera capture endpoint");

if (missing.length) {
  console.error(`Fake action audit failed: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Fake action audit passed");
