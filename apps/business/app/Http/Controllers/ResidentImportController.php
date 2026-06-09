<?php

namespace App\Http\Controllers;

use App\Models\BusinessOnboardingProfile;
use App\Services\ResidentInviteService;
use App\Services\SeniorLivingOnboardingService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ResidentImportController extends Controller
{
    public function __construct(
        private readonly SeniorLivingOnboardingService $onboarding,
        private readonly ResidentInviteService $inviteService,
    ) {
    }

    public function index(Request $request): View
    {
        $profile = $this->approvedProfile($request);

        $communities = DB::connection('shared_platform')
            ->table('senior_living_communities')
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'status', 'target_resident_count']);

        $batches = DB::connection('shared_platform')
            ->table('senior_living_resident_import_batches as b')
            ->join('senior_living_communities as c', 'c.id', '=', 'b.community_id')
            ->orderByDesc('b.created_at')
            ->limit(20)
            ->get(['b.*', 'c.name as community_name']);

        $recentBatches = $batches;
        return view('residents.import', compact('profile', 'communities', 'recentBatches'));
    }

    /**
     * Download CSV template for the given business type.
     */
    public function downloadTemplate(): Response
    {
        $headers = [
            'display_name',
            'care_level_code',
            'room_number',
            'age',
            'email',
            'phone',
            'external_reference',
            'mobility_notes',
            'cognitive_support',
        ];

        $examples = [
            ['Margaret Johnson', 'assisted_living', '101A', '82', 'margaret@example.com', '555-0101', 'EHR-001', '', ''],
            ['Robert Williams', 'independent_living', '202B', '74', 'robert@example.com', '555-0102', 'EHR-002', 'Walker', ''],
            ['Dorothy Smith', 'memory_care', '303C', '88', 'dorothy@example.com', '555-0103', 'EHR-003', '', 'Mild cognitive impairment'],
        ];

        $csv = implode(',', $headers) . "\n";
        foreach ($examples as $row) {
            $csv .= implode(',', array_map(fn ($v) => '"' . str_replace('"', '""', $v) . '"', $row)) . "\n";
        }

        return response($csv, 200, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="tsg-resident-import-template.csv"',
        ]);
    }

    /**
     * Handle CSV file upload and import.
     */
    public function uploadCsv(Request $request): RedirectResponse
    {
        $this->approvedProfile($request);

        $request->validate([
            'community_id' => ['required', 'string'],
            'csv_file'     => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $communityId = $request->community_id;

        // Verify community exists
        $community = DB::connection('shared_platform')
            ->table('senior_living_communities')
            ->where('id', $communityId)
            ->first();

        if (! $community) {
            return back()->withErrors(['community_id' => 'Community not found.']);
        }

        // Parse CSV
        $file    = $request->file('csv_file');
        $handle  = fopen($file->getRealPath(), 'r');
        $headers = fgetcsv($handle);

        if ($headers === false) {
            return back()->withErrors(['csv_file' => 'CSV file is empty or unreadable.']);
        }

        $headers  = array_map('trim', $headers);
        $rows     = [];
        $errors   = [];
        $lineNum  = 1;
        $required = ['display_name', 'care_level_code'];

        // Validate headers
        foreach ($required as $req) {
            if (! in_array($req, $headers)) {
                fclose($handle);

                return back()->withErrors(['csv_file' => "CSV is missing required column: {$req}. Download the template for the correct format."]);
            }
        }

        while (($values = fgetcsv($handle)) !== false) {
            $lineNum++;
            if ($values === [null] || implode('', $values) === '') {
                continue;
            }

            $row = [];
            foreach ($headers as $i => $header) {
                $val = trim($values[$i] ?? '');
                $row[$header] = $val !== '' ? $val : null;
            }

            // Per-row validation
            if (empty($row['display_name'])) {
                $errors[] = "Row {$lineNum}: display_name is required.";
            }

            $validCareLevels = ['assisted_living', 'independent_living', 'memory_care'];
            if (! in_array($row['care_level_code'] ?? '', $validCareLevels)) {
                $errors[] = "Row {$lineNum}: care_level_code must be one of: " . implode(', ', $validCareLevels) . ". Got: " . ($row['care_level_code'] ?? 'empty');
            }

            if (! empty($row['email']) && ! filter_var($row['email'], FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Row {$lineNum}: email '{$row['email']}' is not valid.";
            }

            if (! empty($row['age'])) {
                $age = (int) $row['age'];
                if ($age < 0 || $age > 125) {
                    $errors[] = "Row {$lineNum}: age must be between 0 and 125.";
                }

                $row['age'] = $age;
            }

            $rows[] = $row;
        }

        fclose($handle);

        if (! empty($errors)) {
            return back()
                ->withErrors(['csv_file' => 'CSV has validation errors. Fix them and re-upload.'])
                ->with('csv_errors', $errors)
                ->withInput();
        }

        if (empty($rows)) {
            return back()->withErrors(['csv_file' => 'CSV has no data rows.']);
        }

        // Import
        try {
            $result = $this->onboarding->importResidents(
                communityId: $communityId,
                rows: $rows,
                actorId: $request->user()?->id,
                idempotencyKey: 'csv-' . sha1($communityId . '|' . md5_file($file->getRealPath())),
            );

            // Auto-generate invites
            $inviteResult = $this->inviteService->generateForBatch(
                communityId: $communityId,
                importBatchId: $result['id'],
                businessProfileId: null,
            );

            return redirect()
                ->route('residents.import')
                ->with('status', sprintf(
                    'Imported %d residents into %s. %d invite records created — go to Resident Invites to send them.',
                    $result['accepted_count'],
                    $community->name,
                    $inviteResult['created'],
                ));
        } catch (ValidationException $e) {
            return back()->withErrors($e->errors())->withInput();
        }
    }

    private function approvedProfile(Request $request): BusinessOnboardingProfile
    {
        $profile = BusinessOnboardingProfile::where('user_id', $request->user()->id)
            ->where('status', 'approved')
            ->latest('approved_at')
            ->first();

        // Super admins bypass requirement
        if (! $profile && $request->user()->isSuperAdmin()) {
            return new BusinessOnboardingProfile(['status' => 'approved', 'business_type' => 'senior_living']);
        }

        if (! $profile) {
            abort(redirect()->route('command-center')->with('error', 'Your business must be approved before importing residents.'));
        }

        return $profile;
    }
}
