import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';


class SecureStorage {

  final FlutterSecureStorage _secureStorage = FlutterSecureStorage();

// =====================================================
// SECURE STORAGE
// =====================================================

  Future<void> setSecureString(String key, String value) async {
    await _secureStorage.write(key: key, value: value);
  }


  Future<String?> getSecureString(String key) async {
    try {
      return  await _secureStorage.read(key: key);
    } catch (e) {
      return null;
    }
  }

  Future<void> setSecureJson(String key, Map<String, dynamic> value) async {
    final jsonString = jsonEncode(value);
    await setSecureString(key, jsonString);
  }

  Future<Map<String, dynamic>?> getSecureJson(String key) async {
    try {
      final jsonString = await getSecureString(key);
      if (jsonString == null) return null;
      return jsonDecode(jsonString);
    } catch (e) {
      return null;
    }
  }

  Future<void> removeSecure(String key) async {
    try {
      await _secureStorage.delete(key: key);
    } catch (e) {
      debugPrint('SecureStorage remove error [$key]: $e');
    }
  }

  Future<void> clearSecureStorage() async {
    try {
      await _secureStorage.deleteAll();
    } catch (e) {
      debugPrint('SecureStorage clear error: $e');
    }
  }

}
