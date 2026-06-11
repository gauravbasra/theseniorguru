import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/presentation/layouts/layouts.dart';

class AuthLayout extends ConsumerWidget {
  final String title;
  final String des;
  final Widget child;
  const AuthLayout({required this.child, super.key, required this.title, required this.des});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Colors.white,
      body: PhoneFrame(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
            child: Center(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: theme.colorScheme.primary,
                      child: Center(
                        child: Text("SG", style: theme.textTheme.headlineMedium?.copyWith(
                          color: theme.colorScheme.onPrimary,
                          fontWeight: FontWeight.bold
                        ),),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineLarge,
                    ),

                    const SizedBox(height: 8),

                    Text(
                      des,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium,
                    ),

                    const SizedBox(height: 15),
                    child
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
