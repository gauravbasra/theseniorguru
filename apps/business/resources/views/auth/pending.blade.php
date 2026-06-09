<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Complete Your Application | TheSeniorGuru Business</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="auth-body">
    <main class="auth-card" style="max-width:500px;">
        <a class="auth-brand" href="{{ route('login') }}"><span>TSG</span>TheSeniorGuru Business</a>
        <h1 style="font-size:22px; margin-bottom:8px;">Welcome, {{ auth()->user()->name }}!</h1>
        <p style="color:#64748b; margin-bottom:20px;">Complete your business profile below to apply for portal access. Our team reviews and approves new businesses within 1–2 business days.</p>

        @php $profile = \App\Models\BusinessOnboardingProfile::where('user_id', auth()->id())->latest()->first(); @endphp

        @if ($profile && in_array($profile->status, ['submitted','under_review','approved','rejected']))
            <div style="background:{{ $profile->status === 'approved' ? '#f1fff6' : ($profile->status === 'rejected' ? '#fff7f7' : '#f8f9ff') }}; border:1px solid {{ $profile->status === 'approved' ? '#c9f0d8' : ($profile->status === 'rejected' ? '#ffd0d0' : '#dde3f5') }}; border-radius:10px; padding:16px; margin-bottom:16px; text-align:left;">
                <strong style="font-size:14px;">{{ $profile->company_name }}</strong>
                <span style="margin-left:8px; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:700; background:{{ match($profile->status) { 'approved'=>'#c9f0d8','rejected'=>'#ffd0d0','under_review'=>'#dbeafe',default=>'#fef9c3' } }}; color:{{ match($profile->status) { 'approved'=>'#116b3f','rejected'=>'#b91c1c','under_review'=>'#1e40af',default=>'#713f12' } }};">{{ strtoupper(str_replace('_',' ',$profile->status)) }}</span>
                @if ($profile->status === 'rejected' && $profile->rejection_reason)
                    <p style="margin:8px 0 0; font-size:12px; color:#b91c1c;">{{ $profile->rejection_reason }}</p>
                @endif
                <a href="{{ route('onboarding.pending', $profile) }}" style="display:block; margin-top:10px; font-size:13px; font-weight:700; color:#7048ff; text-decoration:none;">View application status →</a>
            </div>
        @else
            <a href="{{ route('onboarding.start') }}" style="display:block; background:#7048ff; color:#fff; text-align:center; padding:14px 20px; border-radius:9px; font-weight:900; font-size:15px; text-decoration:none; margin-bottom:16px;">
                {{ $profile ? 'Continue Onboarding Application →' : 'Start Onboarding Application →' }}
            </a>
            @if ($profile)
                <p style="font-size:12px; color:#94a3b8; text-align:center; margin-bottom:16px;">Step {{ $profile->step_completed }} of 6 completed</p>
            @endif
        @endif

        <form method="POST" action="{{ route('logout') }}">
            @csrf
            <button type="submit" style="background:none; border:1px solid #e2e8f0; color:#94a3b8; width:100%; padding:10px; border-radius:8px; cursor:pointer; font-size:13px;">Sign out</button>
        </form>
    </main>
</body>
</html>
