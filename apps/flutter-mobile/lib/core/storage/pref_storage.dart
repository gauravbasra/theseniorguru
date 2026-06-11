import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class PrefStorage {

  // =====================================================
  // SHARED PREFERENCES
  // =====================================================

  Future<void> setPrefString(String key, String value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      prefs.setString(key, value);
    } catch (e, s) {
      debugPrint(' SharedPref setString error [$key]: $e');
      debugPrintStack(stackTrace: s);
    }
  }

  Future<String?> getPrefString(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(key);
    } catch (e) {
      return null;
    }
  }

  Future<void> setPrefJson(String key, Map<String, dynamic> value) async {
    final jsonString = jsonEncode(value);
    await setPrefString(key, jsonString);
  }

  Future<Map<String, dynamic>?> getPrefJson(String key) async {
    try {
      final jsonString = await getPrefString(key);
      if (jsonString == null) return null;
      return jsonDecode(jsonString);
    } catch (e) {
      return null;
    }
  }

  Future<void> removePref(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);
    } catch (e) {
      debugPrint('SharedPref remove error [$key]: $e');
    }
  }
}
