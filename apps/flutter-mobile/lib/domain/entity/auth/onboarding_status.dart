class OnboardingStatus {
  final bool roleSelected;
  final String? role;
  final bool isOnboarded;
  final String? flow;
  final int? currentStep;
  final String? currentStepKey;
  final int totalSteps;
  final String nextStep;
  final List<int> completedSteps;
  final List<int> skippedSteps;

  OnboardingStatus({
    required this.roleSelected,
    this.role,
    required this.isOnboarded,
    this.flow,
    this.currentStep,
    this.currentStepKey,
    required this.totalSteps,
    required this.nextStep,
    required this.completedSteps,
    required this.skippedSteps,
  });
}