import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:health/health.dart';

import 'native_health_service_stub.dart';

class NativeHealthService {
  NativeHealthService({Health? health}) : _health = health ?? Health();

  final Health _health;

  Future<NativeHealthSnapshot> collectRecentVitals() async {
    if (kIsWeb || (!Platform.isIOS && !Platform.isAndroid)) {
      return const NativeHealthSnapshot(
        source: 'flutter-native-health-unavailable',
        readings: [],
        message: 'Native HealthKit or Health Connect is unavailable here.',
      );
    }

    final source = Platform.isIOS ? 'ios-healthkit' : 'android-health-connect';
    final now = DateTime.now();
    final start = now.subtract(const Duration(hours: 36));
    final types = <HealthDataType>[
      HealthDataType.HEART_RATE,
      HealthDataType.RESTING_HEART_RATE,
      HealthDataType.BLOOD_OXYGEN,
      HealthDataType.RESPIRATORY_RATE,
      HealthDataType.HEART_RATE_VARIABILITY_SDNN,
      HealthDataType.BLOOD_PRESSURE_SYSTOLIC,
      HealthDataType.BLOOD_PRESSURE_DIASTOLIC,
      HealthDataType.BODY_TEMPERATURE,
      HealthDataType.STEPS,
      HealthDataType.ACTIVE_ENERGY_BURNED,
      HealthDataType.SLEEP_ASLEEP,
      HealthDataType.SLEEP_DEEP,
      HealthDataType.SLEEP_LIGHT,
      HealthDataType.SLEEP_REM,
    ].where(_health.isDataTypeAvailable).toList(growable: false);

    try {
      await _health.configure();
      final authorized = await _health.requestAuthorization(
        types,
        permissions: List.filled(types.length, HealthDataAccess.READ),
      );
      if (!authorized) {
        return NativeHealthSnapshot(
          source: source,
          available: false,
          readings: const [],
          message: 'Health data permission was denied. Please enable access in device Settings to sync vitals.',
        );
      }

      final points = await _health.getHealthDataFromTypes(
        types: types,
        startTime: start,
        endTime: now,
      );
      final reading = _normalize(points, now);
      return NativeHealthSnapshot(
        source: source,
        available: true,
        readings: reading.length <= 1 ? const [] : [reading],
        message: points.isEmpty
            ? 'No recent health samples were available.'
            : null,
      );
    } catch (error) {
      return NativeHealthSnapshot(
        source: source,
        readings: const [],
        message: error.toString(),
      );
    }
  }

  Map<String, dynamic> _normalize(List<HealthDataPoint> points, DateTime now) {
    final latest = <HealthDataType, HealthDataPoint>{};
    var sleepMinutes = 0;
    var stepsTotal = 0;
    var caloriesTotal = 0.0;
    for (final point in points) {
      final value = _numericValue(point);
      if (value == null) continue;
      if (_sleepTypes.contains(point.type)) {
        sleepMinutes += value.round();
        continue;
      }
      if (point.type == HealthDataType.STEPS) {
        stepsTotal += value.round();
        continue;
      }
      if (point.type == HealthDataType.ACTIVE_ENERGY_BURNED) {
        caloriesTotal += value;
        continue;
      }
      final existing = latest[point.type];
      if (existing == null || point.dateTo.isAfter(existing.dateTo)) {
        latest[point.type] = point;
      }
    }

    return <String, dynamic>{
      if (_latestNumber(latest, [
            HealthDataType.RESTING_HEART_RATE,
            HealthDataType.HEART_RATE,
          ]) !=
          null)
        'heartRate': _latestNumber(latest, [
          HealthDataType.RESTING_HEART_RATE,
          HealthDataType.HEART_RATE,
        ])!.round(),
      if (_latestNumber(latest, [HealthDataType.BLOOD_OXYGEN]) != null)
        'oxygenSaturation': _oxygenPercent(
          _latestNumber(latest, [HealthDataType.BLOOD_OXYGEN])!,
        ),
      if (_latestNumber(latest, [HealthDataType.RESPIRATORY_RATE]) != null)
        'respiratoryRate': _latestNumber(latest, [
          HealthDataType.RESPIRATORY_RATE,
        ])!.round(),
      if (_latestNumber(latest, [HealthDataType.HEART_RATE_VARIABILITY_SDNN]) !=
          null)
        'hrv': _latestNumber(latest, [
          HealthDataType.HEART_RATE_VARIABILITY_SDNN,
        ])!.round(),
      if (stepsTotal > 0) 'stepsToday': stepsTotal,
      if (caloriesTotal > 0) 'caloriesToday': caloriesTotal.round(),
      if (sleepMinutes > 0) 'sleepMinutes': sleepMinutes,
      'capturedAt': now.toIso8601String(),
    };
  }

  num? _latestNumber(
    Map<HealthDataType, HealthDataPoint> latest,
    List<HealthDataType> types,
  ) {
    for (final type in types) {
      final point = latest[type];
      final value = point == null ? null : _numericValue(point);
      if (value != null) return value;
    }
    return null;
  }

  num? _numericValue(HealthDataPoint point) {
    final value = point.value;
    if (value is NumericHealthValue) return value.numericValue;
    return num.tryParse(value.toString());
  }

  num _oxygenPercent(num value) => value <= 1 ? value * 100 : value;
}

const _sleepTypes = {
  HealthDataType.SLEEP_ASLEEP,
  HealthDataType.SLEEP_DEEP,
  HealthDataType.SLEEP_LIGHT,
  HealthDataType.SLEEP_REM,
};
