<?php

namespace App\Http\Controllers;

use App\Services\BusinessPortalPrdService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessPortalApiController extends Controller
{
    public function __construct(private readonly BusinessPortalPrdService $portal)
    {
    }

    public function dashboardSummary(Request $request): JsonResponse
    {
        return response()->json($this->portal->dashboardSummary($this->filters($request)));
    }

    public function nocDashboard(Request $request): JsonResponse
    {
        return response()->json($this->portal->nocDashboard($this->filters($request)));
    }

    public function residents(Request $request): JsonResponse
    {
        return response()->json([
            'residents' => $this->portal->residents($this->filters($request), $this->portal->userCanViewHealth($request->user())),
        ]);
    }

    public function residentProfile(Request $request, string $resident): JsonResponse
    {
        return response()->json($this->portal->residentProfile($resident, $this->portal->userCanViewHealth($request->user())));
    }

    public function residentTimeline(Request $request, string $resident): JsonResponse
    {
        return response()->json([
            'events' => $this->portal->residentTimeline($resident, $this->portal->userCanViewHealth($request->user())),
        ]);
    }

    public function guruOverview(Request $request): JsonResponse
    {
        $this->abortIfNoHealthAccess($request);

        return response()->json($this->portal->guruOverview($this->filters($request)));
    }

    public function guruRecommendationQueue(Request $request): JsonResponse
    {
        $this->abortIfNoHealthAccess($request);

        return response()->json([
            'recommendations' => $this->portal->guruRecommendationQueue($this->filters($request)),
        ]);
    }

    public function updateGuruRecommendation(Request $request, string $recommendation): JsonResponse
    {
        $this->abortIfNoHealthAccess($request);

        return response()->json([
            'recommendation' => $this->portal->updateGuruRecommendation($recommendation, $request->all(), $request->user()?->id),
        ]);
    }

    public function liveVitals(Request $request): JsonResponse
    {
        $this->abortIfNoHealthAccess($request);

        return response()->json([
            'vitals' => $this->portal->liveVitals($this->filters($request)),
        ]);
    }

    public function alerts(Request $request): JsonResponse
    {
        $this->abortIfNoHealthAccess($request);

        return response()->json([
            'alerts' => $this->portal->alerts($this->filters($request)),
        ]);
    }

    public function triageAlert(Request $request, string $alert): JsonResponse
    {
        $this->abortIfNoHealthAccess($request);

        return response()->json([
            'alert' => $this->portal->triageAlert($alert, $request->all(), $request->user()?->id),
        ]);
    }

    public function createIncident(Request $request): JsonResponse
    {
        $this->abortIfNoHealthAccess($request);

        return response()->json([
            'incident' => $this->portal->createIncident($request->all(), $request->user()?->id),
        ], 201);
    }

    public function medicationDashboard(Request $request): JsonResponse
    {
        $this->abortIfNoHealthAccess($request);

        return response()->json($this->portal->medicationDashboard($this->filters($request)));
    }

    public function serviceRequests(Request $request): JsonResponse
    {
        return response()->json([
            'requests' => $this->portal->serviceRequests($this->filters($request)),
        ]);
    }

    public function matchServiceRequest(Request $request, string $requestId): JsonResponse
    {
        return response()->json($this->portal->matchServiceRequest($requestId, $request->all()));
    }

    public function bookings(Request $request): JsonResponse
    {
        return response()->json([
            'bookings' => $this->portal->bookings($this->filters($request)),
        ]);
    }

    public function providerServices(): JsonResponse
    {
        return response()->json([
            'services' => $this->portal->providerServices(),
        ]);
    }

    public function testProviderServiceArea(Request $request): JsonResponse
    {
        return response()->json($this->portal->testProviderServiceArea($request->all()));
    }

    public function createReport(Request $request): JsonResponse
    {
        return response()->json([
            'report' => $this->portal->createReport($request->all(), $request->user()?->id),
        ], 202);
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

    private function abortIfNoHealthAccess(Request $request): void
    {
        abort_unless($this->portal->userCanViewHealth($request->user()), 403, 'Health, vitals, Guru, and alert analytics require care-organization permission.');
    }
}
