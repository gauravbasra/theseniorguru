import 'package:theseniorguru_mobile/core/utils/json_utils.dart';

class OnboardingStatusModel {
  final bool roleSelected;
  final String? role;
  final bool isOnboarded;
  final String? flow;
  final int? currentStep;
  final String? currentStepKey;
  final int totalSteps;
  final String nextStep;
  final List<int>? completedSteps;
  final List<int>? skippedSteps;


  OnboardingStatusModel({
    required this.roleSelected,
    this.role,
    required this.isOnboarded,
    this.flow,
    this.currentStep,
    this.currentStepKey,
    required this.totalSteps,
    required this.nextStep,
     this.completedSteps,
     this.skippedSteps,
  });

  factory OnboardingStatusModel.fromJson(Map<String, dynamic> json) {
    return OnboardingStatusModel(
      roleSelected: json['roleSelected'] ?? false,
      role: json['role'],
      isOnboarded: json['isOnboarded'] ?? false,
      flow: json['flow'],
      currentStep: JsonUtils.parseInt(json['currentStep']),
      currentStepKey: json['currentStepKey'],
      totalSteps: json['totalSteps'] ?? 0,
      nextStep: json['nextStep'] ?? '',
      completedSteps:  List<int>.from(json['completedSteps']),
      skippedSteps: List<int>.from(json['skippedSteps']),
    );
  }

  Map<String, dynamic> toJson() => {
    'roleSelected': roleSelected,
    'role': role,
    'isOnboarded': isOnboarded,
    'flow': flow,
    'currentStep': currentStep,
    'currentStepKey': currentStepKey,
    'totalSteps': totalSteps,
    'nextStep': nextStep,
    'completedSteps': completedSteps,
      'skippedSteps':skippedSteps
  };
}