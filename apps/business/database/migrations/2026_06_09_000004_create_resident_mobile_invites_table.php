<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bp_resident_invites', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->uuid('resident_id')->index();
            $table->uuid('business_profile_id')->nullable()->index();
            $table->uuid('community_id')->nullable();
            $table->uuid('import_batch_id')->nullable();
            $table->string('temp_username')->unique();
            $table->string('temp_password_hash');
            $table->string('temp_password_plain')->nullable()->comment('Cleared after first send');
            $table->string('invite_token', 64)->unique();
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('display_name')->nullable();
            $table->string('care_level', 60)->nullable();
            $table->string('community_name')->nullable();
            $table->string('status')->default('pending')->comment('pending|sent|opened|onboarded|failed|expired');
            $table->integer('send_attempts')->default(0);
            $table->timestamp('email_sent_at')->nullable();
            $table->timestamp('sms_sent_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('onboarded_at')->nullable();
            $table->timestamp('password_reset_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bp_resident_invites');
    }
};
