import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/core/config/app_images.dart';
import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
import 'package:theseniorguru_mobile/presentation/layouts/onboarding_layout.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/cards/cards.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/images/assets_image.dart';

class Medications extends StatelessWidget {
  const Medications({super.key});

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      step: 6,
      title: "Medications",
      subtitle: "Add medications so i can remind you.",
      child: Column(
        children: [
          const SizedBox(height: 10),
          Center(child: AssetsImage(path: AppImages.medicationPlaceholder, height: 200,)),
            const SizedBox(height: 30),
          OnboardingOptionCard(
            item: (CupertinoIcons.pencil, "Add Manually", "Lisinopril 10 mg"),
          ),
          OnboardingOptionCard(
            item: (
              CupertinoIcons.camera,
              "Scan Medication Bottle",
              "Use camera",
            ),
          ),
          OnboardingOptionCard(
            item: (
              CupertinoIcons.tray_arrow_down_fill,
              "Import from Pharmacy",
              "Connect",
            ),
          ),
          
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
                onPressed: (){}, 
                style: AppButtonTheme.primary(context),
                child: Text("Continue")
            ),
          ),
          const SizedBox(height: 10),
          TextButton(
              onPressed: (){},
              child: Text("Skip for now", style: TextStyle(fontWeight: FontWeight.w600),)
          )
        ],
      ),
    );
  }
}
