@php
    $resident = $profile['resident'];
    $assignments = collect($profile['assignments'] ?? []);
    $timeline = collect($profile['timeline'] ?? []);
    $latestRisk = $profile['latest_risk'] ?? null;
    $latestVitals = $profile['latest_vitals'] ?? null;
    $formatCareLevel = fn ($value) => \Illuminate\Support\Str::of((string) $value)->replace('_', ' ')->title();
@endphp

@extends('layouts.app')

@section('title', $resident->display_name ?? 'Resident Profile')

@section('content')
    <section class="page-title">
        <div>
            <h1>{{ $resident->display_name ?? 'Resident' }}</h1>
            <p>Profile, assignments, health, and timeline from shared platform tables.</p>
        </div>
        <a class="secondary-link" href="{{ route('business.residents.index') }}">← Back to residents</a>
    </section>

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
                <h2>Current Assignments</h2>
            </div>
            @forelse ($assignments as $assignment)
                <div class="profile-row">
                    <span>{{ $formatCareLevel($assignment->care_level ?? '') }}</span>
                    <strong>Room {{ $assignment->room_number ?? '—' }}</strong>
                    <small>{{ $assignment->status ?? 'unknown' }} · consent {{ $assignment->consent_status ?? 'unknown' }}</small>
                </div>
            @empty
                <p class="muted-line">No active assignment rows for this resident.</p>
            @endforelse
        </article>

        <article class="panel profile-panel">
            <div class="panel-header">
                <h2>Guru Intelligence</h2>
            </div>
            @if ($canViewHealth && $latestRisk)
                <strong class="big-number">{{ $latestRisk->wellness_score ?? '—' }}</strong>
                <p class="muted-line">
                    <span class="status {{ strtolower(str_replace('_', '-', $latestRisk->final_status ?? 'stable')) }}">
                        {{ str_replace('_', ' ', $latestRisk->final_status ?? 'No status') }}
                    </span>
                    · {{ $latestRisk->score_date ?? 'No score date' }}
                </p>
            @elseif ($canViewHealth)
                <p class="muted-line">No Guru risk score has been produced for this resident.</p>
            @else
                <p class="muted-line">Health and Guru details are restricted for this role.</p>
            @endif
        </article>

        <article class="panel profile-panel">
            <div class="panel-header">
                <h2>Latest Vitals</h2>
            </div>
            @if ($canViewHealth && $latestVitals)
                <div class="profile-row">
                    <span>{{ $latestVitals->captured_at ?? 'Latest reading' }}</span>
                    <strong>{{ $latestVitals->heart_rate ?? '—' }} bpm</strong>
                    <small>SpO2 {{ $latestVitals->spo2 ?? '—' }}% · Steps {{ number_format($latestVitals->steps ?? 0) }}</small>
                </div>
            @elseif ($canViewHealth)
                <p class="muted-line">No vitals have been captured for this resident.</p>
            @else
                <p class="muted-line">Vitals are restricted for this role.</p>
            @endif
        </article>
    </section>

    <section class="panel module-panel">
        <div class="panel-header">
            <h2>Resident Timeline</h2>
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
                <span>Timeline rows will appear from care notes, service activity, alerts, vitals, medication events, and incidents.</span>
                <code>resident_events</code>
            </div>
        @endforelse
    </section>
@endsection
