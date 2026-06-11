import 'package:flutter/material.dart';

class FormUtils {
  static void fieldFocusChange(
      BuildContext context,
      FocusNode current,
      FocusNode next,
      ) {
    current.unfocus();
    FocusScope.of(context).requestFocus(next);
  }

}
