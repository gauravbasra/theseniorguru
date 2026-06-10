<?php

/**
 * Cleanup script for Allegro Senior Living test data inserted into the
 * shared production Neon DB (`shared_platform` connection) during the
 * end-to-end onboarding wizard test on 2026-06-09.
 *
 * Run with: php artisan tinker --no-interaction < scripts/cleanup_allegro_test_data.php
 *
 * Removes:
 *  - 5 test residents (Eleanor Hartman, Dorothy Callaway, Ruth Pemberton,
 *    Walter Simmons, Harold Jennings) and their linked users + assignments
 *  - The Allegro tenant + tenant_location records
 *
 * Does NOT remove:
 *  - bp_onboarding_profiles / bp_hipaa_agreements / bp_resident_invites
 *    (portal-only tables, safe to keep or drop separately)
 *  - business_portal_users accounts (admin@theseniorguru.com,
 *    smitchell@allegroliving.com)
 */

$conn = \Illuminate\Support\Facades\DB::connection('shared_platform');

$tenantId = '1a45e58f-a3d5-4412-8ca1-e753fbb1ae26';
$locationId = '48bcbcc2-e310-48de-a297-33fa1d8bda25';

$assignmentIds = [
    'a4693bf2-d0e9-41ef-ae64-ea547be357d3',
    'c2b0618d-9ae8-4b67-bae1-b7940e680394',
    'fa37d520-e1a6-4072-92b1-0ab4491579b2',
    '0a8f949d-bd9a-41c0-b9e9-e120249fb792',
    '140021f2-869b-4b34-bfea-86c582aeccb2',
];

$residentIds = [
    'be8fe524-c969-43a0-8c31-ed987d380f35',
    'a009b2aa-0092-4986-9f96-625c14acd790',
    '96852e22-bd65-4b3e-8700-c8501b18e4b0',
    'a4ddaa2f-9031-42c6-9aa5-7df5bfca336c',
    '60ef35c5-5bef-4e21-867f-33ec9d1da72c',
];

$userIds = [
    '38c2e56f-9276-4c19-99bb-df32a9ed235a',
    '0be0ab47-79ad-4888-87b6-13c5e3f44a16',
    'd3a6f7b1-4559-4e87-8de9-23da2c097134',
    '882322c2-aac4-4325-ad5e-cc415a8d70a9',
    '198fea16-3c87-47d5-87f3-18e75487356a',
];

$conn->table('tenant_location_resident_assignments')->whereIn('id', $assignmentIds)->delete();
$conn->table('residents')->whereIn('id', $residentIds)->delete();
$conn->table('users')->whereIn('id', $userIds)->delete();
$conn->table('tenant_locations')->where('id', $locationId)->delete();
$conn->table('tenants')->where('id', $tenantId)->delete();

echo "Cleanup complete.\n";
