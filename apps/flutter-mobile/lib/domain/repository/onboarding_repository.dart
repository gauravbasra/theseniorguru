import 'package:theseniorguru_mobile/domain/entity/auth/onboarding_status.dart';

import '../entity/auth/user.dart';

abstract class OnboardingRepository {
  Future<(User, OnboardingStatus)> roleSelect({required String role});

  Future<OnboardingStatus>  seniorOnboardingStep({required int step, required String stepKey, required String screen,required Map<String, dynamic> data, bool skipped =false });

}