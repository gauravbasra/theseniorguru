import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
import 'package:theseniorguru_mobile/presentation/layouts/onboarding_layout.dart';
import 'package:theseniorguru_mobile/presentation/widgets/onboarding/senior_onboarding/health_card.dart';

import '../../../../../core/theme/tsg_colors.dart';


final options = [
  HealthOption(
    title: 'High Blood\nPressure',
    icon: CupertinoIcons.drop_fill,
  ),
  // HealthOption(
  //   title: 'Diabetes',
  //   icon: CupertinoIcons.drop_fill,
  // ),
  HealthOption(
    title: 'Heart\nCondition',
    icon: CupertinoIcons.heart_fill,
  ),
  HealthOption(
    title: 'Memory\nConcerns',
    icon: CupertinoIcons.memories,
  ),
  HealthOption(
    title: 'Arthritis / Joint \nPain',
    icon: CupertinoIcons.bandage_fill,
  ),
  HealthOption(
    title: 'Vision / Hearing \nIssue',
    icon: CupertinoIcons.ear,
  ),
  HealthOption(
    title: 'Mobility\nLimitation',
    icon: CupertinoIcons.person_fill,
  ),
  HealthOption(
    title: 'Other',
    icon: CupertinoIcons.square_grid_2x2,
  ),
];

class HealthSnapshot extends StatelessWidget{
  const HealthSnapshot({super.key});
  final  labelSpacer = const SizedBox(height: 5,);
  final  fieldSpacer = const SizedBox(height: 18);
  @override
  Widget build(BuildContext context) {
    return OnboardingLayout(
      step: 5,
      title: "Health Snapshot.",
      subtitle:
      "Select what applies to you. \nYou can update anytime",

      child: Column(
        children: [
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: options.length,
            gridDelegate:
            const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.15,
            ),
            itemBuilder: (_, index) {
              return HealthCard(
                option: options[index],
                selected: index ==0,
                // selected: selectedIds.contains(index),
                onTap: () {},
              );
            },
          ),

          const SizedBox(height: 30),

          SizedBox(
            height: 48,
            width: double.infinity,
            child: ElevatedButton(
                onPressed: (){},
                style: AppButtonTheme.primary(context),
                child: Text("Continue")),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }


}


class Avatar extends StatelessWidget {
  const Avatar({
    super.key,
    this.size = 52,
    this.label = 'A',
    this.tone = TsgColors.lilac,
    this.icon,
  });
  final double size;
  final String label;
  final Color tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            Colors.white,
            tone,
            Color.lerp(tone, TsgColors.purple2, .12)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A6D3B91),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Center(
        child: icon == null
            ? Text(
          label,
          style: TextStyle(
            fontSize: size * .42,
            fontWeight: FontWeight.w800,
            color: theme.colorScheme.primary,
          ),
        )
            : Icon(icon, color: theme.colorScheme.primary, size: size * .48),
      ),
    );
  }
}