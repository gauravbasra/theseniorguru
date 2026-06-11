@extends('layouts.app')

@section('title', 'Alerts & Incidents')

@section('content')
    <section class="page-title">
        <div>
            <h1>Alerts & Incidents</h1>
            <p>Active health alert queue with triage, assignment, escalation, and incident conversion.</p>
        </div>
        <div class="source-chip-row">
            @foreach ($sourceTables as $table)
                <code>{{ $table }}</code>
            @endforeach
        </div>
    </section>

    @if (session('status'))
        <div class="alert-panel success-panel">{{ session('status') }}</div>
    @endif

    @if ($errors->any())
        <div class="alert-panel error-panel">
            <strong>Triage action was not recorded.</strong>
            <ul>
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <section class="panel module-panel">
        <div class="panel-header">
            <h2>Alert work queue</h2>
            <span>{{ count($alerts) }} active</span>
        </div>

        @if (empty($alerts))
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
                                <small>
                                    {{ $alert->resident_name ?? 'Unknown resident' }}
                                    @if ($alert->room_number)
                                        · Room {{ $alert->room_number }}
                                    @endif
                                    · {{ $alert->alert_type ?? 'alert' }} · {{ $alert->status ?? 'open' }} · {{ $alert->created_at ?? '' }}
                                </small>
                            </div>
                        </div>

                        <form method="POST" action="{{ route('business.alerts.triage', $alert->id) }}" class="triage-form">
                            @csrf
                            <label>
                                Action
                                <select name="action" required>
                                    <option value="acknowledge">Acknowledge</option>
                                    <option value="assign">Assign to staff</option>
                                    <option value="escalate">Escalate to NOC</option>
                                    <option value="resolve">Resolve</option>
                                    <option value="convert_to_incident">Convert to incident</option>
                                    <option value="comment">Comment only</option>
                                </select>
                            </label>
                            @if (! empty($staffOptions))
                                <label>
                                    Assign to (required for "Assign to staff")
                                    <select name="assigned_to">
                                        <option value="">— Select staff member —</option>
                                        @foreach ($staffOptions as $staff)
                                            <option value="{{ $staff->id }}">{{ $staff->display_name }} ({{ $staff->role_name }})</option>
                                        @endforeach
                                    </select>
                                </label>
                            @endif
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
@endsection
