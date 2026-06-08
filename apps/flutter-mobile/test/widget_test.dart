import 'package:flutter_test/flutter_test.dart';
import 'package:theseniorguru_flutter_mobile/main.dart';

void main() {
  testWidgets('resident app opens with TSG Guru first', (tester) async {
    await tester.pumpWidget(const TsgResidentApp());

    expect(find.text('How can we help?'), findsOneWidget);
    expect(find.text('TSG Guru'), findsOneWidget);
    expect(find.text('Today'), findsOneWidget);
  });

  test('bottom drawer destinations are role specific', () {
    final senior = bottomTabsForRole(
      AppRole.senior,
    ).map((tab) => tab.label).toList();
    final trustedCircle = bottomTabsForRole(
      AppRole.trustedCircle,
    ).map((tab) => tab.label).toList();
    final business = bottomTabsForRole(
      AppRole.business,
    ).map((tab) => tab.label).toList();

    expect(senior, ['TSG Guru', 'Today', 'Companion', 'Feed', 'More']);
    expect(trustedCircle, ['Overview', 'Vitals', 'Risk', 'Circle', 'More']);
    expect(business, ['Dashboard', 'Leads', 'Bookings', 'Messages', 'More']);
    expect(business, isNot(senior));
    expect(trustedCircle, isNot(senior));
  });

  test('onboarding media cards map to backend evidence contracts', () {
    final seniorPhoto = evidenceCaptureSpecForOption(
      seniorStepSpecs[1],
      'Take Photo',
    );
    final seniorLiveness = evidenceCaptureSpecForOption(
      seniorStepSpecs[2],
      'Blink your eyes',
    );
    final businessLicense = evidenceCaptureSpecForOption(
      businessStepSpecs[2],
      'Business License',
    );
    final governmentId = evidenceCaptureSpecForOption(
      businessStepSpecs[2],
      'Government ID',
    );

    expect(seniorPhoto?.subjectRole, 'senior');
    expect(seniorPhoto?.evidenceType, 'profile_photo');
    expect(seniorPhoto?.mediaKind, EvidenceMediaKind.image);
    expect(seniorLiveness?.evidenceType, 'liveness_video');
    expect(seniorLiveness?.mediaKind, EvidenceMediaKind.video);
    expect(businessLicense?.subjectRole, 'business_owner');
    expect(businessLicense?.evidenceType, 'business_license');
    expect(governmentId?.evidenceType, 'government_id');
  });
}
