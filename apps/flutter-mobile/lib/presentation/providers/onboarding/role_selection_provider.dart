import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/core/di/auth_di.dart';
import 'package:theseniorguru_mobile/core/di/onboarding_di.dart';
import 'package:theseniorguru_mobile/domain/entity/auth/auth_result.dart';

import '../auth/auth_providers.dart';

/// --------------- STATE -------------
class RoleSelectionState {
  final bool loading;
  final String? error;
  final String? selectedRole;

  const RoleSelectionState({
    this.loading = false,
    this.error,
    this.selectedRole,

  });

  RoleSelectionState copyWith({
    bool? loading,
    String? error,
    String? selectedRole,

  }) {
    return RoleSelectionState(
      selectedRole: selectedRole ?? this.selectedRole,
      loading: loading ?? this.loading,
      error: error,
    );
  }
}

/// ---------- Notifier ------------

class RoleSelectNotifier extends Notifier<RoleSelectionState> {
  @override
  RoleSelectionState build() {
    return const RoleSelectionState();
  }

  Future<void> roleSelect(String role) async {
    try {
      state = state.copyWith(
        loading: true,
        selectedRole: role,
        error: null
      );
      final res = await ref.read(onboardingRepositoryProvider).roleSelect(
        role: role
      );

      final oldAuthState = ref.read(authProvider);
      final existingToken = oldAuthState.authResult?.token;

      // 2. नया AuthResult बनाएँ
      final newAuthResult = AuthResult(
        token: existingToken!,
        user: res.$1,
        onboardingStatus:res.$2,
      );

      // 3. authProvider update करें
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
    state = const RoleSelectionState();
  }
}

/// ---------------------- NotifierProvider(ViewModel) ---------------------
final roleSelectProvider = NotifierProvider<RoleSelectNotifier, RoleSelectionState>(
  RoleSelectNotifier.new,
);
