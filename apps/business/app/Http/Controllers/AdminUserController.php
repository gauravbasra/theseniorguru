<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function index(): View
    {
        return view('admin.users', [
            'pendingUsers' => User::query()
                ->where('approval_status', 'pending')
                ->orderBy('created_at')
                ->get(),
            'approvedUsers' => User::query()
                ->where('approval_status', 'approved')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function decide(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
        ]);

        if ($data['decision'] === 'approve') {
            $user->forceFill([
                'approval_status' => 'approved',
                'approved_at' => now(),
                'approved_by' => $request->user()->id,
            ])->save();

            return redirect()
                ->route('admin.users.index')
                ->with('status', "{$user->name} approved.");
        }

        $user->forceFill([
            'approval_status' => 'rejected',
            'approved_at' => null,
            'approved_by' => $request->user()->id,
        ])->save();

        return redirect()
            ->route('admin.users.index')
            ->with('status', "{$user->name} rejected.");
    }
}
