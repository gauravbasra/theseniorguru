<?php

namespace App\Http\Controllers;

use App\Services\SeniorLivingOnboardingService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class BusinessOnboardingController extends Controller
{
    public function __construct(private readonly SeniorLivingOnboardingService $onboarding)
    {
    }

    public function seniorLiving(): View
    {
        return view('business.onboarding.senior-living', [
            'careLevels' => $this->careLevelDefaults(),
        ]);
    }

    public function storeSeniorLiving(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'address' => ['nullable', 'string', 'max:500'],
            'contact_name' => ['nullable', 'string', 'max:180'],
            'contact_email' => ['nullable', 'email', 'max:180'],
            'contact_phone' => ['nullable', 'string', 'max:40'],
            'assisted_living_target' => ['required', 'integer', 'min:1', 'max:500'],
            'independent_living_target' => ['required', 'integer', 'min:1', 'max:500'],
            'memory_care_target' => ['required', 'integer', 'min:1', 'max:500'],
            'resident_import' => ['required', 'string'],
        ]);

        $rows = $this->parseResidentImport($validated['resident_import']);

        $community = $this->onboarding->createCommunity([
            'name' => $validated['name'],
            'address' => $validated['address'] ?? null,
            'contact_name' => $validated['contact_name'] ?? null,
            'contact_email' => $validated['contact_email'] ?? null,
            'contact_phone' => $validated['contact_phone'] ?? null,
            'care_levels' => [
                [
                    'code' => 'assisted_living',
                    'display_name' => 'Assisted Living',
                    'target_resident_count' => (int) $validated['assisted_living_target'],
                ],
                [
                    'code' => 'independent_living',
                    'display_name' => 'Independent Living',
                    'target_resident_count' => (int) $validated['independent_living_target'],
                ],
                [
                    'code' => 'memory_care',
                    'display_name' => 'Memory Care',
                    'target_resident_count' => (int) $validated['memory_care_target'],
                ],
            ],
        ], $request->user()?->id);

        $import = $this->onboarding->importResidents(
            $community['id'],
            $rows,
            $request->user()?->id,
            'portal-'.sha1($community['id'].'|'.$validated['resident_import'])
        );

        return redirect()
            ->route('command-center')
            ->with('status', sprintf(
                'Onboarded %s and imported %d residents into shared PostgreSQL.',
                $community['name'],
                (int) Arr::get($import, 'accepted_count', count($rows))
            ));
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function parseResidentImport(string $input): array
    {
        $trimmed = trim($input);
        if ($trimmed === '') {
            throw ValidationException::withMessages(['resident_import' => 'Resident import is required.']);
        }

        if (str_starts_with($trimmed, '[')) {
            $decoded = json_decode($trimmed, true);
            if (! is_array($decoded)) {
                throw ValidationException::withMessages(['resident_import' => 'Resident JSON could not be parsed.']);
            }

            return $decoded;
        }

        return $this->parseCsvResidentImport($trimmed);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function parseCsvResidentImport(string $csv): array
    {
        $handle = fopen('php://temp', 'r+');
        fwrite($handle, $csv);
        rewind($handle);

        $headers = fgetcsv($handle);
        if ($headers === false) {
            throw ValidationException::withMessages(['resident_import' => 'CSV header row is required.']);
        }

        $headers = array_map(fn (string $header): string => trim($header), $headers);
        $rows = [];

        while (($values = fgetcsv($handle)) !== false) {
            if ($values === [null] || implode('', $values) === '') {
                continue;
            }

            $row = [];
            foreach ($headers as $index => $header) {
                $value = $values[$index] ?? null;
                $row[$header] = is_string($value) && trim($value) !== '' ? trim($value) : null;
            }

            if (isset($row['age']) && $row['age'] !== null) {
                $row['age'] = (int) $row['age'];
            }

            $rows[] = array_filter($row, fn ($value): bool => $value !== null);
        }

        fclose($handle);

        if ($rows === []) {
            throw ValidationException::withMessages(['resident_import' => 'At least one resident row is required.']);
        }

        return $rows;
    }

    /**
     * @return array<int,array{code:string,label:string,target:int}>
     */
    private function careLevelDefaults(): array
    {
        return [
            ['code' => 'assisted_living', 'label' => 'Assisted Living', 'target' => 50],
            ['code' => 'independent_living', 'label' => 'Independent Living', 'target' => 50],
            ['code' => 'memory_care', 'label' => 'Memory Care', 'target' => 50],
        ];
    }
}
