import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:theseniorguru_flutter_mobile/api/tsg_api_client.dart';

void main() {
  test(
    'resident screen contract loads state and writes screen actions',
    () async {
      final requests = <Map<String, dynamic>>[];
      final client = TsgApiClient(
        baseUrl: 'https://mobile-api.test',
        installationIdProvider: () async => 'install-test-1',
        httpClient: MockClient((request) async {
          requests.add({
            'method': request.method,
            'path': request.url.path,
            'body': request.body,
            'authorization': request.headers['Authorization'],
          });
          if (request.url.path == '/api/auth/device-session') {
            return http.Response(
              jsonEncode({
                'token': 'token-123',
                'user': {
                  'id': 'user-1',
                  'display_name': 'Anita Sharma',
                  'role': 'senior',
                },
              }),
              200,
            );
          }
          if (request.url.path == '/api/state') {
            return http.Response(
              jsonEncode({
                'resident': {
                  'id': 'resident-1',
                  'name': 'Anita Sharma',
                  'community': 'Park View',
                },
                'medications': [
                  {
                    'id': 'med-1',
                    'name': 'Lisinopril 10mg',
                    'remaining_count': 5,
                    'status': 'pending',
                  },
                ],
                'services': [
                  {
                    'id': 'service-1',
                    'name': 'CareRide',
                    'category': 'Transportation',
                  },
                ],
                'people': [
                  {
                    'id': 'person-1',
                    'name': 'Rita Sharma',
                    'phone': '+13035550111',
                  },
                ],
                'bookings': [],
                'healthVitals': {
                  'summary': {'riskLevel': 'low'},
                },
              }),
              200,
            );
          }
          return http.Response(
            jsonEncode({
              'ok': true,
              'booking': {'id': 'booking-1'},
            }),
            200,
          );
        }),
      );

      final state = await client.loadResidentState();
      expect(state.residentName, 'Anita Sharma');
      expect(state.medications.single.id, 'med-1');
      expect(state.services.single.name, 'CareRide');

      await client.confirmMedication('med-1');
      await client.requestMedicationRefill('med-1');
      await client.sendGuruMessage('I need a ride tomorrow');
      await client.createRideBooking(
        serviceId: 'service-1',
        label: 'Cardiology Visit',
        time: 'Tomorrow, 10:00 AM',
        pickupLabel: state.community,
        riderName: state.residentName,
      );
      await client.createSupportOrder(
        category: 'grocery',
        label: 'Groceries',
        recipientName: state.residentName,
        deliveryAddress: state.community,
      );
      await client.joinEvent('chair_yoga', 'Chair Yoga');
      await client.createPost('Beautiful morning walk with friends');
      await client.triggerSos();
      await client.startRoleSession('trusted_person', displayName: 'Rita');
      await client.completeTrustCircleOnboarding();
      await client.startRoleSession('business', displayName: 'Rohit');
      await client.completeBusinessOnboarding();
      await client.startRoleSession('senior', displayName: 'Anita');
      await client.completeSeniorOnboarding();

      expect(
        requests.map((item) => item['path']),
        containsAll([
          '/api/auth/device-session',
          '/api/state',
          '/api/medications/confirm',
          '/api/medications/refill-request',
          '/api/guru/chat',
          '/api/bookings',
          '/api/orders',
          '/api/events/join',
          '/api/posts',
          '/api/safety/voice-sos',
          '/api/onboarding/trust-circle',
          '/api/onboarding/business',
          '/api/onboarding/senior',
        ]),
      );
      final sessionBodies = requests
          .where((item) => item['path'] == '/api/auth/device-session')
          .map((item) => jsonDecode(item['body'] as String))
          .toList();
      expect(sessionBodies.any((body) => body['role'] == 'senior'), isTrue);
      expect(
        sessionBodies.any((body) => body['role'] == 'trusted_person'),
        isTrue,
      );
      expect(sessionBodies.any((body) => body['role'] == 'business'), isTrue);
      Map<String, dynamic> requestBody(String path) {
        return jsonDecode(
              requests.lastWhere((item) => item['path'] == path)['body']
                  as String,
            )
            as Map<String, dynamic>;
      }

      final seniorOnboarding = requestBody('/api/onboarding/senior');
      expect(seniorOnboarding, isEmpty);

      final trustOnboarding = requestBody('/api/onboarding/trust-circle');
      expect(trustOnboarding, isEmpty);

      final businessOnboarding = requestBody('/api/onboarding/business');
      expect(businessOnboarding, isEmpty);
      expect(
        requests
            .where((item) => item['path'] != '/api/auth/device-session')
            .every((item) => item['authorization'] == 'Bearer token-123'),
        isTrue,
      );
    },
  );
}
