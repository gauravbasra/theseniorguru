<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Business Registration | TheSeniorGuru</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="auth-body" style="display:block; padding: 40px 20px;">
<div style="max-width:780px; margin:0 auto;">

    <a class="auth-brand" href="/" style="display:inline-flex; margin-bottom:32px;">
        <span>TSG</span>
        <strong style="margin-left:10px; font-size:18px;">TheSeniorGuru</strong>
    </a>

    @include('onboarding._progress', ['step' => 1])

    <div class="workbench-panel" style="grid-column:span 6; margin-top:24px;">
        <div class="panel-heading">
            <div>
                <h2>What type of organization are you?</h2>
                <p class="subcopy">Select the option that best describes your business. This determines your onboarding path and HIPAA data access level.</p>
            </div>
        </div>

        @if ($errors->any())
            <div class="alert-panel error-panel">
                <ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul>
            </div>
        @endif

        <form method="POST" action="{{ route('onboarding.step1.post') }}">
            @csrf

            <div class="care-level-grid" style="grid-template-columns: repeat(2, 1fr); gap:16px; margin-bottom:24px;">
                @foreach ($types as $value => $label)
                    <label style="cursor:pointer;">
                        <input type="radio" name="business_type" value="{{ $value }}" {{ old('business_type') === $value ? 'checked' : '' }} required style="position:absolute; opacity:0;">
                        <div class="care-level-card biz-type-card" data-type="{{ $value }}" style="border:2px solid var(--line); border-radius:12px; padding:20px; transition:border-color .15s;">
                            <div style="font-size:28px; margin-bottom:10px;">
                                @if ($value === 'senior_living') 🏥
                                @elseif ($value === 'insurance') 🛡️
                                @elseif ($value === 'day_care') 🌞
                                @else 🤝
                                @endif
                            </div>
                            <strong style="font-size:15px; display:block; color:var(--ink);">{{ $label }}</strong>
                            <p style="margin:6px 0 0; font-size:13px; color:var(--muted); line-height:1.45;">
                                @if ($value === 'senior_living') Independent Living, Assisted Living, Memory Care, CCRCs, Hospice
                                @elseif ($value === 'insurance') Medicare Advantage, Medicaid, Private Insurance, Care Management
                                @elseif ($value === 'day_care') Adult Day Care Centers, Day Programs, Respite Care
                                @else Transportation, Meals, Home Care, Companionship, Pharmacy, Medical Equipment
                                @endif
                            </p>
                        </div>
                    </label>
                @endforeach
            </div>

            <label class="workbench-panel" style="border:0; padding:0; box-shadow:none;">
                <div style="font-size:13px; font-weight:900; color:#24365f; margin-bottom:7px;">Organization Name <span style="color:var(--red);">*</span></div>
                <input type="text" name="company_name" value="{{ old('company_name') }}" placeholder="e.g. Sunrise Senior Living at Oak Park" required>
            </label>

            <div class="submit-bar" style="position:static; border:0; padding:20px 0 0; background:transparent; box-shadow:none; justify-content:flex-end; display:flex;">
                <button type="submit" class="submit-bar button">Continue — Business Profile →</button>
            </div>
        </form>
    </div>
</div>

<script>
document.querySelectorAll('input[name=business_type]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.querySelectorAll('.biz-type-card').forEach(c => c.style.borderColor = 'var(--line)');
        radio.closest('label').querySelector('.biz-type-card').style.borderColor = '#7048ff';
    });
});
// Restore selection on page load
const checked = document.querySelector('input[name=business_type]:checked');
if (checked) checked.closest('label').querySelector('.biz-type-card').style.borderColor = '#7048ff';
</script>
</body>
</html>
