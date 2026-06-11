import 'package:flutter/material.dart';
import '../../../../core/theme/tsg_colors.dart';

class SoftCard extends StatelessWidget {
  const SoftCard({
    super.key,
    required this.child,
    this.color = TsgColors.card,
    this.padding = const EdgeInsets.all(18),
    this.onTap,
  });

  final Widget child;
  final Color color;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color, Color.lerp(color, Colors.white, .72)!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: Colors.white.withValues(alpha: .9),
          width: 1.2,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x142D2038),
            blurRadius: 26,
            offset: Offset(0, 12),
          ),
          BoxShadow(
            color: Color(0x08FFFFFF),
            blurRadius: 2,
            offset: Offset(0, -1),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}