<?php

namespace Tests\Unit;

use App\Services\ServiceAreaMatcher;
use PHPUnit\Framework\TestCase;

class ServiceAreaMatcherTest extends TestCase
{
    public function test_rejects_requests_outside_zip_boundary(): void
    {
        $result = (new ServiceAreaMatcher)->evaluate([
            'active' => true,
            'zip_codes' => ['80202', '80203'],
        ], [
            'postal_code' => '90210',
        ]);

        $this->assertFalse($result['matches']);
        $this->assertSame(['postal code outside provider service area'], $result['reasons']);
    }

    public function test_accepts_requests_inside_radius_boundary(): void
    {
        $result = (new ServiceAreaMatcher)->evaluate([
            'active' => true,
            'base_latitude' => 39.7392,
            'base_longitude' => -104.9903,
            'radius_miles' => 15,
        ], [
            'latitude' => 39.7589,
            'longitude' => -104.9172,
        ]);

        $this->assertTrue($result['matches']);
        $this->assertLessThan(15, $result['distance_miles']);
        $this->assertContains('coordinates inside provider radius', $result['reasons']);
    }
}
