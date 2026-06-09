@php
    $resident = $profile['resident'];
    $assignments = collect($profile['assignments'] ?? []);
    $timeline = collect($profile['timeline'] ?? []);
    $latestRisk = $profile['latest_risk'] ?? null;
    $latestVitals = $profile['latest_vitals'] ?? null;
    $formatCareLevel = fn ($value) => \Illuminate\Support\Str::of((string) $value)->replace('_', ' ')->title();
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $resident->display_name ?? 'Resident' }} | TheSeniorGuru</title>
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
            <a class="active" href="{{ route('business.residents.index') }}">Residents</a>
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
                <p class="eyebrow">Resident Profile</p>
                <h1>{{ $resident->display_name ?? 'Resident' }}</h1>
                <p class="subcopy">Profile, assignment, health permission, and timeline data from shared platform tables.</p>
            </div>
            <a class="secondary-link" href="{{ route('business.residents.index') }}">Back to residents</a>
        </header>

        <section class="profile-header">
            <div>
                <span class="avatar">{{ strtoupper(substr($resident->display_name ?? 'R', 0, 2)) }}</span>
                <div>
                    <h2>{{ $resident->display_name ?? 'Resident' }}</h2>
                    <p>{{ $resident->age ?? '—' }} years old · {{ $resident->email ?? 'No email' }} · {{ $resident->phone ?? 'No phone' }}</p>
                </div>
            </div>
            <div class="source-chip-row">
                @foreach ($sourceTables as $table)
                    <code>{{ $table }}</code>
                @endforeach
            </div>
        </section>

        <section class="profile-grid">
            <article class="panel profile-panel">
                <div class="panel-header">
                    <h2>Current assignments</h2>
                </div>
                @forelse ($assignments as $assignment)
                    <div class="profile-row">
                        <span>{{ $formatCareLevel($assignment->care_level ?? '') }}</span>
                        <strong>Room {{ $assignment->room_number ?? '—' }}</strong>
                        <small>{{ $assignment->status ?? 'unknown' }} · consent {{ $assignment->consent_status ?? 'unknown' }}</small>
                    </div>
                @empty
                    <p class="muted-line">No active assignment rows are available for this resident.</p>
                @endforelse
            </article>

            <article class="panel profile-panel">
                <div class="panel-header">
                    <h2>Latest Guru Risk</h2>
                </div>
                @if ($canViewHealth && $latestRisk)
                    <strong class="big-number">{{ $latestRisk->wellness_score ?? '—' }}</strong>
                    <p class="muted-line">{{ $latestRisk->final_status ?? 'No status' }} · {{ $latestRisk->score_date ?? 'No score date' }}</p>
                @elseif ($canViewHealth)
                    <p class="muted-line">No Guru risk score has been produced for this resident.</p>
                @else
                    <p class="muted-line">Health and Guru details are restricted for this login.</p>
                @endif
            </article>

            <article class="panel profile-panel">
                <div class="panel-header">
                    <h2>Latest vitals</h2>
                </div>
                @if ($canViewHealth && $latestVitals)
                    <div class="profile-row">
                        <span>{{ $latestVitals->captured_at ?? 'Latest reading' }}</span>
                        <strong>{{ $latestVitals->heart_rate ?? '—' }} bpm</strong>
                        <small>SpO2 {{ $latestVitals->spo2 ?? '—' }} · steps {{ $latestVitals->steps ?? '—' }}</small>
                    </div>
                @elseif ($canViewHealth)
                    <p class="muted-line">No vitals have been captured for this resident.</p>
                @else
                    <p class="muted-line">Vitals are restricted for this login.</p>
                @endif
            </article>
        </section>

        <section class="panel module-panel">
            <div class="panel-header">
                <h2>Resident timeline</h2>
            </div>
            @forelse ($timeline as $event)
                <article class="timeline-row">
                    <span>{{ is_array($event) ? ($event['event_type'] ?? 'event') : ($event->event_type ?? 'event') }}</span>
                    <strong>{{ is_array($event) ? ($event['title'] ?? 'Timeline event') : ($event->title ?? 'Timeline event') }}</strong>
                    <p>{{ is_array($event) ? ($event['body'] ?? '') : ($event->body ?? '') }}</p>
                    <small>{{ is_array($event) ? ($event['occurred_at'] ?? '') : ($event->occurred_at ?? '') }}</small>
                </article>
            @empty
                <div class="empty-state">
                    <strong>No timeline events are available.</strong>
                    <span>Resident timeline rows will appear from care notes, service activity, alerts, vitals, medication events, and incidents.</span>
                    <code>resident_events</code>
                </div>
            @endforelse
        </section>
    </main>
</body>
</html>
