<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Community;
use App\Models\CommunityService;
use App\Models\Device;
use App\Models\FamilyContact;
use App\Models\Resident;
use App\Models\ResidentAlert;
use App\Models\ServiceRequest;
use App\Models\StaffShift;
use App\Models\User;
use App\Models\VitalReading;
use Carbon\CarbonImmutable;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        DB::transaction(function (): void {
            $now = CarbonImmutable::parse('2026-06-08 09:15:00', 'America/Denver');

            $community = Community::create([
                'name' => 'Sunrise Senior Living',
                'care_level' => 'Premium Community',
                'timezone' => 'America/Denver',
                'capacity' => 128,
                'address' => '1450 Aspen Ridge Way, Denver, CO',
                'compliance_flags' => ['HIPAA-ready access controls', 'Daily care audit trail', 'Family update log'],
            ]);

            $superAdmin = User::create([
                'name' => 'Gaurav Basra',
                'email' => env('SUPER_ADMIN_EMAIL', 'gaurav@basraconsultingservices.com'),
                'password' => env('SUPER_ADMIN_PASSWORD', 'Monty@123'),
                'role' => 'super_admin',
                'approval_status' => 'approved',
                'approved_at' => $now,
            ]);

            User::factory()->create([
                'name' => 'Jessica Manager',
                'email' => 'admin@theseniorguru.test',
                'role' => 'business_admin',
                'approval_status' => 'approved',
                'approved_at' => $now,
                'approved_by' => $superAdmin->id,
            ]);

            $services = collect([
                ['name' => 'Medication Mgmt.', 'category' => 'Care', 'base_price' => 45],
                ['name' => 'Transportation', 'category' => 'Logistics', 'base_price' => 25],
                ['name' => 'Physical Therapy', 'category' => 'Wellness', 'base_price' => 80],
                ['name' => 'Meal Delivery', 'category' => 'Hospitality', 'base_price' => 18],
                ['name' => 'Companionship', 'category' => 'Engagement', 'base_price' => 60],
                ['name' => 'Family Update Call', 'category' => 'Communications', 'base_price' => 0],
            ])->mapWithKeys(fn (array $service) => [
                $service['name'] => CommunityService::create($service + ['community_id' => $community->id]),
            ]);

            $residentRows = [
                ['Margaret', 'Smith', 82, '101A', 'Assisted Living', 'stable', 91, 'Walker', 72, 98, 1245],
                ['Robert', 'Johnson', 88, '102B', 'Memory Care', 'watch', 74, 'Assisted', 88, 95, 856],
                ['Linda', 'Davis', 79, '103C', 'Independent Living', 'stable', 88, 'Independent', 65, 97, 1102],
                ['James', 'Wilson', 91, '104A', 'Assisted Living', 'alert', 61, 'Wheelchair', 92, 94, 1765],
                ['Patricia', 'Brown', 84, '105B', 'Assisted Living', 'stable', 86, 'Walker', 78, 96, 983],
                ['Mary', 'Thompson', 77, '106A', 'Independent Living', 'stable', 90, 'Independent', 69, 98, 1540],
                ['John', 'Anderson', 81, '107C', 'Assisted Living', 'watch', 76, 'Cane', 83, 95, 690],
                ['Sarah', 'Williams', 86, '108B', 'Memory Care', 'needs_check_in', 68, 'Assisted', 80, 96, 520],
                ['David', 'Miller', 80, '109A', 'Independent Living', 'stable', 89, 'Independent', 73, 98, 1380],
            ];

            $residents = collect($residentRows)->map(function (array $row, int $index) use ($community, $now) {
                [$first, $last, $age, $room, $careLevel, $status, $wellness, $mobility, $heartRate, $spo2, $steps] = $row;

                $resident = Resident::create([
                    'community_id' => $community->id,
                    'first_name' => $first,
                    'last_name' => $last,
                    'age' => $age,
                    'room' => $room,
                    'care_level' => $careLevel,
                    'status' => $status,
                    'wellness_score' => $wellness,
                    'mobility' => $mobility,
                    'move_in_date' => $now->subMonths(18 + $index)->toDateString(),
                    'care_notes' => 'Coordinate wellness checks, family communication, and scheduled services through the portal.',
                ]);

                FamilyContact::create([
                    'resident_id' => $resident->id,
                    'name' => "{$first} Family Contact",
                    'relationship' => $index % 2 === 0 ? 'Daughter' : 'Son',
                    'phone' => '555-01'.str_pad((string) ($index + 10), 2, '0', STR_PAD_LEFT),
                    'email' => strtolower($first).'.family@example.test',
                    'is_primary' => true,
                    'last_update_sent_at' => $now->subHours($index + 2),
                ]);

                for ($day = 6; $day >= 0; $day--) {
                    VitalReading::create([
                        'resident_id' => $resident->id,
                        'recorded_at' => $now->subDays($day)->setTime(8, 30),
                        'heart_rate' => max(58, $heartRate - $day + ($index % 3)),
                        'spo2' => max(91, $spo2 - ($day % 2)),
                        'steps' => max(320, $steps - ($day * 45)),
                        'sleep_quality' => max(55, 88 - ($index * 3) - $day),
                        'temperature_f' => 98.2 + ($index % 3) / 10,
                    ]);
                }

                return $resident;
            });

            for ($index = 10; $index <= 118; $index++) {
                $first = 'Resident';
                $last = 'Profile '.$index;
                $resident = Resident::create([
                    'community_id' => $community->id,
                    'first_name' => $first,
                    'last_name' => $last,
                    'age' => 74 + ($index % 18),
                    'room' => (string) (100 + $index).($index % 2 === 0 ? 'A' : 'B'),
                    'care_level' => $index % 5 === 0 ? 'Memory Care' : 'Assisted Living',
                    'status' => $index % 11 === 0 ? 'watch' : 'stable',
                    'wellness_score' => 72 + ($index % 24),
                    'mobility' => $index % 4 === 0 ? 'Walker' : 'Independent',
                    'move_in_date' => $now->subMonths(3 + $index)->toDateString(),
                    'care_notes' => 'Operational census profile used for occupancy, staffing, and service-capacity calculations.',
                ]);

                VitalReading::create([
                    'resident_id' => $resident->id,
                    'recorded_at' => $now->setTime(8, 30),
                    'heart_rate' => 64 + ($index % 18),
                    'spo2' => 95 + ($index % 4),
                    'steps' => 620 + ($index * 7),
                    'sleep_quality' => 72 + ($index % 20),
                    'temperature_f' => 98.1 + ($index % 4) / 10,
                ]);
            }

            $alerts = [
                ['High Heart Rate Detected', 'critical', 'vitals', 'James Wilson', 'Heart rate exceeded resident-specific threshold.', 'Director of Nursing', 2],
                ['Low Activity Alert', 'high', 'activity', 'Robert Johnson', 'Activity is below weekly baseline and needs staff check-in.', 'Care Team', 15],
                ['SPO2 Level Fluctuation', 'medium', 'vitals', 'Linda Davis', 'SpO2 moved outside normal range twice today.', 'Nurse', 32],
                ['Device Battery Low', 'low', 'device', 'Patricia Brown', 'Pulse oximeter should be replaced or charged before evening rounds.', 'Maintenance', 75],
                ['Family Callback Requested', 'medium', 'communications', 'Sarah Williams', 'Primary contact requested an update after lunch.', 'Admin Desk', 110],
                ['Medication Confirmation Late', 'high', 'medication', 'Robert Johnson', 'Morning medication confirmation missed the usual window.', 'Medication Tech', 140],
            ];

            foreach ($alerts as [$title, $severity, $type, $residentName, $description, $role, $minutesAgo]) {
                $resident = $residents->first(fn (Resident $resident) => $resident->full_name === $residentName);
                ResidentAlert::create([
                    'community_id' => $community->id,
                    'resident_id' => $resident?->id,
                    'type' => $type,
                    'severity' => $severity,
                    'title' => $title,
                    'description' => $description,
                    'status' => 'open',
                    'assigned_role' => $role,
                    'triggered_at' => $now->subMinutes($minutesAgo),
                ]);
            }

            foreach ($residents->take(7) as $index => $resident) {
                Device::create([
                    'community_id' => $community->id,
                    'resident_id' => $resident->id,
                    'label' => $resident->room.' wearable kit',
                    'type' => $index % 3 === 0 ? 'Fall pendant' : 'Pulse oximeter',
                    'status' => $index === 3 ? 'attention' : 'online',
                    'battery_level' => $index === 3 ? 18 : 74 + $index,
                    'last_seen_at' => $now->subMinutes(4 + $index),
                    'next_service_due_at' => $now->addDays(14 + $index)->toDateString(),
                ]);
            }

            $requestStatuses = ['pending', 'in_progress', 'completed', 'triage', 'pending', 'in_progress', 'completed', 'pending'];
            foreach ($requestStatuses as $index => $status) {
                $resident = $residents[$index % $residents->count()];
                $service = $services->values()[$index % $services->count()];
                ServiceRequest::create([
                    'community_id' => $community->id,
                    'resident_id' => $resident->id,
                    'community_service_id' => $service->id,
                    'requested_by' => $index % 2 === 0 ? 'Family Portal' : 'Care Team',
                    'priority' => $index === 3 ? 'urgent' : ($index % 3 === 0 ? 'high' : 'normal'),
                    'status' => $status,
                    'needed_at' => $now->addHours($index + 1),
                    'notes' => 'Review resident context before confirming staffing and logistics.',
                    'completed_at' => $status === 'completed' ? $now->subHours($index + 2) : null,
                ]);
            }

            $bookingRows = [
                ['Transportation', 'Mary Thompson', 9, 'confirmed'],
                ['Physical Therapy', 'John Anderson', 10, 'confirmed'],
                ['Medication Mgmt.', 'Sarah Williams', 11, 'pending'],
                ['Companionship', 'David Miller', 13, 'confirmed'],
                ['Meal Delivery', 'Margaret Smith', 14, 'confirmed'],
                ['Family Update Call', 'James Wilson', 15, 'scheduled'],
            ];

            foreach ($bookingRows as [$serviceName, $residentName, $hour, $status]) {
                $resident = $residents->first(fn (Resident $resident) => $resident->full_name === $residentName);
                $service = $services[$serviceName];
                Booking::create([
                    'community_id' => $community->id,
                    'resident_id' => $resident?->id,
                    'community_service_id' => $service->id,
                    'client_name' => $residentName,
                    'starts_at' => $now->setTime($hour, 0),
                    'ends_at' => $now->setTime($hour + 1, 0),
                    'status' => $status,
                    'amount' => $service->base_price,
                    'payment_status' => in_array($status, ['confirmed', 'scheduled'], true) ? 'paid' : 'pending',
                    'logistics_notes' => 'Confirm resident readiness and staff handoff.',
                ]);
            }

            foreach (range(1, 24) as $index) {
                $service = $services->values()[$index % $services->count()];
                Booking::create([
                    'community_id' => $community->id,
                    'resident_id' => $residents[$index % $residents->count()]->id,
                    'community_service_id' => $service->id,
                    'client_name' => $residents[$index % $residents->count()]->full_name,
                    'starts_at' => $now->subDays(($index % 18) + 1)->setTime(8 + ($index % 8), 0),
                    'ends_at' => $now->subDays(($index % 18) + 1)->setTime(9 + ($index % 8), 0),
                    'status' => $index % 5 === 0 ? 'completed' : 'confirmed',
                    'amount' => $service->base_price,
                    'payment_status' => $index % 6 === 0 ? 'pending' : 'paid',
                ]);
            }

            foreach ([
                ['Jessica Manager', 'Administrator', 92],
                ['Alicia Chen', 'Director of Nursing', 96],
                ['Marcus Reed', 'Medication Tech', 88],
                ['Priya Shah', 'Caregiver', 84],
                ['Daniel Brooks', 'Transportation', 79],
            ] as [$name, $role, $score]) {
                StaffShift::create([
                    'community_id' => $community->id,
                    'staff_name' => $name,
                    'role' => $role,
                    'starts_at' => $now->setTime(7, 0),
                    'ends_at' => $now->setTime(19, 0),
                    'status' => 'on_duty',
                    'coverage_score' => $score,
                ]);
            }
        });
    }
}
