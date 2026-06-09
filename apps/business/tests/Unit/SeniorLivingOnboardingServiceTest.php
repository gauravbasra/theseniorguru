<?php

namespace Tests\Unit;

use App\Services\SeniorLivingOnboardingService;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SeniorLivingOnboardingServiceTest extends TestCase
{
    public function test_requires_the_three_supported_care_levels_with_positive_targets(): void
    {
        $this->expectException(ValidationException::class);

        $this->service()->validateCommunityPayload([
            'name' => 'Fresh Community',
            'care_levels' => [
                ['code' => 'memory_care', 'target_resident_count' => 50],
                ['code' => 'assisted_living', 'target_resident_count' => 50],
            ],
        ]);
    }

    public function test_rejects_resident_import_when_counts_do_not_match_care_level_targets(): void
    {
        $community = [
            'care_levels' => [
                ['code' => 'memory_care', 'target_resident_count' => 2],
                ['code' => 'independent_living', 'target_resident_count' => 1],
                ['code' => 'assisted_living', 'target_resident_count' => 1],
            ],
        ];

        $this->expectException(ValidationException::class);

        $this->service()->validateResidentRows($community, [
            ['display_name' => 'Resident One', 'care_level_code' => 'memory_care'],
            ['display_name' => 'Resident Two', 'care_level_code' => 'independent_living'],
            ['display_name' => 'Resident Three', 'care_level_code' => 'assisted_living'],
        ]);
    }

    public function test_accepts_exactly_fifty_residents_per_supported_care_level(): void
    {
        $community = [
            'care_levels' => [
                ['code' => 'memory_care', 'target_resident_count' => 50],
                ['code' => 'independent_living', 'target_resident_count' => 50],
                ['code' => 'assisted_living', 'target_resident_count' => 50],
            ],
        ];

        $rows = [];
        foreach (['memory_care', 'independent_living', 'assisted_living'] as $careLevel) {
            for ($index = 1; $index <= 50; $index++) {
                $rows[] = [
                    'display_name' => str_replace('_', ' ', $careLevel).' Resident '.$index,
                    'care_level_code' => $careLevel,
                    'age' => 75,
                ];
            }
        }

        $result = $this->service()->validateResidentRows($community, $rows);

        $this->assertSame(150, $result['total']);
        $this->assertSame([
            'assisted_living' => 50,
            'independent_living' => 50,
            'memory_care' => 50,
        ], $result['counts']);
    }

    private function service(): SeniorLivingOnboardingService
    {
        return new SeniorLivingOnboardingService('shared_platform');
    }
}
