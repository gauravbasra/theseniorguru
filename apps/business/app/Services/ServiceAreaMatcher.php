<?php

namespace App\Services;

class ServiceAreaMatcher
{
    /**
     * @param  array<string,mixed>  $area
     * @param  array<string,mixed>  $request
     * @return array{matches:bool,distance_miles:?float,reasons:array<int,string>}
     */
    public function evaluate(array $area, array $request): array
    {
        $reasons = [];

        if (array_key_exists('active', $area) && ! (bool) $area['active']) {
            return ['matches' => false, 'distance_miles' => null, 'reasons' => ['service area inactive']];
        }

        $zipCodes = $this->normalizeList($area['zip_codes'] ?? []);
        $requestZip = trim((string) ($request['postal_code'] ?? $request['zip'] ?? ''));
        if ($zipCodes !== []) {
            if ($requestZip !== '' && in_array($requestZip, $zipCodes, true)) {
                $reasons[] = 'postal code inside provider service area';
            } else {
                return ['matches' => false, 'distance_miles' => null, 'reasons' => ['postal code outside provider service area']];
            }
        }

        $cities = $this->normalizeList($area['cities'] ?? []);
        $requestCity = strtolower(trim((string) ($request['city'] ?? '')));
        if ($cities !== []) {
            if ($requestCity !== '' && in_array($requestCity, array_map('strtolower', $cities), true)) {
                $reasons[] = 'city inside provider service area';
            } else {
                return ['matches' => false, 'distance_miles' => null, 'reasons' => ['city outside provider service area']];
            }
        }

        $distance = null;
        $radius = isset($area['radius_miles']) ? (float) $area['radius_miles'] : (isset($area['service_radius_miles']) ? (float) $area['service_radius_miles'] : null);
        $baseLat = isset($area['base_latitude']) ? (float) $area['base_latitude'] : null;
        $baseLng = isset($area['base_longitude']) ? (float) $area['base_longitude'] : null;
        $requestLat = isset($request['latitude']) ? (float) $request['latitude'] : null;
        $requestLng = isset($request['longitude']) ? (float) $request['longitude'] : null;

        if ($radius !== null && $baseLat !== null && $baseLng !== null && $requestLat !== null && $requestLng !== null) {
            $distance = $this->haversineMiles($baseLat, $baseLng, $requestLat, $requestLng);
            if ($distance > $radius) {
                return ['matches' => false, 'distance_miles' => round($distance, 2), 'reasons' => ['radius outside provider service area']];
            }

            $reasons[] = 'coordinates inside provider radius';
        }

        if ($reasons === []) {
            $reasons[] = 'provider has no restrictive service boundary for supplied request fields';
        }

        return [
            'matches' => true,
            'distance_miles' => $distance === null ? null : round($distance, 2),
            'reasons' => $reasons,
        ];
    }

    /**
     * @param  mixed  $value
     * @return array<int,string>
     */
    private function normalizeList(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            } else {
                $value = trim($value, '{}');
                $value = array_filter(array_map('trim', explode(',', $value)));
            }
        }

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(array_map(fn ($item) => trim((string) $item), $value)));
    }

    private function haversineMiles(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusMiles = 3958.7613;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return $earthRadiusMiles * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
