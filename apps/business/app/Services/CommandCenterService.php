<?php

namespace App\Services;

use App\Models\Community;
use App\Models\Resident;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class CommandCenterService
{
    public function build(Community $community, CarbonInterface $now): array
    {
        $todayStart = $now->copy()->startOfDay();
        $todayEnd = $now->copy()->endOfDay();
        $monthStart = $now->copy()->startOfMonth();

        $residents = $community->residents()
            ->with(['familyContacts' => fn ($query) => $query->where('is_primary', true), 'vitals' => fn ($query) => $query->latest('recorded_at')->limit(1)])
            ->orderBy('room')
            ->get();

        $alerts = $community->alerts()
            ->with('resident')
            ->where('status', 'open')
            ->latest('triggered_at')
            ->get();

        $requests = $community->requests()
            ->with(['resident', 'service'])
            ->latest()
            ->get();

        $bookings = $community->bookings()
            ->with(['resident', 'service'])
            ->whereBetween('starts_at', [$todayStart, $todayEnd])
            ->orderBy('starts_at')
            ->get();

        $monthlyBookings = $community->bookings()
            ->with('service')
            ->where('starts_at', '>=', $monthStart)
            ->get();

        $devices = $community->devices()->with('resident')->get();
        $staffOnDuty = $community->staffShifts()
            ->where('starts_at', '<=', $now)
            ->where('ends_at', '>=', $now)
            ->orderBy('role')
            ->get();

        return [
            'community' => $community,
            'stats' => $this->stats($community, $alerts, $requests, $bookings, $staffOnDuty, $monthlyBookings),
            'residents' => $residents,
            'alerts' => $alerts,
            'requests' => $requests,
            'bookings' => $bookings,
            'devices' => $devices,
            'staffOnDuty' => $staffOnDuty,
            'alertSummary' => $alerts->countBy('severity'),
            'requestSummary' => $requests->countBy('status'),
            'serviceMix' => $this->serviceMix($monthlyBookings),
            'vitalsTrend' => $this->vitalsTrend($residents),
            'now' => $now,
        ];
    }

    private function stats(Community $community, Collection $alerts, Collection $requests, Collection $bookings, Collection $staffOnDuty, Collection $monthlyBookings): array
    {
        $residentCount = $community->residents_count ?? $community->residents()->count();
        $occupancy = $community->capacity > 0 ? (int) round(($residentCount / $community->capacity) * 100) : 0;
        $criticalAlerts = $alerts->where('severity', 'critical')->count();
        $pendingRequests = $requests->whereIn('status', ['pending', 'triage'])->count();

        return [
            'totalResidents' => $residentCount,
            'activeAlerts' => $alerts->count(),
            'criticalAlerts' => $criticalAlerts,
            'todayBookings' => $bookings->count(),
            'pendingRequests' => $pendingRequests,
            'occupancyRate' => $occupancy,
            'staffOnDuty' => $staffOnDuty->count(),
            'monthRevenue' => $monthlyBookings->sum('amount'),
            'pendingPayments' => $monthlyBookings->where('payment_status', 'pending')->sum('amount'),
        ];
    }

    private function serviceMix(Collection $bookings): Collection
    {
        return $bookings
            ->groupBy(fn ($booking) => $booking->service?->name ?? 'Other')
            ->map(fn ($items, $name) => [
                'name' => $name,
                'bookings' => $items->count(),
                'revenue' => $items->sum('amount'),
            ])
            ->sortByDesc('bookings')
            ->values();
    }

    private function vitalsTrend(Collection $residents): array
    {
        $readings = $residents
            ->flatMap(fn (Resident $resident) => $resident->vitals)
            ->sortBy('recorded_at');

        return [
            'averageHeartRate' => round((float) $readings->avg('heart_rate')),
            'averageSpo2' => round((float) $readings->avg('spo2')),
            'averageSteps' => round((float) $readings->avg('steps')),
        ];
    }
}
