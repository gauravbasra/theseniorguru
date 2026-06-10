/**
 * Seeds a care team (staff_profiles + linked user accounts) and resident
 * assignments for Allegro Senior Living into the shared production Neon DB
 * (`shared_platform` connection), so the new alert -> task -> notification ->
 * acknowledge -> resolve/escalate workflow can be exercised end to end.
 *
 * Run with: php artisan tinker --no-interaction < scripts/seed_allegro_staff.php
 *
 * Tables written: users, staff_profiles, staff_assignments
 */

$conn = \Illuminate\Support\Facades\DB::connection('shared_platform');

$tenantId = '1a45e58f-a3d5-4412-8ca1-e753fbb1ae26';
$locationId = '48bcbcc2-e310-48de-a297-33fa1d8bda25';

$residents = [
    'eleanor' => 'be8fe524-c969-43a0-8c31-ed987d380f35',
    'dorothy' => 'a009b2aa-0092-4986-9f96-625c14acd790',
    'ruth'    => '96852e22-bd65-4b3e-8700-c8501b18e4b0',
    'walter'  => 'a4ddaa2f-9031-42c6-9aa5-7df5bfca336c',
    'harold'  => '60ef35c5-5bef-4e21-867f-33ec9d1da72c',
];

$now = \Illuminate\Support\Carbon::now();

$staffMembers = [
    [
        'name' => 'Maria Gonzalez',
        'email' => 'maria.gonzalez@allegro.tsg',
        'role_name' => 'director_of_nursing',
        'department' => 'Nursing Administration',
    ],
    [
        'name' => 'James Okafor',
        'email' => 'james.okafor@allegro.tsg',
        'role_name' => 'rn',
        'department' => 'Nursing',
    ],
    [
        'name' => 'Priya Anand',
        'email' => 'priya.anand@allegro.tsg',
        'role_name' => 'cna',
        'department' => 'Care',
    ],
    [
        'name' => 'Marcus Webb',
        'email' => 'marcus.webb@allegro.tsg',
        'role_name' => 'cna',
        'department' => 'Care',
    ],
    [
        'name' => 'Devon Carter',
        'email' => 'devon.carter@tsg-noc.com',
        'role_name' => 'noc',
        'department' => 'NOC',
    ],
];

$staffIds = [];

foreach ($staffMembers as $member) {
    $userId = (string) \Illuminate\Support\Str::uuid();
    // Each staff account gets its own randomly generated, never-used password —
    // these accounts exist so staff_profiles.user_id has a valid notifications
    // recipient, not for interactive login in this test pass.
    $conn->table('users')->insert([
        'id' => $userId,
        'email' => $member['email'],
        'display_name' => $member['name'],
        'role' => 'business',
        'password_hash' => password_hash((string) \Illuminate\Support\Str::random(32), PASSWORD_BCRYPT),
        'status' => 'approved',
        'gender' => 'unspecified',
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    $staffProfileId = (string) \Illuminate\Support\Str::uuid();
    $conn->table('staff_profiles')->insert([
        'id' => $staffProfileId,
        'tenant_id' => $tenantId,
        'location_id' => $locationId,
        'user_id' => $userId,
        'display_name' => $member['name'],
        'department' => $member['department'],
        'role_name' => $member['role_name'],
        'status' => 'active',
        'created_at' => $now,
        'updated_at' => $now,
    ]);

    $staffIds[$member['role_name']][] = $staffProfileId;
    echo "Created staff profile: {$member['name']} ({$member['role_name']})\n";
}

$priyaId = $staffIds['cna'][0];
$marcusId = $staffIds['cna'][1];
$jamesId = $staffIds['rn'][0];

// Primary caregiver assignments (CNAs)
$primaryAssignments = [
    $priyaId => ['eleanor', 'dorothy'],
    $marcusId => ['ruth', 'walter', 'harold'],
];

foreach ($primaryAssignments as $staffProfileId => $keys) {
    foreach ($keys as $key) {
        $conn->table('staff_assignments')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'tenant_id' => $tenantId,
            'location_id' => $locationId,
            'staff_profile_id' => $staffProfileId,
            'resident_id' => $residents[$key],
            'assignment_type' => 'primary_caregiver',
            'status' => 'active',
            'metadata' => json_encode([]),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}

// RN clinical oversight for all residents
foreach ($residents as $key => $residentId) {
    $conn->table('staff_assignments')->insert([
        'id' => (string) \Illuminate\Support\Str::uuid(),
        'tenant_id' => $tenantId,
        'location_id' => $locationId,
        'staff_profile_id' => $jamesId,
        'resident_id' => $residentId,
        'assignment_type' => 'clinical_oversight',
        'status' => 'active',
        'metadata' => json_encode([]),
        'created_at' => $now,
        'updated_at' => $now,
    ]);
}

echo "Done.\n";
