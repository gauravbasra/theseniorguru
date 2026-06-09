<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organization Details | TheSeniorGuru</title>@vite(['resources/css/app.css', 'resources/js/app.js'])</head>
<body class="auth-body" style="display:block; padding:40px 20px;">
<div style="max-width:780px; margin:0 auto;">
    <a class="auth-brand" href="/" style="display:inline-flex; margin-bottom:32px;"><span>TSG</span><strong style="margin-left:10px; font-size:18px;">TheSeniorGuru</strong></a>
    @include('onboarding._progress', ['step' => 3])

    <div class="workbench-panel" style="grid-column:span 6; margin-top:24px;">
        <div class="panel-heading"><div>
            <h2>Organization Details</h2>
            <p class="subcopy">{{ \App\Models\BusinessOnboardingProfile::TYPES[$profile->business_type] ?? '' }} · {{ $profile->company_name }}</p>
        </div></div>

        @if ($errors->any())
            <div class="alert-panel error-panel"><ul>@foreach ($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
        @endif

        <form method="POST" action="{{ route('onboarding.step3.post', $profile) }}">
            @csrf
            @php $d = $profile->type_details ?? []; @endphp

            {{-- ── Senior Living ─────────────────────────────────── --}}
            @if ($profile->business_type === 'senior_living')
                <h3 style="margin:0 0 14px; font-size:15px;">Care Types Offered <span style="color:var(--red);">*</span></h3>
                <div class="care-level-grid" style="margin-bottom:20px;">
                    @foreach (['independent_living'=>'Independent Living','assisted_living'=>'Assisted Living','memory_care'=>'Memory Care','ccrc'=>'CCRC / Continuum of Care','hospice'=>'Hospice'] as $val => $lbl)
                        <label class="care-level-card" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                            <input type="checkbox" name="care_types[]" value="{{ $val }}" {{ in_array($val, $d['care_types'] ?? []) ? 'checked' : '' }}>
                            <span>{{ $lbl }}</span>
                        </label>
                    @endforeach
                </div>
                <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                    <label>Total Units / Beds <span style="color:var(--red);">*</span>
                        <input type="number" name="total_units" value="{{ old('total_units', $d['total_units'] ?? '') }}" required min="1" max="2000">
                    </label>
                    <label>State License Number <span style="color:var(--red);">*</span>
                        <input type="text" name="state_license_number" value="{{ old('state_license_number', $d['state_license_number'] ?? '') }}" required>
                    </label>
                    <label>Medicare Provider Number
                        <input type="text" name="medicare_provider_number" value="{{ old('medicare_provider_number', $d['medicare_provider_number'] ?? '') }}" placeholder="NPI or CCN">
                    </label>
                    <label>Year Established
                        <input type="number" name="year_established" value="{{ old('year_established', $d['year_established'] ?? '') }}" min="1800" max="{{ date('Y') }}">
                    </label>
                    <label>Administrator Name <span style="color:var(--red);">*</span>
                        <input type="text" name="administrator_name" value="{{ old('administrator_name', $d['administrator_name'] ?? '') }}" required>
                    </label>
                    <label>Administrator License #
                        <input type="text" name="administrator_license" value="{{ old('administrator_license', $d['administrator_license'] ?? '') }}">
                    </label>
                    <label>Medical Director Name
                        <input type="text" name="medical_director_name" value="{{ old('medical_director_name', $d['medical_director_name'] ?? '') }}">
                    </label>
                </div>

            {{-- ── Insurance ─────────────────────────────────────── --}}
            @elseif ($profile->business_type === 'insurance')
                <h3 style="margin:0 0 14px; font-size:15px;">Plan Types <span style="color:var(--red);">*</span></h3>
                <div class="care-level-grid" style="margin-bottom:20px;">
                    @foreach (['medicare_advantage'=>'Medicare Advantage','medicaid'=>'Medicaid / Managed Medicaid','commercial'=>'Commercial Insurance','medigap'=>'Medigap / Supplement','other'=>'Other'] as $val => $lbl)
                        <label class="care-level-card" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                            <input type="checkbox" name="plan_types[]" value="{{ $val }}" {{ in_array($val, $d['plan_types'] ?? []) ? 'checked' : '' }}>
                            <span>{{ $lbl }}</span>
                        </label>
                    @endforeach
                </div>
                <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                    <label style="grid-column:span 2;">States Covered (comma-separated 2-letter codes) <span style="color:var(--red);">*</span>
                        <input type="text" name="states_covered" value="{{ old('states_covered', implode(', ', $d['states_covered'] ?? [])) }}" placeholder="CO, CA, TX, FL">
                    </label>
                    <label>State License Number <span style="color:var(--red);">*</span>
                        <input type="text" name="state_license_number" value="{{ old('state_license_number', $d['state_license_number'] ?? '') }}" required>
                    </label>
                    <label>CMS Contract Number
                        <input type="text" name="cms_contract_number" value="{{ old('cms_contract_number', $d['cms_contract_number'] ?? '') }}" placeholder="H1234">
                    </label>
                    <label>NPI Number
                        <input type="text" name="npi_number" value="{{ old('npi_number', $d['npi_number'] ?? '') }}" maxlength="20">
                    </label>
                    <label>Estimated Members Covered
                        <input type="number" name="members_covered_estimate" value="{{ old('members_covered_estimate', $d['members_covered_estimate'] ?? '') }}" min="0">
                    </label>
                </div>

            {{-- ── Day Care ──────────────────────────────────────── --}}
            @elseif ($profile->business_type === 'day_care')
                <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                    <label>State License Number <span style="color:var(--red);">*</span>
                        <input type="text" name="state_license_number" value="{{ old('state_license_number', $d['state_license_number'] ?? '') }}" required>
                    </label>
                    <label>Daily Capacity <span style="color:var(--red);">*</span>
                        <input type="number" name="daily_capacity" value="{{ old('daily_capacity', $d['daily_capacity'] ?? '') }}" required min="1">
                    </label>
                    <label>Operating Hours <span style="color:var(--red);">*</span>
                        <input type="text" name="operating_hours" value="{{ old('operating_hours', $d['operating_hours'] ?? '') }}" required placeholder="Mon-Fri 7am-6pm">
                    </label>
                    <label>Administrator Name <span style="color:var(--red);">*</span>
                        <input type="text" name="administrator_name" value="{{ old('administrator_name', $d['administrator_name'] ?? '') }}" required>
                    </label>
                    <label style="grid-column:span 2;">Transportation Offered? <span style="color:var(--red);">*</span>
                        <select name="transportation_offered" required>
                            <option value="">Select…</option>
                            <option value="1" {{ ($d['transportation_offered'] ?? null) === true ? 'selected' : '' }}>Yes</option>
                            <option value="0" {{ ($d['transportation_offered'] ?? null) === false ? 'selected' : '' }}>No</option>
                        </select>
                    </label>
                </div>
                <h3 style="margin:20px 0 12px; font-size:15px;">Services Offered <span style="color:var(--red);">*</span></h3>
                <div class="care-level-grid">
                    @foreach (['Health Monitoring','Medication Management','Meals & Nutrition','Physical Therapy','Occupational Therapy','Social Activities','Memory Care Programs','Transportation','Personal Care'] as $svc)
                        <label class="care-level-card" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                            <input type="checkbox" name="services_offered[]" value="{{ $svc }}" {{ in_array($svc, $d['services_offered'] ?? []) ? 'checked' : '' }}>
                            <span style="font-size:13px;">{{ $svc }}</span>
                        </label>
                    @endforeach
                </div>

            {{-- ── Provider ──────────────────────────────────────── --}}
            @else
                <h3 style="margin:0 0 14px; font-size:15px;">Service Categories <span style="color:var(--red);">*</span></h3>
                <div class="care-level-grid" style="margin-bottom:20px;">
                    @foreach (['transportation'=>'Transportation / Rides','meals'=>'Meal Delivery','housekeeping'=>'Housekeeping','personal_care'=>'Personal Care','companionship'=>'Companionship','pharmacy'=>'Pharmacy / Medication','medical_equipment'=>'Medical Equipment','other'=>'Other'] as $val => $lbl)
                        <label class="care-level-card" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                            <input type="checkbox" name="service_categories[]" value="{{ $val }}" {{ in_array($val, $d['service_categories'] ?? []) ? 'checked' : '' }}>
                            <span>{{ $lbl }}</span>
                        </label>
                    @endforeach
                </div>
                <div class="form-grid" style="grid-template-columns:1fr 1fr; gap:14px;">
                    <label style="grid-column:span 2;">Service Area ZIP Codes <span style="color:var(--red);">*</span>
                        <input type="text" name="service_area_zip_codes" value="{{ old('service_area_zip_codes', $d['service_area_zip_codes'] ?? '') }}" required placeholder="80203, 80204, 80205">
                        <small style="color:var(--muted);">Comma-separated ZIP codes where you provide services</small>
                    </label>
                    <label>State License / Registration #
                        <input type="text" name="license_number" value="{{ old('license_number', $d['license_number'] ?? '') }}">
                    </label>
                    <label>Insurance Carrier <span style="color:var(--red);">*</span>
                        <input type="text" name="insurance_carrier" value="{{ old('insurance_carrier', $d['insurance_carrier'] ?? '') }}" required>
                    </label>
                    <label>Insurance Policy Number
                        <input type="text" name="insurance_policy_number" value="{{ old('insurance_policy_number', $d['insurance_policy_number'] ?? '') }}">
                    </label>
                    <label>Years in Operation
                        <input type="number" name="years_in_operation" value="{{ old('years_in_operation', $d['years_in_operation'] ?? '') }}" min="0">
                    </label>
                    <label style="grid-column:span 2;">Background Check Policy <span style="color:var(--red);">*</span>
                        <textarea name="background_check_policy" rows="3" required>{{ old('background_check_policy', $d['background_check_policy'] ?? '') }}</textarea>
                    </label>
                </div>
            @endif

            <div style="display:flex; justify-content:space-between; margin-top:28px;">
                <a href="{{ route('onboarding.step2', $profile) }}" class="secondary-link">← Back</a>
                <button type="submit" style="border:0; border-radius:8px; background:var(--blue); color:#fff; cursor:pointer; padding:12px 20px; font-weight:900;">Save & Continue →</button>
            </div>
        </form>
    </div>
</div>
</body>
</html>
