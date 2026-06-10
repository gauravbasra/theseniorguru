<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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

        $activeAlerts = $this->healthAlertsQuery($residentIds)->where('health_alerts.status', '!=', 'resolved');
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
            'recent_alerts' => (clone $activeAlerts)->orderByDesc('health_alerts.created_at')->limit(10)->get(),
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
            'escalation_matrix' => $this->familyEscalationMatrix($residentId),
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
                'id' => (string) Str::uuid(),
                'tenant_id' => $this->tenantIdForResident($recommendation->senior_id),
                'location_id' => $this->locationIdForResident($recommendation->senior_id),
                'resident_id' => $recommendation->senior_id,
                'source_type' => 'guru_recommendation',
                'source_id' => $recommendationId,
                'priority' => $this->priorityFromGuru($recommendation->priority ?? 0),
                'title' => $recommendation->title,
                'body' => $validated['note'] ?? $recommendation->body ?? null,
                'status' => $validated['status'] === 'resolved' ? 'resolved' : 'open',
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
            ->leftJoin('tenant_location_resident_assignments as tlra', function ($join): void {
                $join->on('tlra.resident_id', '=', 'health_vitals.resident_id')->where('tlra.status', '=', 'active');
            })
            ->whereIn('health_vitals.resident_id', $residentIds)
            ->select('health_vitals.*', 'residents.display_name', 'tlra.room_number')
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
            ->orderByRaw("case health_alerts.severity::text when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end")
            ->orderByDesc('health_alerts.created_at')
            ->limit(200)
            ->get()
            ->all();
    }

    public function triageAlert(string $alertId, array $payload, ?int $actorId = null): object
    {
        $validated = validator($payload, [
            'action' => ['required', 'string', 'in:acknowledge,assign,escalate,resolve,convert_to_incident,comment'],
            'assigned_to' => ['nullable', 'uuid', 'required_if:action,assign'],
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
                $this->syncAlertStaffTask($alert, $alertId, ['status' => 'accepted']);
            }

            if ($validated['action'] === 'resolve') {
                $db->table('health_alerts')->where('id', $alertId)->update([
                    'status' => 'resolved',
                    'resolved_at' => now(),
                    'resolved_by' => null,
                ]);
                $this->syncAlertStaffTask($alert, $alertId, ['status' => 'resolved', 'resolved_at' => now()]);
                $this->logResidentEvent($alert->senior_id, $this->tenantIdForResident($alert->senior_id), 'health_alert_resolved', 'Alert resolved', $validated['note'] ?? $alert->title);
            }

            if ($validated['action'] === 'assign') {
                $task = $this->upsertAlertStaffTask($alert, $alertId, $validated['assigned_to']);
                $db->table('health_alerts')->where('id', $alertId)->update(['status' => 'assigned']);

                $staff = $db->table('staff_profiles')->where('id', $validated['assigned_to'])->first();
                $this->notifyStaffProfile(
                    $validated['assigned_to'],
                    'New care task assigned: '.($alert->title ?? 'Health alert'),
                    trim(($alert->body ?? 'A health alert needs follow-up.')." \n\nPriority: {$task->priority}".(! empty($validated['note']) ? "\nNote: {$validated['note']}" : ''))
                );
                $this->logResidentEvent($alert->senior_id, $this->tenantIdForResident($alert->senior_id), 'staff_task_assigned', 'Care task assigned', ($staff->display_name ?? 'A staff member')." was assigned to follow up on: {$alert->title}");
            }

            if ($validated['action'] === 'escalate') {
                $tenantId = $this->tenantIdForResident($alert->senior_id);
                $noc = $this->nocStaffProfile($tenantId);

                $db->table('health_alerts')->where('id', $alertId)->update(['status' => 'escalated']);

                $incident = $this->createIncident([
                    'resident_id' => $alert->senior_id,
                    'source_alert_id' => $alertId,
                    'incident_type' => $alert->alert_type ?? 'health_alert',
                    'severity' => 'critical',
                    'title' => 'Escalated: '.($alert->title ?? 'Health alert'),
                    'narrative' => $validated['note'] ?? $alert->body ?? null,
                ], $actorId);

                if ($noc !== null) {
                    $task = $this->upsertAlertStaffTask($alert, $alertId, $noc->id, 'escalation', 'critical');
                    $this->notifyStaffProfile(
                        $noc->id,
                        'NOC ESCALATION: '.($alert->title ?? 'Health alert'),
                        trim(($alert->body ?? 'An alert was escalated to NOC.')."\n\nIncident: {$incident->id}".(! empty($validated['note']) ? "\nNote: {$validated['note']}" : ''))
                    );
                }

                $this->logResidentEvent($alert->senior_id, $tenantId, 'alert_escalated', 'Alert escalated to NOC', $validated['note'] ?? $alert->title);
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
     * @return array<int,mixed>
     */
    public function staffRoster(array $filters = []): array
    {
        $query = $this->connection()->table('staff_profiles')->where('status', 'active');

        if (! empty($filters['tenant_id'])) {
            $query->where('tenant_id', $filters['tenant_id']);
        }

        if (! empty($filters['location_id'])) {
            $query->where('location_id', $filters['location_id']);
        }

        return $query->orderBy('display_name')->get()->all();
    }

    /**
     * @return array<int,mixed>
     */
    public function staffWorkQueue(array $filters = []): array
    {
        return $this->staffTasksQuery($filters)
            ->leftJoin('staff_profiles', 'staff_profiles.id', '=', 'staff_tasks.assigned_to')
            ->leftJoin('residents', 'residents.id', '=', 'staff_tasks.resident_id')
            ->leftJoin('tenant_location_resident_assignments as tlra', function ($join): void {
                $join->on('tlra.resident_id', '=', 'staff_tasks.resident_id')->where('tlra.status', '=', 'active');
            })
            ->select(
                'staff_tasks.*',
                'staff_profiles.display_name as assignee_name',
                'staff_profiles.role_name as assignee_role',
                'residents.display_name as resident_name',
                'tlra.room_number'
            )
            ->orderByRaw("case staff_tasks.status when 'open' then 1 when 'accepted' then 2 when 'snoozed' then 3 else 4 end")
            ->orderByRaw("case staff_tasks.priority when 'critical' then 1 when 'high' then 2 when 'normal' then 3 else 4 end")
            ->orderByDesc('staff_tasks.created_at')
            ->limit(200)
            ->get()
            ->all();
    }

    /**
     * Drives the staff task lifecycle: accept (acknowledge & start), resolve,
     * snooze, or escalate to the on-call NOC team.
     */
    public function staffTaskAction(string $taskId, array $payload, ?int $actorId = null): object
    {
        $validated = validator($payload, [
            'action' => ['required', 'string', 'in:accept,resolve,snooze,escalate'],
            'note' => ['nullable', 'string', 'max:2000'],
        ])->validate();

        $db = $this->connection();
        $task = $db->table('staff_tasks')->where('id', $taskId)->first();
        if ($task === null) {
            throw ValidationException::withMessages(['task_id' => 'Staff task was not found.']);
        }

        $db->transaction(function () use ($db, $task, $taskId, $validated, $actorId): void {
            switch ($validated['action']) {
                case 'accept':
                    $db->table('staff_tasks')->where('id', $taskId)->update(['status' => 'accepted', 'updated_at' => now()]);
                    $this->logResidentEvent($task->resident_id, $task->tenant_id, 'staff_task_accepted', 'Staff task accepted', $validated['note'] ?? ($task->title.' was acknowledged and is being worked on.'));
                    $this->reflectTaskOnAlert($task, 'acknowledged', 'acknowledge', $validated['note'] ?? null, $actorId);
                    break;

                case 'resolve':
                    $db->table('staff_tasks')->where('id', $taskId)->update(['status' => 'resolved', 'resolved_at' => now(), 'updated_at' => now()]);
                    $this->logResidentEvent($task->resident_id, $task->tenant_id, 'staff_task_resolved', 'Staff task resolved', $validated['note'] ?? ($task->title.' was completed.'));
                    $this->reflectTaskOnAlert($task, 'resolved', 'resolve', $validated['note'] ?? null, $actorId, true);
                    break;

                case 'snooze':
                    $db->table('staff_tasks')->where('id', $taskId)->update([
                        'status' => 'snoozed',
                        'due_at' => now()->addHours(2),
                        'updated_at' => now(),
                    ]);
                    $this->logResidentEvent($task->resident_id, $task->tenant_id, 'staff_task_snoozed', 'Staff task snoozed', $validated['note'] ?? ($task->title.' was snoozed for 2 hours.'));
                    break;

                case 'escalate':
                    $db->table('staff_tasks')->where('id', $taskId)->update(['status' => 'cancelled', 'updated_at' => now()]);

                    $noc = $this->nocStaffProfile($task->tenant_id);
                    $incident = $this->createIncident([
                        'resident_id' => $task->resident_id,
                        'source_alert_id' => $task->source_type === 'health_alert' ? $task->source_id : null,
                        'incident_type' => $task->source_type ?? 'staff_task',
                        'severity' => 'critical',
                        'title' => 'Escalated: '.$task->title,
                        'narrative' => $validated['note'] ?? $task->body ?? null,
                    ], $actorId);

                    if ($noc !== null) {
                        $db->table('staff_tasks')->insert([
                            'id' => (string) Str::uuid(),
                            'tenant_id' => $task->tenant_id,
                            'location_id' => $task->location_id,
                            'resident_id' => $task->resident_id,
                            'assigned_to' => $noc->id,
                            'source_type' => 'escalation',
                            'source_id' => $task->id,
                            'priority' => 'critical',
                            'title' => 'NOC follow-up: '.$task->title,
                            'body' => $validated['note'] ?? $task->body ?? null,
                            'status' => 'open',
                            'due_at' => now()->addMinutes(15),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);

                        $this->notifyStaffProfile(
                            $noc->id,
                            'NOC ESCALATION: '.$task->title,
                            trim(($task->body ?? 'A staff task was escalated to NOC.')."\n\nIncident: {$incident->id}".(! empty($validated['note']) ? "\nNote: {$validated['note']}" : ''))
                        );
                    }

                    $this->reflectTaskOnAlert($task, 'escalated', 'escalate', $validated['note'] ?? null, $actorId);
                    $this->logResidentEvent($task->resident_id, $task->tenant_id, 'staff_task_escalated', 'Staff task escalated to NOC', $validated['note'] ?? ($task->title.' was escalated to the NOC team.'));
                    break;
            }
        });

        return $db->table('staff_tasks')->where('id', $taskId)->first();
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
        return $this->connection()->table('health_alerts')
            ->leftJoin('residents', 'residents.id', '=', 'health_alerts.senior_id')
            ->leftJoin('tenant_location_resident_assignments as tlra', function ($join): void {
                $join->on('tlra.resident_id', '=', 'health_alerts.senior_id')->where('tlra.status', '=', 'active');
            })
            ->whereIn('health_alerts.senior_id', $residentIds)
            ->select('health_alerts.*', 'residents.display_name as resident_name', 'tlra.room_number');
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

    /**
     * The family/trusted-contact escalation order for a resident: who to
     * notify, in what order, when an emergency alert can't be resolved by
     * on-site staff. Ranks approved family contacts with health access first,
     * then other approved trusted connections, then everyone else.
     *
     * @return array<int,mixed>
     */
    private function familyEscalationMatrix(string $residentId): array
    {
        return $this->connection()->table('trusted_connections')
            ->leftJoin('users', 'users.id', '=', 'trusted_connections.trusted_user_id')
            ->where('trusted_connections.resident_id', $residentId)
            ->select(
                'trusted_connections.*',
                'users.display_name as contact_name',
                'users.email as contact_email',
                'users.phone as contact_phone'
            )
            ->orderByRaw("case when trusted_connections.status = 'approved' and trusted_connections.connection_type = 'family' and trusted_connections.health_access_status = 'granted' then 1
                                when trusted_connections.status = 'approved' and trusted_connections.connection_type = 'family' then 2
                                when trusted_connections.status = 'approved' then 3
                                else 4 end")
            ->orderBy('trusted_connections.created_at')
            ->get()
            ->all();
    }

    private function locationIdForResident(string $residentId): ?string
    {
        $assignment = $this->connection()->table('tenant_location_resident_assignments')
            ->where('resident_id', $residentId)
            ->where('status', 'active')
            ->first();

        return $assignment?->location_id === null ? null : (string) $assignment->location_id;
    }

    /**
     * Maps a health_alerts.severity value onto the staff_tasks.priority vocabulary.
     */
    private function priorityFromSeverity(?string $severity): string
    {
        return match ($severity) {
            'critical' => 'critical',
            'high' => 'high',
            'watch' => 'normal',
            default => 'normal',
        };
    }

    /**
     * How quickly a staff task derived from an alert should be actioned, by severity.
     */
    private function dueAtForSeverity(?string $severity): \Illuminate\Support\Carbon
    {
        return match ($severity) {
            'critical' => now()->addMinutes(15),
            'high' => now()->addHour(),
            'watch' => now()->addHours(4),
            default => now()->addHours(24),
        };
    }

    /**
     * Find (or create) the staff_tasks row linked to a health alert and
     * (re)assign it to the given staff profile.
     */
    private function upsertAlertStaffTask(object $alert, string $alertId, string $assignedTo, string $sourceType = 'health_alert', ?string $priorityOverride = null): object
    {
        $db = $this->connection();
        $tenantId = $this->tenantIdForResident($alert->senior_id);
        $locationId = $this->locationIdForResident($alert->senior_id);
        $priority = $priorityOverride ?? $this->priorityFromSeverity((string) ($alert->severity ?? 'watch'));

        $existing = $db->table('staff_tasks')
            ->where('source_type', 'health_alert')
            ->where('source_id', $alertId)
            ->whereNotIn('status', ['resolved', 'cancelled'])
            ->first();

        if ($existing !== null) {
            $db->table('staff_tasks')->where('id', $existing->id)->update([
                'assigned_to' => $assignedTo,
                'source_type' => $sourceType,
                'priority' => $priority,
                'status' => 'open',
                'due_at' => $this->dueAtForSeverity((string) ($alert->severity ?? 'watch')),
                'updated_at' => now(),
            ]);

            return $db->table('staff_tasks')->where('id', $existing->id)->first();
        }

        $id = (string) Str::uuid();
        $db->table('staff_tasks')->insert([
            'id' => $id,
            'tenant_id' => $tenantId,
            'location_id' => $locationId,
            'resident_id' => $alert->senior_id,
            'assigned_to' => $assignedTo,
            'source_type' => $sourceType,
            'source_id' => $alertId,
            'priority' => $priority,
            'title' => $alert->title ?? 'Health alert follow-up',
            'body' => $alert->body ?? null,
            'status' => 'open',
            'due_at' => $this->dueAtForSeverity((string) ($alert->severity ?? 'watch')),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $db->table('staff_tasks')->where('id', $id)->first();
    }

    /**
     * Keep the linked staff_tasks row (if any) in sync when an alert is
     * acknowledged/resolved directly from the alert work queue.
     *
     * @param  array<string,mixed>  $updates
     */
    private function syncAlertStaffTask(object $alert, string $alertId, array $updates): void
    {
        $db = $this->connection();

        $task = $db->table('staff_tasks')
            ->where('source_type', 'health_alert')
            ->where('source_id', $alertId)
            ->whereNotIn('status', ['resolved', 'cancelled'])
            ->first();

        if ($task === null) {
            return;
        }

        $db->table('staff_tasks')->where('id', $task->id)->update($updates + ['updated_at' => now()]);
    }

    /**
     * When a staff task derived from a health alert moves through its
     * lifecycle, mirror the state change back onto health_alerts and log a
     * triage event so the alert work queue stays consistent.
     */
    private function reflectTaskOnAlert(object $task, string $alertStatus, string $triageAction, ?string $note, ?int $actorId, bool $resolved = false): void
    {
        if ($task->source_type !== 'health_alert' && $task->source_type !== 'escalation' || empty($task->source_id)) {
            return;
        }

        $db = $this->connection();
        $alertId = $task->source_type === 'escalation'
            ? ($db->table('staff_tasks')->where('id', $task->source_id)->value('source_id') ?? $task->source_id)
            : $task->source_id;

        $alert = $db->table('health_alerts')->where('id', $alertId)->first();
        if ($alert === null) {
            return;
        }

        $update = ['status' => $alertStatus];
        if ($resolved) {
            $update['resolved_at'] = now();
        }

        $db->table('health_alerts')->where('id', $alertId)->update($update);

        $db->table('alert_triage_events')->insert([
            'alert_id' => $alertId,
            'tenant_id' => $task->tenant_id,
            'actor_user_id' => null,
            'action' => $triageAction,
            'assigned_to' => $task->assigned_to,
            'note' => $note,
            'metadata' => json_encode(['local_actor_id' => $actorId, 'via' => 'staff_task']),
            'created_at' => now(),
        ]);
    }

    /**
     * Push a notification to the user account behind a staff profile, if any.
     */
    private function notifyStaffProfile(string $staffProfileId, string $title, string $body): void
    {
        $db = $this->connection();
        $staff = $db->table('staff_profiles')->where('id', $staffProfileId)->first();

        if ($staff === null || empty($staff->user_id)) {
            return;
        }

        $db->table('notifications')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $staff->user_id,
            'channel' => 'push',
            'title' => $title,
            'body' => $body,
            'status' => 'queued',
            'retry_count' => 0,
            'created_at' => now(),
        ]);
    }

    /**
     * The on-call NOC staff profile for a tenant (falls back to any active NOC profile).
     */
    private function nocStaffProfile(?string $tenantId): ?object
    {
        $db = $this->connection();

        if ($tenantId !== null) {
            $scoped = $db->table('staff_profiles')
                ->where('role_name', 'noc')
                ->where('status', 'active')
                ->where('tenant_id', $tenantId)
                ->first();

            if ($scoped !== null) {
                return $scoped;
            }
        }

        return $db->table('staff_profiles')
            ->where('role_name', 'noc')
            ->where('status', 'active')
            ->first();
    }

    /**
     * Append an entry to a resident's activity timeline.
     */
    private function logResidentEvent(?string $residentId, ?string $tenantId, string $eventType, string $title, ?string $body): void
    {
        if (empty($residentId)) {
            return;
        }

        $this->connection()->table('resident_events')->insert([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenantId,
            'location_id' => $this->locationIdForResident($residentId),
            'resident_id' => $residentId,
            'event_type' => $eventType,
            'title' => $title,
            'body' => $body,
            'occurred_at' => now(),
            'metadata' => json_encode([]),
            'created_at' => now(),
        ]);
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
