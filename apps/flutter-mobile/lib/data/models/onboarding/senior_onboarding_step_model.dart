import 'package:theseniorguru_mobile/core/utils/json_utils.dart';

class SeniorOnboardingStepResponse {
  final String flow;
  final String status;
  final int currentStep;
  final String currentStepKey;
  final int totalSteps;
  final List<int> completedSteps;
  final List<int> skippedSteps;
  final bool isComplete;
  final String? resumeScreen;
  final Map<String, dynamic> payload;

  SeniorOnboardingStepResponse({
    required this.flow,
    required this.status,
    required this.currentStep,
    required this.currentStepKey,
    required this.totalSteps,
    required this.completedSteps,
    required this.skippedSteps,
    required this.isComplete,
    this.resumeScreen,
    required this.payload,
  });

  factory SeniorOnboardingStepResponse.fromJson(Map<String, dynamic> json) {
    return SeniorOnboardingStepResponse(
      flow: json['flow'],
      status: json['status'],
      currentStep: JsonUtils.parseInt(json['currentStep']),
      currentStepKey: json['currentStepKey'],
      totalSteps: json['totalSteps'],
      completedSteps: List<int>.from(json['completedSteps']),
      skippedSteps: List<int>.from(json['skippedSteps']),
      isComplete: json['isComplete'],
      resumeScreen: json['resumeScreen'],
      payload: json['payload'] ?? {},
    );
  }
}