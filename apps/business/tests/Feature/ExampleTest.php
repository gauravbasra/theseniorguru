<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use App\Models\User;
use App\Services\BusinessPortalPrdService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_application_returns_a_successful_response(): void
    {
        $this->withoutVite();
        $this->seed(DatabaseSeeder::class);
        $this->app->instance(BusinessPortalPrdService::class, $this->fakePortalService());
        $this->actingAs(User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail());

        $response = $this->get('/');

        $response->assertStatus(200);
    }

    private function fakePortalService(): BusinessPortalPrdService
    {
        $service = Mockery::mock(BusinessPortalPrdService::class);
        $service->shouldReceive('dashboardSummary')->andReturn([
            'generated_at' => now()->toIso8601String(),
            'filters' => [],
            'kpis' => [
                'total_residents' => 0,
                'active_alerts' => 0,
                'critical_alerts' => 0,
                'today_bookings' => 0,
                'pending_requests' => 0,
                'offline_devices' => 0,
            ],
            'alert_summary' => collect(),
            'recent_alerts' => collect(),
            'resident_watchlist' => collect(),
            'device_offline_list' => collect(),
            'staff_tasks_open' => 0,
            'source_tables' => ['residents', 'tenant_location_resident_assignments'],
        ]);
        $service->shouldReceive('residents')->andReturn([]);
        $service->shouldReceive('liveVitals')->andReturn([]);
        $service->shouldReceive('alerts')->andReturn([]);
        $service->shouldReceive('serviceRequests')->andReturn([]);
        $service->shouldReceive('bookings')->andReturn([]);
        $service->shouldReceive('providerServices')->andReturn([]);
        $service->shouldReceive('userCanViewHealth')->andReturn(true);

        return $service;
    }
}
