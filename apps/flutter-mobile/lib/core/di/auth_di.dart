import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/core/di/shared_di.dart';
import 'package:theseniorguru_mobile/core/network/http_service.dart';

import '../../data/data_source/auth/local.dart';
import '../../data/data_source/auth/remote.dart';
import '../../data/repository/auth_repository_impl.dart';
import '../../domain/repository/auth_repository.dart';
import '../storage/pref_storage.dart';
import '../storage/secure_storage.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final PrefStorage prefStore = ref.watch(preferenceStorageProvider);
  final SecureStorage secureStore = ref.watch(secureStorageProvider);
  final HttpService httpService = ref.watch(httpServiceProvider);

  final localSource = AuthLocalDatasourceImpl(prefStorage: prefStore, secureStorage: secureStore);
  final apiSource = AuthApiDatasourceImpl(apiServices: httpService);
  return AuthRepositoryImpl(remote: apiSource, local: localSource);
});

