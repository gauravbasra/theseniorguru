@extends('layouts.app')

@section('title', 'Residents')

@section('content')
    <section class="page-title">
        <div>
            <h1>Residents</h1>
            <p>Resident roster loaded from active tenant and location assignments.</p>
        </div>
        <a class="secondary-link" href="{{ route('business.onboarding.senior-living') }}">Onboard community</a>
    </section>

    <section class="panel module-panel">
        <div class="panel-header">
            <h2>Resident roster</h2>
            <div class="source-chip-row">
                @foreach ($sourceTables as $table)
                    <code>{{ $table }}</code>
                @endforeach
            </div>
        </div>

        @if (empty($residents))
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
                            <th>Guru Status</th>
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
                                        <span class="status {{ strtolower(str_replace('_', '-', $resident['guru_status'] ?? 'no')) }}">{{ str_replace('_', ' ', $resident['guru_status'] ?? 'No score') }}</span>
                                    @else
                                        <span class="status no">Restricted</span>
                                    @endif
                                </td>
                                <td>{{ $canViewHealth ? ($resident['wellness_score'] ?? '—') : 'Restricted' }}</td>
                                <td><a class="inline-link" href="{{ route('business.residents.profile', $resident['id']) }}">Open profile →</a></td>
                            </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        @endif
    </section>
@endsection
