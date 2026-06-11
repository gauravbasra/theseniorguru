import 'package:go_router/go_router.dart';

class RoutesUtils {
  static String? authGuard({
    required GoRouterState state,
    required bool isAuthenticated,
    required bool isInitializeApp
  }) {

    final isLoginRoute = state.matchedLocation == '/login';

    final isAuthRoute = isLoginRoute;

    final splashRoute = state.matchedLocation == '/splash';

    if(!isInitializeApp){
      return splashRoute ? null : '/splash';
    }


    if (!isAuthenticated) {
      return isAuthRoute ? null : '/login';
    }else{
      return '/home';
    }

    return null;
  }
}