import 'package:go_router/go_router.dart';
import 'package:theseniorguru_mobile/presentation/screens/auth/login_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/auth/register_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/onboarding/onboarding_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/onboarding/role_selection_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/seniors/guru_home_screen.dart';

import '../routes_name.dart';


List<GoRoute> seniorRoutes  = [
  GoRoute(
      path: '/senior/tsg-guru',
      name: RoutesName.tsgGuru,
      builder: (_,_)=> const GuruHomeScreen(),

  ),

];