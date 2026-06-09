<?php

namespace App\Http\Controllers;

use App\Services\BusinessPortalPrdService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class BusinessPortalController extends Controller
{
    public function __construct(private readonly BusinessPortalPrdService $portal)
    {
    }

    public function commandCenter(Request $request): View
    {
        $filters = array_filter([
            'tenant_id' => $request->query('tenant_id'),
            'location_id' => $request->query('location_id'),
        ]);
        $canViewHealth = $this->portal->userCanViewHealth($request->user());

        return view('business.command-center', [
            'summary' => $this->portal->dashboardSummary($filters),
            'residents' => $this->portal->residents($filters, $canViewHealth),
            'vitals' => $canViewHealth ? $this->portal->liveVitals($filters) : [],
            'alerts' => $canViewHealth ? $this->portal->alerts($filters) : [],
            'requests' => $this->portal->serviceRequests($filters),
            'bookings' => $this->portal->bookings($filters),
            'providerServices' => $this->portal->providerServices(),
            'canViewHealth' => $canViewHealth,
            'filters' => $filters,
            'generatedAt' => now(),
        ]);
    }

    public function residents(Request $request): View
    {
        $filters = $this->filters($request);
        $canViewHealth = $this->portal->userCanViewHealth($request->user());

        return view('business.residents.index', [
            'residents' => $this->portal->residents($filters, $canViewHealth),
            'canViewHealth' => $canViewHealth,
            'filters' => $filters,
            'sourceTables' => ['residents', 'users', 'tenant_location_resident_assignments', 'guru_risk_scores'],
        ]);
    }

    public function residentProfile(Request $request, string $resident): View
    {
        $canViewHealth = $this->portal->userCanViewHealth($request->user());

        return view('business.residents.profile', [
            'profile' => $this->portal->residentProfile($resident, $canViewHealth),
            'canViewHealth' => $canViewHealth,
            'sourceTables' => ['residents', 'tenant_location_resident_assignments', 'resident_events', 'guru_risk_scores', 'health_vitals'],
        ]);
    }

    public function alerts(Request $request): View
    {
        abort_unless($this->portal->userCanViewHealth($request->user()), 403);

        $filters = $this->filters($request);

        return view('business.alerts.index', [
            'alerts' => $this->portal->alerts($filters),
            'filters' => $filters,
            'sourceTables' => ['health_alerts', 'alert_triage_events', 'incidents', 'incident_events'],
        ]);
    }

    public function triageAlert(Request $request, string $alert): RedirectResponse
    {
        abort_unless($this->portal->userCanViewHealth($request->user()), 403);

        $validated = $request->validate([
            'action' => ['required', 'string', 'in:acknowledge,assign,escalate,resolve,convert_to_incident,comment'],
            'assigned_to' => ['nullable', 'uuid'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->portal->triageAlert($alert, $validated, $request->user()?->id);

        return redirect()
            ->route('business.alerts.index')
            ->with('status', 'Alert triage action recorded in shared PostgreSQL.');
    }

    public function guru(Request $request): View
    {
        abort_unless($this->portal->userCanViewHealth($request->user()), 403);

        $filters = $this->filters($request);

        return view('business.modules.generic', [
            'title' => 'Guru Intelligence',
            'subtitle' => 'Risk distribution and recommendation queue read from Node-owned Guru outputs.',
            'sourceTables' => ['guru_risk_scores', 'guru_recommendations', 'staff_tasks'],
            'sections' => [
                ['heading' => 'Status distribution', 'rows' => collect($this->portal->guruOverview($filters)['status_distribution'] ?? [])->map(fn ($total, $status) => ['label' => $status, 'value' => $total, 'meta' => 'latest score'])->values()],
                ['heading' => 'Recommendation queue', 'rows' => collect($this->portal->guruRecommendationQueue($filters))->map(fn ($row) => ['label' => $row->title ?? $row->id, 'value' => $row->status ?? 'open', 'meta' => $row->priority ?? null])],
            ],
        ]);
    }

    public function vitals(Request $request): View
    {
        abort_unless($this->portal->userCanViewHealth($request->user()), 403);

        return $this->moduleView('Vitals Monitor', 'Live vitals captured from shared health ingestion tables.', ['health_vitals', 'residents'], [
            ['heading' => 'Live readings', 'rows' => collect($this->portal->liveVitals($this->filters($request)))->map(fn ($row) => ['label' => $row->display_name ?? $row->resident_id, 'value' => ($row->heart_rate ?? 'N/A').' bpm', 'meta' => $row->captured_at ?? null])],
        ]);
    }

    public function medication(Request $request): View
    {
        abort_unless($this->portal->userCanViewHealth($request->user()), 403);

        $dashboard = $this->portal->medicationDashboard($this->filters($request));

        return $this->moduleView('Medication', $dashboard['rule'] ?? 'Medication exception monitoring from shared events.', ['medication_schedules', 'medication_events'], [
            ['heading' => 'Missed-dose follow-up', 'rows' => collect($dashboard['residents_with_two_or_more_missed_doses_7d'] ?? [])->map(fn ($row) => ['label' => $row->resident_id, 'value' => $row->missed_count.' missed', 'meta' => 'last 7 days'])],
        ]);
    }

    public function requests(Request $request): View
    {
        return $this->moduleView('Requests', 'Service request queue from shared service_requests.', ['service_requests', 'service_matches'], [
            ['heading' => 'Open requests', 'rows' => collect($this->portal->serviceRequests($this->filters($request)))->map(fn ($row) => ['label' => $row->label ?? $row->category ?? $row->id, 'value' => $row->status ?? 'requested', 'meta' => $row->created_at ?? null])],
        ]);
    }

    public function bookings(Request $request): View
    {
        return $this->moduleView('Bookings', 'Bookings from the shared booking schedule.', ['bookings', 'booking_events'], [
            ['heading' => 'Bookings', 'rows' => collect($this->portal->bookings($this->filters($request)))->map(fn ($row) => ['label' => $row->label ?? $row->id, 'value' => $row->status ?? 'scheduled', 'meta' => $row->scheduled_for ?? null])],
        ]);
    }

    public function services(): View
    {
        return $this->moduleView('Services', 'Active provider services from the shared marketplace catalog.', ['provider_services', 'provider_service_areas', 'business_service_catalog'], [
            ['heading' => 'Provider services', 'rows' => collect($this->portal->providerServices())->map(fn ($row) => ['label' => $row->name ?? $row->service_name ?? $row->id, 'value' => $row->category ?? 'service', 'meta' => $row->provider_name ?? null])],
        ]);
    }

    public function devices(Request $request): View
    {
        return $this->moduleView('Devices', 'Wearable device exceptions from the shared device registry.', ['wearable_devices'], [
            ['heading' => 'Device exceptions', 'rows' => collect($this->portal->deviceExceptions($this->filters($request)))->map(fn ($row) => ['label' => $row->name ?? $row->id, 'value' => $row->status ?? 'unknown', 'meta' => $row->last_seen_at ?? null])],
        ]);
    }

    public function reports(Request $request): View
    {
        $reports = $this->portal->reportsDashboard($this->filters($request));

        return $this->moduleView('Reports', 'Report definitions and generated report jobs from shared PostgreSQL.', ['report_definitions', 'generated_reports', 'exports'], [
            ['heading' => 'Report definitions', 'rows' => collect($reports['definitions'])->map(fn ($row) => ['label' => $row->name ?? $row->report_type ?? $row->id, 'value' => $row->format ?? 'report', 'meta' => $row->created_at ?? null])],
            ['heading' => 'Generated reports', 'rows' => collect($reports['generated'])->map(fn ($row) => ['label' => $row->report_type ?? $row->id, 'value' => $row->status ?? 'queued', 'meta' => $row->created_at ?? null])],
        ]);
    }

    public function staff(Request $request): View
    {
        return $this->moduleView('Staff', 'Staff tasks and care operations work queue from shared PostgreSQL.', ['staff_profiles', 'staff_assignments', 'staff_tasks'], [
            ['heading' => 'Open staff tasks', 'rows' => collect($this->portal->staffTasks($this->filters($request)))->map(fn ($row) => ['label' => $row->title ?? $row->id, 'value' => $row->status ?? 'open', 'meta' => $row->priority ?? null])],
        ]);
    }

    public function operationalModule(string $module): View
    {
        $labels = [
            'safety' => ['Safety Center', ['resident_safe_zones', 'location_events', 'incidents']],
            'families' => ['Families', ['trusted_connections', 'conversations', 'messages']],
            'billing' => ['Billing', ['generated_reports', 'exports']],
            'settings' => ['Settings', ['tenants', 'tenant_locations', 'notification_rules']],
        ];

        abort_unless(isset($labels[$module]), 404);

        return $this->moduleView($labels[$module][0], 'Shared platform module shell wired to production auth and database scope.', $labels[$module][1], []);
    }

    private function moduleView(string $title, string $subtitle, array $sourceTables, array $sections): View
    {
        return view('business.modules.generic', compact('title', 'subtitle', 'sourceTables', 'sections'));
    }

    /**
     * @return array<string,string>
     */
    private function filters(Request $request): array
    {
        return array_filter([
            'tenant_id' => $request->query('tenant_id'),
            'location_id' => $request->query('location_id'),
        ]);
    }
}
