import 'package:go_router/go_router.dart';
import 'package:theseniorguru_mobile/presentation/screens/auth/login_screen.dart';
import 'package:theseniorguru_mobile/presentation/screens/auth/register_screen.dart';

import '../routes_name.dart';


List<GoRoute> authRoutes  = [
  GoRoute(
      path: '/login',
      name: RoutesName.login,
      builder: (_,_)=> const LoginScreen()
  ),

  GoRoute(
      path: '/sign-up',
      name: RoutesName.register,
      builder: (_,_)=> const RegisterScreen()
  ),
];