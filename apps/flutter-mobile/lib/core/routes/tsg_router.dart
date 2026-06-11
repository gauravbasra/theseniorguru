import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:theseniorguru_mobile/core/di/shared_di.dart';
import 'package:theseniorguru_mobile/core/routes/config/auth_routes.dart';
import 'package:theseniorguru_mobile/core/routes/config/onboarding_routes.dart';
import 'package:theseniorguru_mobile/core/routes/navigation_keys.dart';
import 'package:theseniorguru_mobile/presentation/providers/auth/auth_providers.dart';
import 'package:theseniorguru_mobile/presentation/screens/shared/splash_screen.dart';
import './routes_name.dart';
import 'config/senior_routes.dart';

final tsgRouter = Provider<GoRouter>((ref) {
  // final authState = ref.watch(authProvider);
  // final isInitializeApp = ref.watch(appInitializeProvider);
  // final isAuthenticated = ref.watch(loginViewModel.select((s) => s.authSession != null));

  final refreshListenable = RouterRefreshListenable(ref);

  return GoRouter(
    navigatorKey: NavigationKeys.root,
    initialLocation: '/splash',
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isInitializeApp = ref.read(appInitializeProvider);
      final authResult = authState.authResult;
      final isLoggedIn = authResult != null;
      final location = state.matchedLocation;

      final splashRoute = location == '/splash';

      print("fe f3ef3 ${authState.authResult?.onboardingStatus.isOnboarded} ${isLoggedIn}");

        print("isInitializeApp $isInitializeApp");


      if(!isInitializeApp){
        return splashRoute ? null : '/splash';
      }

      if (!isLoggedIn) {
        print("Inside login ${location == '/sign-up'} $location, location == '/login' || location == '/sign-up' ${location == '/login' || location == '/sign-up'}");
        // Allow access to login and sign-up, otherwise redirect to login
        return (location == '/login' || location == '/sign-up') ? null : '/login';
      }

      // ----- User IS logged in -----
      final onboardingStatus = authResult.onboardingStatus;
          if(onboardingStatus.isOnboarded == false){
              if(onboardingStatus.roleSelected==true){
                print("onboardingStatus.roleSelected ${onboardingStatus.roleSelected}");
                  return '/senior-onboarding';
              }else{
                return '/role-selection';
              }
          }else{
            return '/senior/tsg-guru';
          }
      // if (onboardingStatus.isOnboarded == true) {
      //   // If trying to access login, sign-up, role-selection, or onboarding -> redirect to dashboard
      //   if (location == '/login' || location == '/sign-up' ||
      //       location == '/role-selection' || location.startsWith('/onboarding')) {
      //     return '';
      //   }
      //   // Role-based route blocking
      //   final role = authResult.user.role;
      //   if (location.startsWith('/senior') && role != 'senior') {
      //     return '';
      //   }
      //   if (location.startsWith('/family') && role != 'family') {
      //     return '';
      //   }
      //   if (location.startsWith('/service-provider') && role != 'serviceProvider') {
      //     return '';
      //   }
      //   // Allowed to proceed
      //   return null;
      // }

      return null;

      // CASE 2: Onboarding NOT completed
      // Prevent access to any protected routes (dashboard, profile, etc.)


      return null;
},

      // Logged in, but trying to go to login or onboarding (skip) -> dashboard
      // if (isLoggedIn && (location == '/login' || location.startsWith('/onboarding'))) {
      //   return _getDashboardPath(user!.role);
      // }

      // Role‑based route blocking
      // if (isLoggedIn) {
      //   if (location.startsWith('/senior') && user!.role != AppRole.senior) {
      //     return _getDashboardPath(user.role);
      //   }
      //   if (location.startsWith('/family') && user!.role != AppRole.family) {
      //     return _getDashboardPath(user.role);
      //   }
      //   if (location.startsWith('/service-provider') && user!.role != AppRole.serviceProvider) {
      //     return _getDashboardPath(user.role);
      //   }
      // }
    routes: [
      GoRoute(
        name: RoutesName.splash,
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      ...authRoutes,

      ...onboardingRoutes,
      ...seniorRoutes,
    ],
    errorBuilder: (context, state) =>
        Scaffold(body: Center(child: Text('Error: ${state.error}'))),
  );
});


class RouterRefreshListenable extends ChangeNotifier {
  RouterRefreshListenable(Ref ref) {
    // Listen to initialization updates
    ref.listen(appInitializeProvider, (_, _) => notifyListeners());

    // Listen to authentication state updates
    ref.listen(authProvider, (_, _) => notifyListeners());
  }
}