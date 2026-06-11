<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    public function test_command_center_requires_login(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->get('/')
            ->assertRedirect(route('login'));
    }

    public function test_signup_creates_pending_user_who_cannot_access_dashboard_until_approved(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->post(route('signup.store'), [
            'name' => 'Community Operator',
            'email' => 'operator@example.test',
            'password' => 'ApprovedSoon123!',
            'password_confirmation' => 'ApprovedSoon123!',
        ])->assertRedirect(route('approval.pending'));

        $user = User::where('email', 'operator@example.test')->firstOrFail();
        $this->assertSame('business_admin', $user->role);
        $this->assertSame('pending', $user->approval_status);

        $this->actingAs($user)
            ->get('/')
            ->assertRedirect(route('approval.pending'));
    }

    public function test_super_admin_can_approve_pending_users(): void
    {
        $this->seed(DatabaseSeeder::class);

        $admin = User::where('email', 'gaurav@basraconsultingservices.com')->firstOrFail();
        $this->assertSame('super_admin', $admin->role);
        $this->assertSame('approved', $admin->approval_status);
        $this->assertTrue(Hash::check('Monty@123', $admin->password));

        $pending = User::create([
            'name' => 'New Business User',
            'email' => 'newuser@example.test',
            'password' => 'SafePassword123!',
            'role' => 'business_admin',
            'approval_status' => 'pending',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.users.approve', $pending), [
                'decision' => 'approve',
            ])
            ->assertRedirect(route('admin.users.index'));

        $pending->refresh();
        $this->assertSame('approved', $pending->approval_status);
        $this->assertNotNull($pending->approved_at);
        $this->assertSame($admin->id, $pending->approved_by);
    }
}
