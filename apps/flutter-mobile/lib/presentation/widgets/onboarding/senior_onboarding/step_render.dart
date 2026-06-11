import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/onboarding_welcome.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/basic_info.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/connect_device.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/health_snapshot.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/medications.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/permissions.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/photo.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/steps/verify_video.dart';

class SeniorOnboarding extends StatelessWidget{
  const SeniorOnboarding({super.key});

  @override
  Widget build(BuildContext context) {
    // return OnboardingWelcome();
    // return SeniorPhoto();
    // return VerifyVideo();
    // return BasicInfo();
    // return HealthSnapshot();
    // return Medications();
    // return ConnectDevice();
    return Permissions();
  }
}


