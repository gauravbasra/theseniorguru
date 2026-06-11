<?php

namespace App\Services;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class SeniorLivingOnboardingService
{
    public const CARE_LEVELS = [
        'assisted_living',
        'independent_living',
        'memory_care',
    ];

    public function __construct(private readonly string $connectionName = 'shared_platform')
    {
    }

    /**
     * @return array<string,mixed>
     */
    public function validateCommunityPayload(array $payload): array
    {
        $validated = Validator::make($payload, [
            'name' => ['required', 'string', 'max:180'],
            'address' => ['nullable', 'string', 'max:500'],
            'business_id' => ['nullable', 'uuid'],
            'contact_name' => ['nullable', 'string', 'max:180'],
            'contact_email' => ['nullable', 'email', 'max:180'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'care_levels' => ['required', 'array', 'size:3'],
            'care_levels.*.code' => ['required', 'string', 'in:'.implode(',', self::CARE_LEVELS)],
            'care_levels.*.display_name' => ['nullable', 'string', 'max:120'],
            'care_levels.*.target_resident_count' => ['required', 'integer', 'min:1', 'max:500'],
        ])->validate();

        $codes = collect($validated['care_levels'])->pluck('code')->sort()->values()->all();
        if ($codes !== self::CARE_LEVELS) {
            throw ValidationException::withMessages([
                'care_levels' => 'Care levels must include assisted_living, independent_living, and memory_care exactly once.',
            ]);
        }

        return $validated;
    }

    /**
     * @return array{total:int,counts:array<string,int>}
     */
    public function validateResidentRows(array $community, array $rows): array
    {
        $targets = collect($community['care_levels'] ?? [])
            ->mapWithKeys(fn (array $careLevel) => [$careLevel['code'] => (int) $careLevel['target_resident_count']])
            ->sortKeys()
            ->all();

        if (array_keys($targets) !== self::CARE_LEVELS) {
            throw ValidationException::withMessages([
                'community' => 'Community must have assisted_living, independent_living, and memory_care targets before residents can be imported.',
            ]);
        }

        Validator::make(['residents' => $rows], [
            'residents' => ['required', 'array', 'min:1', 'max:500'],
            'residents.*.display_name' => ['required', 'string', 'max:180'],
            'residents.*.care_level_code' => ['required', 'string', 'in:'.implode(',', self::CARE_LEVELS)],
            'residents.*.age' => ['nullable', 'integer', 'min:0', 'max:125'],
            'residents.*.room_number' => ['nullable', 'string', 'max:60'],
            'residents.*.email' => ['nullable', 'email', 'max:180'],
            'residents.*.phone' => ['nullable', 'string', 'max:40'],
            'residents.*.external_reference' => ['nullable', 'string', 'max:120'],
            'residents.*.mobility_notes' => ['nullable', 'string', 'max:1000'],
            'residents.*.cognitive_support' => ['nullable', 'string', 'max:1000'],
        ])->validate();

        $counts = collect($rows)
            ->countBy('care_level_code')
            ->sortKeys()
            ->all();

        if ($counts !== $targets) {
            throw ValidationException::withMessages([
                'residents' => 'Resident import counts must match care-level targets. Expected '.json_encode($targets).', received '.json_encode($counts).'.',
            ]);
        }

        return [
            'total' => count($rows),
            'counts' => $counts,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function createCommunity(array $payload, int|string|null $actorId = null): array
    {
        $validated = $this->validateCommunityPayload($payload);
        $connection = $this->connection();

        return $connection->transaction(function () use ($connection, $validated, $actorId): array {
            $communityId = $connection->table('senior_living_communities')->insertGetId([
                'business_id' => $validated['business_id'] ?? null,
                'name' => $validated['name'],
                'address' => $validated['address'] ?? null,
                'status' => 'draft',
                'target_resident_count' => collect($validated['care_levels'])->sum('target_resident_count'),
                'onboarding_metadata' => json_encode([
                    'contact_name' => $validated['contact_name'] ?? null,
                    'contact_email' => $validated['contact_email'] ?? null,
                    'contact_phone' => $validated['contact_phone'] ?? null,
                    'created_by_laravel_user_id' => $actorId,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ], 'id');

            foreach ($validated['care_levels'] as $careLevel) {
                $connection->table('senior_living_care_levels')->insert([
                    'community_id' => $communityId,
                    'code' => $careLevel['code'],
                    'display_name' => $careLevel['display_name'] ?? $this->displayNameForCareLevel($careLevel['code']),
                    'target_resident_count' => $careLevel['target_resident_count'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $tenantId = $connection->table('tenants')->insertGetId([
                'business_id' => $validated['business_id'] ?? null,
                'name' => $validated['name'],
                'tenant_type' => 'community',
                'status' => 'active',
                'settings' => json_encode([
                    'source' => 'business_portal_onboarding',
                    'senior_living_community_id' => $communityId,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ], 'id');

            $connection->table('tenant_locations')->insert([
                'tenant_id' => $tenantId,
                'senior_living_community_id' => $communityId,
                'name' => $validated['name'],
                'address_line1' => $validated['address'] ?? null,
                'timezone' => 'America/Denver',
                'metadata' => json_encode([
                    'care_levels' => collect($validated['care_levels'])->pluck('target_resident_count', 'code')->all(),
                    'source' => 'business_portal_onboarding',
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->writeAudit('senior_living_community', $communityId, 'community.created', [
                'created_by_laravel_user_id' => $actorId,
                'target_resident_count' => collect($validated['care_levels'])->sum('target_resident_count'),
                'tenant_id' => $tenantId,
            ]);

            return $this->communitySummary((string) $communityId);
        });
    }

    /**
     * @return array<string,mixed>
     */
    public function importResidents(string $communityId, array $rows, int|string|null $actorId = null, ?string $idempotencyKey = null): array
    {
        $connection = $this->connection();
        $community = $this->communitySummary($communityId);
        $validation = $this->validateResidentRows($community, $rows);

        return $connection->transaction(function () use ($connection, $communityId, $rows, $actorId, $idempotencyKey, $validation): array {
            if ($idempotencyKey !== null) {
                $existing = $connection->table('senior_living_resident_import_batches')
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();

                if ($existing !== null) {
                    return $this->residentImportSummary((string) $existing->id);
                }
            }

            $batchId = $connection->table('senior_living_resident_import_batches')->insertGetId([
                'community_id' => $communityId,
                'status' => 'processing',
                'expected_resident_count' => $validation['total'],
                'accepted_count' => 0,
                'rejected_count' => 0,
                'idempotency_key' => $idempotencyKey,
                'validation_report' => json_encode(['counts' => $validation['counts']]),
                'submitted_by_laravel_user_id' => $actorId === null ? null : (string) $actorId,
                'created_at' => now(),
                'updated_at' => now(),
            ], 'id');

            $careLevels = $connection->table('senior_living_care_levels')
                ->where('community_id', $communityId)
                ->pluck('id', 'code')
                ->all();
            $scope = $this->tenantScopeForCommunity($communityId);

            foreach ($rows as $row) {
                $userId = $connection->table('users')->insertGetId([
                    'email' => Arr::get($row, 'email'),
                    'phone' => Arr::get($row, 'phone'),
                    'display_name' => $row['display_name'],
                    'role' => 'senior',
                    'status' => 'approved',
                    'created_at' => now(),
                    'updated_at' => now(),
                ], 'id');

                $residentId = $connection->table('residents')->insertGetId([
                    'user_id' => $userId,
                    'age' => Arr::get($row, 'age'),
                    'community' => $communityId,
                    'mobility_notes' => Arr::get($row, 'mobility_notes'),
                    'cognitive_support' => Arr::get($row, 'cognitive_support'),
                    'health_profile' => json_encode([
                        'care_level_code' => $row['care_level_code'],
                        'room_number' => Arr::get($row, 'room_number'),
                        'source' => 'business_portal_onboarding',
                    ]),
                    'onboarding_complete' => $connection->raw('false'),
                    'live_tracking_enabled' => $connection->raw('false'),
                    'memory_support_enabled' => $connection->raw($row['care_level_code'] === 'memory_care' ? 'true' : 'false'),
                    'display_name' => $row['display_name'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ], 'id');

                $connection->table('senior_living_resident_assignments')->insert([
                    'community_id' => $communityId,
                    'care_level_id' => $careLevels[$row['care_level_code']],
                    'resident_id' => $residentId,
                    'import_batch_id' => $batchId,
                    'room_number' => Arr::get($row, 'room_number'),
                    'external_reference' => Arr::get($row, 'external_reference'),
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $connection->table('tenant_location_resident_assignments')->insert([
                    'tenant_id' => $scope['tenant_id'],
                    'location_id' => $scope['location_id'],
                    'resident_id' => $residentId,
                    'care_level' => $row['care_level_code'],
                    'room_number' => Arr::get($row, 'room_number'),
                    'status' => 'active',
                    'consent_status' => 'contractual',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $connection->table('senior_living_resident_import_batches')
                ->where('id', $batchId)
                ->update([
                    'status' => 'committed',
                    'accepted_count' => $validation['total'],
                    'updated_at' => now(),
                ]);

            $connection->table('senior_living_communities')
                ->where('id', $communityId)
                ->update([
                    'status' => 'active',
                    'updated_at' => now(),
                ]);

            $this->writeAudit('senior_living_resident_import_batch', $batchId, 'residents.imported', [
                'created_by_laravel_user_id' => $actorId,
                'community_id' => $communityId,
                'resident_count' => $validation['total'],
                'counts' => $validation['counts'],
            ]);

            return $this->residentImportSummary((string) $batchId);
        });
    }

    /**
     * @return array<string,mixed>
     */
    public function communitySummary(string $communityId): array
    {
        $connection = $this->connection();
        $community = $connection->table('senior_living_communities')->where('id', $communityId)->first();

        if ($community === null) {
            throw ValidationException::withMessages(['community_id' => 'Senior living community was not found.']);
        }

        $careLevels = $connection->table('senior_living_care_levels')
            ->where('community_id', $communityId)
            ->orderBy('code')
            ->get()
            ->map(fn ($careLevel) => [
                'id' => (string) $careLevel->id,
                'code' => $careLevel->code,
                'display_name' => $careLevel->display_name,
                'target_resident_count' => (int) $careLevel->target_resident_count,
                'current_resident_count' => (int) $connection->table('senior_living_resident_assignments')
                    ->where('care_level_id', $careLevel->id)
                    ->where('status', 'active')
                    ->count(),
            ])
            ->all();

        return [
            'id' => (string) $community->id,
            'business_id' => $community->business_id === null ? null : (string) $community->business_id,
            'name' => $community->name,
            'address' => $community->address,
            'status' => $community->status,
            'target_resident_count' => (int) $community->target_resident_count,
            'current_resident_count' => (int) $connection->table('senior_living_resident_assignments')
                ->where('community_id', $communityId)
                ->where('status', 'active')
                ->count(),
            'care_levels' => $careLevels,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function residentImportSummary(string $batchId): array
    {
        $batch = $this->connection()
            ->table('senior_living_resident_import_batches')
            ->where('id', $batchId)
            ->first();

        if ($batch === null) {
            throw ValidationException::withMessages(['batch_id' => 'Resident import batch was not found.']);
        }

        return [
            'id' => (string) $batch->id,
            'community_id' => (string) $batch->community_id,
            'status' => $batch->status,
            'expected_resident_count' => (int) $batch->expected_resident_count,
            'accepted_count' => (int) $batch->accepted_count,
            'rejected_count' => (int) $batch->rejected_count,
            'validation_report' => json_decode($batch->validation_report, true) ?: [],
        ];
    }

    private function displayNameForCareLevel(string $code): string
    {
        return match ($code) {
            'assisted_living' => 'Assisted Living',
            'independent_living' => 'Independent Living',
            'memory_care' => 'Memory Care',
        };
    }

    private function writeAudit(string $entityType, string $entityId, string $action, array $metadata): void
    {
        $this->connection()->table('audit_logs')->insert([
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'severity' => 'info',
            'metadata' => json_encode($metadata),
            'created_at' => now(),
        ]);
    }

    private function connection(): ConnectionInterface
    {
        return DB::connection($this->connectionName);
    }

    /**
     * @return array{tenant_id:string,location_id:?string}
     */
    private function tenantScopeForCommunity(string $communityId): array
    {
        $location = $this->connection()->table('tenant_locations')
            ->where('senior_living_community_id', $communityId)
            ->first();

        if ($location === null) {
            throw ValidationException::withMessages([
                'community_id' => 'Community is missing tenant/location scope. Re-run community onboarding before resident import.',
            ]);
        }

        return [
            'tenant_id' => (string) $location->tenant_id,
            'location_id' => $location->id === null ? null : (string) $location->id,
        ];
    }
}
