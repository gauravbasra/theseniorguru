<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_portal_users', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role')->default('business_admin'); // business_admin, super_admin
            $table->string('approval_status')->default('pending'); // pending, approved, rejected
            $table->timestamp('approved_at')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_portal_users');
    }
};
