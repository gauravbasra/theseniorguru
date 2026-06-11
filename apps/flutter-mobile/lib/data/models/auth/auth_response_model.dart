import 'onboarding_status_model.dart';
import 'user_model.dart';

class AuthResponseModel  {
  final String token;
  final UserModel user;
  final OnboardingStatusModel onboardingStatus;
  const AuthResponseModel({
    required this.token,
    required this.user,
    required this.onboardingStatus,
  });

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    return AuthResponseModel(
      token: json['token'],
      user: UserModel.fromJson(json['user']),
      onboardingStatus: OnboardingStatusModel.fromJson(json['onboarding_status'])
    );
  }
}

class OnboardingRoleSelection {
  final UserModel user;
  final OnboardingStatusModel onboardingStatus;

  const OnboardingRoleSelection({
    required this.user,
    required this.onboardingStatus,
  });

}