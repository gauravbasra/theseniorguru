import 'package:theseniorguru_mobile/domain/entity/auth/onboarding_status.dart';

import 'user.dart';

class AuthResult {
  final String token;
  final User user;
  final OnboardingStatus onboardingStatus;

  const AuthResult({
    required this.token,
    required this.user,
    required this.onboardingStatus
  });
}