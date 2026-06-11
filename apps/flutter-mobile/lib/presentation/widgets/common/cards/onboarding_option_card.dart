import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../../onboarding/senior_onboarding/steps/health_snapshot.dart';
import './soft_card.dart';

class OnboardingOptionCard extends StatelessWidget {
  const OnboardingOptionCard({
    super.key,
    required this.item,
    this.onTap,
  });

  final (IconData, String, String) item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SoftCard(
        padding: const EdgeInsets.all(13),
        onTap: onTap,
        child: Row(
          children: [
            Avatar(
              size: 42,
              icon: item.$1,
              tone: theme.colorScheme.primary.withValues(alpha: .12),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.$2,
                    style: theme.textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.$3,
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Icon(CupertinoIcons.chevron_right, color: theme.colorScheme.primary, size: 18),
          ],
        ),
      ),
    );
  }
}