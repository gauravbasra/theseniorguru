<?php

// TEMP DEBUG ROUTE — remove after diagnosis
Route::get('/_debug', function () {
    try {
        $conn = config('database.default');
        $host = config("database.connections.{$conn}.host");
        $tableExists = \Illuminate\Support\Facades\Schema::hasTable('business_portal_users');
        $userCount = $tableExists ? \Illuminate\Support\Facades\DB::table('business_portal_users')->count() : 0;
        return response()->json([
            'connection' => $conn,
            'host' => $host,
            'business_portal_users_exists' => $tableExists,
            'user_count' => $userCount,
            'php' => PHP_VERSION,
        ]);
    } catch (\Throwable $e) {
        return response()->json(['error' => $e->getMessage(), 'class' => get_class($e)]);
    }
});

use App\Http\Controllers\BusinessPortalController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BusinessOnboardingController;
use App\Http\Controllers\BusinessOnboardingApiController;
use App\Http\Controllers\BusinessPortalApiController;
use App\Http\Controllers\OnboardingWizardController;
use App\Http\Controllers\ResidentImportController;
use App\Http\Controllers\ResidentInviteController;
use App\Http\Controllers\BusinessApprovalController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthController::class, 'login'])->name('login');
    Route::post('/login', [AuthController::class, 'authenticate'])->name('login.store');
    Route::get('/signup', [AuthController::class, 'signup'])->name('signup');
    Route::post('/signup', [AuthController::class, 'storeSignup'])->name('signup.store');
});

Route::middleware('auth')->group(function (): void {
    Route::get('/approval-pending', [AuthController::class, 'pending'])->name('approval.pending');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    // ── Onboarding Wizard (no 'approved' gate — this IS how you get approved) ──
    Route::get('/onboarding', [OnboardingWizardController::class, 'start'])->name('onboarding.start');
    Route::get('/onboarding/step1', [OnboardingWizardController::class, 'step1'])->name('onboarding.step1');
    Route::post('/onboarding/step1', [OnboardingWizardController::class, 'step1Post'])->name('onboarding.step1.post');
    Route::get('/onboarding/{profile}/step2', [OnboardingWizardController::class, 'step2'])->name('onboarding.step2');
    Route::post('/onboarding/{profile}/step2', [OnboardingWizardController::class, 'step2Post'])->name('onboarding.step2.post');
    Route::get('/onboarding/{profile}/step3', [OnboardingWizardController::class, 'step3'])->name('onboarding.step3');
    Route::post('/onboarding/{profile}/step3', [OnboardingWizardController::class, 'step3Post'])->name('onboarding.step3.post');
    Route::get('/onboarding/{profile}/step4', [OnboardingWizardController::class, 'step4'])->name('onboarding.step4');
    Route::post('/onboarding/{profile}/step4', [OnboardingWizardController::class, 'step4Post'])->name('onboarding.step4.post');
    Route::get('/onboarding/{profile}/step5', [OnboardingWizardController::class, 'step5'])->name('onboarding.step5');
    Route::post('/onboarding/{profile}/step5', [OnboardingWizardController::class, 'step5Post'])->name('onboarding.step5.post');
    Route::get('/onboarding/{profile}/step5/skip', [OnboardingWizardController::class, 'step5Skip'])->name('onboarding.step5.skip');
    Route::get('/onboarding/{profile}/step6', [OnboardingWizardController::class, 'step6'])->name('onboarding.step6');
    Route::post('/onboarding/{profile}/submit', [OnboardingWizardController::class, 'submit'])->name('onboarding.submit');
    Route::get('/onboarding/{profile}/pending', [OnboardingWizardController::class, 'pending'])->name('onboarding.pending');

    Route::middleware('approved')->group(function (): void {
        Route::get('/', [BusinessPortalController::class, 'commandCenter'])->name('command-center');
        Route::get('/residents', [BusinessPortalController::class, 'residents'])->name('business.residents.index');
        Route::get('/residents/{resident}', [BusinessPortalController::class, 'residentProfile'])->name('business.residents.profile');
        Route::get('/alerts', [BusinessPortalController::class, 'alerts'])->name('business.alerts.index');
        Route::post('/alerts/{alert}/triage', [BusinessPortalController::class, 'triageAlert'])->name('business.alerts.triage');
        Route::get('/guru', [BusinessPortalController::class, 'guru'])->name('business.guru.index');
        Route::get('/vitals', [BusinessPortalController::class, 'vitals'])->name('business.vitals.index');
        Route::get('/medication', [BusinessPortalController::class, 'medication'])->name('business.medication.index');
        Route::get('/requests', [BusinessPortalController::class, 'requests'])->name('business.requests.index');
        Route::get('/bookings', [BusinessPortalController::class, 'bookings'])->name('business.bookings.index');
        Route::get('/services', [BusinessPortalController::class, 'services'])->name('business.services.index');
        Route::get('/devices', [BusinessPortalController::class, 'devices'])->name('business.devices.index');
        Route::get('/reports', [BusinessPortalController::class, 'reports'])->name('business.reports.index');
        Route::get('/staff', [BusinessPortalController::class, 'staff'])->name('business.staff.index');
        Route::get('/{module}', [BusinessPortalController::class, 'operationalModule'])
            ->whereIn('module', ['safety', 'families', 'billing', 'settings', 'calendar', 'communications', 'marketing'])
            ->name('business.modules.operational');
        // Legacy single-step onboarding (kept for backwards compat)
        Route::get('/onboarding/senior-living', [BusinessOnboardingController::class, 'seniorLiving'])->name('business.onboarding.senior-living');
        Route::post('/onboarding/senior-living', [BusinessOnboardingController::class, 'storeSeniorLiving'])->name('business.onboarding.senior-living.store');

        // ── Resident Import & Invites ────────────────────────────────────────
        Route::get('/residents/import', [ResidentImportController::class, 'index'])->name('residents.import');
        Route::post('/residents/import', [ResidentImportController::class, 'uploadCsv'])->name('residents.import.upload');
        Route::get('/residents/import/template', [ResidentImportController::class, 'downloadTemplate'])->name('residents.import.template');
        Route::get('/residents/invites', [ResidentInviteController::class, 'index'])->name('residents.invites');
        Route::post('/residents/invites/send-all', [ResidentInviteController::class, 'sendAll'])->name('residents.invites.send-all');
        Route::post('/residents/invites/{invite}/resend', [ResidentInviteController::class, 'resend'])->name('residents.invites.resend');
        Route::post('/residents/invites/{invite}/mark-onboarded', [ResidentInviteController::class, 'markOnboarded'])->name('residents.invites.mark-onboarded');

        Route::prefix('portal-api/business/onboarding')
            ->name('api.business.onboarding.')
            ->group(function (): void {
                Route::get('/diagnostics', [BusinessOnboardingApiController::class, 'diagnostics'])->name('diagnostics');
                Route::post('/senior-living-communities', [BusinessOnboardingApiController::class, 'storeCommunity'])->name('communities.store');
                Route::get('/senior-living-communities/{community}', [BusinessOnboardingApiController::class, 'showCommunity'])->name('communities.show');
                Route::post('/senior-living-communities/{community}/resident-imports', [BusinessOnboardingApiController::class, 'importResidents'])->name('resident-imports.store');
            });

        Route::prefix('portal-api/business')
            ->name('api.business.')
            ->group(function (): void {
                Route::get('/dashboard/summary', [BusinessPortalApiController::class, 'dashboardSummary'])->name('dashboard.summary');
                Route::get('/dashboard/noc', [BusinessPortalApiController::class, 'nocDashboard'])->name('dashboard.noc');
                Route::get('/residents', [BusinessPortalApiController::class, 'residents'])->name('residents.index');
                Route::get('/residents/{resident}/profile', [BusinessPortalApiController::class, 'residentProfile'])->name('residents.profile');
                Route::get('/residents/{resident}/timeline', [BusinessPortalApiController::class, 'residentTimeline'])->name('residents.timeline');
                Route::get('/guru/overview', [BusinessPortalApiController::class, 'guruOverview'])->name('guru.overview');
                Route::get('/guru/recommendations/queue', [BusinessPortalApiController::class, 'guruRecommendationQueue'])->name('guru.recommendations.queue');
                Route::patch('/guru/recommendations/{recommendation}', [BusinessPortalApiController::class, 'updateGuruRecommendation'])->name('guru.recommendations.update');
                Route::get('/vitals/live', [BusinessPortalApiController::class, 'liveVitals'])->name('vitals.live');
                Route::get('/alerts', [BusinessPortalApiController::class, 'alerts'])->name('alerts.index');
                Route::patch('/alerts/{alert}', [BusinessPortalApiController::class, 'triageAlert'])->name('alerts.triage');
                Route::post('/incidents', [BusinessPortalApiController::class, 'createIncident'])->name('incidents.store');
                Route::get('/medications/dashboard', [BusinessPortalApiController::class, 'medicationDashboard'])->name('medications.dashboard');
                Route::get('/requests', [BusinessPortalApiController::class, 'serviceRequests'])->name('requests.index');
                Route::post('/requests/{requestId}/match', [BusinessPortalApiController::class, 'matchServiceRequest'])->name('requests.match');
                Route::get('/bookings', [BusinessPortalApiController::class, 'bookings'])->name('bookings.index');
                Route::get('/provider/services', [BusinessPortalApiController::class, 'providerServices'])->name('provider.services');
                Route::post('/provider/service-areas/test', [BusinessPortalApiController::class, 'testProviderServiceArea'])->name('provider.service-areas.test');
                Route::post('/reports/generate', [BusinessPortalApiController::class, 'createReport'])->name('reports.generate');
            });

        Route::middleware('super_admin')->group(function (): void {
            Route::get('/admin/users', [AdminUserController::class, 'index'])->name('admin.users.index');
            Route::post('/admin/users/{user}/decision', [AdminUserController::class, 'decide'])->name('admin.users.approve');

            // ── Business Approval Queue ──────────────────────────────────────
            Route::get('/admin/approvals', [BusinessApprovalController::class, 'index'])->name('admin.approvals');
            Route::get('/admin/approvals/{profile}', [BusinessApprovalController::class, 'show'])->name('admin.approvals.detail');
            Route::post('/admin/approvals/{profile}/approve', [BusinessApprovalController::class, 'approve'])->name('admin.approvals.approve');
            Route::post('/admin/approvals/{profile}/reject', [BusinessApprovalController::class, 'reject'])->name('admin.approvals.reject');
            Route::post('/admin/approvals/{profile}/under-review', [BusinessApprovalController::class, 'markUnderReview'])->name('admin.approvals.under-review');
        });
    });
});
