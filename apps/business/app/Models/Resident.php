<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Resident extends Model
{
    protected $guarded = [];

    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    public function familyContacts(): HasMany
    {
        return $this->hasMany(FamilyContact::class);
    }

    public function vitals(): HasMany
    {
        return $this->hasMany(VitalReading::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(ResidentAlert::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class);
    }

    public function primaryContact(): HasMany
    {
        return $this->familyContacts()->where('is_primary', true);
    }

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }
}
