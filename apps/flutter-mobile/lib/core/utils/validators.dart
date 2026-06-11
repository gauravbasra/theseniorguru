class Validators {
  static String? email(String? value) {
    if (value == null || value.isEmpty) return 'Email is required';

    final emailRegex = RegExp(r'^[^@]+@[^@]+\.[^@]+');
    if (!emailRegex.hasMatch(value)) {
      return 'Please enter a valid email';
    }

    return null;
  }

  static String? phone(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Phone number is required';
    }

    // 10 digit phone number
    final phoneRegex = RegExp(r'^[0-9]{10}$');

    if (!phoneRegex.hasMatch(value.trim())) {
      return 'Please enter a valid 10-digit phone number';
    }

    return null;
  }

  static String? required(
      String? value, [
        String fieldName = 'This field',
      ]) {
    if (value == null || value.trim().isEmpty) {
      return '$fieldName is required';
    }
    return null;
  }

  static String? maxLengthValidation(String? value, int max) {
    if (value != null && value.trim().length > max) {
      return 'Can be up to $max characters long';
    }
    return null;
  }

  static String? minLengthValidation(String? value, int min) {
    if (value != null && value.trim().length < min) {
      return 'Must be at least $min characters long';
    }
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Password is required';
    }

    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (value.length > 20) {
      return 'Password can be at most 20 characters';
    }

    return null;
  }
}