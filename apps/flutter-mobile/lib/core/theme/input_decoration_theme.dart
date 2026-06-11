import 'package:flutter/material.dart';
import '../theme/tsg_colors.dart';

final InputDecorationTheme inputDecorationTheme = InputDecorationTheme(
  filled: true,
  fillColor: Colors.white,

  border: border,

  enabledBorder: border,
  hintStyle: TextStyle(
    fontSize: 14
  ),

  focusedBorder: border.copyWith(
    borderSide: const BorderSide(
      color: TsgColors.purple,
      width: 1.5,
    ),
  ),

  errorBorder: border.copyWith(
    borderSide: const BorderSide(
      color: Colors.red,
    ),
  ),

  focusedErrorBorder: border.copyWith(
    borderSide: const BorderSide(
      color: Colors.red,
      width: 1.5,
    ),
  ),

  contentPadding: const EdgeInsets.symmetric(
    horizontal: 14,
    vertical: 14,
  ),
);

OutlineInputBorder border = OutlineInputBorder(
  borderRadius: BorderRadius.circular(8),
  borderSide: BorderSide(
    color: TsgColors.line,
    // color: Colors.black.withValues(alpha: 0.2),
    width: 1.2,
  ),
);