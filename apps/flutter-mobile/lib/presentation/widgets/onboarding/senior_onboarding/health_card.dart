import 'package:flutter/material.dart';

class HealthCard extends StatelessWidget {
  final HealthOption option;
  final bool selected;
  final VoidCallback onTap;

  const HealthCard({
    super.key,
    required this.option,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;
    final textTheme = theme.textTheme;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? primary.withValues(alpha: .08)
              : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            width: 1.4,
            color: selected
                ? primary
                : Colors.grey.shade300,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              option.icon,
              color: selected
                  ? primary
                  : Colors.grey.shade700,
              size: 28,
            ),

            const SizedBox(height: 12),

            Text(
              option.title,
              textAlign: TextAlign.center,
              style: textTheme.titleMedium?.copyWith(
                color: selected ? primary : null,
                fontWeight: FontWeight.w600
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class HealthOption {
  final String title;
  final IconData icon;

  const HealthOption({
    required this.title,
    required this.icon,
  });
}