<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>HIPAA Agreement | TheSeniorGuru</title>@vite(['resources/css/app.css', 'resources/js/app.js'])</head>
<body class="auth-body" style="display:block; padding:40px 20px;">
<div style="max-width:780px; margin:0 auto;">
    <a class="auth-brand" href="/" style="display:inline-flex; margin-bottom:32px;"><span>TSG</span><strong style="margin-left:10px; font-size:18px;">TheSeniorGuru</strong></a>
    @include('onboarding._progress', ['step' => 4])

    @if ($existing)
        <div class="alert-panel" style="border-color:#c9f0d8; background:#f1fff6; color:#116b3f; margin-top:24px; border-radius:10px; padding:16px;">
            ✅ <strong>HIPAA BAA previously signed</strong> by {{ $existing->signatory_name }} on {{ $existing->agreed_at->format('M j, Y g:i A') }} from IP {{ $existing->ip_address }}. You may re-sign below to update.
        </div>
    @endif

    <div class="workbench-panel" style="grid-column:span 6; margin-top:24px;">
        <div class="panel-heading"><div>
            <h2>HIPAA Business Associate Agreement</h2>
            <p class="subcopy">All businesses accessing protected health information (PHI) on the TheSeniorGuru platform must sign this agreement. This is legally required under HIPAA.</p>
        </div></div>

        @if ($errors->any())
            <div class="alert-panel error-panel"><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
        @endif

        <div style="border:1px solid var(--line); border-radius:10px; background:#fafcff; padding:24px; margin-bottom:24px; max-height:360px; overflow-y:auto; font-size:13px; line-height:1.7; color:#334e68;">
            <h3 style="margin:0 0 12px; font-size:16px; color:var(--ink);">Business Associate Agreement — Version 1.0</h3>
            <p><strong>Effective Date:</strong> Date of electronic acceptance</p>
            <p>This Business Associate Agreement ("BAA") is entered into between TheSeniorGuru, Inc. ("Covered Entity") and the Business Associate identified in the registration form below ("Business Associate").</p>
            <p><strong>1. Definitions.</strong> Terms used but not otherwise defined in this Agreement shall have the same meaning as those terms in 45 CFR Parts 160 and 164 (the "HIPAA Rules").</p>
            <p><strong>2. Obligations of Business Associate.</strong> Business Associate agrees to not use or disclose Protected Health Information ("PHI") other than as permitted or required by this Agreement or as Required by Law. Business Associate agrees to use appropriate safeguards, and comply, where applicable, with Subpart C of 45 CFR Part 164 to prevent use or disclosure of PHI not provided for by this Agreement.</p>
            <p><strong>3. Permitted Uses and Disclosures.</strong> Business Associate may use or disclose PHI only for the purposes set forth in the underlying service agreement, or as Required by Law. Business Associate may use PHI for the proper management and administration of the Business Associate or to carry out its legal responsibilities.</p>
            <p><strong>4. Breach Notification.</strong> Business Associate agrees to report to Covered Entity any use or disclosure of PHI not provided for by this Agreement without unreasonable delay and in no case later than 60 days following the discovery of a breach. Business Associate shall provide Covered Entity with the information specified in 45 CFR § 164.410(c).</p>
            <p><strong>5. Subcontractors.</strong> Business Associate shall ensure that any subcontractors that create, receive, maintain, or transmit PHI on behalf of Business Associate agree to the same restrictions, conditions, and requirements that apply to Business Associate with respect to such information.</p>
            <p><strong>6. Access to PHI.</strong> Business Associate shall make PHI in a Designated Record Set available to Covered Entity as necessary to satisfy Covered Entity's obligations under 45 CFR § 164.524.</p>
            <p><strong>7. Minimum Necessary.</strong> Business Associate will make reasonable efforts to use, disclose, and request only the minimum amount of PHI necessary to accomplish the intended purpose.</p>
            <p><strong>8. Data Use Agreement.</strong> Business Associate agrees to use PHI accessed through the TheSeniorGuru platform solely for purposes permitted in this agreement, and not to sell, license, or otherwise commercialize resident health data.</p>
            <p><strong>9. Term and Termination.</strong> This Agreement shall be effective as of the date of acceptance and shall terminate when all PHI provided by, or created or received by Business Associate on behalf of, Covered Entity is destroyed or returned.</p>
        </div>

        <form method="POST" action="{{ route('onboarding.step4.post', $profile) }}">
            @csrf

            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px; margin-bottom:20px;">
                <label>Signatory Full Name <span style="color:var(--red);">*</span>
                    <input type="text" name="signatory_name" value="{{ old('signatory_name', $existing?->signatory_name ?? $profile->primary_contact_name) }}" required placeholder="Full legal name">
                </label>
                <label>Title / Authority <span style="color:var(--red);">*</span>
                    <input type="text" name="signatory_title" value="{{ old('signatory_title', $existing?->signatory_title ?? $profile->primary_contact_title) }}" required placeholder="Must have authority to sign">
                </label>
                <label style="grid-column:span 2;">Signatory Email <span style="color:var(--red);">*</span>
                    <input type="email" name="signatory_email" value="{{ old('signatory_email', $existing?->signatory_email ?? $profile->primary_contact_email) }}" required>
                </label>
            </div>

            <div style="display:grid; gap:14px; margin-bottom:24px;">
                <label class="check-row" style="display:flex; gap:10px; align-items:flex-start; font-weight:700; font-size:14px; cursor:pointer;">
                    <input type="checkbox" name="baa_accepted" value="1" style="width:18px; height:18px; margin-top:2px;" required {{ old('baa_accepted') ? 'checked' : '' }}>
                    <span>I have read, understand, and agree to the <strong>HIPAA Business Associate Agreement</strong> above. I have authority to enter into this agreement on behalf of {{ $profile->company_name }}.</span>
                </label>
                <label class="check-row" style="display:flex; gap:10px; align-items:flex-start; font-weight:700; font-size:14px; cursor:pointer;">
                    <input type="checkbox" name="data_use_accepted" value="1" style="width:18px; height:18px; margin-top:2px;" required {{ old('data_use_accepted') ? 'checked' : '' }}>
                    <span>I agree to the <strong>Data Use Agreement</strong> — I will only use resident health data for the purposes permitted in this agreement and will not sell or commercialize it.</span>
                </label>
                <label class="check-row" style="display:flex; gap:10px; align-items:flex-start; font-weight:700; font-size:14px; cursor:pointer;">
                    <input type="checkbox" name="phi_handling_accepted" value="1" style="width:18px; height:18px; margin-top:2px;" required {{ old('phi_handling_accepted') ? 'checked' : '' }}>
                    <span>I understand our <strong>PHI handling obligations</strong> — we will implement appropriate administrative, physical, and technical safeguards to protect resident health information.</span>
                </label>
                <label class="check-row" style="display:flex; gap:10px; align-items:flex-start; font-weight:700; font-size:14px; cursor:pointer;">
                    <input type="checkbox" name="breach_notification_accepted" value="1" style="width:18px; height:18px; margin-top:2px;" required {{ old('breach_notification_accepted') ? 'checked' : '' }}>
                    <span>I acknowledge our <strong>breach notification responsibility</strong> — we will notify TheSeniorGuru within 60 days of discovering any PHI breach.</span>
                </label>
            </div>

            <div style="background:#fffbea; border:1px solid #ffe08a; border-radius:8px; padding:14px; margin-bottom:24px; font-size:13px; color:#7a5c00;">
                🔒 <strong>This signature is legally binding.</strong> Your IP address ({{ request()->ip() }}), timestamp, user agent, and signatory name will be recorded and stored in our HIPAA audit log.
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:8px;">
                <a href="{{ route('onboarding.step3', $profile) }}" class="secondary-link">← Back</a>
                <button type="submit" style="border:0; border-radius:8px; background:#7048ff; color:#fff; cursor:pointer; padding:12px 20px; font-weight:900;">Sign & Continue →</button>
            </div>
        </form>
    </div>
</div>
</body>
</html>
