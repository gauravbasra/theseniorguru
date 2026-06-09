@extends('layouts.app')

@section('content')
<div class="panel-heading" style="margin-bottom:20px;">
    <div>
        <a href="{{ route('admin.approvals') }}" style="font-size:12px; color:var(--muted); text-decoration:none;">← Back to Approvals</a>
        <h1 class="page-title" style="margin-top:4px;">{{ $profile->company_name }}</h1>
        <p class="subcopy">{{ \App\Models\BusinessOnboardingProfile::TYPES[$profile->business_type] ?? $profile->business_type }} · {{ $profile->city }}, {{ $profile->state }}</p>
    </div>
    <span class="status {{ match($profile->status) { 'approved' => 'stable', 'rejected' => 'alert', 'under_review' => 'info', default => 'warning' } }}" style="font-size:15px; padding:8px 14px;">{{ $profile->status }}</span>
</div>

@if (session('status'))
    <div class="alert-panel" style="border-color:#c9f0d8; background:#f1fff6; color:#116b3f; border-radius:9px; padding:14px; margin-bottom:16px;">✅ {{ session('status') }}</div>
@endif

<div style="display:grid; grid-template-columns:2fr 1fr; gap:20px;">

    {{-- Left: details --}}
    <div style="display:grid; gap:16px;">

        <div class="workbench-panel">
            <div class="panel-heading"><div><h3>Business Profile</h3></div></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; font-size:13px;">
                <div><span style="color:var(--muted);">Legal Name</span><br><strong>{{ $profile->legal_name ?: '—' }}</strong></div>
                <div><span style="color:var(--muted);">EIN / Tax ID</span><br><strong>{{ $profile->ein_tax_id ?: '—' }}</strong></div>
                <div><span style="color:var(--muted);">Phone</span><br><strong>{{ $profile->phone ?: '—' }}</strong></div>
                <div><span style="color:var(--muted);">Website</span><br><strong>{{ $profile->website ?: '—' }}</strong></div>
                <div style="grid-column:span 2;"><span style="color:var(--muted);">Address</span><br><strong>{{ implode(', ', array_filter([$profile->address_line1, $profile->address_line2, $profile->city, $profile->state, $profile->postal_code])) ?: '—' }}</strong></div>
            </div>
        </div>

        <div class="workbench-panel">
            <div class="panel-heading"><div><h3>Primary HIPAA Contact</h3></div></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; font-size:13px;">
                <div><span style="color:var(--muted);">Name</span><br><strong>{{ $profile->primary_contact_name }}</strong></div>
                <div><span style="color:var(--muted);">Title</span><br><strong>{{ $profile->primary_contact_title }}</strong></div>
                <div><span style="color:var(--muted);">Email</span><br><strong>{{ $profile->primary_contact_email }}</strong></div>
                <div><span style="color:var(--muted);">Phone</span><br><strong>{{ $profile->primary_contact_phone }}</strong></div>
            </div>
        </div>

        <div class="workbench-panel">
            <div class="panel-heading"><div><h3>Organization Details</h3></div></div>
            @php $d = $profile->type_details ?? []; @endphp
            <div style="font-size:13px;">
                @foreach ($d as $key => $value)
                    @if (!is_array($value))
                    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--line);">
                        <span style="color:var(--muted);">{{ str_replace('_', ' ', ucfirst($key)) }}</span>
                        <strong>{{ $value ?: '—' }}</strong>
                    </div>
                    @else
                    <div style="padding:6px 0; border-bottom:1px solid var(--line);">
                        <span style="color:var(--muted); display:block;">{{ str_replace('_', ' ', ucfirst($key)) }}</span>
                        <strong>{{ implode(', ', $value) ?: '—' }}</strong>
                    </div>
                    @endif
                @endforeach
            </div>
        </div>

        <div class="workbench-panel">
            <div class="panel-heading"><div><h3>HIPAA BAA</h3></div></div>
            @if ($profile->hipaaAgreement)
                @php $baa = $profile->hipaaAgreement; @endphp
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; font-size:13px;">
                    <div><span style="color:var(--muted);">Signatory</span><br><strong>{{ $baa->signatory_name }}</strong></div>
                    <div><span style="color:var(--muted);">Title</span><br><strong>{{ $baa->signatory_title }}</strong></div>
                    <div><span style="color:var(--muted);">Email</span><br><strong>{{ $baa->signatory_email }}</strong></div>
                    <div><span style="color:var(--muted);">Version</span><br><strong>{{ $baa->agreement_version }}</strong></div>
                    <div><span style="color:var(--muted);">Signed</span><br><strong>{{ $baa->agreed_at->format('M j, Y g:i A') }}</strong></div>
                    <div><span style="color:var(--muted);">IP Address</span><br><strong>{{ $baa->ip_address }}</strong></div>
                    <div style="grid-column:span 2;">
                        <span style="color:var(--muted);">Acceptances</span><br>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:4px;">
                            @foreach (['baa_accepted' => 'BAA', 'data_use_accepted' => 'Data Use', 'phi_handling_accepted' => 'PHI Handling', 'breach_notification_accepted' => 'Breach Notification'] as $field => $label)
                                <span style="padding:3px 8px; border-radius:4px; font-size:11px; font-weight:700; background:{{ $baa->$field ? '#c9f0d8' : '#ffd0d0' }}; color:{{ $baa->$field ? '#116b3f' : 'var(--red)' }};">{{ $baa->$field ? '✓' : '✗' }} {{ $label }}</span>
                            @endforeach
                        </div>
                    </div>
                </div>
            @else
                <p style="color:var(--red); font-size:13px; margin:0;">⚠️ HIPAA BAA not signed</p>
            @endif
        </div>

        <div class="workbench-panel">
            <div class="panel-heading"><div><h3>Documents ({{ $profile->documents->count() }})</h3></div></div>
            @forelse ($profile->documents as $doc)
                <div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--line); font-size:13px;">
                    <span>📄</span>
                    <div style="flex:1;">
                        <strong>{{ \App\Models\BusinessVerificationDocument::TYPES[$doc->document_type] ?? $doc->document_type }}</strong>
                        <small style="display:block; color:var(--muted);">{{ $doc->file_name }} · {{ number_format($doc->file_size_bytes / 1024, 1) }} KB</small>
                    </div>
                    <span class="status {{ $doc->status === 'verified' ? 'stable' : ($doc->status === 'rejected' ? 'alert' : 'pending') }}">{{ $doc->status }}</span>
                </div>
            @empty
                <p style="color:var(--muted); font-size:13px; margin:0;">No documents uploaded.</p>
            @endforelse
        </div>

    </div>

    {{-- Right: action sidebar --}}
    <div style="display:grid; gap:16px; align-content:start;">

        @if (in_array($profile->status, ['submitted', 'under_review']))
        <div class="workbench-panel" style="border-color:#c9f0d8;">
            <h3 style="margin:0 0 14px; font-size:14px; color:#116b3f;">✅ Approve Application</h3>
            <p style="font-size:12px; color:var(--muted); margin:0 0 14px;">Approving will provision a tenant account and allow the business to access the portal.</p>
            <form method="POST" action="{{ route('admin.approvals.approve', $profile) }}">
                @csrf
                <button type="submit" onclick="return confirm('Approve {{ $profile->company_name }}? This will provision their tenant account.')"
                    style="width:100%; border:0; border-radius:8px; background:#116b3f; color:#fff; cursor:pointer; padding:12px; font-weight:900;">
                    Approve & Provision
                </button>
            </form>
        </div>

        <div class="workbench-panel" style="border-color:#ffd0d0;">
            <h3 style="margin:0 0 14px; font-size:14px; color:var(--red);">❌ Reject Application</h3>
            <form method="POST" action="{{ route('admin.approvals.reject', $profile) }}">
                @csrf
                <textarea name="rejection_reason" rows="4" required placeholder="Reason for rejection (required — will be shown to applicant)" style="width:100%; resize:vertical; font-size:13px; margin-bottom:10px;"></textarea>
                <button type="submit" onclick="return confirm('Reject this application? The applicant will see your rejection reason.')"
                    style="width:100%; border:0; border-radius:8px; background:var(--red); color:#fff; cursor:pointer; padding:12px; font-weight:900;">
                    Reject
                </button>
            </form>
        </div>
        @endif

        @if ($profile->status === 'approved')
        <div class="workbench-panel" style="border-color:#c9f0d8; background:#f1fff6;">
            <strong style="color:#116b3f;">✅ Approved</strong>
            <p style="font-size:12px; color:var(--muted); margin:8px 0 0;">Approved {{ $profile->approved_at?->format('M j, Y') }}</p>
        </div>
        @endif

        @if ($profile->status === 'rejected')
        <div class="workbench-panel" style="border-color:#ffd0d0; background:#fff7f7;">
            <strong style="color:var(--red);">❌ Rejected</strong>
            <p style="font-size:12px; margin:8px 0 0;">{{ $profile->rejection_reason }}</p>
        </div>
        @endif

        {{-- Submission timeline --}}
        <div class="workbench-panel">
            <h3 style="margin:0 0 12px; font-size:14px;">Timeline</h3>
            <div style="font-size:12px; display:grid; gap:8px;">
                <div>📝 Created <span style="color:var(--muted);">{{ $profile->created_at->format('M j, Y g:i A') }}</span></div>
                @if ($profile->submitted_at)<div>📤 Submitted <span style="color:var(--muted);">{{ $profile->submitted_at->format('M j, Y g:i A') }}</span></div>@endif
                @if ($profile->approved_at)<div>✅ Approved <span style="color:var(--muted);">{{ $profile->approved_at->format('M j, Y g:i A') }}</span></div>@endif
                @if ($profile->rejected_at)<div>❌ Rejected <span style="color:var(--muted);">{{ $profile->rejected_at->format('M j, Y g:i A') }}</span></div>@endif
            </div>
        </div>

    </div>
</div>
@endsection
