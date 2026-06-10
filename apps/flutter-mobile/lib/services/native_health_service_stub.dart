class NativeHealthSnapshot {
  const NativeHealthSnapshot({
    required this.source,
    required this.readings,
    this.available = false,
    this.message,
  });

  final String source;
  final List<Map<String, dynamic>> readings;
  final bool available;
  final String? message;

  List<String> get consentDataTypes {
    final types = <String>{};
    for (final reading in readings) {
      if (reading['heartRate'] != null) types.add('heartRate');
      if (reading['oxygenSaturation'] != null) types.add('oxygenSaturation');
      if (reading['respiratoryRate'] != null) types.add('respiratoryRate');
      if (reading['hrv'] != null) types.add('hrv');
      if (reading['sleepMinutes'] != null) types.add('sleep');
      if (reading['caloriesToday'] != null) types.add('calories');
      if (reading['stepsToday'] != null) types.add('steps');
    }
    return types.toList(growable: false);
  }
}

class NativeHealthService {
  Future<NativeHealthSnapshot> collectRecentVitals() async {
    return const NativeHealthSnapshot(
      source: 'flutter-native-health-unavailable',
      readings: [],
      message: 'Native HealthKit or Health Connect is unavailable here.',
    );
  }
}
