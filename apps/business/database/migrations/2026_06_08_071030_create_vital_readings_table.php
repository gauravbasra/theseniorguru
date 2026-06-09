<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('vital_readings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resident_id')->constrained()->cascadeOnDelete();
            $table->timestamp('recorded_at');
            $table->unsignedSmallInteger('heart_rate');
            $table->unsignedTinyInteger('spo2');
            $table->unsignedSmallInteger('steps')->default(0);
            $table->unsignedTinyInteger('sleep_quality')->default(70);
            $table->decimal('temperature_f', 4, 1)->nullable();
            $table->string('source')->default('wearable');
            $table->timestamps();

            $table->index(['resident_id', 'recorded_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vital_readings');
    }
};
