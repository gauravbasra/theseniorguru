<?php

namespace App\Http\Controllers;

use App\Models\ResidentMobileInvite;
use App\Services\ResidentInviteService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ResidentInviteController extends Controller
{
    public function __construct(private readonly ResidentInviteService $inviteService)
    {
    }

    public function index(Request $request): View
    {
        $communityId = $request->query('community_id');

        $query = ResidentMobileInvite::orderByDesc('created_at');

        if ($communityId) {
            $query->where('community_id', $communityId);
        }

        $invites = $query->paginate(50);

        $communities = DB::connection('shared_platform')
            ->table('senior_living_communities')
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name']);

        // Summary stats
        $summaryQuery = ResidentMobileInvite::when($communityId, fn ($q) => $q->where('community_id', $communityId));
        $summary = [
            'total'     => (clone $summaryQuery)->count(),
            'sent'      => (clone $summaryQuery)->where('status', 'sent')->count(),
            'opened'    => (clone $summaryQuery)->where('status', 'opened')->count(),
            'onboarded' => (clone $summaryQuery)->where('status', 'onboarded')->count(),
            'failed'    => (clone $summaryQuery)->where('status', 'failed')->count(),
        ];
        $pendingCount = (clone $summaryQuery)->whereIn('status', ['pending', 'failed'])->count();

        // Filter by status if requested
        if ($request->query('status') && $request->query('status') !== 'all') {
            $query->where('status', $request->query('status'));
        }
        // Rebuild $invites after status filter
        $invites = $query->paginate(50);

        return view('residents.invites', compact('invites', 'communities', 'summary', 'pendingCount', 'communityId'));
    }

    public function sendAll(Request $request): RedirectResponse
    {
        $request->validate([
            'batch_id' => ['nullable', 'string'],
        ]);

        $batchId = $request->batch_id ?? $request->import_batch_id;
        if (!$batchId) {
            return back()->with('error', 'No batch specified.');
        }
        $result = $this->inviteService->sendBatch($batchId);

        return redirect()
            ->route('residents.invites')
            ->with('status', "Invites sent: {$result['sent']} emailed, {$result['failed']} failed, {$result['skipped']} skipped (no contact info).");
    }

    public function resend(Request $request, string $invite): RedirectResponse
    {
        $invite = ResidentMobileInvite::findOrFail($invite);

        if (! $invite->canResend()) {
            return back()->with('error', 'This invite cannot be resent (max attempts reached or already onboarded).');
        }

        // Regenerate password if already cleared
        if (! $invite->temp_password_plain) {
            $invite->update(['temp_password_plain' => null]); // handled in sendEmail
        }

        $ok = $this->inviteService->sendEmail($invite->fresh());

        return back()->with('status', $ok ? 'Invite resent successfully.' : 'Failed to resend — check mail config.');
    }

    public function markOnboarded(Request $request, string $invite): RedirectResponse
    {
        $invite = ResidentMobileInvite::findOrFail($invite);
        $invite->update(['status' => 'onboarded', 'onboarded_at' => now()]);

        // Clear temp credentials from shared users table
        DB::connection('shared_platform')
            ->table('users')
            ->join('residents', 'residents.user_id', '=', 'users.id')
            ->where('residents.id', $invite->resident_id)
            ->update([
                'users.temp_login_username'     => null,
                'users.password_reset_required' => false,
                'users.updated_at'              => now(),
            ]);

        return back()->with('status', 'Resident marked as onboarded and temp credentials cleared.');
    }
}
