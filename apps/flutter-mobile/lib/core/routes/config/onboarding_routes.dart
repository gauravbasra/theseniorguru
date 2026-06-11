import 'package:go_router/go_router.dart';
import 'package:theseniorguru_mobile/presentation/screens/auth/login_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/auth/register_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/onboarding/onboarding_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/onboarding/role_selection_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/onboarding/senior_onboarding_screen.dart';

import '../routes_name.dart';


List<GoRoute> onboardingRoutes  = [
  GoRoute(
      path: '/role-selection',
      name: RoutesName.roleSelection,
      builder: (_,_)=> const RoleSelectionScreen()
  ),

  GoRoute(
      path: '/senior-onboarding',
      name: RoutesName.seniorOnboarding,
      builder: (_,_)=> const SeniorOnboardingScreen()
  ),
];