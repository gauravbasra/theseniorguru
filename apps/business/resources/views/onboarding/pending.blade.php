<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Application Under Review | TheSeniorGuru</title>@vite(['resources/css/app.css', 'resources/js/app.js'])</head>
<body class="auth-body" style="display:block; padding:60px 20px;">
<div style="max-width:600px; margin:0 auto; text-align:center;">
    <a class="auth-brand" href="/" style="display:inline-flex; justify-content:center; margin-bottom:40px;"><span>TSG</span><strong style="margin-left:10px; font-size:18px;">TheSeniorGuru</strong></a>

    <div class="workbench-panel" style="grid-column:span 6; text-align:left;">
        <div style="text-align:center; padding:20px 0 16px;">
            @if ($profile->status === 'rejected')
                <div style="font-size:56px; margin-bottom:16px;">❌</div>
                <h1 style="margin:0 0 8px; font-size:24px; color:var(--red);">Application Not Approved</h1>
                <p style="color:var(--muted); font-size:15px; margin:0;">Your application has been reviewed and could not be approved at this time.</p>
            @elseif ($profile->status === 'under_review')
                <div style="font-size:56px; margin-bottom:16px;">🔍</div>
                <h1 style="margin:0 0 8px; font-size:24px;">Under Review</h1>
                <p style="color:var(--muted); font-size:15px; margin:0;">Your application is currently being reviewed by the TSG compliance team.</p>
            @else
                <div style="font-size:56px; margin-bottom:16px;">📋</div>
                <h1 style="margin:0 0 8px; font-size:24px;">Application Submitted!</h1>
                <p style="color:var(--muted); font-size:15px; margin:0;">We've received your application and will review it within 2–3 business days.</p>
            @endif
        </div>

        <div style="border-top:1px solid var(--line); padding-top:20px; margin-top:8px; display:grid; gap:12px; font-size:13px;">
            <div style="display:flex; gap:12px; align-items:center;">
                <span style="font-size:20px;">🏢</span>
                <div><strong>{{ $profile->company_name }}</strong><small style="display:block; color:var(--muted);">{{ \App\Models\BusinessOnboardingProfile::TYPES[$profile->business_type] ?? $profile->business_type }}</small></div>
                <span class="status {{ $profile->status === 'approved' ? 'stable' : ($profile->status === 'rejected' ? 'alert' : 'warning') }}" style="margin-left:auto;">{{ $profile->status }}</span>
            </div>
            @if ($profile->submitted_at)
                <div style="color:var(--muted);">Submitted {{ $profile->submitted_at->format('M j, Y g:i A') }}</div>
            @endif
        </div>

        @if ($profile->status === 'rejected' && $profile->rejection_reason)
            <div style="background:#fff7f7; border:1px solid #ffd0d0; border-radius:8px; padding:16px; margin-top:16px;">
                <strong style="display:block; margin-bottom:6px; font-size:13px; color:var(--red);">Reason for Non-Approval</strong>
                <p style="margin:0; font-size:13px; color:#5a3535;">{{ $profile->rejection_reason }}</p>
            </div>
            <div style="margin-top:16px; text-align:center;">
                <a href="{{ route('onboarding.step1') }}" style="border:0; border-radius:8px; background:var(--blue); color:#fff; padding:12px 20px; font-weight:900; text-decoration:none; display:inline-block;">Start a New Application</a>
                <p style="margin:8px 0 0; font-size:12px; color:var(--muted);">Or email <a href="mailto:support@theseniorguru.com">support@theseniorguru.com</a> to appeal this decision.</p>
            </div>
        @else
            <div style="margin-top:20px; border-radius:8px; background:#f8f9ff; border:1px solid var(--line); padding:16px; font-size:13px;">
                <strong style="display:block; margin-bottom:8px;">What happens next?</strong>
                <ol style="margin:0; padding-left:20px; display:grid; gap:6px;">
                    <li>TSG compliance team reviews your documents and HIPAA BAA</li>
                    <li>We may reach out to {{ $profile->primary_contact_email }} with any questions</li>
                    <li>Once approved, you'll receive a welcome email and can log into the portal</li>
                    <li>You'll be able to add your residents and start using the platform</li>
                </ol>
            </div>

            @if ($profile->documents->count() < count($profile->requiredDocuments()))
                <div style="background:#fffbea; border:1px solid #ffe08a; border-radius:8px; padding:14px; margin-top:14px; font-size:13px; color:#7a5c00;">
                    💡 <strong>Speed up your review:</strong> Upload your remaining verification documents to avoid delays.
                    <a href="{{ route('onboarding.step5', $profile) }}" style="margin-left:6px; font-weight:700;">Upload now →</a>
                </div>
            @endif
        @endif
    </div>
</div>
</body>
</html>
