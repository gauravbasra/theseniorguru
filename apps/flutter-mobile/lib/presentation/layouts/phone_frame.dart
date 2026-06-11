import 'package:flutter/material.dart';

class PhoneFrame extends StatelessWidget {
  const PhoneFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth.clamp(360.0, 430.0);
        return Center(
          child: Container(
            width: width,
            height: constraints.maxHeight,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFFFFFCFA),
                  Color(0xFFFFF8F2),
                  Color(0xFFFCF7FF),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(
                constraints.maxWidth > 500 ? 36 : 0,
              ),
              boxShadow: constraints.maxWidth > 500
                  ? const [BoxShadow(color: Color(0x22000000), blurRadius: 40)]
                  : null,
            ),
            clipBehavior: Clip.antiAlias,
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(-.8, -.95),
                  radius: 1.4,
                  colors: [Color(0xFFFFF1E4), Color(0x00FFF1E4)],
                ),
              ),
              child: child,
            ),
          ),
        );
      },
    );
  }
}