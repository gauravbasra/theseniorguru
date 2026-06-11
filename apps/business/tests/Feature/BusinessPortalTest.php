<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\BusinessPortalPrdService;
use App\Services\SeniorLivingOnboardingService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class BusinessPortalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    public function test_command_center_renders_database_backed_operational_view(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->fakeSharedPortalData();
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('TheSeniorGuru');
        $response->assertSee('Live operating view from the shared TheSeniorGuru PostgreSQL platform.');
        $response->assertSee('Database Resident');
        $response->assertSee('Shared PostgreSQL');
        $response->assertSee('tenant_location_resident_assignments');
        $response->assertDontSee('span-2', false);
        $response->assertDontSee('span-3', false);
        $response->assertDontSee('href="#"', false);
        $response->assertSee('href="http://localhost/residents"', false);
        $response->assertSee('href="http://localhost/alerts"', false);
        $response->assertSee('href="http://localhost/requests"', false);
        $response->assertSee('href="http://localhost/bookings"', false);
        $response->assertSee('href="http://localhost/services"', false);
    }

    public function test_shared_database_backed_sidebar_modules_render_real_pages(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->fakeSharedPortalData();
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        foreach ([
            '/guru' => 'Guru Intelligence',
            '/vitals' => 'Vitals Monitor',
            '/medication' => 'Medication',
            '/requests' => 'Requests',
            '/bookings' => 'Bookings',
            '/services' => 'Services',
            '/devices' => 'Devices',
            '/reports' => 'Reports',
            '/staff' => 'Staff',
        ] as $path => $heading) {
            $response = $this->get($path);

            $response->assertStatus(200);
            $response->assertSee($heading);
            $response->assertSee('Shared PostgreSQL');
        }
    }

    public function test_command_center_no_longer_depends_on_seeded_local_community_rows(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->fakeSharedPortalData(totalResidents: 0);
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $response = $this->get('/');

        $response->assertStatus(200);
        $response->assertSee('No residents are currently assigned to a tenant scope.');
        $response->assertDontSee('Margaret Smith');
        $response->assertDontSee('Sunrise Senior Living');
    }

    public function test_senior_living_onboarding_workbench_renders_real_import_form(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $response = $this->get('/onboarding/senior-living');

        $response->assertStatus(200);
        $response->assertSee('Senior Living Onboarding');
        $response->assertSee('Memory Care');
        $response->assertSee('Independent Living');
        $response->assertSee('Assisted Living');
        $response->assertSee('Resident import');
        $response->assertSee('CSV or JSON');
    }

    public function test_senior_living_onboarding_posts_to_shared_service_and_redirects_to_live_dashboard(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $service = Mockery::mock(SeniorLivingOnboardingService::class);
        $service->shouldReceive('createCommunity')
            ->once()
            ->with(Mockery::on(fn (array $payload): bool => $payload['name'] === 'Fresh Memory Care Community'
                && $payload['care_levels'][0]['code'] === 'assisted_living'
                && $payload['care_levels'][0]['target_resident_count'] === 1
                && $payload['care_levels'][1]['code'] === 'independent_living'
                && $payload['care_levels'][1]['target_resident_count'] === 1
                && $payload['care_levels'][2]['code'] === 'memory_care'
                && $payload['care_levels'][2]['target_resident_count'] === 1), Mockery::type('int'))
            ->andReturn([
                'id' => 'community-uuid',
                'name' => 'Fresh Memory Care Community',
                'care_levels' => [],
            ]);
        $service->shouldReceive('importResidents')
            ->once()
            ->with('community-uuid', Mockery::on(fn (array $rows): bool => count($rows) === 3
                && $rows[0]['display_name'] === 'Alice Resident'
                && $rows[0]['care_level_code'] === 'assisted_living'
                && $rows[1]['care_level_code'] === 'independent_living'
                && $rows[2]['care_level_code'] === 'memory_care'), Mockery::type('int'), Mockery::type('string'))
            ->andReturn([
                'id' => 'batch-uuid',
                'community_id' => 'community-uuid',
                'status' => 'committed',
                'expected_resident_count' => 3,
                'accepted_count' => 3,
                'rejected_count' => 0,
            ]);

        $this->app->instance(SeniorLivingOnboardingService::class, $service);

        $response = $this->post('/onboarding/senior-living', [
            'name' => 'Fresh Memory Care Community',
            'address' => '100 Care Way',
            'contact_name' => 'Dana Ops',
            'contact_email' => 'dana@example.com',
            'contact_phone' => '555-1000',
            'assisted_living_target' => 1,
            'independent_living_target' => 1,
            'memory_care_target' => 1,
            'resident_import' => implode("\n", [
                'display_name,care_level_code,age,room_number,email,phone,external_reference,mobility_notes,cognitive_support',
                'Alice Resident,assisted_living,82,A101,alice@example.com,555-1010,AL-1,Walker,',
                'Ben Resident,independent_living,76,I201,ben@example.com,555-2020,IL-1,,',
                'Cora Resident,memory_care,88,M301,cora@example.com,555-3030,MC-1,Wheelchair,Memory support',
            ]),
        ]);

        $response->assertRedirect('/');
        $response->assertSessionHas('status', 'Onboarded Fresh Memory Care Community and imported 3 residents into shared PostgreSQL.');
    }

    public function test_residents_module_renders_shared_database_residents(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->fakeSharedPortalData();
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $response = $this->get('/residents');

        $response->assertStatus(200);
        $response->assertSee('Residents');
        $response->assertSee('Database Resident');
        $response->assertSee('tenant_location_resident_assignments');
        $response->assertDontSee('Margaret Smith');
    }

    public function test_resident_profile_module_renders_assignments_and_timeline_from_shared_database(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->fakeSharedPortalData();
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $response = $this->get('/residents/resident-1');

        $response->assertStatus(200);
        $response->assertSee('Database Resident');
        $response->assertSee('Assisted Living');
        $response->assertSee('Room A101');
        $response->assertSee('Latest Guru Risk');
        $response->assertSee('Medication review');
    }

    public function test_alerts_module_renders_shared_alert_work_queue(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->fakeSharedPortalData();
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $response = $this->get('/alerts');

        $response->assertStatus(200);
        $response->assertSee('Alerts & Incidents', false);
        $response->assertSee('High heart rate');
        $response->assertSee('health_alerts');
        $response->assertSee('Convert to incident');
    }

    public function test_alert_triage_posts_to_shared_service_and_returns_to_queue(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->fakeSharedPortalData();
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $response = $this->post('/alerts/alert-1/triage', [
            'action' => 'acknowledge',
            'note' => 'Nurse review started.',
        ]);

        $response->assertRedirect('/alerts');
        $response->assertSessionHas('status', 'Alert triage action recorded in shared PostgreSQL.');
    }

    private function fakeSharedPortalData(int $totalResidents = 1): void
    {
        $service = Mockery::mock(BusinessPortalPrdService::class);
        $service->shouldReceive('dashboardSummary')->andReturn([
            'generated_at' => now()->toIso8601String(),
            'filters' => [],
            'kpis' => [
                'total_residents' => $totalResidents,
                'active_alerts' => 1,
                'critical_alerts' => 0,
                'today_bookings' => 0,
                'pending_requests' => 0,
                'offline_devices' => 0,
            ],
            'alert_summary' => collect(['medium' => 1]),
            'recent_alerts' => collect([(object) ['severity' => 'medium', 'title' => 'Database Alert', 'alert_type' => 'health', 'status' => 'open']]),
            'resident_watchlist' => collect(),
            'device_offline_list' => collect(),
            'staff_tasks_open' => 0,
            'source_tables' => ['residents', 'tenant_location_resident_assignments', 'health_alerts'],
        ]);
        $service->shouldReceive('residents')->andReturn($totalResidents > 0 ? [[
            'id' => 'resident-1',
            'display_name' => 'Database Resident',
            'age' => 82,
            'memory_support_enabled' => true,
            'guru_status' => 'WATCH',
            'wellness_score' => 74,
        ]] : []);
        $service->shouldReceive('liveVitals')->andReturn([]);
        $service->shouldReceive('alerts')->andReturn([
            (object) [
                'id' => 'alert-1',
                'title' => 'High heart rate',
                'body' => 'Heart rate exceeded configured threshold.',
                'severity' => 'high',
                'alert_type' => 'vital',
                'status' => 'open',
                'created_at' => now()->toIso8601String(),
            ],
        ]);
        $service->shouldReceive('serviceRequests')->andReturn([]);
        $service->shouldReceive('bookings')->andReturn([]);
        $service->shouldReceive('providerServices')->andReturn([]);
        $service->shouldReceive('userCanViewHealth')->andReturn(true);
        $service->shouldReceive('guruOverview')->andReturn([
            'status_distribution' => collect(['WATCH' => 0]),
            'recommendations_open' => collect(),
            'guardrail' => 'Laravel reads Guru risk outputs. Node/Guru remains the risk scoring owner.',
        ]);
        $service->shouldReceive('guruRecommendationQueue')->andReturn([]);
        $service->shouldReceive('medicationDashboard')->andReturn([
            'residents_with_two_or_more_missed_doses_7d' => collect(),
            'missed_count' => 0,
            'rule' => '2+ missed doses in 7 days creates Watch-level follow-up.',
        ]);
        $service->shouldReceive('deviceExceptions')->andReturn([]);
        $service->shouldReceive('staffTasks')->andReturn([]);
        $service->shouldReceive('reportsDashboard')->andReturn([
            'definitions' => collect(),
            'generated' => collect(),
        ]);
        $service->shouldReceive('residentProfile')->with('resident-1', true)->andReturn([
            'resident' => (object) [
                'id' => 'resident-1',
                'display_name' => 'Database Resident',
                'age' => 82,
                'email' => 'resident@example.com',
                'phone' => '555-0100',
                'memory_support_enabled' => false,
            ],
            'assignments' => collect([(object) [
                'care_level' => 'assisted_living',
                'room_number' => 'A101',
                'status' => 'active',
                'consent_status' => 'contractual',
            ]]),
            'safe_zones' => collect(),
            'trusted_circle' => collect(),
            'timeline' => [
                [
                    'event_type' => 'care_note',
                    'title' => 'Medication review',
                    'body' => 'Reviewed medication adherence.',
                    'occurred_at' => now()->toIso8601String(),
                ],
            ],
            'latest_risk' => (object) [
                'final_status' => 'WATCH',
                'wellness_score' => 74,
                'score_date' => now()->toDateString(),
            ],
            'latest_vitals' => null,
            'medications' => collect(),
        ]);
        $service->shouldReceive('triageAlert')
            ->with('alert-1', Mockery::on(fn (array $payload): bool => $payload['action'] === 'acknowledge'
                && $payload['note'] === 'Nurse review started.'), Mockery::type('int'))
            ->andReturn((object) [
                'id' => 'alert-1',
                'status' => 'acknowledged',
            ]);

        $this->app->instance(BusinessPortalPrdService::class, $service);
    }
}
