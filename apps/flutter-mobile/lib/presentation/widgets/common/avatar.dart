import 'package:flutter/material.dart';

import '../../../core/theme/tsg_colors.dart';

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
            color: TsgColors.purple,
          ),
        )
            : Icon(icon, color: TsgColors.purple, size: size * .48),
      ),
    );
  }
}