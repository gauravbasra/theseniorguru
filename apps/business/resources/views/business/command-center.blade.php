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

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TheSeniorGuru Business</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    <div class="app-shell">
        <aside class="sidebar">
            <a class="brand" href="{{ route('command-center') }}">
                <span class="brand-mark">TSG</span>
                <span>TheSeniorGuru</span>
            </a>

            <section class="scope-panel">
                <span>Shared PostgreSQL</span>
                <strong>{{ $filters['tenant_id'] ?? 'All authorized tenants' }}</strong>
                <small>{{ $generatedAt->format('M j, Y g:i A') }}</small>
            </section>

            <nav class="side-nav" aria-label="Business portal">
                @foreach ([
                    ['Command Center', 'C', route('command-center'), true, null],
                    ['Residents', 'R', route('business.residents.index'), false, $kpis['total_residents']],
                    ['Guru Intelligence', 'G', route('business.guru.index'), false, null],
                    ['Vitals Monitor', 'V', route('business.vitals.index'), false, $vitalRows->count()],
                    ['Alerts & Incidents', 'A', route('business.alerts.index'), false, $kpis['active_alerts']],
                    ['Medication', 'M', route('business.medication.index'), false, null],
                    ['Safety Center', 'S', route('business.modules.operational', 'safety'), false, null],
                    ['Requests', 'Q', route('business.requests.index'), false, $kpis['pending_requests']],
                    ['Bookings', 'B', route('business.bookings.index'), false, $kpis['today_bookings']],
                    ['Services', 'L', route('business.services.index'), false, $serviceRows->count()],
                    ['Families', 'F', route('business.modules.operational', 'families'), false, null],
                    ['Staff', 'T', route('business.staff.index'), false, $summary['staff_tasks_open']],
                    ['Devices', 'D', route('business.devices.index'), false, $kpis['offline_devices']],
                    ['Reports', 'N', route('business.reports.index'), false, null],
                    ['Billing', '$', route('business.modules.operational', 'billing'), false, null],
                    ['Settings', 'X', route('business.modules.operational', 'settings'), false, null],
                ] as $item)
                    <a @class(['active' => $item[3]]) href="{{ $item[2] }}">
                        <span>{{ $item[1] }}</span>
                        <strong>{{ $item[0] }}</strong>
                        @if ($item[4] !== null)
                            <em>{{ $item[4] }}</em>
                        @endif
                    </a>
                @endforeach
            </nav>

            <section class="user-card">
                <span class="avatar">{{ collect(explode(' ', auth()->user()->name))->map(fn ($part) => substr($part, 0, 1))->take(2)->join('') }}</span>
                <span>
                    <strong>{{ auth()->user()->name }}</strong>
                    <small>{{ str_replace('_', ' ', auth()->user()->role) }}</small>
                </span>
            </section>
        </aside>

        <main class="main-content">
            <header class="topbar">
                <div class="search">
                    <input type="search" placeholder="Search live shared data...">
                </div>
                <div class="topbar-actions">
                    @if (auth()->user()->isSuperAdmin())
                        <a class="topbar-link" href="{{ route('admin.users.index') }}">Approvals</a>
                    @endif
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit">Sign out</button>
                    </form>
                </div>
            </header>

            <section class="page-title">
                <div>
                    <h1>Command Center</h1>
                    <p>Live operating view from the shared TheSeniorGuru PostgreSQL platform.</p>
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
                        <div><span>Total Residents</span><strong>{{ number_format($kpis['total_residents']) }}</strong><em>Tenant-scoped assignments</em></div>
                    </div>
                </article>
                <article class="metric-card red">
                    <div class="metric-top">
                        <span class="metric-icon">A</span>
                        <div><span>Active Alerts</span><strong>{{ number_format($kpis['active_alerts']) }}</strong><em>{{ number_format($kpis['critical_alerts']) }} critical</em></div>
                    </div>
                </article>
                <article class="metric-card blue">
                    <div class="metric-top">
                        <span class="metric-icon">B</span>
                        <div><span>Today Bookings</span><strong>{{ number_format($kpis['today_bookings']) }}</strong><em>Shared bookings table</em></div>
                    </div>
                </article>
                <article class="metric-card orange">
                    <div class="metric-top">
                        <span class="metric-icon">Q</span>
                        <div><span>Pending Requests</span><strong>{{ number_format($kpis['pending_requests']) }}</strong><em>Service request queue</em></div>
                    </div>
                </article>
                <article class="metric-card green">
                    <div class="metric-top">
                        <span class="metric-icon">D</span>
                        <div><span>Offline Devices</span><strong>{{ number_format($kpis['offline_devices']) }}</strong><em>Wearable devices</em></div>
                    </div>
                </article>
            </section>

            @if ($kpis['total_residents'] === 0)
                <section class="empty-state">
                    <strong>No residents are currently assigned to a tenant scope.</strong>
                    <p>Onboard a senior living community to populate this command center from the shared PostgreSQL database.</p>
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
                                    <td><span class="avatar small">{{ substr($resident['display_name'] ?? 'R', 0, 1) }}</span><strong>{{ $resident['display_name'] ?? $resident['id'] }}</strong></td>
                                    <td>{{ $resident['age'] ?? 'Unknown' }}</td>
                                    <td><span class="status {{ strtolower($resident['guru_status'] ?? 'stable') }}">{{ str_replace('_', ' ', $resident['guru_status'] ?? 'No score') }}</span></td>
                                    <td>{{ $resident['wellness_score'] ?? 'Pending' }}</td>
                                    <td>{{ $resident['memory_support_enabled'] ? 'Enabled' : 'No' }}</td>
                                </tr>
                            @empty
                                <tr><td colspan="5">No tenant-scoped residents found.</td></tr>
                            @endforelse
                        </tbody>
                    </table>
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
                            <span>Restricted</span>
                        @else
                            <span>{{ $vitalRows->count() }} readings</span>
                        @endif
                    </div>
                    @if (! $canViewHealth)
                        <p class="muted-line">Health and vitals require care-organization permission.</p>
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
                                        <td>{{ $vital->heart_rate ?? 'N/A' }}</td>
                                        <td>{{ $vital->oxygen_saturation ?? 'N/A' }}</td>
                                        <td>{{ number_format($vital->steps_today ?? 0) }}</td>
                                        <td>{{ $vital->captured_at ?? 'Unknown' }}</td>
                                    </tr>
                                @empty
                                    <tr><td colspan="5">No live vitals for the current tenant scope.</td></tr>
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
                                <span>{{ $request->category }} · {{ $request->status }}</span>
                            </div>
                        @empty
                            <p class="muted-line">No service requests for the current tenant scope.</p>
                        @endforelse
                    </div>
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
                                <span>{{ $booking->status }} · {{ $booking->scheduled_for ?? 'No date' }}</span>
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
                                <span>{{ $device->status }} · {{ $device->battery_percent ?? 'N/A' }}%</span>
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
                                <span>{{ substr($service->category ?? 'S', 0, 1) }}</span>
                                <strong>{{ $service->name }}</strong>
                                <small>{{ $service->category }}</small>
                            </div>
                        @empty
                            <p class="muted-line">No active provider services configured.</p>
                        @endforelse
                    </div>
                </article>

                <article class="panel dashboard-full">
                    <div class="panel-header">
                        <h2>Database Sources</h2>
                        <span>Shared contract</span>
                    </div>
                    <div class="source-chip-row">
                        @foreach ($sourceTables as $table)
                            <code>{{ $table }}</code>
                        @endforeach
                    </div>
                </article>
            </section>
        </main>
    </div>
</body>
</html>
