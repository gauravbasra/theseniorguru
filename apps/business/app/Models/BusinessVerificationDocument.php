<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BusinessVerificationDocument extends Model
{
    use HasUuids;

    protected $table = 'business_verification_documents';

    protected $fillable = [
        'business_profile_id', 'uploaded_by', 'document_type', 'document_label',
        'file_name', 'file_path', 'mime_type', 'file_size_bytes',
        'status', 'verified_by', 'verified_at', 'notes',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    public const TYPES = [
        'state_license'       => 'State Operating License',
        'liability_insurance' => 'General Liability Insurance Certificate',
        'background_check'    => 'Background Check Authorization',
        'ein_letter'          => 'IRS EIN Confirmation Letter',
        'cms_contract'        => 'CMS/Medicare Contract',
        'other'               => 'Other Document',
    ];
}
