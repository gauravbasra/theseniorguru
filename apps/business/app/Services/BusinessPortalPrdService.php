<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BusinessPortalPrdService
{
    public function __construct(
        private readonly ServiceAreaMatcher $matcher,
        private readonly string $connectionName = 'shared_platform',
    ) {
    }

    /**
     * @return array<string,mixed>
     */
    public function dashboardSummary(array $filters = []): array
    {
        $db = $this->connection();
        $now = CarbonImmutable::now('UTC');

        $residentAssignments = $this->assignedResidentsQuery($filters);
        $residentIds = $residentAssignments->pluck('resident_id')->all();

        $activeAlerts = $this->healthAlertsQuery($residentIds)->where('status', '!=', 'resolved');
        $todayBookings = $this->bookingsQuery($residentIds)
            ->whereBetween('scheduled_for', [$now->startOfDay(), $now->endOfDay()]);

        return [
            'generated_at' => $now->toIso8601String(),
            'filters' => $filters,
            'kpis' => [
                'total_residents' => count($residentIds),
                'active_alerts' => (clone $activeAlerts)->count(),
                'critical_alerts' => (clone $activeAlerts)->where('severity', 'critical')->count(),
                'today_bookings' => (clone $todayBookings)->count(),
                'pending_requests' => $this->serviceRequestsQuery($residentIds)->whereIn('status', ['pending', 'triage', 'requested'])->count(),
                'offline_devices' => $this->devicesQuery($residentIds)->whereIn('status', ['offline', 'battery_low', 'lost'])->count(),
            ],
            'alert_summary' => $this->severityCounts((clone $activeAlerts)->get()),
            'recent_alerts' => (clone $activeAlerts)->orderByDesc('created_at')->limit(10)->get(),
            'resident_watchlist' => $this->residentWatchlist($residentIds),
            'device_offline_list' => $this->devicesQuery($residentIds)->whereIn('status', ['offline', 'battery_low', 'lost'])->orderBy('last_seen_at')->limit(20)->get(),
            'staff_tasks_open' => $this->staffTasksQuery($filters)->whereIn('status', ['open', 'accepted', 'snoozed'])->count(),
            'source_tables' => ['residents', 'tenant_location_resident_assignments', 'health_alerts', 'guru_risk_scores', 'service_requests', 'bookings', 'wearable_devices', 'staff_tasks'],
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function nocDashboard(array $filters = []): array
    {
        $summary = $this->dashboardSummary($filters);

        return [
            'generated_at' => $summary['generated_at'],
            'auto_refresh_seconds' => 30,
            'kpis' => $summary['kpis'],
            'critical_alerts' => collect($summary['recent_alerts'])->where('severity', 'critical')->values(),
            'resident_watchlist' => collect($summary['resident_watchlist'])->take(12)->values(),
            'device_offline_list' => collect($summary['device_offline_list'])->take(12)->values(),
            'staff_tasks_open' => $summary['staff_tasks_open'],
        ];
    }

    /**
     * @return array<int,mixed>
     */
    public function residents(array $filters = [], bool $includeHealth = false): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();
        if ($residentIds === []) {
            return [];
        }

        $rows = $this->connection()->table('residents')
            ->leftJoin('users', 'users.id', '=', 'residents.user_id')
            ->whereIn('residents.id', $residentIds)
            ->select([
                'residents.id',
                'residents.display_name',
                'residents.age',
                'residents.community',
                'residents.memory_support_enabled',
                'users.email',
                'users.phone',
            ])
            ->orderBy('residents.display_name')
            ->get()
            ->map(fn ($resident) => (array) $resident)
            ->all();

        if (! $includeHealth) {
            return $rows;
        }

        $riskByResident = $this->latestRiskScores($residentIds);

        return array_map(function (array $resident) use ($riskByResident): array {
            $resident['guru_status'] = $riskByResident[$resident['id']]->final_status ?? null;
            $resident['wellness_score'] = $riskByResident[$resident['id']]->wellness_score ?? null;

            return $resident;
        }, $rows);
    }

    /**
     * @return array<string,mixed>
     */
    public function residentProfile(string $residentId, bool $includeHealth): array
    {
        $resident = $this->connection()->table('residents')
            ->leftJoin('users', 'users.id', '=', 'residents.user_id')
            ->where('residents.id', $residentId)
            ->select('residents.*', 'users.email', 'users.phone')
            ->first();

        if ($resident === null) {
            throw ValidationException::withMessages(['resident_id' => 'Resident was not found.']);
        }

        $profile = [
            'resident' => $resident,
            'assignments' => $this->connection()->table('tenant_location_resident_assignments')->where('resident_id', $residentId)->get(),
            'safe_zones' => $this->connection()->table('resident_safe_zones')->where('resident_id', $residentId)->get(),
            'trusted_circle' => $this->connection()->table('trusted_connections')->where('resident_id', $residentId)->get(),
            'timeline' => $this->residentTimeline($residentId, $includeHealth),
        ];

        if ($includeHealth) {
            $profile['latest_risk'] = $this->connection()->table('guru_risk_scores')->where('senior_id', $residentId)->orderByDesc('score_date')->first();
            $profile['latest_vitals'] = $this->connection()->table('health_vitals')->where('resident_id', $residentId)->orderByDesc('captured_at')->first();
            $profile['medications'] = $this->connection()->table('medications')->where('resident_id', $residentId)->orderBy('name')->get();
        }

        return $profile;
    }

    /**
     * @return array<int,mixed>
     */
    public function residentTimeline(string $residentId, bool $includeHealth): array
    {
        $events = $this->connection()->table('resident_events')
            ->where('resident_id', $residentId)
            ->orderByDesc('occurred_at')
            ->limit(100)
            ->get()
            ->map(fn ($event) => (array) $event)
            ->all();

        if (! $includeHealth) {
            return array_values(array_filter($events, fn (array $event) => ! in_array($event['event_type'], ['vital', 'medication', 'health_alert'], true)));
        }

        return $events;
    }

    /**
     * @return array<string,mixed>
     */
    public function guruOverview(array $filters = []): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();

        return [
            'status_distribution' => $this->connection()->table('guru_risk_scores')
                ->select('final_status', DB::raw('count(*) as total'))
                ->whereIn('senior_id', $residentIds)
                ->whereRaw('score_date = (select max(score_date) from guru_risk_scores latest where latest.senior_id = guru_risk_scores.senior_id)')
                ->groupBy('final_status')
                ->pluck('total', 'final_status'),
            'recommendations_open' => $this->connection()->table('guru_recommendations')
                ->whereIn('senior_id', $residentIds)
                ->whereIn('status', ['active', 'open', 'pending'])
                ->orderByDesc('priority')
                ->limit(50)
                ->get(),
            'guardrail' => 'Laravel reads Guru risk outputs. Node/Guru remains the risk scoring owner.',
        ];
    }

    /**
     * @return array<int,mixed>
     */
    public function guruRecommendationQueue(array $filters = []): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();

        return $this->connection()->table('guru_recommendations')
            ->whereIn('senior_id', $residentIds)
            ->whereIn('status', ['active', 'open', 'pending'])
            ->orderByDesc('priority')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->all();
    }

    public function updateGuruRecommendation(string $recommendationId, array $payload, ?int $actorId = null): object
    {
        $validated = validator($payload, [
            'status' => ['required', 'string', 'in:active,accepted,assigned,snoozed,resolved,dismissed'],
            'assigned_to' => ['nullable', 'uuid'],
            'note' => ['nullable', 'string', 'max:1000'],
        ])->validate();

        $db = $this->connection();
        $recommendation = $db->table('guru_recommendations')->where('id', $recommendationId)->first();
        if ($recommendation === null) {
            throw ValidationException::withMessages(['recommendation_id' => 'Guru recommendation was not found.']);
        }

        $db->transaction(function () use ($db, $recommendationId, $recommendation, $validated, $actorId): void {
            $db->table('guru_recommendations')->where('id', $recommendationId)->update([
                'status' => $validated['status'],
                'updated_at' => now(),
            ]);

            $db->table('staff_tasks')->insert([
                'tenant_id' => $this->tenantIdForResident($recommendation->senior_id),
                'resident_id' => $recommendation->senior_id,
                'source_type' => 'guru_recommendation',
                'source_id' => $recommendationId,
                'priority' => $this->priorityFromGuru($recommendation->priority ?? 0),
                'title' => $recommendation->title,
                'body' => $validated['note'] ?? $recommendation->body ?? null,
                'status' => $validated['status'] === 'resolved' ? 'resolved' : 'open',
                'metadata' => json_encode(['local_actor_id' => $actorId, 'guru_status' => $validated['status']]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return $db->table('guru_recommendations')->where('id', $recommendationId)->first();
    }

    /**
     * @return array<int,mixed>
     */
    public function liveVitals(array $filters = []): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();

        return $this->connection()->table('health_vitals')
            ->leftJoin('residents', 'residents.id', '=', 'health_vitals.resident_id')
            ->whereIn('health_vitals.resident_id', $residentIds)
            ->select('health_vitals.*', 'residents.display_name')
            ->orderByDesc('health_vitals.captured_at')
            ->limit(100)
            ->get()
            ->all();
    }

    /**
     * @return array<int,mixed>
     */
    public function alerts(array $filters = []): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();

        return $this->healthAlertsQuery($residentIds)
            ->orderByRaw("case severity::text when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end")
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->all();
    }

    public function triageAlert(string $alertId, array $payload, ?int $actorId = null): object
    {
        $validated = validator($payload, [
            'action' => ['required', 'string', 'in:acknowledge,assign,escalate,resolve,convert_to_incident,comment'],
            'assigned_to' => ['nullable', 'uuid'],
            'note' => ['nullable', 'string', 'max:2000'],
        ])->validate();

        $db = $this->connection();
        $alert = $db->table('health_alerts')->where('id', $alertId)->first();
        if ($alert === null) {
            throw ValidationException::withMessages(['alert_id' => 'Alert was not found.']);
        }

        $db->transaction(function () use ($db, $alert, $alertId, $validated, $actorId): void {
            $db->table('alert_triage_events')->insert([
                'alert_id' => $alertId,
                'tenant_id' => $this->tenantIdForResident($alert->senior_id),
                'actor_user_id' => null,
                'action' => $validated['action'],
                'assigned_to' => $validated['assigned_to'] ?? null,
                'note' => $validated['note'] ?? null,
                'metadata' => json_encode(['local_actor_id' => $actorId]),
                'created_at' => now(),
            ]);

            if ($validated['action'] === 'acknowledge') {
                $db->table('health_alerts')->where('id', $alertId)->update(['status' => 'acknowledged']);
            }

            if ($validated['action'] === 'resolve') {
                $db->table('health_alerts')->where('id', $alertId)->update([
                    'status' => 'resolved',
                    'resolved_at' => now(),
                    'resolved_by' => null,
                ]);
            }

            if ($validated['action'] === 'convert_to_incident') {
                $this->createIncident([
                    'resident_id' => $alert->senior_id,
                    'source_alert_id' => $alertId,
                    'incident_type' => $alert->alert_type ?? 'health_alert',
                    'severity' => (string) $alert->severity,
                    'title' => $alert->title,
                    'narrative' => $validated['note'] ?? $alert->body ?? null,
                ], $actorId);
            }
        });

        return $db->table('health_alerts')->where('id', $alertId)->first();
    }

    public function createIncident(array $payload, ?int $actorId = null): object
    {
        $validated = validator($payload, [
            'resident_id' => ['nullable', 'uuid'],
            'source_alert_id' => ['nullable', 'uuid'],
            'incident_type' => ['required', 'string', 'max:120'],
            'severity' => ['required', 'string', 'in:low,medium,high,critical'],
            'title' => ['required', 'string', 'max:240'],
            'narrative' => ['nullable', 'string'],
        ])->validate();

        $db = $this->connection();
        $incidentId = $db->transaction(function () use ($db, $validated, $actorId): string {
            $residentId = $validated['resident_id'] ?? null;
            $incidentId = $db->table('incidents')->insertGetId([
                'tenant_id' => $residentId ? $this->tenantIdForResident($residentId) : null,
                'resident_id' => $residentId,
                'source_alert_id' => $validated['source_alert_id'] ?? null,
                'incident_type' => $validated['incident_type'],
                'severity' => $validated['severity'],
                'title' => $validated['title'],
                'narrative' => $validated['narrative'] ?? null,
                'created_by' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ], 'id');

            $db->table('incident_events')->insert([
                'incident_id' => $incidentId,
                'actor_user_id' => null,
                'event_type' => 'created',
                'body' => $validated['narrative'] ?? null,
                'metadata' => json_encode(['local_actor_id' => $actorId]),
                'created_at' => now(),
            ]);

            return (string) $incidentId;
        });

        return $db->table('incidents')->where('id', $incidentId)->first();
    }

    /**
     * @return array<int,mixed>
     */
    public function serviceRequests(array $filters = []): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();

        return $this->serviceRequestsQuery($residentIds)->orderByDesc('created_at')->limit(200)->get()->all();
    }

    /**
     * @return array<string,mixed>
     */
    public function matchServiceRequest(string $requestId, array $requestContext = []): array
    {
        $db = $this->connection();
        $serviceRequest = $db->table('service_requests')->where('id', $requestId)->first();
        if ($serviceRequest === null) {
            throw ValidationException::withMessages(['request_id' => 'Service request was not found.']);
        }

        $category = strtolower((string) $serviceRequest->category);
        $providers = $db->table('business_service_catalog')
            ->join('businesses', 'businesses.id', '=', 'business_service_catalog.business_profile_id')
            ->leftJoin('business_service_areas', 'business_service_areas.business_profile_id', '=', 'businesses.id')
            ->whereRaw('business_service_catalog.active is true')
            ->whereRaw('lower(business_service_catalog.category) = ?', [$category])
            ->select([
                'businesses.id as provider_id',
                'businesses.name as provider_name',
                'business_service_catalog.id as provider_service_id',
                'business_service_catalog.service_name',
                'business_service_areas.service_radius_miles',
                'business_service_areas.zip_codes',
                'business_service_areas.cities',
                'business_service_areas.active as area_active',
            ])
            ->get();

        $matches = [];
        foreach ($providers as $provider) {
            $evaluation = $this->matcher->evaluate([
                'active' => $provider->area_active ?? true,
                'service_radius_miles' => $provider->service_radius_miles,
                'zip_codes' => $provider->zip_codes,
                'cities' => $provider->cities,
            ], $requestContext + $this->requestMetadata($serviceRequest));

            if (! $evaluation['matches']) {
                continue;
            }

            $score = 80 - min((float) ($evaluation['distance_miles'] ?? 0), 50);
            $matches[] = [
                'service_request_id' => $requestId,
                'provider_business_id' => $provider->provider_id,
                'provider_service_id' => $provider->provider_service_id,
                'provider_name' => $provider->provider_name,
                'service_name' => $provider->service_name,
                'match_score' => round($score, 2),
                'distance_miles' => $evaluation['distance_miles'],
                'match_reasons' => $evaluation['reasons'],
            ];
        }

        $db->transaction(function () use ($db, $matches, $requestId): void {
            $db->table('service_matches')->where('service_request_id', $requestId)->delete();
            foreach ($matches as $match) {
                $db->table('service_matches')->insert([
                    'service_request_id' => $match['service_request_id'],
                    'provider_business_id' => $match['provider_business_id'],
                    'provider_service_id' => $match['provider_service_id'],
                    'match_score' => $match['match_score'],
                    'distance_miles' => $match['distance_miles'],
                    'match_reasons' => json_encode($match['match_reasons']),
                    'status' => 'recommended',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        return [
            'request_id' => $requestId,
            'match_count' => count($matches),
            'matches' => $matches,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function medicationDashboard(array $filters = []): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();
        $sevenDaysAgo = now()->subDays(7);

        $missed = $this->connection()->table('medication_events')
            ->select('resident_id', DB::raw('count(*) as missed_count'))
            ->whereIn('resident_id', $residentIds)
            ->where('event_type', 'missed')
            ->where('occurred_at', '>=', $sevenDaysAgo)
            ->groupBy('resident_id')
            ->havingRaw('count(*) >= 2')
            ->get();

        return [
            'residents_with_two_or_more_missed_doses_7d' => $missed,
            'missed_count' => $missed->count(),
            'rule' => '2+ missed doses in 7 days creates Watch-level follow-up.',
        ];
    }

    /**
     * @return array<int,mixed>
     */
    public function bookings(array $filters = []): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();

        return $this->bookingsQuery($residentIds)->orderByDesc('scheduled_for')->limit(200)->get()->all();
    }

    /**
     * @return array<int,mixed>
     */
    public function providerServices(): array
    {
        return $this->connection()->table('provider_services')->whereRaw('active is true')->orderBy('category')->orderBy('name')->get()->all();
    }

    /**
     * @return array<int,mixed>
     */
    public function deviceExceptions(array $filters = []): array
    {
        $residentIds = $this->assignedResidentsQuery($filters)->pluck('resident_id')->all();

        return $this->devicesQuery($residentIds)
            ->whereIn('status', ['offline', 'battery_low', 'lost'])
            ->orderBy('last_seen_at')
            ->limit(200)
            ->get()
            ->all();
    }

    /**
     * @return array<int,mixed>
     */
    public function staffTasks(array $filters = []): array
    {
        return $this->staffTasksQuery($filters)
            ->orderByRaw("case priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end")
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->all();
    }

    /**
     * @return array<string,mixed>
     */
    public function reportsDashboard(array $filters = []): array
    {
        $tenantId = $filters['tenant_id'] ?? null;

        $definitions = $this->connection()->table('report_definitions')
            ->when($tenantId, fn ($query) => $query->where(function ($nested) use ($tenantId): void {
                $nested->whereNull('tenant_id')->orWhere('tenant_id', $tenantId);
            }))
            ->orderBy('name')
            ->limit(100)
            ->get();

        $generated = $this->connection()->table('generated_reports')
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return [
            'definitions' => $definitions,
            'generated' => $generated,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function testProviderServiceArea(array $payload): array
    {
        $validated = validator($payload, [
            'provider_id' => ['required', 'uuid'],
            'postal_code' => ['nullable', 'string'],
            'city' => ['nullable', 'string'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
        ])->validate();

        $areas = $this->connection()->table('business_service_areas')
            ->where('business_profile_id', $validated['provider_id'])
            ->get();

        foreach ($areas as $area) {
            $evaluation = $this->matcher->evaluate((array) $area, $validated);
            if ($evaluation['matches']) {
                return $evaluation + ['provider_id' => $validated['provider_id']];
            }
        }

        return [
            'provider_id' => $validated['provider_id'],
            'matches' => false,
            'distance_miles' => null,
            'reasons' => ['no active service area matched supplied request fields'],
        ];
    }

    public function createReport(array $payload, ?int $actorId = null): object
    {
        $validated = validator($payload, [
            'report_type' => ['required', 'string', 'max:120'],
            'format' => ['required', 'string', 'in:csv,pdf,xlsx'],
            'tenant_id' => ['nullable', 'uuid'],
            'filters' => ['nullable', 'array'],
        ])->validate();

        $id = $this->connection()->table('generated_reports')->insertGetId([
            'tenant_id' => $validated['tenant_id'] ?? null,
            'report_type' => $validated['report_type'],
            'format' => $validated['format'],
            'status' => 'queued',
            'generated_by' => null,
            'metadata' => json_encode(['filters' => $validated['filters'] ?? [], 'local_actor_id' => $actorId]),
            'created_at' => now(),
        ], 'id');

        return $this->connection()->table('generated_reports')->where('id', $id)->first();
    }

    public function userCanViewHealth(?object $user): bool
    {
        if ($user === null) {
            return false;
        }

        return in_array($user->role, ['super_admin', 'tenant_owner', 'location_admin', 'care_manager', 'nurse', 'business_admin'], true);
    }

    private function connection(): ConnectionInterface
    {
        return DB::connection($this->connectionName);
    }

    private function assignedResidentsQuery(array $filters)
    {
        $query = $this->connection()->table('tenant_location_resident_assignments')->where('status', 'active');

        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', $filters['tenant_id']);
        }

        if (! empty($filters['location_id'])) {
            $query->where('location_id', $filters['location_id']);
        }

        return $query;
    }

    private function healthAlertsQuery(array $residentIds)
    {
        return $this->connection()->table('health_alerts')->whereIn('senior_id', $residentIds);
    }

    private function serviceRequestsQuery(array $residentIds)
    {
        return $this->connection()->table('service_requests')->whereIn('resident_id', $residentIds);
    }

    private function bookingsQuery(array $residentIds)
    {
        return $this->connection()->table('bookings')->whereIn('resident_id', $residentIds);
    }

    private function devicesQuery(array $residentIds)
    {
        return $this->connection()->table('wearable_devices')->whereIn('resident_id', $residentIds);
    }

    private function staffTasksQuery(array $filters)
    {
        $query = $this->connection()->table('staff_tasks');

        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', $filters['tenant_id']);
        }

        if (! empty($filters['location_id'])) {
            $query->where('location_id', $filters['location_id']);
        }

        return $query;
    }

    /**
     * @param  array<int,string>  $residentIds
     * @return array<string,object>
     */
    private function latestRiskScores(array $residentIds): array
    {
        return $this->connection()->table('guru_risk_scores as grs')
            ->whereIn('senior_id', $residentIds)
            ->whereRaw('score_date = (select max(score_date) from guru_risk_scores latest where latest.senior_id = grs.senior_id)')
            ->get()
            ->keyBy('senior_id')
            ->all();
    }

    private function residentWatchlist(array $residentIds)
    {
        if ($residentIds === []) {
            return collect();
        }

        return $this->connection()->table('guru_risk_scores')
            ->leftJoin('residents', 'residents.id', '=', 'guru_risk_scores.senior_id')
            ->whereIn('senior_id', $residentIds)
            ->whereIn('final_status', ['WATCH', 'NEEDS_CHECKIN', 'EMERGENCY'])
            ->orderByRaw("case final_status when 'EMERGENCY' then 1 when 'NEEDS_CHECKIN' then 2 when 'WATCH' then 3 else 4 end")
            ->orderByDesc('score_date')
            ->select('guru_risk_scores.*', 'residents.display_name')
            ->limit(25)
            ->get();
    }

    private function severityCounts($alerts)
    {
        return collect($alerts)->countBy('severity');
    }

    private function tenantIdForResident(string $residentId): ?string
    {
        $assignment = $this->connection()->table('tenant_location_resident_assignments')
            ->where('resident_id', $residentId)
            ->where('status', 'active')
            ->first();

        return $assignment?->tenant_id === null ? null : (string) $assignment->tenant_id;
    }

    private function priorityFromGuru(mixed $priority): string
    {
        return match (true) {
            (int) $priority >= 90 => 'critical',
            (int) $priority >= 70 => 'high',
            (int) $priority <= 20 => 'low',
            default => 'normal',
        };
    }

    /**
     * @return array<string,mixed>
     */
    private function requestMetadata(object $serviceRequest): array
    {
        $metadata = json_decode((string) ($serviceRequest->metadata ?? '{}'), true);
        if (! is_array($metadata)) {
            $metadata = [];
        }

        return [
            'postal_code' => Arr::get($metadata, 'postal_code'),
            'city' => Arr::get($metadata, 'city'),
            'latitude' => Arr::get($metadata, 'latitude'),
            'longitude' => Arr::get($metadata, 'longitude'),
        ];
    }
}
