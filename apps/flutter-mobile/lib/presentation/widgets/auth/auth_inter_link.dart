import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AuthInterLink extends StatelessWidget {
  final String title;
  final String linkLabel;
  final String routeName;

  const AuthInterLink({super.key, required this.title, required this.routeName, required this.linkLabel});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text.rich(
      TextSpan(
        text: title, // Inherits default style
        children: <InlineSpan>[
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: GestureDetector(
              onTap: () {
                context.goNamed(routeName);
              },
              child: Text(
                linkLabel,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}