<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BusinessOnboardingProfile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'business_type', 'status', 'company_name', 'legal_name',
        'ein_tax_id', 'website', 'phone', 'address_line1', 'address_line2',
        'city', 'state', 'postal_code', 'country', 'primary_contact_name',
        'primary_contact_email', 'primary_contact_phone', 'primary_contact_title',
        'type_details', 'step_completed', 'submitted_at', 'reviewed_at',
        'reviewed_by', 'review_notes', 'approved_at', 'rejected_at', 'rejection_reason',
    ];

    protected $casts = [
        'type_details'  => 'array',
        'submitted_at'  => 'datetime',
        'reviewed_at'   => 'datetime',
        'approved_at'   => 'datetime',
        'rejected_at'   => 'datetime',
    ];

    public const TYPES = [
        'senior_living' => 'Senior Living Community',
        'insurance'     => 'Insurance / Medicare Advantage',
        'day_care'      => 'Adult Day Care Center',
        'provider'      => '3rd Party Service Provider',
    ];

    public const STATUSES = [
        'draft'        => 'Draft',
        'submitted'    => 'Submitted — Pending Review',
        'under_review' => 'Under Review',
        'approved'     => 'Approved',
        'rejected'     => 'Rejected',
    ];

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isPending(): bool
    {
        return in_array($this->status, ['submitted', 'under_review']);
    }

    public function hipaaAgreement(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(HipaaAgreement::class, 'business_profile_id');
    }

    public function documents(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(BusinessVerificationDocument::class, 'business_profile_id');
    }

    public function requiredDocuments(): array
    {
        return match ($this->business_type) {
            'senior_living' => ['state_license', 'liability_insurance'],
            'insurance'     => ['state_license', 'cms_contract'],
            'day_care'      => ['state_license', 'liability_insurance'],
            'provider'      => ['liability_insurance'],
            default         => ['state_license'],
        };
    }

    public function seniorLivingCareTypes(): array
    {
        return [
            'independent_living' => 'Independent Living',
            'assisted_living'    => 'Assisted Living',
            'memory_care'        => 'Memory Care',
            'ccrc'               => 'CCRC (Continuing Care Retirement)',
            'hospice'            => 'Hospice',
        ];
    }
}
