<?php

namespace App\Http\Controllers;

use App\Models\BusinessOnboardingProfile;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BusinessApprovalController extends Controller
{
    public function index(): View
    {
        $pending = BusinessOnboardingProfile::whereIn('status', ['submitted', 'under_review'])
            ->with(['hipaaAgreement', 'documents'])
            ->orderBy('submitted_at')
            ->paginate(25);

        $recent = BusinessOnboardingProfile::whereIn('status', ['approved', 'rejected'])
            ->orderByDesc('updated_at')
            ->limit(20)
            ->get();

        $counts = BusinessOnboardingProfile::selectRaw('status, count(*) as cnt')
            ->groupBy('status')
            ->pluck('cnt', 'status');

        return view('admin.approvals', compact('pending', 'recent', 'counts'));
    }

    public function show(string $profile): View
    {
        $profile = BusinessOnboardingProfile::with(['hipaaAgreement', 'documents'])->findOrFail($profile);

        return view('admin.approval-detail', compact('profile'));
    }

    public function markUnderReview(Request $request, string $profile): RedirectResponse
    {
        $profile = BusinessOnboardingProfile::findOrFail($profile);

        if ($profile->status !== 'submitted') {
            return back()->with('error', 'Application is not in submitted state.');
        }

        $profile->update([
            'status'      => 'under_review',
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()->id,
        ]);

        $this->audit($profile, 'business.onboarding.under_review', $request->user()->id);

        return back()->with('status', 'Application marked as under review.');
    }

    public function approve(Request $request, string $profile): RedirectResponse
    {
        $profile = BusinessOnboardingProfile::findOrFail($profile);

        $request->validate([
            'review_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $profile->update([
            'status'       => 'approved',
            'approved_at'  => now(),
            'reviewed_by'  => $request->user()->id,
            'review_notes' => $request->review_notes,
        ]);

        // Create tenant entry in shared DB for this business
        $this->provisionTenant($profile);

        $this->audit($profile, 'business.onboarding.approved', $request->user()->id, [
            'review_notes' => $request->review_notes,
        ]);

        return redirect()
            ->route('admin.approvals')
            ->with('status', "{$profile->company_name} has been approved and provisioned.");
    }

    public function reject(Request $request, string $profile): RedirectResponse
    {
        $profile = BusinessOnboardingProfile::findOrFail($profile);

        $request->validate([
            'rejection_reason' => ['required', 'string', 'max:2000'],
        ]);

        $profile->update([
            'status'           => 'rejected',
            'rejected_at'      => now(),
            'reviewed_by'      => $request->user()->id,
            'review_notes'     => $request->review_notes,
            'rejection_reason' => $request->rejection_reason,
        ]);

        $this->audit($profile, 'business.onboarding.rejected', $request->user()->id, [
            'rejection_reason' => $request->rejection_reason,
        ]);

        return redirect()
            ->route('admin.approvals')
            ->with('status', "{$profile->company_name} has been rejected.");
    }

    private function provisionTenant(BusinessOnboardingProfile $profile): void
    {
        $tenantType = match ($profile->business_type) {
            'senior_living' => 'community',
            'insurance'     => 'insurance',
            'day_care'      => 'day_care',
            'provider'      => 'provider',
            default         => 'provider',
        };

        $existing = DB::connection('shared_platform')
            ->table('tenants')
            ->where('name', $profile->company_name)
            ->whereJsonContains('settings->business_profile_id', $profile->id)
            ->first();

        if ($existing) {
            return;
        }

        $tenantId = DB::connection('shared_platform')->table('tenants')->insertGetId([
            'name'        => $profile->company_name,
            'tenant_type' => $tenantType,
            'status'      => 'active',
            'settings'    => json_encode([
                'business_profile_id' => $profile->id,
                'business_type'       => $profile->business_type,
                'provisioned_at'      => now()->toIso8601String(),
                'contact_email'       => $profile->primary_contact_email,
                'type_details'        => $profile->type_details,
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ], 'id');

        DB::connection('shared_platform')->table('tenant_locations')->insert([
            'tenant_id'    => $tenantId,
            'name'         => $profile->company_name,
            'address_line1'=> $profile->address_line1,
            'city'         => $profile->city,
            'state'        => $profile->state,
            'postal_code'  => $profile->postal_code,
            'timezone'     => 'America/Denver',
            'metadata'     => json_encode(['business_profile_id' => $profile->id]),
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);
    }

    private function audit(BusinessOnboardingProfile $profile, string $action, string $actorId, array $extra = []): void
    {
        DB::connection('shared_platform')->table('audit_logs')->insert([
            'entity_type' => 'business_onboarding_profile',
            'entity_id'   => $profile->id,
            'action'      => $action,
            'severity'    => 'info',
            'metadata'    => json_encode(array_merge([
                'company_name'   => $profile->company_name,
                'business_type'  => $profile->business_type,
                'actor_id'       => $actorId,
                'timestamp'      => now()->toIso8601String(),
            ], $extra)),
            'created_at' => now(),
        ]);
    }
}
