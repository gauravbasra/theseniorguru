<?php

namespace App\Http\Controllers;

use App\Models\BusinessOnboardingProfile;
use App\Models\BusinessVerificationDocument;
use App\Models\HipaaAgreement;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OnboardingWizardController extends Controller
{
    // ─── Entry: redirect to existing draft or step1 ──────────────────────────

    public function start(Request $request): RedirectResponse
    {
        $existing = BusinessOnboardingProfile::where('user_id', $request->user()->id)
            ->whereIn('status', ['draft', 'submitted', 'under_review'])
            ->latest()
            ->first();

        if ($existing) {
            if ($existing->status !== 'draft') {
                return redirect()->route('onboarding.pending', ['profile' => $existing->id]);
            }
            $nextStep = $existing->step_completed + 1;
            $nextStep = min($nextStep, 6);
            if ($nextStep <= 1) {
                return redirect()->route('onboarding.step1');
            }
            return redirect()->route('onboarding.step' . $nextStep, ['profile' => $existing->id]);
        }

        return redirect()->route('onboarding.step1');
    }

    // ─── Step 1: Business Type ────────────────────────────────────────────────

    public function step1(): View
    {
        return view('onboarding.step1-type', [
            'types' => BusinessOnboardingProfile::TYPES,
        ]);
    }

    public function step1Post(Request $request): RedirectResponse
    {
        $request->validate([
            'business_type' => ['required', 'in:' . implode(',', array_keys(BusinessOnboardingProfile::TYPES))],
            'company_name'  => ['required', 'string', 'max:180'],
        ]);

        $profile = BusinessOnboardingProfile::updateOrCreate(
            ['user_id' => $request->user()->id, 'status' => 'draft'],
            [
                'business_type' => $request->business_type,
                'company_name'  => $request->company_name,
                'step_completed' => max(1, $this->getProfile($request)?->step_completed ?? 0),
            ]
        );

        return redirect()->route('onboarding.step2', ['profile' => $profile->id]);
    }

    // ─── Step 2: Business Profile ─────────────────────────────────────────────

    public function step2(Request $request, string $profile): View
    {
        $profile = $this->authorizeProfile($request, $profile);

        return view('onboarding.step2-profile', compact('profile'));
    }

    public function step2Post(Request $request, string $profile): RedirectResponse
    {
        $profile = $this->authorizeProfile($request, $profile);

        $validated = $request->validate([
            'legal_name'            => ['nullable', 'string', 'max:180'],
            'ein_tax_id'            => ['nullable', 'string', 'max:20', 'regex:/^\d{2}-\d{7}$/'],
            'website'               => ['nullable', 'url', 'max:180'],
            'phone'                 => ['required', 'string', 'max:40'],
            'address_line1'         => ['required', 'string', 'max:180'],
            'address_line2'         => ['nullable', 'string', 'max:180'],
            'city'                  => ['required', 'string', 'max:100'],
            'state'                 => ['required', 'string', 'max:60'],
            'postal_code'           => ['required', 'string', 'max:20'],
            'primary_contact_name'  => ['required', 'string', 'max:180'],
            'primary_contact_title' => ['required', 'string', 'max:120'],
            'primary_contact_email' => ['required', 'email', 'max:180'],
            'primary_contact_phone' => ['required', 'string', 'max:40'],
        ]);

        $profile->update(array_merge($validated, [
            'step_completed' => max(2, $profile->step_completed),
        ]));

        return redirect()->route('onboarding.step3', ['profile' => $profile->id]);
    }

    // ─── Step 3: Type-specific Details ───────────────────────────────────────

    public function step3(Request $request, string $profile): View
    {
        $profile = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 2);

        return view('onboarding.step3-details', compact('profile'));
    }

    public function step3Post(Request $request, string $profile): RedirectResponse
    {
        $profile = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 2);

        $rules = $this->typeDetailRules($profile->business_type);
        $validated = $request->validate($rules);

        $profile->update([
            'type_details'   => $validated,
            'step_completed' => max(3, $profile->step_completed),
        ]);

        return redirect()->route('onboarding.step4', ['profile' => $profile->id]);
    }

    // ─── Step 4: HIPAA BAA ────────────────────────────────────────────────────

    public function step4(Request $request, string $profile): View
    {
        $profile = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 3);
        $existing = $profile->hipaaAgreement;

        return view('onboarding.step4-hipaa', compact('profile', 'existing'));
    }

    public function step4Post(Request $request, string $profile): RedirectResponse
    {
        $profile = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 3);

        $request->validate([
            'signatory_name'               => ['required', 'string', 'max:180'],
            'signatory_title'              => ['required', 'string', 'max:120'],
            'signatory_email'              => ['required', 'email', 'max:180'],
            'baa_accepted'                 => ['required', 'accepted'],
            'data_use_accepted'            => ['required', 'accepted'],
            'phi_handling_accepted'        => ['required', 'accepted'],
            'breach_notification_accepted' => ['required', 'accepted'],
        ]);

        HipaaAgreement::updateOrCreate(
            ['business_profile_id' => $profile->id],
            [
                'user_id'                      => $request->user()->id,
                'agreed_at'                    => now(),
                'ip_address'                   => $request->ip(),
                'user_agent'                   => $request->userAgent(),
                'agreement_version'            => '1.0',
                'signatory_name'               => $request->signatory_name,
                'signatory_title'              => $request->signatory_title,
                'signatory_email'              => $request->signatory_email,
                'baa_accepted'                 => true,
                'data_use_accepted'            => true,
                'phi_handling_accepted'        => true,
                'breach_notification_accepted' => true,
            ]
        );

        $profile->update(['step_completed' => max(4, $profile->step_completed)]);

        DB::connection('shared_platform')->table('audit_logs')->insert([
            'entity_type' => 'business_onboarding_profile',
            'entity_id'   => $profile->id,
            'action'      => 'hipaa_baa.signed',
            'severity'    => 'info',
            'metadata'    => json_encode([
                'signatory_name'  => $request->signatory_name,
                'signatory_email' => $request->signatory_email,
                'ip_address'      => $request->ip(),
                'agreed_at'       => now()->toIso8601String(),
                'version'         => '1.0',
            ]),
            'created_at' => now(),
        ]);

        return redirect()->route('onboarding.step5', ['profile' => $profile->id]);
    }

    // ─── Step 5: Documents ────────────────────────────────────────────────────

    public function step5(Request $request, string $profile): View
    {
        $profile   = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 4);
        $documents = $profile->documents()->get();
        $required  = $profile->requiredDocuments();

        return view('onboarding.step5-documents', compact('profile', 'documents', 'required'));
    }

    public function step5Post(Request $request, string $profile): RedirectResponse
    {
        $profile = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 4);

        $request->validate([
            'document_type'   => ['required', 'in:' . implode(',', array_keys(BusinessVerificationDocument::TYPES))],
            'document_file'   => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ]);

        $file = $request->file('document_file');
        // Store locally for now; swap to S3 in production
        $path = $file->store('business-documents/' . $profile->id, 'local');

        BusinessVerificationDocument::create([
            'business_profile_id' => $profile->id,
            'uploaded_by'         => $request->user()->id,
            'document_type'       => $request->document_type,
            'document_label'      => BusinessVerificationDocument::TYPES[$request->document_type] ?? $request->document_type,
            'file_name'           => $file->getClientOriginalName(),
            'file_path'           => $path,
            'mime_type'           => $file->getMimeType(),
            'file_size_bytes'     => $file->getSize(),
            'status'              => 'pending',
        ]);

        $profile->update(['step_completed' => max(5, $profile->step_completed)]);

        return redirect()
            ->route('onboarding.step5', ['profile' => $profile->id])
            ->with('status', 'Document uploaded successfully.');
    }

    public function step5Skip(Request $request, string $profile): RedirectResponse
    {
        $profile = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 4);
        $profile->update(['step_completed' => max(5, $profile->step_completed)]);

        return redirect()->route('onboarding.step6', ['profile' => $profile->id]);
    }

    // ─── Step 6: Review & Submit ──────────────────────────────────────────────

    public function step6(Request $request, string $profile): View
    {
        $profile   = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 5);
        $hipaa     = $profile->hipaaAgreement;
        $documents = $profile->documents()->get();

        return view('onboarding.step6-review', compact('profile', 'hipaa', 'documents'));
    }

    public function submit(Request $request, string $profile): RedirectResponse
    {
        $profile = $this->authorizeProfile($request, $profile);
        $this->requireStep($profile, 5);

        if ($profile->status !== 'draft') {
            return redirect()->route('onboarding.pending', ['profile' => $profile->id]);
        }

        $profile->update([
            'status'         => 'submitted',
            'submitted_at'   => now(),
            'step_completed' => 6,
        ]);

        DB::connection('shared_platform')->table('audit_logs')->insert([
            'entity_type' => 'business_onboarding_profile',
            'entity_id'   => $profile->id,
            'action'      => 'business.onboarding.submitted',
            'severity'    => 'info',
            'metadata'    => json_encode([
                'business_type' => $profile->business_type,
                'company_name'  => $profile->company_name,
                'submitted_by'  => $request->user()->id,
                'submitted_at'  => now()->toIso8601String(),
            ]),
            'created_at' => now(),
        ]);

        return redirect()->route('onboarding.pending', ['profile' => $profile->id])
            ->with('status', 'Application submitted! Our team will review and respond within 1-2 business days.');
    }

    // ─── Pending / Waiting page ───────────────────────────────────────────────

    public function pending(Request $request, string $profile): View
    {
        $profile = $this->authorizeProfile($request, $profile);

        return view('onboarding.pending', compact('profile'));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function authorizeProfile(Request $request, string $profileId): BusinessOnboardingProfile
    {
        $profile = BusinessOnboardingProfile::where('id', $profileId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        return $profile;
    }

    private function getProfile(Request $request): ?BusinessOnboardingProfile
    {
        return BusinessOnboardingProfile::where('user_id', $request->user()->id)
            ->where('status', 'draft')
            ->latest()
            ->first();
    }

    private function requireStep(BusinessOnboardingProfile $profile, int $step): void
    {
        if ($profile->step_completed < $step) {
            abort(redirect()->route('onboarding.step' . $step, ['profile' => $profile->id]));
        }
    }

    /**
     * @return array<string,mixed>
     */
    private function typeDetailRules(string $type): array
    {
        return match ($type) {
            'senior_living' => [
                'care_types'              => ['required', 'array', 'min:1'],
                'care_types.*'            => ['string', 'in:independent_living,assisted_living,memory_care,ccrc,hospice'],
                'total_units'             => ['required', 'integer', 'min:1', 'max:2000'],
                'state_license_number'    => ['required', 'string', 'max:80'],
                'medicare_provider_number'=> ['nullable', 'string', 'max:80'],
                'administrator_name'      => ['required', 'string', 'max:180'],
                'administrator_license'   => ['nullable', 'string', 'max:80'],
                'medical_director_name'   => ['nullable', 'string', 'max:180'],
                'year_established'        => ['nullable', 'integer', 'min:1800', 'max:' . date('Y')],
            ],
            'insurance' => [
                'plan_types'              => ['required', 'array', 'min:1'],
                'plan_types.*'            => ['string', 'in:medicare_advantage,medicaid,commercial,medigap,other'],
                'states_covered'          => ['required', 'array', 'min:1'],
                'states_covered.*'        => ['string', 'size:2'],
                'cms_contract_number'     => ['nullable', 'string', 'max:80'],
                'npi_number'              => ['nullable', 'string', 'max:20'],
                'state_license_number'    => ['required', 'string', 'max:80'],
                'members_covered_estimate'=> ['nullable', 'integer', 'min:0'],
            ],
            'day_care' => [
                'state_license_number'    => ['required', 'string', 'max:80'],
                'daily_capacity'          => ['required', 'integer', 'min:1', 'max:500'],
                'operating_hours'         => ['required', 'string', 'max:180'],
                'transportation_offered'  => ['required', 'boolean'],
                'services_offered'        => ['required', 'array', 'min:1'],
                'services_offered.*'      => ['string'],
                'administrator_name'      => ['required', 'string', 'max:180'],
            ],
            'provider' => [
                'service_categories'      => ['required', 'array', 'min:1'],
                'service_categories.*'    => ['string', 'in:transportation,meals,housekeeping,personal_care,companionship,pharmacy,medical_equipment,other'],
                'service_area_zip_codes'  => ['required', 'string'],
                'license_number'          => ['nullable', 'string', 'max:80'],
                'insurance_carrier'       => ['required', 'string', 'max:180'],
                'insurance_policy_number' => ['nullable', 'string', 'max:80'],
                'background_check_policy' => ['required', 'string', 'max:500'],
                'years_in_operation'      => ['nullable', 'integer', 'min:0', 'max:200'],
            ],
            default => [],
        };
    }
}
