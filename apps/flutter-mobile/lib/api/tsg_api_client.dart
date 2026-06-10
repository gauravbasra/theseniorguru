import 'dart:convert';

import 'package:http/http.dart' as http;

typedef InstallationIdProvider = Future<String> Function();

class TsgApiException implements Exception {
  const TsgApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;

  @override
  String toString() => 'TsgApiException($statusCode): $message';
}

class ResidentMedication {
  const ResidentMedication({
    required this.id,
    required this.name,
    required this.status,
    required this.remainingCount,
  });

  final String id;
  final String name;
  final String status;
  final int remainingCount;

  factory ResidentMedication.fromJson(Map<String, dynamic> json) {
    return ResidentMedication(
      id: stringValue(json['id']),
      name: stringValue(json['name']),
      status: stringValue(json['status'], fallback: 'pending'),
      remainingCount: intValue(
        json['remaining_count'] ?? json['remaining'] ?? json['remainingCount'],
      ),
    );
  }
}

class ResidentService {
  const ResidentService({
    required this.id,
    required this.name,
    required this.category,
  });

  final String id;
  final String name;
  final String category;

  factory ResidentService.fromJson(Map<String, dynamic> json) {
    return ResidentService(
      id: stringValue(json['id']),
      name: stringValue(json['name']),
      category: stringValue(json['category']),
    );
  }
}

class ResidentPerson {
  const ResidentPerson({
    required this.id,
    required this.name,
    required this.phone,
  });

  final String id;
  final String name;
  final String phone;

  factory ResidentPerson.fromJson(Map<String, dynamic> json) {
    return ResidentPerson(
      id: stringValue(json['id']),
      name: stringValue(json['name']),
      phone: stringValue(json['phone']),
    );
  }
}

class ResidentAppState {
  const ResidentAppState({
    required this.residentId,
    required this.residentName,
    required this.community,
    required this.medications,
    required this.services,
    required this.people,
    required this.raw,
  });

  final String residentId;
  final String residentName;
  final String community;
  final List<ResidentMedication> medications;
  final List<ResidentService> services;
  final List<ResidentPerson> people;
  final Map<String, dynamic> raw;

  factory ResidentAppState.fromJson(Map<String, dynamic> json) {
    final resident = mapValue(json['resident']);
    return ResidentAppState(
      residentId: stringValue(resident['id']),
      residentName: stringValue(resident['name'] ?? resident['display_name']),
      community: stringValue(resident['community']),
      medications: listOfMaps(
        json['medications'],
      ).map(ResidentMedication.fromJson).toList(),
      services: listOfMaps(
        json['services'],
      ).map(ResidentService.fromJson).toList(),
      people: listOfMaps(json['people']).map(ResidentPerson.fromJson).toList(),
      raw: json,
    );
  }
}

class TsgApiClient {
  TsgApiClient({
    required this.baseUrl,
    required this.installationIdProvider,
    http.Client? httpClient,
  }) : _http = httpClient ?? http.Client();

  final String baseUrl;
  final InstallationIdProvider installationIdProvider;
  final http.Client _http;
  String? _token;
  String _role = 'senior';

  Future<ResidentAppState> loadResidentState() async {
    final json = await get('/api/state');
    return ResidentAppState.fromJson(json);
  }

  Future<Map<String, dynamic>> startRoleSession(
    String role, {
    String? displayName,
  }) async {
    _role = role;
    _token = null;
    await _ensureSession(displayName: displayName);
    return get('/api/me');
  }

  Future<Map<String, dynamic>> confirmMedication(String medicationId) {
    return post('/api/medications/confirm', {'id': medicationId});
  }

  Future<Map<String, dynamic>> remindMedicationLater(
    String medicationId, {
    int minutes = 30,
  }) {
    return post('/api/medications/remind-later', {
      'id': medicationId,
      'minutes': minutes,
    });
  }

  Future<Map<String, dynamic>> skipMedication(
    String medicationId, {
    String reason = 'Skipped from Flutter app',
  }) {
    return post('/api/medications/skip-dose', {
      'id': medicationId,
      'reason': reason,
    });
  }

  Future<Map<String, dynamic>> requestMedicationRefill(String medicationId) {
    return post('/api/medications/refill-request', {
      'medicationId': medicationId,
      'notes': 'Requested from Flutter resident app',
    });
  }

  Future<Map<String, dynamic>> sendGuruMessage(
    String message, {
    String screen = 'guru',
  }) {
    return post('/api/guru/chat', {'message': message, 'screen': screen});
  }

  Future<Map<String, dynamic>> createRideBooking({
    required String serviceId,
    required String label,
    required String time,
    required String pickupLabel,
    required String riderName,
    String riderPhone = '',
  }) {
    return post('/api/bookings', {
      'serviceId': serviceId,
      'label': label,
      'time': time,
      'scheduledFor': DateTime.now()
          .add(const Duration(days: 1))
          .toIso8601String(),
      'pickup': {'label': pickupLabel, 'lat': 39.5447, 'lng': -104.9673},
      'dropoff': {'label': label, 'lat': 39.5487, 'lng': -104.9897},
      'fulfillmentMode': 'manual_coordination',
      'paymentResponsibility': 'senior',
      'rideIntake': {
        'riderName': riderName,
        'riderPhone': riderPhone,
        'contactPreference': 'call_and_text',
        'mobilityAid': '',
        'accessibilityNeeds': [],
        'needsDoorToDoor': true,
        'caregiverRidingAlong': false,
        'okToShareWithDriver': true,
        'pickupInstructions': '',
        'dropoffInstructions': '',
        'assistanceNotes': '',
      },
    });
  }

  Future<Map<String, dynamic>> createSupportOrder({
    required String category,
    required String label,
    String provider = 'manual_coordination',
    int providerBillCents = 2500,
    required String recipientName,
    required String deliveryAddress,
    String recipientPhone = '',
  }) {
    return post('/api/orders', {
      'category': category,
      'provider': provider,
      'label': label,
      'providerBillCents': providerBillCents,
      'fulfillmentMode': 'manual_coordination',
      'paymentResponsibility': 'senior',
      'orderIntake': {
        'recipientName': recipientName,
        'recipientPhone': recipientPhone,
        'deliveryAddress': deliveryAddress,
        'contactPreference': 'call_and_text',
        'notes': 'Requested from Flutter resident services screen.',
      },
    });
  }

  Future<Map<String, dynamic>> joinEvent(String eventId, String name) {
    return post('/api/events/join', {'id': eventId, 'name': name});
  }

  Future<Map<String, dynamic>> createPost(String body) {
    return post('/api/posts', {'body': body, 'audience': 'community'});
  }

  Future<Map<String, dynamic>> triggerSos() {
    return post('/api/safety/sos', {
      'type': 'resident_sos',
      'source': 'flutter_app',
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    });
  }

  Future<Map<String, dynamic>> syncSafetyLocation({
    required double lat,
    required double lng,
    double? accuracyMeters,
    String label = 'Current phone location',
    String movementStatus = 'active',
    int? stepsLastHour,
    int? stillMinutes,
    double? lastKnownSpeedMph,
    int? phoneBattery,
    String? safeZoneStatus,
  }) async {
    await patch('/api/settings/senior', {'liveTrackingEnabled': true});
    return post('/api/safety/phone-analytics', {
      'location': {
        'lat': lat,
        'lng': lng,
        'accuracyMeters': accuracyMeters,
        'label': label,
      },
      'movementStatus': movementStatus,
      'stepsLastHour': stepsLastHour,
      'stillMinutes': stillMinutes,
      'lastKnownSpeedMph': lastKnownSpeedMph,
      'phoneBattery': phoneBattery,
      'safeZoneStatus': safeZoneStatus,
      'source': 'flutter-resident-app',
    });
  }

  Future<Map<String, dynamic>> captureEvidence({
    required String subjectRole,
    required String evidenceType,
    required String localUri,
    String captureMethod = 'camera',
    String? fileName,
    String? mimeType,
    String? base64Data,
    int? width,
    int? height,
    int? durationMs,
    Map<String, dynamic> metadata = const {},
  }) {
    final body = <String, dynamic>{
      'subjectRole': subjectRole,
      'evidenceType': evidenceType,
      'localUri': localUri,
      'captureMethod': captureMethod,
      'source': 'flutter-resident-app',
      'metadata': metadata,
    };
    if (fileName != null) body['fileName'] = fileName;
    if (mimeType != null) body['mimeType'] = mimeType;
    if (base64Data != null) body['base64Data'] = base64Data;
    if (width != null) body['width'] = width;
    if (height != null) body['height'] = height;
    if (durationMs != null) body['durationMs'] = durationMs;
    return post('/api/media/evidence', body);
  }

  Future<Map<String, dynamic>> completeSeniorOnboarding([
    Map<String, dynamic> payload = const {},
  ]) {
    return post('/api/onboarding/senior', {
      'source': 'flutter_onboarding',
      ...payload,
    });
  }

  Future<Map<String, dynamic>> completeTrustCircleOnboarding({
    Map<String, dynamic> payload = const {},
  }) {
    return post('/api/onboarding/trust-circle', {
      'source': 'flutter_onboarding',
      ...payload,
    });
  }

  Future<Map<String, dynamic>> completeBusinessOnboarding([
    Map<String, dynamic> payload = const {},
  ]) {
    return post('/api/onboarding/business', {
      'source': 'flutter_onboarding',
      ...payload,
    });
  }

  Future<Map<String, dynamic>> syncHealthConsentAndVitals({
    String source = 'flutter-health-connect',
    List<Map<String, dynamic>> readings = const [],
    List<String>? dataTypes,
  }) async {
    final consentTypes = dataTypes ?? healthConsentDataTypes(readings);
    await patch('/api/health/consent', {
      'granted': true,
      'source': source,
      'dataTypes': consentTypes,
    });
    return post('/api/health/vitals', {
      'source': source,
      'readings': readings
          .map(
            (reading) => {
              ...reading,
              'capturedAt':
                  reading['capturedAt'] ?? DateTime.now().toIso8601String(),
            },
          )
          .toList(growable: false),
    });
  }

  Future<Map<String, dynamic>> get(String path) => _request('GET', path);
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) =>
      _request('POST', path, body: body);
  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) =>
      _request('PATCH', path, body: body);

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    await _ensureSession();
    return _send(method, path, body: body, authenticated: true);
  }

  Future<void> _ensureSession({String? displayName}) async {
    if (_token != null) return;
    final installationId = await installationIdProvider();
    final session = await _send(
      'POST',
      '/api/auth/device-session',
      body: {
        'installationId': '$installationId-$_role',
        'role': _role,
        'displayName': displayName,
      },
      authenticated: false,
    );
    _token = stringValue(
      session['token'] ?? mapValue(session['session'])['token'],
    );
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    required bool authenticated,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (authenticated && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    final response = await _http.send(
      http.Request(method, uri)
        ..headers.addAll(headers)
        ..body = body == null ? '' : jsonEncode(body),
    );
    final text = await response.stream.bytesToString();
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
    final json = decoded is Map<String, dynamic>
        ? decoded
        : <String, dynamic>{'data': decoded};
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw TsgApiException(
        stringValue(
          json['error'] ?? json['message'],
          fallback: 'API request failed',
        ),
        response.statusCode,
      );
    }
    return json;
  }
}

Map<String, dynamic> mapValue(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, val) => MapEntry(key.toString(), val));
  }
  return <String, dynamic>{};
}

List<Map<String, dynamic>> listOfMaps(Object? value) {
  if (value is! List) return const [];
  return value.map(mapValue).toList();
}

String stringValue(Object? value, {String fallback = ''}) {
  final text = value == null ? '' : value.toString().trim();
  return text.isEmpty ? fallback : text;
}

int intValue(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(value.toString()) ?? fallback;
}

List<String> healthConsentDataTypes(List<Map<String, dynamic>> readings) {
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

Map<String, dynamic> buildSeniorOnboardingPayload({
  required String fullName,
  required String phone,
  required String email,
  required String address,
  required String city,
  required String state,
  required String zip,
  required int age,
  required String careNeeds,
  String? photoBase64,
}) {
  return {
    'resident': {
      'fullName': fullName,
      'phone': phone,
      'email': email,
      'address': address,
      'city': city,
      'state': state,
      'zip': zip,
      'age': age,
      'careNeeds': careNeeds,
      if (photoBase64 != null) 'photoBase64': photoBase64,
    },
    'source': 'flutter_onboarding',
  };
}

Map<String, dynamic> buildTrustCircleOnboardingPayload({
  required String fullName,
  required String phone,
  required String email,
  required String relationship,
  required String inviteCode,
}) {
  return {
    'fullName': fullName,
    'phone': phone,
    'email': email,
    'relationship': relationship,
    'inviteCode': inviteCode,
    'source': 'flutter_onboarding',
  };
}

Map<String, dynamic> buildBusinessOnboardingPayload({
  required String businessName,
  required String ownerName,
  required String phone,
  required String email,
  required String address,
  required String serviceType,
}) {
  return {
    'businessName': businessName,
    'ownerName': ownerName,
    'phone': phone,
    'email': email,
    'address': address,
    'serviceType': serviceType,
    'source': 'flutter_onboarding',
  };
}
