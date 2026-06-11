import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/core/theme/color_schema.dart';
import 'package:theseniorguru_mobile/core/theme/input_decoration_theme.dart';
import 'package:theseniorguru_mobile/core/theme/text_theme.dart';
import 'TSG_colors.dart';

final lightTheme = ThemeData(
  fontFamily: 'Montserrat',
  useMaterial3: true,
  appBarTheme: AppBarTheme(
    backgroundColor: TsgColors.cream,
  ),
  scaffoldBackgroundColor: TsgColors.canvas,
  colorScheme: lightColorScheme,
  textTheme: textTheme,
  inputDecorationTheme: inputDecorationTheme,

);


