<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Residents | TheSeniorGuru</title>
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
                <p class="eyebrow">Shared PostgreSQL</p>
                <h1>Residents</h1>
                <p class="subcopy">Resident roster loaded from active tenant and location assignments.</p>
            </div>
            <a class="secondary-link" href="{{ route('business.onboarding.senior-living') }}">Onboard community</a>
        </header>

        <section class="panel module-panel">
            <div class="panel-header">
                <h2>Resident roster</h2>
                <div class="source-chip-row">
                    @foreach ($sourceTables as $table)
                        <code>{{ $table }}</code>
                    @endforeach
                </div>
            </div>

            @if ($residents === [])
                <div class="empty-state">
                    <strong>No residents are currently assigned.</strong>
                    <span>Create a community and import residents through onboarding to populate this module.</span>
                    <code>tenant_location_resident_assignments.status = active</code>
                </div>
            @else
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Resident</th>
                                <th>Age</th>
                                <th>Contact</th>
                                <th>Guru status</th>
                                <th>Wellness</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($residents as $resident)
                                <tr>
                                    <td>
                                        <span class="avatar small">{{ strtoupper(substr($resident['display_name'] ?? 'R', 0, 2)) }}</span>
                                        <strong>{{ $resident['display_name'] ?? 'Resident' }}</strong>
                                    </td>
                                    <td>{{ $resident['age'] ?? '—' }}</td>
                                    <td>
                                        <span class="stacked">
                                            <span>{{ $resident['email'] ?? 'No email' }}</span>
                                            <small>{{ $resident['phone'] ?? 'No phone' }}</small>
                                        </span>
                                    </td>
                                    <td>
                                        @if ($canViewHealth)
                                            <span class="status {{ strtolower(str_replace('_', '-', $resident['guru_status'] ?? 'no')) }}">{{ $resident['guru_status'] ?? 'No score' }}</span>
                                        @else
                                            <span class="status no">Restricted</span>
                                        @endif
                                    </td>
                                    <td>{{ $canViewHealth ? ($resident['wellness_score'] ?? '—') : 'Restricted' }}</td>
                                    <td><a class="inline-link" href="{{ route('business.residents.profile', $resident['id']) }}">Open profile</a></td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </section>
    </main>
</body>
</html>
