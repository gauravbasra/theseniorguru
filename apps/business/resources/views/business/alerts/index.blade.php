<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Alerts & Incidents | TheSeniorGuru</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="app-shell">
    <aside class="sidebar">
        <div class="brand">
            <span class="brand-mark">TSG</span>
            <span>TheSeniorGuru</span>
        </div>

        <nav class="nav-list">
            <a href="{{ route('command-center') }}">Command Center</a>
            <a href="{{ route('business.residents.index') }}">Residents</a>
            <a class="active" href="{{ route('business.alerts.index') }}">Alerts</a>
            <a href="{{ route('business.onboarding.senior-living') }}">Onboarding</a>
            <a href="{{ route('admin.users.index') }}">Admin Approval</a>
        </nav>

        <form method="POST" action="{{ route('logout') }}" class="logout-form">
            @csrf
            <button type="submit">Sign out</button>
        </form>
    </aside>

    <main class="main-content">
        <header class="topbar">
            <div>
                <p class="eyebrow">Health Operations</p>
                <h1>Alerts & Incidents</h1>
                <p class="subcopy">Active health alert queue with triage events and incident conversion written to shared PostgreSQL.</p>
            </div>
            <a class="secondary-link" href="{{ route('command-center') }}">Command Center</a>
        </header>

        @if (session('status'))
            <section class="alert-panel success-panel">{{ session('status') }}</section>
        @endif

        @if ($errors->any())
            <section class="alert-panel error-panel">
                <strong>Triage action was not recorded.</strong>
                <ul>
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </section>
        @endif

        <section class="panel module-panel">
            <div class="panel-header">
                <h2>Alert work queue</h2>
                <div class="source-chip-row">
                    @foreach ($sourceTables as $table)
                        <code>{{ $table }}</code>
                    @endforeach
                </div>
            </div>

            @if ($alerts === [])
                <div class="empty-state">
                    <strong>No active alerts are currently in scope.</strong>
                    <span>Health alerts will appear here after device, vitals, safety, or Guru events are written by the shared platform.</span>
                    <code>health_alerts.status != resolved</code>
                </div>
            @else
                <div class="alert-work-list">
                    @foreach ($alerts as $alert)
                        <article class="alert-work-item">
                            <div class="alert-work-main">
                                <span class="status {{ strtolower((string) $alert->severity) }}">{{ $alert->severity }}</span>
                                <div>
                                    <h2>{{ $alert->title ?? 'Alert' }}</h2>
                                    <p>{{ $alert->body ?? 'No alert narrative was supplied.' }}</p>
                                    <small>{{ $alert->alert_type ?? 'alert' }} · {{ $alert->status ?? 'open' }} · {{ $alert->created_at ?? '' }}</small>
                                </div>
                            </div>

                            <form method="POST" action="{{ route('business.alerts.triage', $alert->id) }}" class="triage-form">
                                @csrf
                                <label>
                                    Action
                                    <select name="action" required>
                                        <option value="acknowledge">Acknowledge</option>
                                        <option value="resolve">Resolve</option>
                                        <option value="escalate">Escalate</option>
                                        <option value="convert_to_incident">Convert to incident</option>
                                        <option value="comment">Comment</option>
                                    </select>
                                </label>
                                <label>
                                    Note
                                    <textarea name="note" rows="2" maxlength="2000"></textarea>
                                </label>
                                <button type="submit">Record triage</button>
                            </form>
                        </article>
                    @endforeach
                </div>
            @endif
        </section>
    </main>
</body>
</html>
