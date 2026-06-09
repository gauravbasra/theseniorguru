<?php

use App\Http\Controllers\BusinessPortalController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BusinessOnboardingController;
use App\Http\Controllers\BusinessOnboardingApiController;
use App\Http\Controllers\BusinessPortalApiController;
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
            ->whereIn('module', ['safety', 'families', 'billing', 'settings'])
            ->name('business.modules.operational');
        Route::get('/onboarding/senior-living', [BusinessOnboardingController::class, 'seniorLiving'])->name('business.onboarding.senior-living');
        Route::post('/onboarding/senior-living', [BusinessOnboardingController::class, 'storeSeniorLiving'])->name('business.onboarding.senior-living.store');

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
        });
    });
});
