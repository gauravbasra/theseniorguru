<?php

namespace App\Http\Controllers;

use App\Services\SeniorLivingOnboardingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class BusinessOnboardingApiController extends Controller
{
    public function __construct(private readonly SeniorLivingOnboardingService $onboarding)
    {
    }

    public function storeCommunity(Request $request): JsonResponse
    {
        try {
            $community = $this->onboarding->createCommunity($request->all(), $request->user()?->id);
        } catch (Throwable $exception) {
            Log::error('Senior living community onboarding failed.', [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            throw $exception;
        }

        return response()->json(['community' => $community], 201);
    }

    public function diagnostics(): JsonResponse
    {
        $config = config('database.connections.shared_platform');

        try {
            $database = DB::connection('shared_platform')
                ->selectOne('select current_database() as database_name, current_user as user_name');

            return response()->json([
                'shared_platform' => [
                    'ok' => true,
                    'driver' => $config['driver'] ?? null,
                    'host' => $config['host'] ?? null,
                    'database' => $database->database_name ?? null,
                    'user' => $database->user_name ?? null,
                    'sslmode' => $config['sslmode'] ?? null,
                    'neon_endpoint_configured' => ! empty($config['neon_endpoint']),
                    'url_configured' => ! empty($config['url']),
                ],
            ]);
        } catch (Throwable $exception) {
            return response()->json([
                'shared_platform' => [
                    'ok' => false,
                    'driver' => $config['driver'] ?? null,
                    'host' => $config['host'] ?? null,
                    'database' => $config['database'] ?? null,
                    'sslmode' => $config['sslmode'] ?? null,
                    'neon_endpoint_configured' => ! empty($config['neon_endpoint']),
                    'url_configured' => ! empty($config['url']),
                    'exception' => $exception::class,
                    'message' => $exception->getMessage(),
                ],
            ], 500);
        }
    }

    public function showCommunity(string $community): JsonResponse
    {
        return response()->json([
            'community' => $this->onboarding->communitySummary($community),
        ]);
    }

    public function importResidents(Request $request, string $community): JsonResponse
    {
        try {
            $result = $this->onboarding->importResidents(
                $community,
                $request->input('residents', []),
                $request->user()?->id,
                $request->header('Idempotency-Key')
            );
        } catch (Throwable $exception) {
            Log::error('Senior living resident import failed.', [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'community_id' => $community,
            ]);

            throw $exception;
        }

        return response()->json(['import' => $result], 201);
    }

}
