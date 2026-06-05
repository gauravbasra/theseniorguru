const seedState = {
  "resident": {
    "id": "resident_anita",
    "name": "Anita Sharma",
    "age": 68,
    "community": "Park View Community",
    "mood": "Okay",
    "onboardingComplete": true,
    "sosContacts": [
      "Rita Sharma",
      "Arjun Sharma",
      "Meena Joshi"
    ],
    "healthProfile": {
      "conditions": [],
      "allergies": [],
      "mobilityNotes": "",
      "cognitiveSupport": "",
      "primaryCondition": {
        "name": "Parkinsonism with orthostatic dizziness",
        "status": "Active, needs daily monitoring",
        "severity": "High fall-risk support",
        "diagnosedWhen": "2024",
        "symptomsToWatch": [
          "New tremor",
          "Dizziness on standing",
          "Freezing gait"
        ],
        "careTeamNotes": "Approach slowly, offer a chair, ask one question at a time, and notify Rita if dizziness persists."
      },
      "allergyProfile": {
        "allergen": "Penicillin",
        "reaction": "Facial swelling and rash",
        "severity": "Severe",
        "instructions": "Avoid penicillin-class antibiotics. If swelling or breathing trouble occurs, call 911 and notify trusted circle."
      },
      "mobilityProfile": {
        "assistiveDevice": "Walker outside bedroom, grab bars in bathroom",
        "fallHistory": "Two falls in last 6 months, no fracture",
        "transferSupport": "Needs standby assist from bed to bathroom at night",
        "walkingTolerance": "5 minutes before rest",
        "homeRiskAreas": [
          "Bathroom at night",
          "Kitchen threshold",
          "Front porch steps"
        ]
      },
      "memoryProfile": {
        "wanderingRisk": "Moderate after sundown",
        "confusionTriggers": [
          "Poor sleep",
          "Unfamiliar visitors",
          "Missed meals"
        ],
        "reassuranceStyle": "Use warm tone, say you are here to help, repeat the next step once.",
        "routineAnchors": [
          "Breakfast medication",
          "Noon walk with Rita",
          "7 PM family call"
        ]
      },
      "carePreferences": {
        "preferredHospital": "City Care Hospital",
        "emergencyInstructions": "Escalate immediately for fall with head impact, chest pain, stroke signs, severe allergic reaction, or wandering outside safe zone."
      },
      "updatedAt": "2026-06-05T04:43:03.671Z"
    }
  },
  "business": {
    "id": "biz_careride",
    "name": "CareRide",
    "owner": "Rohit Mehta",
    "contactPerson": "Rohit Mehta",
    "email": "rohit@careride.example",
    "phone": "(555) 018-2044",
    "website": "https://careride.example",
    "googleBusinessProfile": "https://business.google.com/careride",
    "description": "Reliable non-emergency rides for seniors, families, and care communities.",
    "demographics": [
      "Seniors 65+",
      "Families coordinating care",
      "Retirement communities"
    ],
    "serviceAreas": [
      "Brampton",
      "Mississauga",
      "Etobicoke"
    ],
    "onboardingComplete": true,
    "plan": "free",
    "leadQuota": {
      "freePerYear": 5,
      "paidPerMonth": 5,
      "usedThisYear": 0,
      "usedThisMonth": 0,
      "topUps": 0
    }
  },
  "medications": [
    {
      "id": "med_lisinopril",
      "name": "Lisinopril",
      "condition": "Blood Pressure",
      "time": "8:00 AM",
      "remaining": 3,
      "status": "taken",
      "strength": "10mg",
      "doseQuantity": 1,
      "frequency": "Once daily",
      "refillThreshold": 5,
      "prescriber": "Dr. Mehta",
      "pharmacy": "HealthPlus Pharmacy"
    },
    {
      "id": "med_metformin",
      "name": "Metformin",
      "condition": "Diabetes",
      "time": "2:00 PM",
      "remaining": 17,
      "status": "taken",
      "strength": "500mg",
      "doseQuantity": 1,
      "frequency": "Once daily",
      "refillThreshold": 5,
      "prescriber": "Dr. Mehta",
      "pharmacy": "HealthPlus Pharmacy"
    },
    {
      "id": "med_atorvastatin",
      "name": "Atorvastatin",
      "condition": "Cholesterol",
      "time": "8:00 PM",
      "remaining": 21,
      "status": "taken",
      "strength": "20mg",
      "doseQuantity": 1,
      "frequency": "Once nightly",
      "refillThreshold": 5,
      "prescriber": "Dr. Mehta",
      "pharmacy": "HealthPlus Pharmacy"
    },
    {
      "id": "med_1780633492804",
      "name": "Amlodipine",
      "condition": "Hypertension",
      "strength": "5mg",
      "doseQuantity": 1,
      "time": "7:30 AM",
      "frequency": "Once daily",
      "remaining": 27,
      "refillThreshold": 7,
      "prescriber": "Dr. Mehta",
      "pharmacy": "HealthPlus Pharmacy",
      "status": "taken",
      "lastConfirmedAt": "2026-06-05T04:28:38.358Z"
    }
  ],
  "people": [
    {
      "id": "rita",
      "name": "Rita Sharma",
      "role": "Daughter",
      "status": "Online",
      "permissions": [
        "wellness",
        "medications",
        "rides",
        "messages",
        "sos",
        "safety"
      ],
      "inviteCode": "RITA-ANITA"
    },
    {
      "id": "arjun",
      "name": "Arjun Sharma",
      "role": "Son",
      "status": "Busy",
      "permissions": [
        "wellness",
        "rides",
        "messages",
        "safety"
      ],
      "inviteCode": "ARJUN-ANITA"
    },
    {
      "id": "mehta",
      "name": "Dr. Mehta",
      "role": "Physician",
      "status": "Available",
      "permissions": [
        "medications",
        "wellness"
      ],
      "inviteCode": "DRMEHTA-ANITA"
    },
    {
      "id": "sunita",
      "name": "Sunita Patel",
      "role": "Neighbor",
      "status": "Nearby",
      "permissions": [
        "sos",
        "rides",
        "messages",
        "safety"
      ],
      "inviteCode": "SUNITA-ANITA"
    }
  ],
  "circleTasks": [
    {
      "id": "circle_task_1780635229391_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 31 minutes of unusual stillness. Mobility profile threshold is 30 minutes. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635229391_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 31 minutes of unusual stillness. Mobility profile threshold is 30 minutes. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635229391_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 31 minutes of unusual stillness. Mobility profile threshold is 30 minutes. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635229391_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Memory profile guidance: Use warm tone, say you are here to help, repeat the next step once.. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635229391_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Memory profile guidance: Use warm tone, say you are here to help, repeat the next step once.. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635229391_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Memory profile guidance: Use warm tone, say you are here to help, repeat the next step once.. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635229391_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 74% confidence. Health profile notes: Needs standby assist from bed to bathroom at night. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635229391_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 74% confidence. Health profile notes: Needs standby assist from bed to bathroom at night. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635229391_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 74% confidence. Health profile notes: Needs standby assist from bed to bathroom at night. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635192339_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635192339_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780635192339_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780628061193_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780628061193_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780628061193_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780628043429_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780628043429_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780628043429_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627675830_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627675830_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627675830_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627656514_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627656514_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627656514_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627553365_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627553365_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627553365_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627533543_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627533543_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627533543_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627376505_sunita_escalation",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "sos-escalated",
      "body": "Rita Sharma escalated wearable-fall-detected. Route: call-emergency-and-circle.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627376505_arjun_escalation",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "sos-escalated",
      "body": "Rita Sharma escalated wearable-fall-detected. Route: call-emergency-and-circle.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627376505_rita_escalation",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "sos-escalated",
      "body": "Rita Sharma escalated wearable-fall-detected. Route: call-emergency-and-circle.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627369551_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627369551_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627369551_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627345889_sunita_escalation",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "sos-escalated",
      "body": "Rita Sharma escalated wearable-fall-detected. Route: call-emergency-and-circle.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627345889_arjun_escalation",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "sos-escalated",
      "body": "Rita Sharma escalated wearable-fall-detected. Route: call-emergency-and-circle.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627345889_rita_escalation",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "sos-escalated",
      "body": "Rita Sharma escalated wearable-fall-detected. Route: call-emergency-and-circle.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627338923_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627338923_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627338923_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627305247_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627305247_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627305247_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627273410_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627273409_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627273409_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "acknowledged",
      "acknowledgedAt": "2026-06-05T02:41:20.419Z"
    },
    {
      "id": "circle_task_1780627254410_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627254410_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627254410_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "acknowledged",
      "acknowledgedAt": "2026-06-05T02:40:54.459Z"
    },
    {
      "id": "circle_task_1780627083245_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627083245_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627083245_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "acknowledged",
      "acknowledgedAt": "2026-06-05T02:40:54.459Z"
    },
    {
      "id": "circle_task_1780627058771_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627058771_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780627058771_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "status": "acknowledged",
      "acknowledgedAt": "2026-06-05T02:40:54.459Z"
    },
    {
      "id": "circle_task_1780626786009_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "health-vitals-risk",
      "body": "Anita Sharma has elevated health risk signals: oxygen-below-92, heart-rate-out-of-range, respiratory-rate-out-of-range, low-sleep-duration. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626786009_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "health-vitals-risk",
      "body": "Anita Sharma has elevated health risk signals: oxygen-below-92, heart-rate-out-of-range, respiratory-rate-out-of-range, low-sleep-duration. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626786009_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "health-vitals-risk",
      "body": "Anita Sharma has elevated health risk signals: oxygen-below-92, heart-rate-out-of-range, respiratory-rate-out-of-range, low-sleep-duration. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626433457_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626433457_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626433457_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626431358_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626431358_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626431358_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626429773_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626429773_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626429773_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626428439_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626428439_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626428439_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626427699_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626427699_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626427699_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626426888_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626426888_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626426888_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "unusual-stillness",
      "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626426302_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626426302_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626426302_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626425806_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626425806_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626425806_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "safe-zone-exit",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626353508_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "voice-sos-trusted-circle",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626353508_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "voice-sos-trusted-circle",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626353508_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "voice-sos-trusted-circle",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626352598_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "voice-sos-trusted-circle",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626352598_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "voice-sos-trusted-circle",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626352598_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "voice-sos-trusted-circle",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626201607_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626201607_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626201607_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626177010_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626177010_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626177010_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626005479_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626005479_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780626005479_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "voice-sos-911",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911.",
      "status": "open"
    },
    {
      "id": "circle_task_1780604557286_sunita",
      "assignedTo": "sunita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780604557286_arjun",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1780604557286_rita",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "fall-detected",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered.",
      "status": "open"
    },
    {
      "id": "circle_task_1",
      "assignedTo": "rita",
      "resident": "Anita Sharma",
      "type": "Medication follow-up",
      "body": "Lisinopril was confirmed today. Check in if evening medication is missed.",
      "status": "acknowledged"
    },
    {
      "id": "circle_task_2",
      "assignedTo": "arjun",
      "resident": "Anita Sharma",
      "type": "Ride coordination",
      "body": "Cardiology appointment ride is scheduled for tomorrow at 10:00 AM.",
      "status": "open"
    }
  ],
  "safety": {
    "liveTrackingEnabled": true,
    "lastUpdated": "2026-06-05T04:53:49.390Z",
    "location": {
      "label": "Front porch steps",
      "lat": 43.7315,
      "lng": -79.7624,
      "accuracyMeters": 14
    },
    "safeZones": [
      {
        "id": "home",
        "name": "Park View Community",
        "radiusMeters": 300,
        "status": "outside"
      },
      {
        "id": "clinic",
        "name": "City Care Hospital",
        "radiusMeters": 150,
        "status": "outside"
      }
    ],
    "movement": {
      "status": "no movement after impact",
      "stepsLastHour": 1,
      "stillMinutes": 31,
      "lastKnownSpeedMph": 1.8,
      "phoneBattery": 72
    },
    "fallDetection": {
      "status": "possible-fall",
      "confidence": 0.74,
      "lastEvent": "2026-06-05T04:53:49.391Z"
    },
    "riskSignals": [
      {
        "id": "risk_1",
        "type": "memory-support",
        "severity": "watch",
        "body": "Dementia/memory-loss support is enabled. Notify trusted circle if Anita exits a safe zone, has unusual stillness, or phone analytics detect a likely fall."
      }
    ],
    "sosEvents": [
      {
        "id": "sos_1780635229391_joua9",
        "createdAt": "2026-06-05T04:53:49.391Z",
        "location": {
          "label": "Front porch steps",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "unusual-stillness",
        "severity": "high",
        "body": "Phone analytics show 31 minutes of unusual stillness. Mobility profile threshold is 30 minutes. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780635229391_7vywj",
        "createdAt": "2026-06-05T04:53:49.391Z",
        "location": {
          "label": "Front porch steps",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "safe-zone-exit",
        "severity": "critical",
        "body": "Resident appears outside the approved safe zone. Memory profile guidance: Use warm tone, say you are here to help, repeat the next step once.. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780635229391_1j8y6",
        "createdAt": "2026-06-05T04:53:49.391Z",
        "location": {
          "label": "Front porch steps",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "fall-detected",
        "severity": "critical",
        "body": "Likely fall detected with 74% confidence. Health profile notes: Needs standby assist from bed to bathroom at night. Immediate SOS notification triggered."
      },
      {
        "id": "sos_1780635192339_mtlde",
        "createdAt": "2026-06-05T04:53:12.339Z",
        "location": {
          "label": "Front porch steps",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "safe-zone-exit",
        "severity": "high",
        "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780628061193_db1vn",
        "createdAt": "2026-06-05T02:54:21.193Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-fall-detected",
        "severity": "critical",
        "source": "ui-audit-log-setup",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780628043428_q55ur",
        "createdAt": "2026-06-05T02:54:03.428Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "audit-feature-test",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780627675830_j5rkk",
        "createdAt": "2026-06-05T02:47:55.830Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "ui-provider-processor-setup",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780627656514_64j6b",
        "createdAt": "2026-06-05T02:47:36.514Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "provider-adapter-test",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780627553365_pf41m",
        "createdAt": "2026-06-05T02:45:53.365Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "ui-notification-delivery-setup",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780627533543_28z81",
        "createdAt": "2026-06-05T02:45:33.543Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "notification-queue-test",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780627369551_brvff",
        "createdAt": "2026-06-05T02:42:49.551Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "escalated",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-fall-detected",
        "severity": "critical",
        "source": "ui-escalate-setup-top-row",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
        "escalatedBy": "Rita Sharma",
        "escalatedAt": "2026-06-05T02:42:56.505Z",
        "escalationRoute": "call-emergency-and-circle"
      },
      {
        "id": "sos_1780627338923_yhqxh",
        "createdAt": "2026-06-05T02:42:18.923Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-fall-detected",
        "severity": "critical",
        "source": "ui-escalate-setup-exact",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780627305247_axybx",
        "createdAt": "2026-06-05T02:41:45.247Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "escalated",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-fall-detected",
        "severity": "critical",
        "source": "ui-escalate-setup",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
        "escalatedBy": "Rita Sharma",
        "escalatedAt": "2026-06-05T02:42:25.889Z",
        "escalationRoute": "call-emergency-and-circle"
      },
      {
        "id": "sos_1780627273409_a4egc",
        "createdAt": "2026-06-05T02:41:13.409Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "acknowledged",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "ui-ack-setup",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
        "acknowledgedBy": "Rita Sharma",
        "acknowledgedAt": "2026-06-05T02:41:20.419Z"
      },
      {
        "id": "sos_1780627254410_d1t3r",
        "createdAt": "2026-06-05T02:40:54.410Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "acknowledged",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "ack-flow-setup",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
        "acknowledgedBy": "Rita Sharma",
        "acknowledgedAt": "2026-06-05T02:40:54.459Z"
      },
      {
        "id": "sos_1780627083245_m0h0f",
        "createdAt": "2026-06-05T02:38:03.245Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "mobile-wearable-sync",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780627058771_64lb3",
        "createdAt": "2026-06-05T02:37:38.771Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "wearable-sos-pressed",
        "severity": "critical",
        "source": "api-wearable-sos",
        "route": "trusted-circle-and-emergency-review",
        "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780626786009_qh5ue",
        "createdAt": "2026-06-05T02:33:06.009Z",
        "location": {
          "label": "Park View Community - Garden Walkway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "health-vitals-risk",
        "severity": "high",
        "source": "high-risk-verification",
        "route": "trusted-circle-health-alert",
        "body": "Anita Sharma has elevated health risk signals: oxygen-below-92, heart-rate-out-of-range, respiratory-rate-out-of-range, low-sleep-duration. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780626433457_a5fq3",
        "createdAt": "2026-06-05T02:27:13.457Z",
        "location": {
          "label": "Outside Park View safe zone - North entrance",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "safe-zone-exit",
        "severity": "high",
        "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780626431358_jbavq",
        "createdAt": "2026-06-05T02:27:11.358Z",
        "location": {
          "label": "Park View Community - Bedroom",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "unusual-stillness",
        "severity": "high",
        "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780626429773_w8na2",
        "createdAt": "2026-06-05T02:27:09.773Z",
        "location": {
          "label": "Park View Community - Apartment hallway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "fall-detected",
        "severity": "critical",
        "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered."
      },
      {
        "id": "sos_1780626428439_4es97",
        "createdAt": "2026-06-05T02:27:08.439Z",
        "location": {
          "label": "Outside Park View safe zone - North entrance",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "safe-zone-exit",
        "severity": "high",
        "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780626427699_pjwom",
        "createdAt": "2026-06-05T02:27:07.699Z",
        "location": {
          "label": "Park View Community - Apartment hallway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "fall-detected",
        "severity": "critical",
        "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered."
      },
      {
        "id": "sos_1780626426888_72dha",
        "createdAt": "2026-06-05T02:27:06.888Z",
        "location": {
          "label": "Park View Community - Bedroom",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "unusual-stillness",
        "severity": "high",
        "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780626426302_bmlsr",
        "createdAt": "2026-06-05T02:27:06.302Z",
        "location": {
          "label": "Park View Community - Apartment hallway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "fall-detected",
        "severity": "critical",
        "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered."
      },
      {
        "id": "sos_1780626425806_caiv3",
        "createdAt": "2026-06-05T02:27:05.806Z",
        "location": {
          "label": "Outside Park View safe zone - North entrance",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "safe-zone-exit",
        "severity": "high",
        "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered."
      },
      {
        "id": "sos_1780626353508_ky8io",
        "createdAt": "2026-06-05T02:25:53.508Z",
        "location": {
          "label": "Mobile app local test",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "voice-sos-trusted-circle",
        "severity": "high",
        "source": "mobile-voice-command",
        "route": "trusted-circle-first",
        "emergencyNumber": null,
        "command": "Guru, call Rita now",
        "nativeDialStatus": "not-required",
        "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately."
      },
      {
        "id": "sos_1780626352598_gp731",
        "createdAt": "2026-06-05T02:25:52.598Z",
        "location": {
          "label": "Mobile app local test",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "voice-sos-trusted-circle",
        "severity": "high",
        "source": "mobile-voice-command",
        "route": "trusted-circle-first",
        "emergencyNumber": null,
        "command": "Guru, call Rita now",
        "nativeDialStatus": "not-required",
        "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately."
      },
      {
        "id": "sos_1780626201607_sdy6z",
        "createdAt": "2026-06-05T02:23:21.607Z",
        "location": {
          "label": "Mobile app local test",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "voice-sos-911",
        "severity": "critical",
        "source": "mobile-voice-command",
        "route": "911-and-trusted-circle",
        "emergencyNumber": "911",
        "command": "Guru, call emergency",
        "nativeDialStatus": "pending-native-confirmation",
        "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911."
      },
      {
        "id": "sos_1780626177009_mitib",
        "createdAt": "2026-06-05T02:22:57.009Z",
        "location": {
          "label": "Mobile app local test",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "voice-sos-911",
        "severity": "critical",
        "source": "mobile-voice-command",
        "route": "911-and-trusted-circle",
        "emergencyNumber": "911",
        "command": "Guru, call emergency",
        "nativeDialStatus": "pending-native-confirmation",
        "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911."
      },
      {
        "id": "sos_1780626005478_5ew02",
        "createdAt": "2026-06-05T02:20:05.478Z",
        "location": {
          "label": "Mobile app local test",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "voice-sos-911",
        "severity": "critical",
        "source": "api-verification",
        "route": "911-and-trusted-circle",
        "emergencyNumber": "911",
        "command": "Guru, call emergency",
        "nativeDialStatus": "pending-native-confirmation",
        "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911."
      },
      {
        "id": "sos_1780604557286_dp5fm",
        "createdAt": "2026-06-04T20:22:37.286Z",
        "location": {
          "label": "Park View Community - Apartment hallway",
          "lat": 43.7315,
          "lng": -79.7624,
          "accuracyMeters": 14
        },
        "status": "active",
        "notified": [
          "Rita Sharma",
          "Arjun Sharma",
          "Sunita Patel"
        ],
        "type": "fall-detected",
        "severity": "critical",
        "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered."
      }
    ],
    "voiceSos": {
      "enabled": true,
      "lastCommand": "Guru, call Rita now",
      "lastRoute": "trusted-circle-first",
      "lastTriggeredAt": "2026-06-05T02:25:53.508Z",
      "nativeDialStatus": "not-required"
    }
  },
  "services": [
    {
      "id": "careride",
      "name": "CareRide",
      "category": "Transportation",
      "rating": 4.8,
      "price": "$18 - $25",
      "eta": "Available tomorrow",
      "provider": "CareRide",
      "status": "approved",
      "approvedAt": "2026-06-05T05:18:44.263Z",
      "approvalNotes": "Approved from mobile superadmin."
    },
    {
      "id": "senior_wheels",
      "name": "Senior Wheels",
      "category": "Transportation",
      "rating": 4.6,
      "price": "$20 - $28",
      "eta": "Available tomorrow",
      "provider": "Senior Wheels"
    },
    {
      "id": "healthplus",
      "name": "HealthPlus Pharmacy",
      "category": "Medicine Delivery",
      "rating": 4.7,
      "price": "$5 delivery",
      "eta": "Fast delivery",
      "provider": "HealthPlus Pharmacy"
    },
    {
      "id": "community_cab",
      "name": "Community Cab",
      "category": "Transportation",
      "rating": 4.5,
      "price": "$15 - $20",
      "eta": "2 seats left",
      "provider": "Community Cab"
    }
  ],
  "events": [
    {
      "id": "chair_yoga",
      "name": "Chair Yoga",
      "host": "Meena",
      "time": "Today, 10:30 AM",
      "joined": false
    },
    {
      "id": "memory_game",
      "name": "Memory Game Challenge",
      "host": "Park View",
      "time": "Tomorrow, 4:00 PM",
      "joined": false
    },
    {
      "id": "community_lunch",
      "name": "Community Lunch",
      "host": "Park View",
      "time": "Friday, 12:30 PM",
      "joined": false
    }
  ],
  "posts": [
    {
      "id": "post_1",
      "author": "Meena Sharma",
      "body": "Lovely morning walk with the group 🌿",
      "likes": 24,
      "comments": 6
    },
    {
      "id": "post_2",
      "author": "Park View Community",
      "body": "Join us for a Bhajan Evening this Saturday at 6 PM.",
      "likes": 18,
      "comments": 3
    }
  ],
  "requests": [
    {
      "id": "req_1780636254421",
      "resident": "Anita Sharma",
      "type": "I need a ride to my doctor tomorrow.",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_1780624887732",
      "resident": "Anita Sharma",
      "type": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$15 - $20",
      "status": "matched",
      "provider": "Community Cab"
    },
    {
      "id": "req_1780624814393",
      "resident": "Anita Sharma",
      "type": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$15 - $20",
      "status": "matched",
      "provider": "Community Cab"
    },
    {
      "id": "req_1780624813492",
      "resident": "Anita Sharma",
      "type": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$20 - $28",
      "status": "matched",
      "provider": "Senior Wheels"
    },
    {
      "id": "req_1780624811350",
      "resident": "Anita Sharma",
      "type": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_1780623663388",
      "resident": "Anita Sharma",
      "type": "I need a ride to my doctor tomorrow.",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_1780623662408",
      "resident": "Anita Sharma",
      "type": "I need a ride to my doctor tomorrow.",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_1780603077252",
      "resident": "Anita Sharma",
      "type": "Pharmacy delivery",
      "time": "Today",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_1780603072523",
      "resident": "Anita Sharma",
      "type": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_1780603065472",
      "resident": "Anita Sharma",
      "type": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_1780603063010",
      "resident": "Anita Sharma",
      "type": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_1780602985912",
      "resident": "Anita Sharma",
      "type": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "distance": "$18 - $25",
      "status": "matched",
      "provider": "CareRide"
    },
    {
      "id": "req_ride_1",
      "resident": "Anita Sharma",
      "type": "Ride to hospital",
      "time": "Tomorrow, 10:00 AM",
      "distance": "3.2 km",
      "status": "new",
      "provider": null
    },
    {
      "id": "req_pharmacy_1",
      "resident": "Anita Sharma",
      "type": "Pharmacy delivery",
      "time": "Today",
      "distance": "2.1 km",
      "status": "new",
      "provider": null
    }
  ],
  "bookings": [
    {
      "id": "booking_1780636254421",
      "resident": "Anita Sharma",
      "service": "I need a ride to my doctor tomorrow.",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1780624887732",
      "resident": "Anita Sharma",
      "service": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "Community Cab"
    },
    {
      "id": "booking_1780624814393",
      "resident": "Anita Sharma",
      "service": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "Community Cab"
    },
    {
      "id": "booking_1780624813492",
      "resident": "Anita Sharma",
      "service": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "Senior Wheels"
    },
    {
      "id": "booking_1780624811350",
      "resident": "Anita Sharma",
      "service": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1780623663388",
      "resident": "Anita Sharma",
      "service": "I need a ride to my doctor tomorrow.",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1780623662408",
      "resident": "Anita Sharma",
      "service": "I need a ride to my doctor tomorrow.",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1780603077252",
      "resident": "Anita Sharma",
      "service": "Pharmacy delivery",
      "time": "Today",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1780603072523",
      "resident": "Anita Sharma",
      "service": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1780603065472",
      "resident": "Anita Sharma",
      "service": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1780603063010",
      "resident": "Anita Sharma",
      "service": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1780602985912",
      "resident": "Anita Sharma",
      "service": "Ride requested",
      "time": "Tomorrow, 10:00 AM",
      "status": "pending",
      "provider": "CareRide"
    },
    {
      "id": "booking_1",
      "resident": "Anita Sharma",
      "service": "Ride - Local",
      "time": "Today, 2:30 PM",
      "status": "confirmed",
      "provider": "CareRide"
    },
    {
      "id": "booking_2",
      "resident": "Anita Sharma",
      "service": "Ride - Hospital",
      "time": "Tomorrow, 10:00 AM",
      "status": "confirmed",
      "provider": "CareRide"
    }
  ],
  "refills": [],
  "messages": [
    {
      "from": "Safety Monitor",
      "body": "Phone analytics show 31 minutes of unusual stillness. Mobility profile threshold is 30 minutes. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Resident appears outside the approved safe zone. Memory profile guidance: Use warm tone, say you are here to help, repeat the next step once.. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Likely fall detected with 74% confidence. Health profile notes: Needs standby assist from bed to bathroom at night. Immediate SOS notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered."
    },
    {
      "from": "System",
      "body": "Amlodipine marked as taken."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Rita Sharma",
      "body": "Escalated SOS event: wearable-fall-detected. Route: call-emergency-and-circle."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered."
    },
    {
      "from": "Rita Sharma",
      "body": "Escalated SOS event: wearable-fall-detected. Route: call-emergency-and-circle."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered."
    },
    {
      "from": "Rita Sharma",
      "body": "Acknowledged SOS event: wearable-sos-pressed."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Rita Sharma",
      "body": "Acknowledged SOS event: wearable-sos-pressed."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma has elevated health risk signals: oxygen-below-92, heart-rate-out-of-range, respiratory-rate-out-of-range, low-sleep-duration. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Phone analytics show 58 minutes of unusual stillness. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Resident appears outside the approved safe zone. Trusted circle notification triggered."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call Rita now\". Route: trusted-circle-first. Trusted circle should call immediately."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911."
    },
    {
      "from": "Safety Monitor",
      "body": "Anita Sharma triggered Voice SOS: \"Guru, call emergency\". Route: 911-and-trusted-circle. Prepare native emergency call to 911."
    },
    {
      "from": "System",
      "body": "Lisinopril 10mg marked as taken."
    },
    {
      "from": "Guru",
      "body": "I am sorry you did not sleep well. Want to try a two-minute breathing check-in?"
    },
    {
      "from": "Anita Sharma",
      "body": "I didn't sleep well last night."
    },
    {
      "from": "System",
      "body": "Atorvastatin 20mg marked as taken."
    },
    {
      "from": "System",
      "body": "Metformin 500mg marked as taken."
    },
    {
      "from": "Safety Monitor",
      "body": "Likely fall detected with 91% confidence. Immediate SOS notification triggered."
    },
    {
      "from": "System",
      "body": "Lisinopril 10mg marked as taken."
    },
    {
      "from": "Guru",
      "body": "Good morning Anita. How are you feeling today?"
    }
  ],
  "healthVitals": {
    "lastSyncedAt": "2026-06-05T02:51:37.536Z",
    "source": "mobile-healthkit-health-connect-sync",
    "readings": [
      {
        "id": "vital_1780627897536_0",
        "capturedAt": "2026-06-05T01:51:37.527Z",
        "source": "mobile-healthkit-health-connect-sync",
        "heartRate": 72,
        "oxygenSaturation": 98,
        "respiratoryRate": 15,
        "hrv": 45,
        "sleepMinutes": 430,
        "caloriesToday": 1520,
        "stepsToday": 3842
      },
      {
        "id": "vital_1780627897536_1",
        "capturedAt": "2026-06-05T02:21:37.527Z",
        "source": "mobile-healthkit-health-connect-sync",
        "heartRate": 76,
        "oxygenSaturation": 97,
        "respiratoryRate": 16,
        "hrv": 42,
        "sleepMinutes": 430,
        "caloriesToday": 1640,
        "stepsToday": 4128
      },
      {
        "id": "vital_1780627897536_2",
        "capturedAt": "2026-06-05T02:51:37.527Z",
        "source": "mobile-healthkit-health-connect-sync",
        "heartRate": 74,
        "oxygenSaturation": 97,
        "respiratoryRate": 16,
        "hrv": 41,
        "sleepMinutes": 430,
        "caloriesToday": 1688,
        "stepsToday": 4390
      },
      {
        "id": "vital_1780627804634_0",
        "capturedAt": "2026-06-05T02:50:04.634Z",
        "source": "mobile-healthkit-health-connect-sync",
        "heartRate": 74,
        "oxygenSaturation": 97,
        "respiratoryRate": 16,
        "hrv": 43,
        "sleepMinutes": 430,
        "caloriesToday": 1616,
        "stepsToday": 4120
      },
      {
        "id": "vital_1780626786008_0",
        "capturedAt": "2026-06-05T02:33:06.008Z",
        "source": "high-risk-verification",
        "heartRate": 122,
        "oxygenSaturation": 89,
        "respiratoryRate": 27,
        "hrv": 18,
        "sleepMinutes": 180,
        "caloriesToday": 900,
        "stepsToday": 240
      },
      {
        "id": "vital_1780626681840_0",
        "capturedAt": "2026-06-05T02:31:21.840Z",
        "source": "high-risk-verification",
        "heartRate": 122,
        "oxygenSaturation": 89,
        "respiratoryRate": 27,
        "hrv": 18,
        "sleepMinutes": 180,
        "caloriesToday": 900,
        "stepsToday": 240
      },
      {
        "id": "vital_1780626667387_0",
        "capturedAt": "2026-06-05T01:31:07.383Z",
        "source": "mobile-healthkit-health-connect-sync",
        "heartRate": 72,
        "oxygenSaturation": 98,
        "respiratoryRate": 15,
        "hrv": 45,
        "sleepMinutes": 430,
        "caloriesToday": 1520,
        "stepsToday": 3842
      },
      {
        "id": "vital_1780626667387_1",
        "capturedAt": "2026-06-05T02:01:07.383Z",
        "source": "mobile-healthkit-health-connect-sync",
        "heartRate": 76,
        "oxygenSaturation": 97,
        "respiratoryRate": 16,
        "hrv": 42,
        "sleepMinutes": 430,
        "caloriesToday": 1640,
        "stepsToday": 4128
      },
      {
        "id": "vital_1780626667387_2",
        "capturedAt": "2026-06-05T02:31:07.383Z",
        "source": "mobile-healthkit-health-connect-sync",
        "heartRate": 74,
        "oxygenSaturation": 97,
        "respiratoryRate": 16,
        "hrv": 41,
        "sleepMinutes": 430,
        "caloriesToday": 1688,
        "stepsToday": 4390
      },
      {
        "id": "vital_1780626643824_0",
        "capturedAt": "2026-06-05T02:30:43.824Z",
        "source": "api-verification-health-sync",
        "heartRate": 72,
        "oxygenSaturation": 98,
        "respiratoryRate": 15,
        "hrv": 45,
        "sleepMinutes": 430,
        "caloriesToday": 1520,
        "stepsToday": 3842
      },
      {
        "id": "vital_1780626643824_1",
        "capturedAt": "2026-06-05T02:30:43.824Z",
        "source": "api-verification-health-sync",
        "heartRate": 76,
        "oxygenSaturation": 97,
        "respiratoryRate": 16,
        "hrv": 42,
        "sleepMinutes": 430,
        "caloriesToday": 1640,
        "stepsToday": 4128
      },
      {
        "id": "vital_1780626643824_2",
        "capturedAt": "2026-06-05T02:30:43.824Z",
        "source": "api-verification-health-sync",
        "heartRate": 74,
        "oxygenSaturation": 97,
        "respiratoryRate": 16,
        "hrv": 41,
        "sleepMinutes": 430,
        "caloriesToday": 1688,
        "stepsToday": 4390
      }
    ],
    "summary": {
      "heartRateAvg": 82,
      "oxygenAvg": 96,
      "respiratoryRateAvg": 18,
      "hrvAvg": 39,
      "sleepMinutes": 388,
      "caloriesToday": 1497,
      "stepsToday": 3473,
      "riskLevel": "low",
      "riskReasons": []
    },
    "latestSummary": {
      "heartRateAvg": 74,
      "oxygenAvg": 97,
      "respiratoryRateAvg": 16,
      "hrvAvg": 43,
      "sleepMinutes": 430,
      "caloriesToday": 1616,
      "stepsToday": 4120,
      "riskLevel": "low",
      "riskReasons": []
    }
  },
  "wearables": {
    "lastSyncedAt": "2026-06-05T02:54:21.193Z",
    "devices": [
      {
        "id": "apple_watch_anita",
        "type": "smartwatch",
        "name": "Apple Watch",
        "status": "connected",
        "batteryPercent": 82,
        "signal": "Fall detection, heart rate, SOS",
        "lastSeenAt": "2026-06-05T02:54:21.193Z",
        "fallConfidence": 0.91,
        "sosPressed": false
      },
      {
        "id": "home_tag_anita",
        "type": "proximity-tag",
        "name": "Home proximity tag",
        "status": "connected",
        "batteryPercent": 64,
        "signal": "Room proximity, night movement, exit alerts",
        "lastSeenAt": "2026-06-05T02:38:03.243Z",
        "fallConfidence": 0,
        "sosPressed": false
      }
    ],
    "proximity": {
      "currentZone": "Hall",
      "distanceMeters": 8,
      "safe": true,
      "lastSeenAt": "2026-06-05T02:54:21.193Z"
    },
    "latestSummary": {
      "connectedCount": 2,
      "lowBatteryCount": 0,
      "sosPressed": false,
      "fallDetected": true,
      "proximityRisk": "low",
      "riskLevel": "high",
      "riskReasons": [
        "wearable-fall-detected"
      ]
    }
  },
  "notificationQueue": [
    {
      "id": "notif_1780628061193_sunita_call_k8vc",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "call",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628061193_sunita_sms_g1hq",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "sms",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628061193_sunita_push_d7xr",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "push",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628061193_arjun_call_4td4",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "call",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628061193_arjun_sms_qa42",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "sms",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628061193_arjun_push_i5ek",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "push",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628061193_rita_call_raa1",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "call",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628061193_rita_sms_tvx9",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "sms",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628061193_rita_push_n11b",
      "eventId": "sos_1780628061193_db1vn",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "push",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-fall-detected",
      "body": "Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628043429_sunita_call_hvpr",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": "2026-06-05T02:54:03.437Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780628043429_sunita_call_hvpr_1780628043437"
    },
    {
      "id": "notif_1780628043429_sunita_sms_qy5z",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": "2026-06-05T02:54:03.437Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780628043429_sunita_sms_qy5z_1780628043437"
    },
    {
      "id": "notif_1780628043429_sunita_push_mwvm",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": "2026-06-05T02:54:03.437Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780628043429_sunita_push_mwvm_1780628043437"
    },
    {
      "id": "notif_1780628043429_arjun_call_wds6",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "call",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628043429_arjun_sms_h60s",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "sms",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628043429_arjun_push_zdjr",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "push",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628043429_rita_call_8q3w",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "call",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628043429_rita_sms_a0mf",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "sms",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780628043429_rita_push_l54w",
      "eventId": "sos_1780628043428_q55ur",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "push",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780627675830_sunita_call_38i8",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627675830_sunita_call_38i8_1780627681336"
    },
    {
      "id": "notif_1780627675830_sunita_sms_pdu6",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627675830_sunita_sms_pdu6_1780627681336"
    },
    {
      "id": "notif_1780627675830_sunita_push_mxb6",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627675830_sunita_push_mxb6_1780627681336"
    },
    {
      "id": "notif_1780627675830_arjun_call_hmjg",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627675830_arjun_call_hmjg_1780627681336"
    },
    {
      "id": "notif_1780627675830_arjun_sms_7fe0",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627675830_arjun_sms_7fe0_1780627681336"
    },
    {
      "id": "notif_1780627675830_arjun_push_gdv4",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627675830_arjun_push_gdv4_1780627681336"
    },
    {
      "id": "notif_1780627675830_rita_call_i62t",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627675830_rita_call_i62t_1780627681336"
    },
    {
      "id": "notif_1780627675830_rita_sms_zka0",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627675830_rita_sms_zka0_1780627681336"
    },
    {
      "id": "notif_1780627675830_rita_push_rjdk",
      "eventId": "sos_1780627675830_j5rkk",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:55.830Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627675830_rita_push_rjdk_1780627681336"
    },
    {
      "id": "notif_1780627656514_sunita_call_uck2",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627656514_sunita_call_uck2_1780627656524"
    },
    {
      "id": "notif_1780627656514_sunita_sms_6xzd",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627656514_sunita_sms_6xzd_1780627656524"
    },
    {
      "id": "notif_1780627656514_sunita_push_0ohl",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627656514_sunita_push_0ohl_1780627656524"
    },
    {
      "id": "notif_1780627656514_arjun_call_qmcc",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627656514_arjun_call_qmcc_1780627656524"
    },
    {
      "id": "notif_1780627656514_arjun_sms_vq2t",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627656514_arjun_sms_vq2t_1780627656524"
    },
    {
      "id": "notif_1780627656514_arjun_push_4lni",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627656514_arjun_push_4lni_1780627656524"
    },
    {
      "id": "notif_1780627656514_rita_call_mdyl",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627656514_rita_call_mdyl_1780627656524"
    },
    {
      "id": "notif_1780627656514_rita_sms_5vi3",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627656514_rita_sms_5vi3_1780627656524"
    },
    {
      "id": "notif_1780627656514_rita_push_r7cd",
      "eventId": "sos_1780627656514_64j6b",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:47:36.514Z",
      "deliveredAt": "2026-06-05T02:47:36.524Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627656514_rita_push_r7cd_1780627656524"
    },
    {
      "id": "notif_1780627553365_sunita_call_2ocn",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627553365_sunita_call_2ocn_1780627681336"
    },
    {
      "id": "notif_1780627553365_sunita_sms_9v1o",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627553365_sunita_sms_9v1o_1780627681336"
    },
    {
      "id": "notif_1780627553365_sunita_push_llw4",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627553365_sunita_push_llw4_1780627681336"
    },
    {
      "id": "notif_1780627553365_arjun_call_6uah",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627553365_arjun_call_6uah_1780627681336"
    },
    {
      "id": "notif_1780627553365_arjun_sms_ihcy",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627553365_arjun_sms_ihcy_1780627681336"
    },
    {
      "id": "notif_1780627553365_arjun_push_btfv",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627553365_arjun_push_btfv_1780627681336"
    },
    {
      "id": "notif_1780627553365_rita_call_ggjt",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:46:00.548Z",
      "provider": "mobile-test-delivery",
      "providerMessageId": "call_1780627560548"
    },
    {
      "id": "notif_1780627553365_rita_sms_kr9b",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627553365_rita_sms_kr9b_1780627681336"
    },
    {
      "id": "notif_1780627553365_rita_push_csnh",
      "eventId": "sos_1780627553365_pf41m",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:53.365Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627553365_rita_push_csnh_1780627681336"
    },
    {
      "id": "notif_1780627533543_sunita_call_5c7e",
      "eventId": "sos_1780627533543_28z81",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "call",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-voice-simulator",
      "providerMessageId": "twilio-voice-simulator_notif_1780627533543_sunita_call_5c7e_1780627681336"
    },
    {
      "id": "notif_1780627533543_sunita_sms_buwn",
      "eventId": "sos_1780627533543_28z81",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "sms",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "twilio-sms-simulator",
      "providerMessageId": "twilio-sms-simulator_notif_1780627533543_sunita_sms_buwn_1780627681336"
    },
    {
      "id": "notif_1780627533543_sunita_push_3t9i",
      "eventId": "sos_1780627533543_28z81",
      "personId": "sunita",
      "personName": "Sunita Patel",
      "channel": "push",
      "status": "delivered",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": "2026-06-05T02:48:01.336Z",
      "provider": "expo-push-simulator",
      "providerMessageId": "expo-push-simulator_notif_1780627533543_sunita_push_3t9i_1780627681336"
    },
    {
      "id": "notif_1780627533543_arjun_call_pd3h",
      "eventId": "sos_1780627533543_28z81",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "call",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780627533543_arjun_sms_85vl",
      "eventId": "sos_1780627533543_28z81",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "sms",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780627533543_arjun_push_5blc",
      "eventId": "sos_1780627533543_28z81",
      "personId": "arjun",
      "personName": "Arjun Sharma",
      "channel": "push",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780627533543_rita_call_llc3",
      "eventId": "sos_1780627533543_28z81",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "call",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780627533543_rita_sms_w64e",
      "eventId": "sos_1780627533543_28z81",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "sms",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": null
    },
    {
      "id": "notif_1780627533543_rita_push_bclh",
      "eventId": "sos_1780627533543_28z81",
      "personId": "rita",
      "personName": "Rita Sharma",
      "channel": "push",
      "status": "queued",
      "severity": "critical",
      "eventType": "wearable-sos-pressed",
      "body": "Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered.",
      "createdAt": "2026-06-05T02:45:33.543Z",
      "deliveredAt": null
    }
  ],
  "healthConsent": {
    "residentId": "resident_anita",
    "granted": true,
    "source": "mobile-healthkit-health-connect-sync",
    "dataTypes": [
      "heartRate",
      "oxygenSaturation",
      "respiratoryRate",
      "hrv",
      "sleep",
      "calories",
      "steps"
    ],
    "updatedAt": "2026-06-05T02:51:35.904Z"
  },
  "auditLogs": [
    {
      "id": "audit_1780636724263_6dth4",
      "createdAt": "2026-06-05T05:18:44.263Z",
      "action": "service_approved",
      "entityType": "service",
      "entityId": null,
      "severity": "info",
      "actor": "superadmin",
      "details": "CareRide approved. Approved from mobile superadmin."
    },
    {
      "id": "audit_1780635229391_t684f",
      "createdAt": "2026-06-05T04:53:49.391Z",
      "action": "phone_analytics_ingested",
      "entityType": "safety_telemetry",
      "entityId": null,
      "severity": "high",
      "actor": "mobile-phone-sensors",
      "details": "movement=no movement after impact, fallConfidence=0.74, safeZone=outside"
    },
    {
      "id": "audit_1780635192339_2cjs5",
      "createdAt": "2026-06-05T04:53:12.339Z",
      "action": "phone_analytics_ingested",
      "entityType": "safety_telemetry",
      "entityId": null,
      "severity": "high",
      "actor": "mobile-phone-sensors",
      "details": "movement=no movement after impact, fallConfidence=0.74, safeZone=outside"
    },
    {
      "id": "audit_1780633492804",
      "createdAt": "2026-06-05T04:24:52.804Z",
      "action": "medication_inventory_created",
      "entityType": "medication",
      "entityId": "med_1780633492804",
      "severity": "info",
      "actor": "Anita Sharma",
      "details": "Amlodipine 5mg scheduled Once daily at 7:30 AM; 28 remaining."
    },
    {
      "id": "audit_1780628061193_v1fkc",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "action": "wearable_telemetry_synced",
      "entityType": "wearable_telemetry",
      "entityId": null,
      "severity": "critical",
      "actor": "ui-audit-log-setup",
      "details": "devices=1, risk=high, reasons=wearable-fall-detected"
    },
    {
      "id": "audit_1780628061193_1e991",
      "createdAt": "2026-06-05T02:54:21.193Z",
      "action": "sos_event_created",
      "entityType": "sos_event",
      "entityId": "sos_1780628061193_db1vn",
      "severity": "critical",
      "actor": "ui-audit-log-setup",
      "details": "wearable-fall-detected: Anita Sharma has a wearable safety alert: wearable-fall-detected. Trusted circle notification triggered."
    },
    {
      "id": "audit_1780628043437_ds6zj",
      "createdAt": "2026-06-05T02:54:03.437Z",
      "action": "notification_queue_processed",
      "entityType": "notification_queue",
      "entityId": null,
      "severity": "info",
      "actor": "superadmin",
      "details": "delivered=3, remaining=12"
    },
    {
      "id": "audit_1780628043429_z6y7h",
      "createdAt": "2026-06-05T02:54:03.429Z",
      "action": "wearable_telemetry_synced",
      "entityType": "wearable_telemetry",
      "entityId": null,
      "severity": "critical",
      "actor": "audit-feature-test",
      "details": "devices=1, risk=high, reasons=wearable-sos-pressed"
    },
    {
      "id": "audit_1780628043428_rzhy5",
      "createdAt": "2026-06-05T02:54:03.428Z",
      "action": "sos_event_created",
      "entityType": "sos_event",
      "entityId": "sos_1780628043428_q55ur",
      "severity": "critical",
      "actor": "audit-feature-test",
      "details": "wearable-sos-pressed: Anita Sharma has a wearable safety alert: wearable-sos-pressed. Trusted circle notification triggered."
    }
  ]
};
export default seedState;
