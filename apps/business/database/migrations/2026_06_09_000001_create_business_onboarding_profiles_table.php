<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bp_onboarding_profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->uuid('user_id')->index();
            $table->string('business_type')->comment('senior_living|insurance|day_care|provider');
            $table->string('status')->default('draft')->comment('draft|submitted|under_review|approved|rejected');
            $table->string('company_name');
            $table->string('legal_name')->nullable();
            $table->string('ein_tax_id', 20)->nullable();
            $table->string('website')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('address_line1')->nullable();
            $table->string('address_line2')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 60)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('country', 60)->default('US');
            $table->string('primary_contact_name')->nullable();
            $table->string('primary_contact_email')->nullable();
            $table->string('primary_contact_phone', 40)->nullable();
            $table->string('primary_contact_title', 120)->nullable();
            $table->jsonb('type_details')->default('{}')->comment('Type-specific fields stored as JSON');
            $table->integer('step_completed')->default(0)->comment('Wizard step progress 0-6');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->uuid('reviewed_by')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bp_onboarding_profiles');
    }
};
