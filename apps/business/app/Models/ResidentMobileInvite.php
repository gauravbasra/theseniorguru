<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ResidentMobileInvite extends Model
{
    use HasUuids;

    protected $table = 'resident_mobile_invites';

    protected $fillable = [
        'resident_id', 'business_profile_id', 'community_id', 'import_batch_id',
        'temp_username', 'temp_password_hash', 'temp_password_plain',
        'invite_token', 'email', 'phone', 'display_name', 'care_level',
        'community_name', 'status', 'send_attempts',
        'email_sent_at', 'sms_sent_at', 'opened_at', 'onboarded_at',
        'password_reset_at', 'expires_at', 'last_error',
    ];

    protected $casts = [
        'email_sent_at'     => 'datetime',
        'sms_sent_at'       => 'datetime',
        'opened_at'         => 'datetime',
        'onboarded_at'      => 'datetime',
        'password_reset_at' => 'datetime',
        'expires_at'        => 'datetime',
    ];

    protected $hidden = ['temp_password_hash', 'temp_password_plain'];

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function canResend(): bool
    {
        return in_array($this->status, ['pending', 'failed']) && $this->send_attempts < 5;
    }
}
