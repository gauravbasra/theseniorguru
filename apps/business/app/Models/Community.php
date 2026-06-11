<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class Community extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'compliance_flags' => 'array',
        ];
    }

    public function residents(): HasMany
    {
        return $this->hasMany(Resident::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(ResidentAlert::class);
    }

    public function services(): HasMany
    {
        return $this->hasMany(CommunityService::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }

    public function staffShifts(): HasMany
    {
        return $this->hasMany(StaffShift::class);
    }
}
