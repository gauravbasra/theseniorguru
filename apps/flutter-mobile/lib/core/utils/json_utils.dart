class JsonUtils {
  static int parseInt(dynamic value) {
    if (value is int) return value;
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }

  static String parseString(dynamic value) {
    return value?.toString() ?? '';
  }
}