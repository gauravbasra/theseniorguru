import 'package:flutter_test/flutter_test.dart';
import 'package:theseniorguru_flutter_mobile/main.dart';

void main() {
  testWidgets('resident app opens with TSG Guru first', (tester) async {
    await tester.pumpWidget(const TsgResidentApp());

    expect(find.text('How can we help?'), findsOneWidget);
    expect(find.text('TSG Guru'), findsOneWidget);
    expect(find.text('Today'), findsOneWidget);
  });
}
