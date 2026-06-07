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
}
