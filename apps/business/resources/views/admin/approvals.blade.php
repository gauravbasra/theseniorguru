@extends('layouts.app')

@section('content')
<div class="panel-heading" style="margin-bottom:20px;">
    <div>
        <h1 class="page-title">Business Approvals</h1>
        <p class="subcopy">Review and approve business applications before they can access the portal.</p>
    </div>
    <div style="display:flex; gap:8px; align-items:center; font-size:13px; color:var(--muted);">
        <span>{{ $pending->total() }} pending</span>
    </div>
</div>

@if (session('status'))
    <div class="alert-panel" style="border-color:#c9f0d8; background:#f1fff6; color:#116b3f; border-radius:9px; padding:14px; margin-bottom:16px;">✅ {{ session('status') }}</div>
@endif

{{-- Summary badges --}}
<div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px;">
    @foreach ([
        ['Pending','submitted','#e67e22'],
        ['Under Review','under_review','var(--blue)'],
        ['Approved','approved','#116b3f'],
        ['Rejected','rejected','var(--red)'],
    ] as [$label, $s, $color])
    <div style="border:1px solid var(--line); border-radius:10px; padding:14px; background:#fff; text-align:center;">
        <div style="font-size:26px; font-weight:900; color:{{ $color }};">{{ $counts[$s] ?? 0 }}</div>
        <div style="font-size:11px; color:var(--muted); margin-top:4px;">{{ $label }}</div>
    </div>
    @endforeach
</div>

{{-- Pending queue --}}
<div class="workbench-panel" style="margin-bottom:24px;">
    <div class="panel-heading"><div><h3>Pending Applications</h3></div></div>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead><tr style="border-bottom:2px solid var(--line); text-align:left;">
            <th style="padding:10px 8px;">Business</th>
            <th style="padding:10px 8px;">Type</th>
            <th style="padding:10px 8px;">Contact</th>
            <th style="padding:10px 8px;">Submitted</th>
            <th style="padding:10px 8px;">HIPAA</th>
            <th style="padding:10px 8px;">Docs</th>
            <th style="padding:10px 8px;">Status</th>
            <th style="padding:10px 8px;">Actions</th>
        </tr></thead>
        <tbody>
            @forelse ($pending as $app)
            <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:10px 8px;">
                    <a href="{{ route('admin.approvals.detail', $app) }}" style="font-weight:700; color:var(--ink); text-decoration:none;">{{ $app->company_name }}</a>
                    <small style="display:block; color:var(--muted);">{{ $app->city }}, {{ $app->state }}</small>
                </td>
                <td style="padding:10px 8px; color:var(--muted);">{{ \App\Models\BusinessOnboardingProfile::TYPES[$app->business_type] ?? $app->business_type }}</td>
                <td style="padding:10px 8px; font-size:12px;">{{ $app->primary_contact_name }}<br><span style="color:var(--muted);">{{ $app->primary_contact_email }}</span></td>
                <td style="padding:10px 8px; font-size:12px; color:var(--muted);">{{ $app->submitted_at?->format('M j, Y') ?? '—' }}</td>
                <td style="padding:10px 8px; text-align:center;">{{ $app->hipaaAgreement ? '✅' : '❌' }}</td>
                <td style="padding:10px 8px; text-align:center; font-size:12px;">{{ $app->documents->count() }} / {{ count($app->requiredDocuments()) }}</td>
                <td style="padding:10px 8px;">
                    <span class="status {{ match($app->status) { 'under_review' => 'info', 'submitted' => 'warning', default => '' } }}">{{ $app->status }}</span>
                </td>
                <td style="padding:10px 8px;">
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <a href="{{ route('admin.approvals.detail', $app) }}" style="font-size:12px; padding:5px 10px; border-radius:6px; border:1px solid var(--line); text-decoration:none; color:var(--ink); font-weight:700;">Review</a>
                        @if ($app->status === 'submitted')
                        <form method="POST" action="{{ route('admin.approvals.under-review', $app) }}" style="display:inline;">
                            @csrf
                            <button type="submit" style="font-size:12px; padding:5px 10px; border-radius:6px; border:1px solid var(--blue); background:none; color:var(--blue); cursor:pointer; font-weight:700;">Start Review</button>
                        </form>
                        @endif
                    </div>
                </td>
            </tr>
            @empty
            <tr><td colspan="8" style="padding:32px; text-align:center; color:var(--muted);">No pending applications 🎉</td></tr>
            @endforelse
        </tbody>
    </table>
    @if ($pending->hasPages())
        <div style="padding:16px 8px;">{{ $pending->withQueryString()->links() }}</div>
    @endif
</div>

{{-- Recent decisions --}}
@if ($recent->count() > 0)
<div class="workbench-panel">
    <div class="panel-heading"><div><h3>Recent Decisions</h3></div></div>
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead><tr style="border-bottom:2px solid var(--line); text-align:left;">
            <th style="padding:10px 8px;">Business</th>
            <th style="padding:10px 8px;">Type</th>
            <th style="padding:10px 8px;">Decision</th>
            <th style="padding:10px 8px;">Date</th>
            <th style="padding:10px 8px;">Action</th>
        </tr></thead>
        <tbody>
            @foreach ($recent as $app)
            <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:10px 8px; font-weight:700;">{{ $app->company_name }}</td>
                <td style="padding:10px 8px; color:var(--muted);">{{ \App\Models\BusinessOnboardingProfile::TYPES[$app->business_type] ?? $app->business_type }}</td>
                <td style="padding:10px 8px;"><span class="status {{ $app->status === 'approved' ? 'stable' : 'alert' }}">{{ $app->status }}</span></td>
                <td style="padding:10px 8px; font-size:12px; color:var(--muted);">{{ ($app->approved_at ?? $app->rejected_at)?->format('M j, Y') ?? '—' }}</td>
                <td style="padding:10px 8px;"><a href="{{ route('admin.approvals.detail', $app) }}" style="font-size:12px; color:var(--blue); text-decoration:none;">View</a></td>
            </tr>
            @endforeach
        </tbody>
    </table>
</div>
@endif
@endsection
