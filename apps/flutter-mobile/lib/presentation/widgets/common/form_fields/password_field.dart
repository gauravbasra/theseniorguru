import 'package:flutter/material.dart';

class PasswordField extends StatefulWidget {
  final TextEditingController? controller;
  final FocusNode? focus;
  final ValueChanged<String>? onFieldSubmitted;
  final FormFieldValidator<String>? validator;
  final String hintText;
  final IconData? prefixIcon;
  const PasswordField({
    super.key,
    this.controller,
    this.focus,
    this.onFieldSubmitted,
    this.validator,
    this.hintText = "Enter password",
    this.prefixIcon
  });

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscureText = true;
  @override
  Widget build(BuildContext context) {

    final baseDecoration = InputDecoration(
        hintText: widget.hintText,
        prefixIcon: widget.prefixIcon != null? Icon(widget.prefixIcon, color: Colors.grey,) : null,
        suffixIcon: IconButton(
          onPressed: () {
            setState(() {
              _obscureText = !_obscureText;
            });
          },
          icon: Icon(
            _obscureText ? Icons.visibility : Icons.visibility_off,
          ),
        )
    );

    return TextFormField(
      controller: widget.controller,
      obscureText: _obscureText,
      focusNode: widget.focus,
      onFieldSubmitted:widget.onFieldSubmitted,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      validator: widget.validator,
      decoration:baseDecoration,
    );
  }
}
