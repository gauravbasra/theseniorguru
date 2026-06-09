<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_verification_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->uuid('business_profile_id')->index();
            $table->uuid('uploaded_by');
            $table->string('document_type')->comment('state_license|liability_insurance|background_check|ein_letter|cms_contract|other');
            $table->string('document_label')->nullable();
            $table->string('file_name');
            $table->string('file_path')->nullable()->comment('S3 path once uploaded');
            $table->string('mime_type', 80)->nullable();
            $table->unsignedBigInteger('file_size_bytes')->nullable();
            $table->string('status')->default('pending')->comment('pending|verified|rejected');
            $table->uuid('verified_by')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_verification_documents');
    }
};
