/**
 * Seeds vitals/Guru risk score/alert/medication/etc. test data for the
 * 5 Allegro Senior Living test residents into the shared production Neon DB
 * (`shared_platform` connection), so the dashboard sections (Vitals, Guru,
 * Alerts, Medications, Timeline, Safety, Devices, Staff Tasks) can be tested.
 *
 * Run with: php artisan tinker --no-interaction < scripts/seed_allegro_health_data.php
 *
 * Tables written:
 *   health_vitals, guru_risk_scores, health_alerts, medications,
 *   resident_events, vital_baselines, wearable_devices,
 *   resident_safe_zones, guru_recommendations, staff_tasks
 */

$conn = \Illuminate\Support\Facades\DB::connection('shared_platform');

$tenantId = '1a45e58f-a3d5-4412-8ca1-e753fbb1ae26';
$locationId = '48bcbcc2-e310-48de-a297-33fa1d8bda25';

$residents = [
    'dorothy' => ['id' => 'a009b2aa-0092-4986-9f96-625c14acd790', 'name' => 'Dorothy Callaway', 'status' => 'WATCH'],
    'ruth'    => ['id' => '96852e22-bd65-4b3e-8700-c8501b18e4b0', 'name' => 'Ruth Pemberton', 'status' => 'NEEDS_CHECKIN'],
    'walter'  => ['id' => 'a4ddaa2f-9031-42c6-9aa5-7df5bfca336c', 'name' => 'Walter Simmons', 'status' => 'EMERGENCY'],
    'harold'  => ['id' => '60ef35c5-5bef-4e21-867f-33ec9d1da72c', 'name' => 'Harold Jennings', 'status' => 'STABLE'],
];

$now = \Illuminate\Support\Carbon::now();

foreach ($residents as $key => $r) {
    $rid = $r['id'];

    // ---- health_vitals (3 readings: today, -1d, -2d) ----
    $vitalProfiles = [
        'eleanor' => ['hr' => 68, 'spo2' => 97, 'rr' => 16, 'hrv' => 45, 'sleep' => 420, 'cal' => 1650, 'steps' => 3200],
        'dorothy' => ['hr' => 92, 'spo2' => 95, 'rr' => 19, 'hrv' => 28, 'sleep' => 310, 'cal' => 1100, 'steps' => 1100],
        'ruth'    => ['hr' => 78, 'spo2' => 94, 'rr' => 18, 'hrv' => 25, 'sleep' => 260, 'cal' => 900, 'steps' => 600],
        'walter'  => ['hr' => 128, 'spo2' => 89, 'rr' => 24, 'hrv' => 14, 'sleep' => 180, 'cal' => 700, 'steps' => 200],
        'harold'  => ['hr' => 71, 'spo2' => 98, 'rr' => 15, 'hrv' => 50, 'sleep' => 440, 'cal' => 1700, 'steps' => 4100],
    ];
    $vp = $vitalProfiles[$key];
    for ($d = 0; $d < 3; $d++) {
        $jitter = $d === 0 ? 0 : rand(-3, 3);
        $conn->table('health_vitals')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'resident_id' => $rid,
            'source' => 'wearable',
            'heart_rate' => $vp['hr'] + $jitter,
            'oxygen_saturation' => $vp['spo2'] + ($d === 0 ? 0 : rand(-1, 1)),
            'respiratory_rate' => $vp['rr'],
            'hrv' => $vp['hrv'] + $jitter,
            'sleep_minutes' => $vp['sleep'] - ($d * 10),
            'calories_today' => $vp['cal'],
            'steps_today' => $vp['steps'],
            'captured_at' => $now->copy()->subDays($d)->setTime(7, 0),
            'created_at' => $now->copy()->subDays($d)->setTime(7, 5),
        ]);
    }

    // ---- vital_baselines ----
    $conn->table('vital_baselines')->insert([
        [
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'resident_id' => $rid,
            'vital_key' => 'heart_rate',
            'unit' => 'bpm',
            'baseline_value' => $vp['hr'],
            'min_normal' => $vp['hr'] - 15,
            'max_normal' => $vp['hr'] + 15,
            'baseline_window_days' => 30,
            'source' => 'computed',
            'updated_at' => $now,
        ],
        [
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'resident_id' => $rid,
            'vital_key' => 'oxygen_saturation',
            'unit' => '%',
            'baseline_value' => $vp['spo2'],
            'min_normal' => 92,
            'max_normal' => 100,
            'baseline_window_days' => 30,
            'source' => 'computed',
            'updated_at' => $now,
        ],
    ]);

    // ---- guru_risk_scores ----
    $riskProfiles = [
        'eleanor' => ['wellness' => 88, 'health' => 12, 'mobility' => 15, 'med' => 5, 'social' => 10, 'env' => 8, 'safety' => 6],
        'dorothy' => ['wellness' => 65, 'health' => 45, 'mobility' => 40, 'med' => 30, 'social' => 35, 'env' => 20, 'safety' => 25],
        'ruth'    => ['wellness' => 52, 'health' => 58, 'mobility' => 55, 'med' => 60, 'social' => 50, 'env' => 30, 'safety' => 40],
        'walter'  => ['wellness' => 28, 'health' => 88, 'mobility' => 75, 'med' => 70, 'social' => 60, 'env' => 45, 'safety' => 90],
        'harold'  => ['wellness' => 91, 'health' => 10, 'mobility' => 12, 'med' => 8, 'social' => 15, 'env' => 5, 'safety' => 5],
    ];
    $rp = $riskProfiles[$key];
    $explanations = [
        'eleanor' => 'Vitals stable, activity levels consistent with personal baseline.',
        'dorothy' => 'Elevated resting heart rate and reduced sleep over the past 48 hours; recommend monitoring.',
        'ruth'    => 'Lower step count and skipped medication confirmation; recommend wellness check-in.',
        'walter'  => 'Sustained elevated heart rate (128 bpm) with low oxygen saturation (89%) detected this morning; immediate review recommended.',
        'harold'  => 'All indicators within normal range; consistent activity and sleep patterns.',
    ];
    $riskScoreId = (string) \Illuminate\Support\Str::uuid();
    $conn->table('guru_risk_scores')->insert([
        'id' => $riskScoreId,
        'senior_id' => $rid,
        'score_date' => $now->toDateString(),
        'wellness_score' => $rp['wellness'],
        'health_risk_score' => $rp['health'],
        'mobility_risk_score' => $rp['mobility'],
        'medication_risk_score' => $rp['med'],
        'social_risk_score' => $rp['social'],
        'environmental_risk_score' => $rp['env'],
        'safety_risk_score' => $rp['safety'],
        'final_status' => $r['status'],
        'explanation' => json_encode(['summary' => $explanations[$key]]),
        'recommendations' => json_encode([]),
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    // ---- guru_recommendations ----
    $recProfiles = [
        'eleanor' => ['domain' => 'wellness', 'title' => 'Maintain current activity routine', 'body' => 'Eleanor is meeting her daily step goal consistently.', 'why' => 'Steps and sleep are within healthy baseline range.', 'priority' => 5],
        'dorothy' => ['domain' => 'health', 'title' => 'Monitor heart rate trend', 'body' => 'Resting heart rate has been elevated for 2 days. Suggest a wellness check.', 'why' => 'Heart rate is 25% above personal baseline.', 'priority' => 3],
        'ruth'    => ['domain' => 'medication', 'title' => 'Confirm medication adherence', 'body' => 'Ruth has not confirmed her evening medication for 2 days.', 'why' => 'Missed medication confirmations increase health risk.', 'priority' => 2],
        'walter'  => ['domain' => 'safety', 'title' => 'Immediate vitals check required', 'body' => 'Walter\'s heart rate and oxygen levels are outside safe range. Dispatch staff for in-person check.', 'why' => 'Heart rate 128bpm and SpO2 89% triggered emergency threshold.', 'priority' => 1],
        'harold'  => ['domain' => 'social', 'title' => 'Encourage social engagement', 'body' => 'Consider inviting Harold to the afternoon group activity.', 'why' => 'Social interaction supports continued wellness.', 'priority' => 5],
    ];
    $rec = $recProfiles[$key];
    $conn->table('guru_recommendations')->insert([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'senior_id' => $rid,
        'recommendation_date' => $now->toDateString(),
        'domain' => $rec['domain'],
        'title' => $rec['title'],
        'body' => $rec['body'],
        'why' => $rec['why'],
        'action_type' => 'inform',
        'priority' => $rec['priority'],
        'status' => 'open',
        'source_risk_score_id' => $riskScoreId,
        'metadata' => json_encode([]),
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    // ---- medications (2 each) ----
    $medSets = [
        'eleanor' => [
            ['name' => 'Lisinopril', 'condition' => 'Hypertension', 'strength' => '10mg', 'freq' => 'Once daily'],
            ['name' => 'Vitamin D3', 'condition' => 'Supplement', 'strength' => '1000 IU', 'freq' => 'Once daily'],
        ],
        'dorothy' => [
            ['name' => 'Metformin', 'condition' => 'Type 2 Diabetes', 'strength' => '500mg', 'freq' => 'Twice daily'],
            ['name' => 'Atorvastatin', 'condition' => 'High Cholesterol', 'strength' => '20mg', 'freq' => 'Once daily'],
        ],
        'ruth' => [
            ['name' => 'Levothyroxine', 'condition' => 'Hypothyroidism', 'strength' => '75mcg', 'freq' => 'Once daily'],
            ['name' => 'Donepezil', 'condition' => 'Mild Cognitive Decline', 'strength' => '5mg', 'freq' => 'Once nightly'],
        ],
        'walter' => [
            ['name' => 'Metoprolol', 'condition' => 'Atrial Fibrillation', 'strength' => '50mg', 'freq' => 'Twice daily'],
            ['name' => 'Warfarin', 'condition' => 'Anticoagulation', 'strength' => '5mg', 'freq' => 'Once daily'],
        ],
        'harold' => [
            ['name' => 'Amlodipine', 'condition' => 'Hypertension', 'strength' => '5mg', 'freq' => 'Once daily'],
            ['name' => 'Omeprazole', 'condition' => 'GERD', 'strength' => '20mg', 'freq' => 'Once daily'],
        ],
    ];
    foreach ($medSets[$key] as $m) {
        $conn->table('medications')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'resident_id' => $rid,
            'name' => $m['name'],
            'condition' => $m['condition'],
            'strength' => $m['strength'],
            'dose_quantity' => 1,
            'dose_time' => '08:00:00',
            'frequency' => $m['freq'],
            'remaining_count' => 28,
            'refill_threshold' => 5,
            'prescriber' => 'Dr. Sandra Whitfield',
            'pharmacy' => 'Allegro On-Site Pharmacy',
            'status' => 'active',
            'last_confirmed_at' => $now->copy()->subDay(),
            'is_active' => true,
            'start_date' => $now->copy()->subMonths(6)->toDateString(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    // ---- resident_events (timeline) ----
    $events = [
        ['type' => 'vitals_recorded', 'title' => 'Morning vitals recorded', 'body' => 'Wearable device synced morning vitals.'],
        ['type' => 'medication_confirmed', 'title' => 'Medication confirmed', 'body' => 'Resident confirmed morning medication via app.'],
    ];
    if ($key === 'walter') {
        $events[] = ['type' => 'health_alert', 'title' => 'Emergency vitals alert triggered', 'body' => 'Heart rate and oxygen levels triggered an emergency alert. Staff notified.'];
    } elseif ($key === 'ruth') {
        $events[] = ['type' => 'guru_recommendation', 'title' => 'Check-in recommended by Guru', 'body' => 'Guru flagged missed medication confirmations and recommended a wellness check-in.'];
    } elseif ($key === 'dorothy') {
        $events[] = ['type' => 'health_alert', 'title' => 'Elevated heart rate flagged', 'body' => 'Heart rate trending above baseline for 2 consecutive days.'];
    }
    foreach ($events as $i => $e) {
        $conn->table('resident_events')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenantId,
            'location_id' => $locationId,
            'resident_id' => $rid,
            'event_type' => $e['type'],
            'title' => $e['title'],
            'body' => $e['body'],
            'occurred_at' => $now->copy()->subHours($i * 3),
            'metadata' => json_encode([]),
            'created_at' => $now->copy()->subHours($i * 3),
        ]);
    }

    // ---- wearable_devices ----
    $conn->table('wearable_devices')->insert([
        'id' => 'dev-' . \Illuminate\Support\Str::lower(\Illuminate\Support\Str::random(10)),
        'resident_id' => $rid,
        'device_type' => 'smartwatch',
        'name' => $r['name'] . "'s Watch",
        'status' => $key === 'walter' ? 'low_battery' : 'connected',
        'battery_percent' => $key === 'walter' ? 12 : rand(60, 95),
        'signal' => 'good',
        'last_seen_at' => $now->copy()->subMinutes(5),
        'updated_at' => $now,
    ]);

    // ---- resident_safe_zones ----
    $conn->table('resident_safe_zones')->insert([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'resident_id' => $rid,
        'name' => 'Allegro Senior Living - Main Campus',
        'center_lat' => 39.7684,
        'center_lng' => -86.1581,
        'radius_meters' => 200,
        'status' => 'active',
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    // ---- health_alerts + staff_tasks for at-risk residents ----
    if (in_array($r['status'], ['WATCH', 'NEEDS_CHECKIN', 'EMERGENCY'], true)) {
        $alertProfiles = [
            'dorothy' => ['type' => 'heart_rate', 'severity' => 'watch', 'title' => 'Elevated Heart Rate', 'body' => 'Resting heart rate has been elevated (avg 92 bpm) for 2 consecutive days, ~25% above baseline.'],
            'ruth'    => ['type' => 'medication_adherence', 'severity' => 'high', 'title' => 'Missed Medication Confirmations', 'body' => 'Evening medication has not been confirmed for 2 consecutive days.'],
            'walter'  => ['type' => 'vitals_critical', 'severity' => 'critical', 'title' => 'Critical Vitals: High Heart Rate / Low SpO2', 'body' => 'Heart rate 128 bpm and oxygen saturation 89% recorded this morning - both outside safe thresholds.'],
        ];
        $ap = $alertProfiles[$key];
        $alertId = (string) \Illuminate\Support\Str::uuid();
        $conn->table('health_alerts')->insert([
            'id' => $alertId,
            'senior_id' => $rid,
            'score_id' => null,
            'alert_type' => $ap['type'],
            'severity' => $ap['severity'],
            'title' => $ap['title'],
            'body' => $ap['body'],
            'status' => 'open',
            'source' => 'guru',
            'metadata' => json_encode([]),
            'confirmation_status' => 'pending_confirmation',
            'signal_count' => 1,
            'action_required' => $key === 'walter',
            'created_at' => $now->copy()->subHours(2),
        ]);

        $conn->table('staff_tasks')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenantId,
            'location_id' => $locationId,
            'resident_id' => $rid,
            'source_type' => 'health_alert',
            'source_id' => $alertId,
            'priority' => $key === 'walter' ? 'critical' : ($key === 'ruth' ? 'high' : 'normal'),
            'title' => 'Follow up: ' . $ap['title'] . ' (' . $r['name'] . ')',
            'body' => $ap['body'],
            'status' => 'open',
            'due_at' => $now->copy()->addHours($key === 'walter' ? 1 : 24),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    echo "Seeded health data for {$r['name']}\n";
}

echo "Done.\n";
