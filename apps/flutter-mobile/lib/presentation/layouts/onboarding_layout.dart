import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/presentation/layouts/layouts.dart';

class OnboardingLayout extends StatelessWidget {
  final Widget child;
  final int step;
  final String title;
  final String subtitle;

  const OnboardingLayout({
    super.key,
    required this.child,
    required this.step,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 10,
      ),
      bottomNavigationBar: const SafeArea(
        child: SizedBox(),
      ),
      body: PhoneFrame(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('$step.',  style: theme.textTheme.headlineLarge?.copyWith(
                        fontSize: 24
                    ),),
                    const SizedBox(width:8),
                    Expanded(
                      child:  Text(
                        title,
                        style: theme.textTheme.headlineLarge?.copyWith(
                            fontSize: 24
                        ),
                      ),
                    )
                  ],
                ),

                const SizedBox(height: 10),

                Text(
                  subtitle,
                  style: theme.textTheme.bodyMedium?.copyWith(
                      fontSize: 16,
                      height: 1.6,

                  ),
                ),

                const SizedBox(height: 20),
                child,
              ],
            ),
          ),
        )
      ),
    );
  }
}