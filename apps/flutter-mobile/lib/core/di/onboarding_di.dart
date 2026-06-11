import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/core/di/shared_di.dart';
import 'package:theseniorguru_mobile/core/network/http_service.dart';
import 'package:theseniorguru_mobile/data/data_source/onboarding/remote.dart';
import 'package:theseniorguru_mobile/data/repository/onboarding_repository_impl.dart';
import 'package:theseniorguru_mobile/domain/repository/onboarding_repository.dart';
import '../../data/data_source/auth/local.dart';
import '../storage/pref_storage.dart';
import '../storage/secure_storage.dart';

final onboardingRepositoryProvider = Provider<OnboardingRepository>((ref) {
  final PrefStorage prefStore = ref.watch(preferenceStorageProvider);
  final SecureStorage secureStore = ref.watch(secureStorageProvider);
  final HttpService httpService = ref.watch(httpServiceProvider);

  final localSource = AuthLocalDatasourceImpl(prefStorage: prefStore, secureStorage: secureStore);
  final apiSource = OnboardingApiSourceImpl(apiServices: httpService);
  return OnboardingRepositoryImpl(remote: apiSource, local: localSource);
});

