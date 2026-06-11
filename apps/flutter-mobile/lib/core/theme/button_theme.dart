import 'package:flutter/material.dart';

class AppButtonTheme {
  const AppButtonTheme._();

  static  ButtonStyle primary (BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return ElevatedButton.styleFrom(
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
        textStyle: theme.textTheme.bodyLarge?.copyWith(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10)
        )
    );
  }

  static  ButtonStyle secondary (BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return ElevatedButton.styleFrom(
        backgroundColor: colorScheme.secondary,
        foregroundColor: colorScheme.onSecondary,
        fixedSize: Size.fromHeight(50),
        textStyle: theme.textTheme.bodyLarge?.copyWith(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10)
        )
    );
  }

  static  ButtonStyle primaryLightButton (BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    return ElevatedButton.styleFrom(
        elevation: 0,
        backgroundColor: colorScheme.primary.withValues(alpha: 0.1),
        foregroundColor: colorScheme.primary,
        textStyle: theme.textTheme.bodyLarge?.copyWith(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10)
        )
    );
  }

  static ButtonStyle outlineMuted  = OutlinedButton.styleFrom(
    side:  BorderSide(
      color:Color(0xFFD8D8D8),
      width: 1.2,
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8),
    ),
    foregroundColor: Colors.black
  );

}