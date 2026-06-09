<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceRequest extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'needed_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function resident(): BelongsTo
    {
        return $this->belongsTo(Resident::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(CommunityService::class, 'community_service_id');
    }
}
