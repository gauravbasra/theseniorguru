import 'package:flutter/material.dart';

import '../../../../core/theme/button_theme.dart';

class PrimaryButton extends StatelessWidget {
  final String label;
  final bool isLoading;
  final VoidCallback onPressed;
  const PrimaryButton({
    super.key,
    required  this.label,
    this.isLoading =false,
    required this.onPressed
  });

  @override
  Widget build(BuildContext context) {
    return  SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: AppButtonTheme.primary(context),
        child:   Text(isLoading ? "Please wait..." : label),
      ),
    );
  }
}