<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Business Profile | TheSeniorGuru</title>@vite(['resources/css/app.css', 'resources/js/app.js'])</head>
<body class="auth-body" style="display:block; padding:40px 20px;">
<div style="max-width:780px; margin:0 auto;">
    <a class="auth-brand" href="/" style="display:inline-flex; margin-bottom:32px;"><span>TSG</span><strong style="margin-left:10px; font-size:18px;">TheSeniorGuru</strong></a>
    @include('onboarding._progress', ['step' => 2])

    <div class="workbench-panel" style="grid-column:span 6; margin-top:24px;">
        <div class="panel-heading"><div>
            <h2>Business Profile</h2>
            <p class="subcopy">{{ \App\Models\BusinessOnboardingProfile::TYPES[$profile->business_type] ?? $profile->business_type }} · {{ $profile->company_name }}</p>
        </div></div>

        @if ($errors->any())
            <div class="alert-panel error-panel"><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
        @endif

        <form method="POST" action="{{ route('onboarding.step2.post', $profile) }}">
            @csrf
            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                <label>Legal Business Name
                    <input type="text" name="legal_name" value="{{ old('legal_name', $profile->legal_name) }}" placeholder="As registered with IRS / state">
                </label>
                <label>EIN / Tax ID
                    <input type="text" name="ein_tax_id" value="{{ old('ein_tax_id', $profile->ein_tax_id) }}" placeholder="12-3456789">
                </label>
                <label>Website
                    <input type="url" name="website" value="{{ old('website', $profile->website) }}" placeholder="https://yourorganization.com">
                </label>
                <label>Main Phone <span style="color:var(--red);">*</span>
                    <input type="tel" name="phone" value="{{ old('phone', $profile->phone) }}" required placeholder="(555) 000-0000">
                </label>
            </div>

            <h3 style="margin:24px 0 14px; font-size:15px;">Business Address</h3>
            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                <label style="grid-column:span 2;">Street Address <span style="color:var(--red);">*</span>
                    <input type="text" name="address_line1" value="{{ old('address_line1', $profile->address_line1) }}" required placeholder="123 Main Street">
                </label>
                <label style="grid-column:span 2;">Suite / Unit
                    <input type="text" name="address_line2" value="{{ old('address_line2', $profile->address_line2) }}" placeholder="Suite 200">
                </label>
                <label>City <span style="color:var(--red);">*</span>
                    <input type="text" name="city" value="{{ old('city', $profile->city) }}" required>
                </label>
                <label>State <span style="color:var(--red);">*</span>
                    <input type="text" name="state" value="{{ old('state', $profile->state) }}" required maxlength="60" placeholder="Colorado">
                </label>
                <label>ZIP Code <span style="color:var(--red);">*</span>
                    <input type="text" name="postal_code" value="{{ old('postal_code', $profile->postal_code) }}" required>
                </label>
            </div>

            <h3 style="margin:24px 0 14px; font-size:15px;">Primary HIPAA Contact / Administrator</h3>
            <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                <label>Full Name <span style="color:var(--red);">*</span>
                    <input type="text" name="primary_contact_name" value="{{ old('primary_contact_name', $profile->primary_contact_name) }}" required>
                </label>
                <label>Title / Role <span style="color:var(--red);">*</span>
                    <input type="text" name="primary_contact_title" value="{{ old('primary_contact_title', $profile->primary_contact_title) }}" required placeholder="Executive Director, COO, etc.">
                </label>
                <label>Email <span style="color:var(--red);">*</span>
                    <input type="email" name="primary_contact_email" value="{{ old('primary_contact_email', $profile->primary_contact_email) }}" required>
                </label>
                <label>Phone <span style="color:var(--red);">*</span>
                    <input type="tel" name="primary_contact_phone" value="{{ old('primary_contact_phone', $profile->primary_contact_phone) }}" required>
                </label>
            </div>

            <div style="display:flex; justify-content:space-between; margin-top:28px;">
                <a href="{{ route('onboarding.step1') }}" class="secondary-link">← Back</a>
                <button type="submit" class="submit-bar button" style="border:0; border-radius:8px; background:var(--blue); color:#fff; cursor:pointer; padding:12px 20px; font-weight:900;">Save & Continue →</button>
            </div>
        </form>
    </div>
</div>
</body>
</html>
