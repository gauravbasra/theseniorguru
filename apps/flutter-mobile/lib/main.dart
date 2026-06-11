import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/core/routes/tsg_router.dart';
import 'package:theseniorguru_mobile/presentation/screens/auth/login_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/auth/register_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/onboarding/onboarding_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/onboarding/role_selection_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/seniors/guru_home_screen.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/step_render.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/photo.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/verify_video.dart';
import 'core/di/global_container.dart';
import 'core/theme/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    UncontrolledProviderScope(
      container: globalContainer,
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TheSeniorGuru',
      theme:lightTheme,
      home : VerifyVideo()
      // home: OnboardingScreen(),
    );
  }
}

// class MyApp extends ConsumerWidget {
//   const MyApp({super.key});
//
//   @override
//   Widget build(BuildContext context, WidgetRef ref) {
//     final router = ref.watch(tsgRouter);
//     return MaterialApp.router(
//       title: 'The Senior GURU',
//       theme: lightTheme,
//       routerConfig: router,
//     );
//   }
// }


