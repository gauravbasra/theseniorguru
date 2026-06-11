@php
    $kpis = $summary['kpis'];
    $recentAlerts = collect($summary['recent_alerts']);
    $watchlist = collect($summary['resident_watchlist']);
    $offlineDevices = collect($summary['device_offline_list']);
    $residentRows = collect($residents);
    $vitalRows = collect($vitals);
    $requestRows = collect($requests);
    $bookingRows = collect($bookings);
    $serviceRows = collect($providerServices);
    $sourceTables = collect($summary['source_tables']);
@endphp

@extends('layouts.app', [
    'badges' => [
        'total_residents'   => $kpis['total_residents'],
        'active_alerts'     => $kpis['active_alerts'],
        'pending_requests'  => $kpis['pending_requests'],
        'today_bookings'    => $kpis['today_bookings'],
        'offline_devices'   => $kpis['offline_devices'],
        'staff_tasks_open'  => $summary['staff_tasks_open'] ?? 0,
    ],
])

@section('title', 'Command Center')

@section('content')
    <section class="page-title">
        <div>
            <h1>Command Center</h1>
            <p>Live operating view · {{ $generatedAt->format('M j, Y g:i A') }}</p>
        </div>
        <div class="coverage-pill">
            <span>{{ $sourceTables->count() }}</span>
            Source tables
        </div>
    </section>

    <section class="metric-grid" aria-label="Operational metrics">
        <article class="metric-card purple">
            <div class="metric-top">
                <span class="metric-icon">R</span>
                <div>
                    <span>Total Residents</span>
                    <strong>{{ number_format($kpis['total_residents']) }}</strong>
                    <em>Tenant-scoped</em>
                </div>
            </div>
        </article>
        <article class="metric-card red">
            <div class="metric-top">
                <span class="metric-icon">A</span>
                <div>
                    <span>Active Alerts</span>
                    <strong>{{ number_format($kpis['active_alerts']) }}</strong>
                    <em>{{ number_format($kpis['critical_alerts']) }} critical</em>
                </div>
            </div>
        </article>
        <article class="metric-card blue">
            <div class="metric-top">
                <span class="metric-icon">B</span>
                <div>
                    <span>Today Bookings</span>
                    <strong>{{ number_format($kpis['today_bookings']) }}</strong>
                    <em>Scheduled today</em>
                </div>
            </div>
        </article>
        <article class="metric-card orange">
            <div class="metric-top">
                <span class="metric-icon">Q</span>
                <div>
                    <span>Pending Requests</span>
                    <strong>{{ number_format($kpis['pending_requests']) }}</strong>
                    <em>Service queue</em>
                </div>
            </div>
        </article>
        <article class="metric-card green">
            <div class="metric-top">
                <span class="metric-icon">D</span>
                <div>
                    <span>Offline Devices</span>
                    <strong>{{ number_format($kpis['offline_devices']) }}</strong>
                    <em>Wearables</em>
                </div>
            </div>
        </article>
    </section>

    @if ($kpis['total_residents'] === 0)
        <section class="empty-state">
            <strong>No residents are currently assigned to a tenant scope.</strong>
            <p>Onboard a senior living community to populate this command center.</p>
            <code>POST /portal-api/business/onboarding/senior-living-communities</code>
        </section>
    @endif

    <section class="dashboard-grid live-data-grid">

        <article class="panel dashboard-wide">
            <div class="panel-header">
                <h2>Residents</h2>
                <span>{{ $residentRows->count() }} loaded</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Resident</th>
                        <th>Age</th>
                        <th>Guru Status</th>
                        <th>Wellness</th>
                        <th>Memory Support</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($residentRows->take(8) as $resident)
                        <tr>
                            <td>
                                <span class="avatar small">{{ substr($resident['display_name'] ?? 'R', 0, 1) }}</span>
                                <a href="{{ route('business.residents.profile', $resident['id'] ?? '#') }}">
                                    <strong>{{ $resident['display_name'] ?? $resident['id'] }}</strong>
                                </a>
                            </td>
                            <td>{{ $resident['age'] ?? '—' }}</td>
                            <td><span class="status {{ strtolower(str_replace('_', '-', $resident['guru_status'] ?? 'stable')) }}">{{ str_replace('_', ' ', $resident['guru_status'] ?? 'No score') }}</span></td>
                            <td>{{ $resident['wellness_score'] ?? 'Pending' }}</td>
                            <td>{{ ($resident['memory_support_enabled'] ?? false) ? 'Enabled' : 'No' }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="muted-line">No tenant-scoped residents found.</td></tr>
                    @endforelse
                </tbody>
            </table>
            @if ($residentRows->count() > 8)
                <a class="inline-link" href="{{ route('business.residents.index') }}">View all {{ $residentRows->count() }} residents →</a>
            @endif
        </article>

        <article class="panel dashboard-card">
            <div class="panel-header">
                <h2>Alert Triage</h2>
                <span>{{ $recentAlerts->count() }} recent</span>
            </div>
            <div class="alert-stack">
                @forelse ($recentAlerts->take(6) as $alert)
                    <article>
                        <span class="alert-icon {{ $alert->severity }}">{{ strtoupper(substr((string) $alert->severity, 0, 1)) }}</span>
                        <div>
                            <strong>{{ $alert->title }}</strong>
                            <small>{{ $alert->alert_type }} · {{ $alert->status }}</small>
                        </div>
                        <em class="{{ $alert->severity }}">{{ $alert->severity }}</em>
                    </article>
                @empty
                    <p class="muted-line">No active health alerts for the current tenant scope.</p>
                @endforelse
            </div>
            @if ($recentAlerts->count() > 0)
                <a class="inline-link" href="{{ route('business.alerts.index') }}">Open alert queue →</a>
            @endif
        </article>

        <article class="panel dashboard-card">
            <div class="panel-header">
                <h2>Guru Watchlist</h2>
                <span>{{ $watchlist->count() }} residents</span>
            </div>
            <div class="watch-list">
                @forelse ($watchlist->take(8) as $risk)
                    <div>
                        <strong>{{ $risk->display_name ?? $risk->senior_id }}</strong>
                        <span>{{ $risk->final_status }} · Wellness {{ $risk->wellness_score ?? 'N/A' }}</span>
                    </div>
                @empty
                    <p class="muted-line">No Watch, Needs Check-In, or Emergency residents.</p>
                @endforelse
            </div>
        </article>

        <article class="panel dashboard-wide">
            <div class="panel-header">
                <h2>Live Vitals</h2>
                @if (! $canViewHealth)
                    <span class="status alert">Restricted</span>
                @else
                    <span>{{ $vitalRows->count() }} readings</span>
                @endif
            </div>
            @if (! $canViewHealth)
                <p class="muted-line">Health and vitals require care-organization permission. Contact your admin.</p>
            @else
                <table>
                    <thead>
                        <tr>
                            <th>Resident</th>
                            <th>Heart Rate</th>
                            <th>SpO2</th>
                            <th>Steps</th>
                            <th>Captured</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($vitalRows->take(8) as $vital)
                            <tr>
                                <td>{{ $vital->display_name ?? $vital->resident_id }}</td>
                                <td>{{ $vital->heart_rate ? $vital->heart_rate.' bpm' : '—' }}</td>
                                <td>{{ $vital->oxygen_saturation ? $vital->oxygen_saturation.'%' : '—' }}</td>
                                <td>{{ number_format($vital->steps_today ?? 0) }}</td>
                                <td>{{ $vital->captured_at ?? 'Unknown' }}</td>
                            </tr>
                        @empty
                            <tr><td colspan="5" class="muted-line">No live vitals for the current tenant scope.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            @endif
        </article>

        <article class="panel dashboard-card">
            <div class="panel-header">
                <h2>Service Requests</h2>
                <span>{{ $requestRows->count() }} loaded</span>
            </div>
            <div class="request-list">
                @forelse ($requestRows->take(6) as $request)
                    <div>
                        <strong>{{ $request->label ?? $request->category }}</strong>
                        <span>{{ $request->category }} · <span class="status {{ strtolower($request->status ?? 'pending') }}">{{ $request->status ?? 'pending' }}</span></span>
                    </div>
                @empty
                    <p class="muted-line">No service requests for the current tenant scope.</p>
                @endforelse
            </div>
            @if ($requestRows->count() > 0)
                <a class="inline-link" href="{{ route('business.requests.index') }}">View all requests →</a>
            @endif
        </article>

        <article class="panel dashboard-card">
            <div class="panel-header">
                <h2>Bookings</h2>
                <span>{{ $bookingRows->count() }} loaded</span>
            </div>
            <div class="request-list">
                @forelse ($bookingRows->take(6) as $booking)
                    <div>
                        <strong>{{ $booking->label ?? $booking->id }}</strong>
                        <span>{{ $booking->scheduled_for ?? 'No date' }} · <span class="status {{ strtolower($booking->status ?? 'scheduled') }}">{{ $booking->status ?? 'scheduled' }}</span></span>
                    </div>
                @empty
                    <p class="muted-line">No bookings for the current tenant scope.</p>
                @endforelse
            </div>
        </article>

        <article class="panel dashboard-card">
            <div class="panel-header">
                <h2>Device Exceptions</h2>
                <span>{{ $offlineDevices->count() }} offline</span>
            </div>
            <div class="device-list">
                @forelse ($offlineDevices->take(6) as $device)
                    <div>
                        <strong>{{ $device->name ?? $device->id }}</strong>
                        <span>{{ $device->status }} · Battery {{ $device->battery_percent ?? 'N/A' }}%</span>
                    </div>
                @empty
                    <p class="muted-line">No offline devices for the current tenant scope.</p>
                @endforelse
            </div>
        </article>

        <article class="panel dashboard-card">
            <div class="panel-header">
                <h2>Provider Services</h2>
                <span>{{ $serviceRows->count() }} active</span>
            </div>
            <div class="service-list">
                @forelse ($serviceRows->take(6) as $service)
                    <div>
                        <span class="service-dot">{{ substr($service->category ?? 'S', 0, 1) }}</span>
                        <div>
                            <strong>{{ $service->name }}</strong>
                            <small>{{ $service->category }}</small>
                        </div>
                    </div>
                @empty
                    <p class="muted-line">No active provider services configured.</p>
                @endforelse
            </div>
        </article>

        <article class="panel dashboard-full">
            <div class="panel-header">
                <h2>Database Sources</h2>
                <span>Shared contract · {{ $sourceTables->count() }} tables</span>
            </div>
            <div class="source-chip-row">
                @foreach ($sourceTables as $table)
                    <code>{{ $table }}</code>
                @endforeach
            </div>
        </article>

    </section>
@endsection
