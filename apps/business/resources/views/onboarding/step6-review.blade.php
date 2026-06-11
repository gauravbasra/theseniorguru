<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review & Submit | TheSeniorGuru</title>@vite(['resources/css/app.css', 'resources/js/app.js'])</head>
<body class="auth-body" style="display:block; padding:40px 20px;">
<div style="max-width:820px; margin:0 auto;">
    <a class="auth-brand" href="/" style="display:inline-flex; margin-bottom:32px;"><span>TSG</span><strong style="margin-left:10px; font-size:18px;">TheSeniorGuru</strong></a>
    @include('onboarding._progress', ['step' => 6])

    @if ($errors->any())
        <div class="alert-panel error-panel" style="margin-top:16px;"><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
    @endif

    <div style="display:grid; gap:16px; margin-top:24px;">

        {{-- Business type --}}
        <div class="workbench-panel" style="grid-column:span 6;">
            <div class="panel-heading">
                <div><h3 style="margin:0;">Business Type</h3></div>
                <a href="{{ route('onboarding.step1') }}" style="font-size:12px; color:var(--blue); text-decoration:none;">Edit</a>
            </div>
            <p style="margin:0; font-size:15px; font-weight:700;">{{ \App\Models\BusinessOnboardingProfile::TYPES[$profile->business_type] ?? $profile->business_type }}</p>
        </div>

        {{-- Business profile --}}
        <div class="workbench-panel" style="grid-column:span 6;">
            <div class="panel-heading">
                <div><h3 style="margin:0;">Business Profile</h3></div>
                <a href="{{ route('onboarding.step2', $profile) }}" style="font-size:12px; color:var(--blue); text-decoration:none;">Edit</a>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; font-size:13px;">
                <div><span style="color:var(--muted);">Company Name</span><br><strong>{{ $profile->company_name }}</strong></div>
                <div><span style="color:var(--muted);">Legal Name</span><br><strong>{{ $profile->legal_name ?: '—' }}</strong></div>
                <div><span style="color:var(--muted);">EIN / Tax ID</span><br><strong>{{ $profile->ein_tax_id ?: '—' }}</strong></div>
                <div><span style="color:var(--muted);">Phone</span><br><strong>{{ $profile->phone ?: '—' }}</strong></div>
                <div style="grid-column:span 2;"><span style="color:var(--muted);">Address</span><br><strong>{{ implode(', ', array_filter([$profile->address_line1, $profile->address_line2, $profile->city, $profile->state, $profile->postal_code])) ?: '—' }}</strong></div>
                <div><span style="color:var(--muted);">Primary Contact</span><br><strong>{{ $profile->primary_contact_name }} · {{ $profile->primary_contact_title }}</strong></div>
                <div><span style="color:var(--muted);">Contact Email</span><br><strong>{{ $profile->primary_contact_email }}</strong></div>
            </div>
        </div>

        {{-- Type-specific details --}}
        <div class="workbench-panel" style="grid-column:span 6;">
            <div class="panel-heading">
                <div><h3 style="margin:0;">Organization Details</h3></div>
                <a href="{{ route('onboarding.step3', $profile) }}" style="font-size:12px; color:var(--blue); text-decoration:none;">Edit</a>
            </div>
            @php $d = $profile->type_details ?? []; @endphp
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; font-size:13px;">
                @if ($profile->business_type === 'senior_living')
                    <div><span style="color:var(--muted);">Care Types</span><br><strong>{{ implode(', ', $d['care_types'] ?? []) ?: '—' }}</strong></div>
                    <div><span style="color:var(--muted);">Total Units/Beds</span><br><strong>{{ $d['total_units'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">State License</span><br><strong>{{ $d['state_license_number'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">Medicare Provider #</span><br><strong>{{ $d['medicare_provider_number'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">Administrator</span><br><strong>{{ $d['administrator_name'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">Medical Director</span><br><strong>{{ $d['medical_director_name'] ?? '—' }}</strong></div>
                @elseif ($profile->business_type === 'insurance')
                    <div><span style="color:var(--muted);">Plan Types</span><br><strong>{{ implode(', ', $d['plan_types'] ?? []) ?: '—' }}</strong></div>
                    <div><span style="color:var(--muted);">States Covered</span><br><strong>{{ implode(', ', $d['states_covered'] ?? []) ?: '—' }}</strong></div>
                    <div><span style="color:var(--muted);">State License</span><br><strong>{{ $d['state_license_number'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">NPI Number</span><br><strong>{{ $d['npi_number'] ?? '—' }}</strong></div>
                @elseif ($profile->business_type === 'day_care')
                    <div><span style="color:var(--muted);">State License</span><br><strong>{{ $d['state_license_number'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">Daily Capacity</span><br><strong>{{ $d['daily_capacity'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">Operating Hours</span><br><strong>{{ $d['operating_hours'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">Transportation</span><br><strong>{{ isset($d['transportation_offered']) ? ($d['transportation_offered'] ? 'Yes' : 'No') : '—' }}</strong></div>
                    <div style="grid-column:span 2;"><span style="color:var(--muted);">Services</span><br><strong>{{ implode(', ', $d['services_offered'] ?? []) ?: '—' }}</strong></div>
                @else
                    <div style="grid-column:span 2;"><span style="color:var(--muted);">Service Categories</span><br><strong>{{ implode(', ', $d['service_categories'] ?? []) ?: '—' }}</strong></div>
                    <div style="grid-column:span 2;"><span style="color:var(--muted);">Service ZIP Codes</span><br><strong>{{ $d['service_area_zip_codes'] ?? '—' }}</strong></div>
                    <div><span style="color:var(--muted);">Insurance Carrier</span><br><strong>{{ $d['insurance_carrier'] ?? '—' }}</strong></div>
                @endif
            </div>
        </div>

        {{-- HIPAA BAA status --}}
        <div class="workbench-panel" style="grid-column:span 6;">
            <div class="panel-heading">
                <div><h3 style="margin:0;">HIPAA BAA</h3></div>
                <a href="{{ route('onboarding.step4', $profile) }}" style="font-size:12px; color:var(--blue); text-decoration:none;">Edit</a>
            </div>
            @if ($profile->hipaaAgreement)
                <div style="display:flex; align-items:center; gap:10px; font-size:13px;">
                    <span style="font-size:18px;">✅</span>
                    <div>
                        <strong>Signed by {{ $profile->hipaaAgreement->signatory_name }}</strong>
                        <small style="display:block; color:var(--muted);">{{ $profile->hipaaAgreement->agreed_at->format('M j, Y g:i A') }} · IP {{ $profile->hipaaAgreement->ip_address }}</small>
                    </div>
                </div>
            @else
                <div style="color:var(--red); font-size:13px;">⚠️ HIPAA BAA not yet signed — <a href="{{ route('onboarding.step4', $profile) }}">sign now</a></div>
            @endif
        </div>

        {{-- Documents --}}
        <div class="workbench-panel" style="grid-column:span 6;">
            <div class="panel-heading">
                <div><h3 style="margin:0;">Documents</h3></div>
                <a href="{{ route('onboarding.step5', $profile) }}" style="font-size:12px; color:var(--blue); text-decoration:none;">Edit</a>
            </div>
            @if ($profile->documents->count() > 0)
                <div style="display:grid; gap:6px;">
                    @foreach ($profile->documents as $doc)
                        <div style="display:flex; gap:8px; font-size:13px; align-items:center;">
                            <span>📄</span>
                            <span>{{ $doc->document_type }}</span>
                            <span style="color:var(--muted);">· {{ $doc->file_name }}</span>
                            <span class="status {{ $doc->status === 'verified' ? 'stable' : 'pending' }}" style="margin-left:auto;">{{ $doc->status }}</span>
                        </div>
                    @endforeach
                </div>
            @else
                <p style="font-size:13px; color:var(--muted); margin:0;">No documents uploaded. You may upload them after submission.</p>
            @endif
        </div>

        {{-- Submit --}}
        <div class="workbench-panel" style="grid-column:span 6; border:2px solid #7048ff;">
            <div style="text-align:center; padding:10px 0;">
                <h2 style="margin:0 0 8px;">Ready to Submit?</h2>
                <p style="color:var(--muted); font-size:14px; margin:0 0 20px;">Once submitted, your application will be reviewed by the TSG team. You'll receive an email when approved.</p>
                @if (!$profile->hipaaAgreement)
                    <div style="background:#fff7f7; border:1px solid var(--red); border-radius:8px; padding:12px; margin-bottom:16px; font-size:13px; color:var(--red);">
                        ⚠️ You must sign the HIPAA BAA before you can submit. <a href="{{ route('onboarding.step4', $profile) }}">Sign now →</a>
                    </div>
                @endif
                <form method="POST" action="{{ route('onboarding.submit', $profile) }}">
                    @csrf
                    <button type="submit" {{ !$profile->hipaaAgreement ? 'disabled' : '' }}
                        style="border:0; border-radius:8px; background:{{ $profile->hipaaAgreement ? '#7048ff' : '#ccc' }}; color:#fff; cursor:{{ $profile->hipaaAgreement ? 'pointer' : 'not-allowed' }}; padding:14px 32px; font-size:16px; font-weight:900;">
                        Submit Application →
                    </button>
                </form>
            </div>
        </div>

    </div>

    <div style="margin-top:12px;">
        <a href="{{ route('onboarding.step5', $profile) }}" class="secondary-link">← Back to Documents</a>
    </div>
</div>
</body>
</html>
