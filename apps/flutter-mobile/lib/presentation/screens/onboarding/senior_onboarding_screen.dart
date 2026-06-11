import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/presentation/providers/auth/auth_providers.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/onboarding_welcome.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/basic_info.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/photo.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/verify_video.dart';

final List<Widget> _seniorOnboardingSteps = [
  OnboardingWelcome(),
  SeniorPhoto(),
  VerifyVideo(),
  BasicInfo(),
];

class SeniorOnboardingScreen extends ConsumerStatefulWidget{
  const SeniorOnboardingScreen({super.key});

  @override
  ConsumerState<SeniorOnboardingScreen> createState()  => _SeniorOnBoardingState();
}

class _SeniorOnBoardingState extends ConsumerState<SeniorOnboardingScreen>{
  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider).authResult;
    final currentStep =
        authState?.onboardingStatus.currentStep ?? 1;
    final index =
    (currentStep - 1).clamp(0, _seniorOnboardingSteps.length - 1);
    final renderStep = _seniorOnboardingSteps[index];
    return renderStep;
  }
}


