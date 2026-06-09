@extends('layouts.app')

@section('content')
<div class="panel-heading" style="margin-bottom:20px;">
    <div>
        <h1 class="page-title">Resident Mobile Invites</h1>
        <p class="subcopy">Send residents their login credentials and app download links.</p>
    </div>
    <div style="display:flex; gap:10px;">
        <a href="{{ route('residents.import') }}" style="border:1px solid var(--line); border-radius:8px; background:#fff; padding:10px 14px; font-size:13px; font-weight:700; text-decoration:none; color:var(--ink);">+ Import More</a>
        @if ($pendingCount > 0)
        <form method="POST" action="{{ route('residents.invites.send-all') }}">
            @csrf
            @if (request('batch_id'))<input type="hidden" name="batch_id" value="{{ request('batch_id') }}">@endif
            <button type="submit" style="border:0; border-radius:8px; background:#7048ff; color:#fff; cursor:pointer; padding:10px 14px; font-size:13px; font-weight:700;">
                📧 Send All Pending ({{ $pendingCount }})
            </button>
        </form>
        @endif
    </div>
</div>

@if (session('status'))
    <div class="alert-panel" style="border-color:#c9f0d8; background:#f1fff6; color:#116b3f; border-radius:9px; padding:14px; margin-bottom:16px;">✅ {{ session('status') }}</div>
@endif

{{-- Summary stats --}}
<div style="display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:20px;">
    @foreach ([
        ['Total','total','var(--ink)'],
        ['Sent','sent','var(--blue)'],
        ['Opened','opened','#e67e22'],
        ['Onboarded','onboarded','#116b3f'],
        ['Failed','failed','var(--red)'],
    ] as [$label, $key, $color])
    <div style="border:1px solid var(--line); border-radius:10px; padding:14px; text-align:center; background:#fff;">
        <div style="font-size:24px; font-weight:900; color:{{ $color }};">{{ $summary[$key] ?? 0 }}</div>
        <div style="font-size:11px; color:var(--muted); margin-top:4px;">{{ $label }}</div>
    </div>
    @endforeach
</div>

{{-- Filters --}}
<div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
    @foreach (['all','pending','sent','opened','onboarded','failed'] as $f)
        <a href="{{ request()->fullUrlWithQuery(['status' => $f === 'all' ? null : $f]) }}"
           style="padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; text-decoration:none;
                  background:{{ (request('status', 'all') === $f) ? '#7048ff' : 'var(--line)' }};
                  color:{{ (request('status', 'all') === $f) ? '#fff' : 'var(--ink)' }};">
            {{ ucfirst($f) }}
        </a>
    @endforeach
</div>

<div class="workbench-panel">
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead><tr style="border-bottom:2px solid var(--line); text-align:left;">
            <th style="padding:10px 8px;">Resident</th>
            <th style="padding:10px 8px;">Care Level</th>
            <th style="padding:10px 8px;">Username</th>
            <th style="padding:10px 8px;">Email / Phone</th>
            <th style="padding:10px 8px;">Status</th>
            <th style="padding:10px 8px;">Last Sent</th>
            <th style="padding:10px 8px;">Actions</th>
        </tr></thead>
        <tbody>
            @forelse ($invites as $inv)
            <tr style="border-bottom:1px solid var(--line);">
                <td style="padding:10px 8px; font-weight:700;">{{ $inv->display_name }}</td>
                <td style="padding:10px 8px; color:var(--muted);">{{ $inv->care_level }}</td>
                <td style="padding:10px 8px; font-family:monospace; font-size:12px;">{{ $inv->temp_username }}</td>
                <td style="padding:10px 8px; font-size:12px; color:var(--muted);">{{ $inv->email ?: ($inv->phone ?: '—') }}</td>
                <td style="padding:10px 8px;">
                    <span class="status {{ match($inv->status) {
                        'onboarded' => 'stable',
                        'opened' => 'info',
                        'sent' => 'pending',
                        'failed' => 'alert',
                        default => '' } }}">{{ $inv->status }}</span>
                </td>
                <td style="padding:10px 8px; font-size:12px; color:var(--muted);">
                    {{ $inv->email_sent_at ? $inv->email_sent_at->format('M j g:i A') : '—' }}
                </td>
                <td style="padding:10px 8px;">
                    @if (in_array($inv->status, ['pending','failed']))
                        <form method="POST" action="{{ route('residents.invites.resend', $inv) }}" style="display:inline;">
                            @csrf
                            <button type="submit" style="border:0; background:none; color:var(--blue); cursor:pointer; font-size:12px; font-weight:700; padding:0;">
                                Resend
                            </button>
                        </form>
                    @elseif ($inv->status === 'sent' || $inv->status === 'opened')
                        <form method="POST" action="{{ route('residents.invites.mark-onboarded', $inv) }}" style="display:inline;">
                            @csrf
                            <button type="submit" style="border:0; background:none; color:#116b3f; cursor:pointer; font-size:12px; font-weight:700; padding:0;">
                                Mark Onboarded
                            </button>
                        </form>
                    @else
                        <span style="color:var(--muted); font-size:12px;">—</span>
                    @endif
                </td>
            </tr>
            @empty
            <tr><td colspan="7" style="padding:32px; text-align:center; color:var(--muted);">No invites found for the selected filter.</td></tr>
            @endforelse
        </tbody>
    </table>
    @if ($invites->hasPages())
        <div style="padding:16px 8px;">{{ $invites->withQueryString()->links() }}</div>
    @endif
</div>
@endsection
