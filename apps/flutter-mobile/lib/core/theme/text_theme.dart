import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/core/theme/tsg_colors.dart';

final textTheme = TextTheme(
  /// BIG TITLE
  displayLarge: TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: Colors.black,
    // color: Color(0xFF161616),
    height: 1.2,
  ),

  /// SCREEN TITLE
  headlineLarge: TextStyle(
    fontSize: 26,
    fontWeight: FontWeight.w700,
    color: Colors.black,
    // color: Color(0xFF161616),
  ),

  /// CARD TITLE
  headlineMedium: TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: Colors.black,
    // color: Color(0xFF161616),
  ),

  headlineSmall: TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: Colors.black,
    // color: Color(0xFF161616),
  ),

  /// SECTION TITLE
  titleLarge: TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: Colors.black,
    // color: Color(0xFF344054),
  ),

  /// LABEL
  titleMedium: TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w500,
    color: Colors.black,
    // color: Color(0xFF667085),
  ),

  /// LABEL
  titleSmall: TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: Colors.black,
    // color: Color(0xFF667085),
  ),

  /// NORMAL BODY
  bodyLarge: TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    color: Colors.black,
  ),

  /// SMALL BODY
  bodyMedium: TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: TsgColors.muted,
  ),

  /// VERY SMALL
  bodySmall: TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: TsgColors.muted,
  ),
);
