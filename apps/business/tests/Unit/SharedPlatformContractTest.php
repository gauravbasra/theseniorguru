<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class SharedPlatformContractTest extends TestCase
{
    public function test_contract_names_the_shared_postgresql_source_and_boundaries(): void
    {
        $contract = require __DIR__.'/../../config/shared_platform.php';

        $this->assertSame('pgsql', $contract['database']['engine']);
        $this->assertSame('mobile-api', $contract['database']['canonical_project']);
        $this->assertContains('users', $contract['required_tables']);
        $this->assertContains('residents', $contract['required_tables']);
        $this->assertContains('businesses', $contract['required_tables']);
        $this->assertContains('bookings', $contract['required_tables']);
        $this->assertContains('support_orders', $contract['required_tables']);
        $this->assertContains('guru_risk_scores', $contract['node_owned_tables']);
        $this->assertContains('health_daily_metrics', $contract['node_owned_tables']);
        $this->assertContains('business_approval_queue', $contract['laravel_operations_tables']);
        $this->assertContains('support_orders', $contract['laravel_operations_tables']);
        $this->assertContains('tenants', $contract['required_tables']);
        $this->assertContains('tenant_locations', $contract['required_tables']);
        $this->assertContains('tenant_location_resident_assignments', $contract['required_tables']);
        $this->assertContains('staff_tasks', $contract['required_tables']);
        $this->assertContains('alert_triage_events', $contract['required_tables']);
        $this->assertContains('incidents', $contract['required_tables']);
        $this->assertContains('service_matches', $contract['required_tables']);
        $this->assertContains('provider_service_areas', $contract['required_tables']);
        $this->assertContains('communities', $contract['temporary_portal_only_tables']);
    }
}
