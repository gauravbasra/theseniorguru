import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/presentation/providers/auth/auth_providers.dart';
import '../network/dio_http_service.dart';
import '../network/http_service.dart';
import '../storage/pref_storage.dart';
import '../storage/secure_storage.dart';

final secureStorageProvider = Provider<SecureStorage>((ref){
  return SecureStorage();
});

final preferenceStorageProvider = Provider<PrefStorage>((ref)=>PrefStorage());

final httpServiceProvider = Provider<HttpService>((ref)=>DioHttpService());




class AppInitialNotifier extends Notifier<bool> {
  @override
  bool build() {
    return false;
  }
  Future<void> init() async {
    try {
      await ref.read(authProvider.notifier).getCachedAuthSession();
    } catch (e, stack) {
      // Log error but don't let initialization fail completely
      print("Init error: $e\n$stack");
    } finally {
      // Always mark initialization as complete, even if there was an error
      state = true;
    }
  }
}

final appInitializeProvider = NotifierProvider<AppInitialNotifier, bool>(
  AppInitialNotifier.new,
);