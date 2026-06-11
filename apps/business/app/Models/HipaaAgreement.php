<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class HipaaAgreement extends Model
{
    use HasUuids;

    protected $table = 'bp_hipaa_agreements';

    protected $fillable = [
        'business_profile_id', 'user_id', 'agreed_at', 'ip_address', 'user_agent',
        'agreement_version', 'signatory_name', 'signatory_title', 'signatory_email',
        'baa_accepted', 'data_use_accepted', 'phi_handling_accepted', 'breach_notification_accepted',
    ];

    protected $casts = [
        'agreed_at'                    => 'datetime',
        'baa_accepted'                 => 'boolean',
        'data_use_accepted'            => 'boolean',
        'phi_handling_accepted'        => 'boolean',
        'breach_notification_accepted' => 'boolean',
    ];
}
