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
        Schema::create('residents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_id')->constrained()->cascadeOnDelete();
            $table->string('first_name');
            $table->string('last_name');
            $table->unsignedTinyInteger('age');
            $table->string('room');
            $table->string('care_level');
            $table->string('status')->default('stable');
            $table->unsignedTinyInteger('wellness_score')->default(80);
            $table->string('mobility')->nullable();
            $table->date('move_in_date')->nullable();
            $table->text('care_notes')->nullable();
            $table->timestamps();

            $table->index(['community_id', 'status']);
            $table->unique(['community_id', 'room']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('residents');
    }
};
