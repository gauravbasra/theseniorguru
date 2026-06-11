<?php

namespace App\Services;

use App\Models\ResidentMobileInvite;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class ResidentInviteService
{
    private const APP_STORE_URL  = 'https://apps.apple.com/app/theseniorguru/id123456789';
    private const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.theseniorguru';
    private const INVITE_TTL_DAYS = 30;

    /**
     * Generate invite records for all residents in an import batch
     * who don't already have an invite.
     *
     * @return array{created:int,skipped:int}
     */
    public function generateForBatch(string $communityId, string $importBatchId, ?string $businessProfileId = null): array
    {
        $residents = DB::connection('shared_platform')
            ->table('residents as r')
            ->join('senior_living_resident_assignments as a', 'a.resident_id', '=', 'r.id')
            ->join('users as u', 'u.id', '=', 'r.user_id')
            ->where('a.community_id', $communityId)
            ->where('a.import_batch_id', $importBatchId)
            ->where('a.status', 'active')
            ->leftJoin('resident_mobile_invites as i', 'i.resident_id', '=', 'r.id')
            ->whereNull('i.id')
            ->select('r.id as resident_id', 'r.display_name', 'u.email', 'u.phone', 'a.care_level', 'a.care_level_id')
            ->get();

        // Get community name
        $community = DB::connection('shared_platform')
            ->table('senior_living_communities')
            ->where('id', $communityId)
            ->value('name') ?? 'TheSeniorGuru Community';

        $created = 0;
        foreach ($residents as $resident) {
            $this->createInvite(
                residentId: (string) $resident->resident_id,
                displayName: $resident->display_name,
                email: $resident->email,
                phone: $resident->phone,
                careLevel: $resident->care_level,
                communityId: $communityId,
                communityName: $community,
                importBatchId: $importBatchId,
                businessProfileId: $businessProfileId,
            );
            $created++;
        }

        return ['created' => $created, 'skipped' => 0];
    }

    /**
     * Create a single invite record with temp credentials.
     */
    public function createInvite(
        string $residentId,
        string $displayName,
        ?string $email,
        ?string $phone,
        ?string $careLevel,
        ?string $communityId,
        string $communityName,
        ?string $importBatchId = null,
        ?string $businessProfileId = null,
    ): ResidentMobileInvite {
        $tempUsername = $this->generateUsername($displayName);
        $tempPassword = $this->generatePassword();

        $invite = ResidentMobileInvite::create([
            'resident_id'         => $residentId,
            'business_profile_id' => $businessProfileId,
            'community_id'        => $communityId,
            'import_batch_id'     => $importBatchId,
            'temp_username'       => $tempUsername,
            'temp_password_hash'  => Hash::make($tempPassword),
            'temp_password_plain' => $tempPassword, // cleared after first send
            'invite_token'        => Str::random(48),
            'email'               => $email,
            'phone'               => $phone,
            'display_name'        => $displayName,
            'care_level'          => $careLevel,
            'community_name'      => $communityName,
            'status'              => 'pending',
            'expires_at'          => now()->addDays(self::INVITE_TTL_DAYS),
        ]);

        // Write temp credentials back to shared users table so mobile login works
        DB::connection('shared_platform')
            ->table('users')
            ->join('residents', 'residents.user_id', '=', 'users.id')
            ->where('residents.id', $residentId)
            ->update([
                'users.password_hash'          => Hash::make($tempPassword),
                'users.temp_login_username'    => $tempUsername,
                'users.password_reset_required'=> true,
                'users.updated_at'             => now(),
            ]);

        return $invite;
    }

    /**
     * Send invite email for one invite record.
     */
    public function sendEmail(ResidentMobileInvite $invite): bool
    {
        if (! $invite->email) {
            return false;
        }

        try {
            $data = $this->inviteEmailData($invite);
            Mail::send('emails.resident-invite', $data, function ($message) use ($invite): void {
                $message->to($invite->email, $invite->display_name)
                    ->subject('Welcome to TheSeniorGuru — Download the App & Get Started');
            });

            $invite->update([
                'status'         => 'sent',
                'email_sent_at'  => now(),
                'send_attempts'  => $invite->send_attempts + 1,
                'temp_password_plain' => null, // clear after send
            ]);

            return true;
        } catch (\Throwable $e) {
            Log::error('ResidentInviteService::sendEmail failed', [
                'invite_id' => $invite->id,
                'error'     => $e->getMessage(),
            ]);

            $invite->update([
                'status'         => 'failed',
                'send_attempts'  => $invite->send_attempts + 1,
                'last_error'     => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Send all pending invites for a batch.
     *
     * @return array{sent:int,failed:int,skipped:int}
     */
    public function sendBatch(string $importBatchId): array
    {
        $invites = ResidentMobileInvite::where('import_batch_id', $importBatchId)
            ->where('status', 'pending')
            ->get();

        $sent = $failed = $skipped = 0;

        foreach ($invites as $invite) {
            if (! $invite->email && ! $invite->phone) {
                $skipped++;
                continue;
            }

            $ok = $this->sendEmail($invite);
            $ok ? $sent++ : $failed++;
        }

        return compact('sent', 'failed', 'skipped');
    }

    /**
     * Return invite summary stats for a community.
     *
     * @return array{total:int,sent:int,onboarded:int,pending:int,failed:int}
     */
    public function summaryForCommunity(string $communityId): array
    {
        $rows = ResidentMobileInvite::where('community_id', $communityId)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        $total = array_sum($rows);

        return [
            'total'     => $total,
            'sent'      => (int) ($rows['sent'] ?? 0),
            'onboarded' => (int) ($rows['onboarded'] ?? 0),
            'pending'   => (int) ($rows['pending'] ?? 0),
            'failed'    => (int) ($rows['failed'] ?? 0),
        ];
    }

    private function generateUsername(string $displayName): string
    {
        $parts = explode(' ', trim($displayName));
        $first = Str::ascii(Str::lower($parts[0] ?? 'user'));
        $last  = Str::ascii(Str::lower($parts[1] ?? ''));
        $base  = preg_replace('/[^a-z]/', '', $first . $last);
        $base  = substr($base ?: 'resident', 0, 14);
        $suffix = str_pad((string) random_int(100, 9999), 4, '0', STR_PAD_LEFT);

        $candidate = $base . $suffix;

        // Ensure uniqueness
        $attempts = 0;
        while (ResidentMobileInvite::where('temp_username', $candidate)->exists() && $attempts < 10) {
            $suffix = str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
            $candidate = $base . $suffix;
            $attempts++;
        }

        return $candidate;
    }

    private function generatePassword(): string
    {
        // 12 chars: mix of upper, lower, digits — no ambiguous chars
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        $password = '';
        for ($i = 0; $i < 12; $i++) {
            $password .= $chars[random_int(0, strlen($chars) - 1)];
        }

        return $password;
    }

    /**
     * @return array<string,mixed>
     */
    private function inviteEmailData(ResidentMobileInvite $invite): array
    {
        return [
            'displayName'   => $invite->display_name,
            'communityName' => $invite->community_name,
            'username'      => $invite->temp_username,
            'password'      => $invite->temp_password_plain,
            'appStoreUrl'   => self::APP_STORE_URL,
            'playStoreUrl'  => self::PLAY_STORE_URL,
            'inviteToken'   => $invite->invite_token,
            'expiresAt'     => $invite->expires_at?->format('F j, Y'),
        ];
    }
}
