import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/core/di/onboarding_di.dart';
import 'package:theseniorguru_mobile/domain/entity/auth/auth_result.dart';
import '../auth/auth_providers.dart';

/// --------------- STATE -------------
class OnboardingProvider {
  final bool loading;
  final String? error;

  const OnboardingProvider({
    this.loading = false,
    this.error,

  });

  OnboardingProvider copyWith({
    bool? loading,
    String? error,

  }) {
    return OnboardingProvider(
      loading: loading ?? this.loading,
      error: error,
    );
  }
}

/// ---------- Notifier ------------

class RoleSelectNotifier extends Notifier<OnboardingProvider> {
  @override
  OnboardingProvider build() {
    return const OnboardingProvider();
  }

  Future<void> onboardStep({required int step, required String stepKey, required String screen,required Map<String, dynamic> data, bool skipped =false }) async {
    try {
      state = state.copyWith(
          loading: true,
          error: null
      );
      final res = await ref.read(onboardingRepositoryProvider).seniorOnboardingStep(step: step, stepKey: stepKey, screen: screen, data: data, skipped: skipped);

      final oldAuthState = ref.read(authProvider);
      final existingToken = oldAuthState.authResult?.token;
      final existingUser = oldAuthState.authResult?.user;

      // 2. नया AuthResult बनाएँ
      final newAuthResult = AuthResult(
        token: existingToken!,
        user:existingUser!,
        onboardingStatus:res,
      );

      await ref.read(authProvider.notifier).updateAuthResult(newAuthResult);

      state = state.copyWith(loading: false);
    } catch (e) {
      print("Role select error: $e");
      state = state.copyWith(error: e.toString(), loading: false);
    }
  }



  void clearError(){
    state = state.copyWith(error:null);
  }

  void reset() {
    state = const OnboardingProvider();
  }
}

/// ---------------------- NotifierProvider(ViewModel) ---------------------
final onboardingProvider = NotifierProvider<RoleSelectNotifier, OnboardingProvider>(
  RoleSelectNotifier.new,
);
