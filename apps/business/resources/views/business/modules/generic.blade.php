<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }} | TheSeniorGuru</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="app-shell">
    <aside class="sidebar">
        <a class="brand" href="{{ route('command-center') }}">
            <span class="brand-mark">TSG</span>
            <span>TheSeniorGuru</span>
        </a>

        <nav class="nav-list">
            <a href="{{ route('command-center') }}">Command Center</a>
            <a href="{{ route('business.residents.index') }}">Residents</a>
            <a href="{{ route('business.guru.index') }}">Guru Intelligence</a>
            <a href="{{ route('business.vitals.index') }}">Vitals Monitor</a>
            <a href="{{ route('business.alerts.index') }}">Alerts</a>
            <a href="{{ route('business.requests.index') }}">Requests</a>
            <a href="{{ route('business.bookings.index') }}">Bookings</a>
            <a href="{{ route('business.services.index') }}">Services</a>
        </nav>

        <form method="POST" action="{{ route('logout') }}" class="logout-form">
            @csrf
            <button type="submit">Sign out</button>
        </form>
    </aside>

    <main class="main-content">
        <header class="topbar">
            <div>
                <p class="eyebrow">Shared PostgreSQL</p>
                <h1>{{ $title }}</h1>
                <p class="subcopy">{{ $subtitle }}</p>
            </div>
            <a class="secondary-link" href="{{ route('command-center') }}">Command Center</a>
        </header>

        <section class="panel module-panel">
            <div class="panel-header">
                <h2>Source tables</h2>
                <div class="source-chip-row">
                    @foreach ($sourceTables as $table)
                        <code>{{ $table }}</code>
                    @endforeach
                </div>
            </div>
        </section>

        @forelse ($sections as $section)
            <section class="panel module-panel">
                <div class="panel-header">
                    <h2>{{ $section['heading'] }}</h2>
                    <span>{{ collect($section['rows'])->count() }} loaded</span>
                </div>

                <div class="request-list">
                    @forelse (collect($section['rows']) as $row)
                        <div>
                            <strong>{{ $row['label'] ?? 'Record' }}</strong>
                            <span>{{ $row['value'] ?? 'open' }} @if (! empty($row['meta'])) · {{ $row['meta'] }} @endif</span>
                        </div>
                    @empty
                        <p class="muted-line">No records currently exist for this shared database scope.</p>
                    @endforelse
                </div>
            </section>
        @empty
            <section class="panel module-panel">
                <div class="empty-state">
                    <strong>No operational records are currently loaded for this module.</strong>
                    <span>This route is authenticated and database-scoped; module-specific workflows will populate here as shared tables receive production data.</span>
                </div>
            </section>
        @endforelse
    </main>
</body>
</html>
