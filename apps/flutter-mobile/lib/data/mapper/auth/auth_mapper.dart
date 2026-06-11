import 'package:theseniorguru_mobile/data/models/auth/onboarding_status_model.dart';
import 'package:theseniorguru_mobile/data/models/onboarding/senior_onboarding_step_model.dart';
import 'package:theseniorguru_mobile/domain/entity/auth/onboarding_status.dart';

import '../../../domain/entity/auth/user.dart';
import '../../models/auth/user_model.dart';

extension UserModelMapper on UserModel {
  User toEntity() {
    return User(
      id: id,
      email: email,
      phone: phone,
      displayName: displayName,
      gender: gender,
      role: role,
      status: status,
      createdAt: createdAt,
      updatedAt: updatedAt,
      lastLoginAt: lastLoginAt,
    );
  }
}

extension UserEntityMapper on User {
  UserModel toModel() {
    return UserModel(
      id: id,
      email: email,
      phone: phone,
      displayName: displayName,
      gender: gender,
      role: role,
      status: status,
      createdAt: createdAt,
      updatedAt: updatedAt,
      lastLoginAt: lastLoginAt,
    );
  }
}

extension OnboardingModelMapper on OnboardingStatusModel {
  OnboardingStatus toEntity() {
    return OnboardingStatus(
      roleSelected: roleSelected,
      isOnboarded: isOnboarded,
      totalSteps: totalSteps,
      role: role,
      currentStep: currentStep,
      currentStepKey: currentStepKey,
      nextStep: nextStep,
      completedSteps: completedSteps ?? [],
      skippedSteps: skippedSteps ?? [],
    );
  }
}

// extension SeniorStepResponseMapper on SeniorOnboardingStepResponse{
//   OnboardingStatus stepResToEntity(){
//     return OnboardingStatus(
//       isOnboarded: isComplete,
//       currentStep: currentStep,
//       role: flow,
//       roleSelected: true,
//       currentStepKey: currentStepKey,
//       nextStep: "",
//       totalSteps:totalSteps,
//       skippedSteps: skippedSteps,
//       completedSteps: completedSteps
//     );
//   }
// }

extension SeniorStepResponseMapper on SeniorOnboardingStepResponse {
  OnboardingStatusModel toStepResModel() {
    return OnboardingStatusModel(
      isOnboarded: isComplete,
      currentStep: currentStep,
      role: flow,
      roleSelected: flow.isNotEmpty,
      currentStepKey: currentStepKey,
      nextStep: "",
      totalSteps: totalSteps,
      skippedSteps: skippedSteps,
      completedSteps: completedSteps,
    );
  }
}
