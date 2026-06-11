import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/presentation/layouts/onboarding_layout.dart';
import 'package:theseniorguru_mobile/presentation/providers/onboarding/onboarding_provider.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/buttons/primary.dart';
import '../../../core/theme/TSG_colors.dart';
import '../../providers/auth/auth_providers.dart';

class OnboardingWelcome extends ConsumerWidget {
  const OnboardingWelcome({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final authState = ref.watch(authProvider).authResult;
    final notifier = ref.read(onboardingProvider.notifier);
    final onboardingState = ref.watch(onboardingProvider);
    return OnboardingLayout(
      step: 1,
      title: "Welcome",
      subtitle: "",
      child: Column(
          children: [
            Center(
              child: PhotoTile(
                icon: CupertinoIcons.person_2_fill,
                width: 178,
                height: 150,
                color: Color(0xFFFFEEE6),
                accent: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 26),
            Center(
              child: Text('Hello ${authState?.user.displayName}', style:  theme.textTheme.headlineLarge,textAlign: TextAlign.center,),
            ),
            const SizedBox(height: 10),
            const Center(
              child: Text(
                "I am GURU your AI companion. I'm here to make daily life easier, safer and more connected. ",
                textAlign: TextAlign.center,
                style: TextStyle(color: TsgColors.muted, height: 1.35),
              ),
            ),
            const SizedBox(height: 34),
            PrimaryButton(
              onPressed: (){
                notifier.onboardStep(
                  step: 1,
                  stepKey: "welcome",
                  screen :'onboardingWelcome',
                  data: {},
                );
              },
              isLoading: onboardingState.loading,
              label: "Get Start",
            ),

          ]
      ),
    );
  }
}


class FlowNumber extends StatelessWidget {
  const FlowNumber(this.value, {super.key});
  final int value;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return CircleAvatar(
      radius: 14,
      backgroundColor: theme.colorScheme.primary,
      child: Text(
        '$value',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class PhotoTile extends StatelessWidget {
  const PhotoTile({
    super.key,
    required this.icon,
    this.color = TsgColors.cream,
    this.width = 96,
    this.height = 92,
    this.accent = TsgColors.purple,
  });

  final IconData icon;
  final Color color;
  final double width;
  final double height;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: [Colors.white, color, Color.lerp(color, accent, .08)!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x102D2038),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: CustomPaint(
        painter: SoftIllustrationPainter(icon: icon, accent: accent),
      ),
    );
  }
}

class SoftIllustrationPainter extends CustomPainter {
  const SoftIllustrationPainter({required this.icon, required this.accent});
  final IconData icon;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width * .55, size.height * .55);
    final glow = Paint()
      ..shader =
          RadialGradient(
            colors: [
              accent.withValues(alpha: .22),
              accent.withValues(alpha: 0),
            ],
          ).createShader(
            Rect.fromCircle(center: center, radius: size.shortestSide * .62),
          );
    canvas.drawCircle(center, size.shortestSide * .5, glow);

    final bubble = Paint()..color = Colors.white.withValues(alpha: .72);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          size.width * .14,
          size.height * .18,
          size.width * .72,
          size.height * .62,
        ),
        const Radius.circular(22),
      ),
      bubble,
    );

    final tp = TextPainter(
      text: TextSpan(
        text: String.fromCharCode(icon.codePoint),
        style: TextStyle(
          fontSize: size.shortestSide * .46,
          fontFamily: icon.fontFamily,
          package: icon.fontPackage,
          color: accent,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(
      canvas,
      Offset((size.width - tp.width) / 2, (size.height - tp.height) / 2),
    );

    final shine = Paint()
      ..color = Colors.white.withValues(alpha: .62)
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(size.width * .2, size.height * .23),
      Offset(size.width * .36, size.height * .15),
      shine,
    );
    canvas.drawLine(
      Offset(size.width * .72, size.height * .78),
      Offset(size.width * .84, size.height * .7),
      shine,
    );
  }

  @override
  bool shouldRepaint(covariant SoftIllustrationPainter oldDelegate) {
    return oldDelegate.icon != icon || oldDelegate.accent != accent;
  }
}

