<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_hipaa_agreements', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->uuid('business_profile_id')->index();
            $table->uuid('user_id');
            $table->timestamp('agreed_at');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('agreement_version', 20)->default('1.0');
            $table->string('signatory_name');
            $table->string('signatory_title', 120)->nullable();
            $table->string('signatory_email')->nullable();
            $table->boolean('baa_accepted')->default(true);
            $table->boolean('data_use_accepted')->default(true);
            $table->boolean('phi_handling_accepted')->default(true);
            $table->boolean('breach_notification_accepted')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_hipaa_agreements');
    }
};
