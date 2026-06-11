<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Command Center') | TheSeniorGuru Business</title>
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
            <span>Business Portal</span>
            <strong>{{ auth()->user()->name }}</strong>
            <small>{{ str_replace('_', ' ', auth()->user()->role ?? 'Staff') }}</small>
        </section>

        <nav class="side-nav" aria-label="Business portal navigation">
            @php
                $navItems = [
                    ['Command Center',      'CC', 'command-center',                    null,                                                   $badges['active_alerts'] ?? null],
                    ['Residents',           'R',  'business.residents.index',          null,                                                   $badges['total_residents'] ?? null],
                    ['Guru Intelligence',   'GI', 'business.guru.index',               null,                                                   null],
                    ['Vitals Monitor',      'V',  'business.vitals.index',             null,                                                   null],
                    ['Alerts & Incidents',  'A',  'business.alerts.index',             null,                                                   $badges['active_alerts'] ?? null],
                    ['Medication',          'Rx', 'business.medication.index',         null,                                                   null],
                    ['Safety Center',       'S',  'business.modules.operational',      ['module' => 'safety'],                                 null],
                    ['Requests',            'Q',  'business.requests.index',           null,                                                   $badges['pending_requests'] ?? null],
                    ['Bookings',            'Bk', 'business.bookings.index',           null,                                                   $badges['today_bookings'] ?? null],
                    ['Services',            'Sv', 'business.services.index',           null,                                                   null],
                    ['Calendar',            'Ca', 'business.modules.operational',      ['module' => 'calendar'],                               null],
                    ['Families',            'F',  'business.modules.operational',      ['module' => 'families'],                               null],
                    ['Staff',               'St', 'business.staff.index',             null,                                                   $badges['staff_tasks_open'] ?? null],
                    ['Devices',             'Dv', 'business.devices.index',           null,                                                   $badges['offline_devices'] ?? null],
                    ['Communications',      'Co', 'business.modules.operational',      ['module' => 'communications'],                         null],
                    ['Reports & Analytics', 'Ra', 'business.reports.index',           null,                                                   null],
                    ['Billing & Payments',  '$',  'business.modules.operational',      ['module' => 'billing'],                                null],
                    ['Marketing Tools',     'Mk', 'business.modules.operational',      ['module' => 'marketing'],                              null],
                    ['Settings',            'Cfg','business.modules.operational',      ['module' => 'settings'],                               null],
                ];
            @endphp

            @foreach ($navItems as [$label, $icon, $routeName, $routeParams, $badge])
                @php
                    try {
                        $href = $routeParams ? route($routeName, $routeParams) : route($routeName);
                        $isActive = request()->routeIs($routeName) && (
                            ! $routeParams || (request()->route('module') ?? null) === ($routeParams['module'] ?? null)
                        );
                    } catch (\Exception $e) {
                        $href = '#';
                        $isActive = false;
                    }
                @endphp
                <a href="{{ $href }}" @class(['active' => $isActive])>
                    <span>{{ $icon }}</span>
                    <strong>{{ $label }}</strong>
                    @if ($badge !== null && $badge > 0)
                        <em>{{ $badge }}</em>
                    @endif
                </a>
            @endforeach
        </nav>

        <section class="user-card">
            <span class="avatar">{{ collect(explode(' ', auth()->user()->name))->map(fn ($p) => substr($p, 0, 1))->take(2)->join('') }}</span>
            <span>
                <strong>{{ auth()->user()->name }}</strong>
                <small>{{ ucwords(str_replace('_', ' ', auth()->user()->role ?? 'Staff')) }}</small>
            </span>
        </section>
    </aside>

    <main class="main-content">
        <header class="topbar">
            <div class="search">
                <input type="search" placeholder="Search residents, alerts, requests...">
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

        @yield('content')
    </main>

</div>
</body>
</html>
