import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
import 'package:theseniorguru_mobile/presentation/layouts/onboarding_layout.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/cards/cards.dart';

class Permissions extends StatelessWidget {
  const Permissions({super.key});

  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      step: 8,
      title: "Permissions",
      subtitle: "Allow permissions to enable core features.",
      child: Column(
        children: [
          OnboardingOptionCard(
            item: (CupertinoIcons.location_fill, "Locations", "Used for rides, emergencies and check-ins"),
          ),
          OnboardingOptionCard(
            item: (
            CupertinoIcons.bell_fill,
            "Notifications",
            "Reminders and important alerts",
            ),
          ),

          const SizedBox(height: 30),
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
