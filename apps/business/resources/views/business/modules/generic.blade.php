@extends('layouts.app')

@section('title', $title)

@section('content')
    <section class="page-title">
        <div>
            <h1>{{ $title }}</h1>
            <p>{{ $subtitle }}</p>
        </div>
        @if (! empty($sourceTables))
            <div class="source-chip-row">
                @foreach ($sourceTables as $table)
                    <code>{{ $table }}</code>
                @endforeach
            </div>
        @endif
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
                        <span>
                            {{ $row['value'] ?? 'open' }}
                            @if (! empty($row['meta'])) · {{ $row['meta'] }} @endif
                        </span>
                    </div>
                @empty
                    <p class="muted-line">No records currently exist for this scope.</p>
                @endforelse
            </div>
        </section>
    @empty
        <section class="panel module-panel">
            <div class="empty-state">
                <strong>No operational records are currently loaded for this module.</strong>
                <span>This module is authenticated and database-scoped. Records will appear here as the shared tables receive production data.</span>
            </div>
        </section>
    @endforelse
@endsection
