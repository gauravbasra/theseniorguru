import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/core/di/auth_di.dart';
import 'package:theseniorguru_mobile/domain/entity/auth/auth_result.dart';


/// --------------- STATE -------------
class AuthState {
  final AuthResult? authResult;
  final bool loading;
  final String? error;
  final bool isRememberMe;
  final Map<String, dynamic>? savedRememberMeData;

  const AuthState({
    this.authResult,
    this.loading = false,
    this.error,
    this.isRememberMe = false,
    this.savedRememberMeData,
  });

  AuthState copyWith({
    AuthResult? authResult,
    bool? loading,
    String? error,
    bool? isRememberMe,
    Map<String, dynamic>? savedRememberMeData,
  }) {
    return AuthState(
      authResult: authResult ?? this.authResult,
      loading: loading ?? this.loading,
      isRememberMe: isRememberMe ?? this.isRememberMe,
      savedRememberMeData: savedRememberMeData ?? this.savedRememberMeData,
      error: error,
    );
  }
}

/// ---------- Notifier ------------

class LoginNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    return const AuthState();
  }
    Future<void> register({required String fullName, required String phone,  required String email,required String password, required String gender }) async{
        try{
          state = state.copyWith(error: null, loading: true);

          final res = await ref.read(authRepositoryProvider).register(fullName: fullName, phone: phone, email: email, password: password, gender: gender);
          state = state.copyWith(authResult: res, loading: false);

        }catch(e){
          print("Login error: $e"); // ✅
          state = state.copyWith(error: e.toString(), loading: false);
        }
    }
  Future<void> login({required String email, required String password}) async {
    try {
      state = state.copyWith(error: null, loading: true);
      final res = await ref.read(authRepositoryProvider).login(
          email: email,
          password: password,
          isRememberMe: state.isRememberMe,
      );
      print("Login success, res: $res"); // ✅ देखें
      state = state.copyWith(authResult: res, loading: false);
    } catch (e) {
      print("Login error: $e"); // ✅
      state = state.copyWith(error: e.toString(), loading: false);
    }
  }

  void setRememberMe(bool v) {
    state = state.copyWith(isRememberMe: v);
  }

  Future<void> loadRememberMe() async {
    final res = await ref.read(authRepositoryProvider).getRememberMeData();
    state = state.copyWith(
      savedRememberMeData: res,
      isRememberMe: res != null ? true : false,
    );
  }

  Future<void> getCachedAuthSession() async{
    final res = await ref.read(authRepositoryProvider).getLoggedInUserSession();
    state = state.copyWith(authResult: res);
  }

  void clearError(){
    state = state.copyWith(error:null);
  }

  void reset() {
    state = const AuthState();
  }

  Future<void> logout() async {
    try {
      // await ref.read(authRepositoryProvider).logout();
    } finally {
      state = const AuthState();
    }
  }

  Future<void> updateAuthResult(AuthResult newResult) async {
    state = state.copyWith(authResult: newResult);
  }
}

/// ---------------------- NotifierProvider(ViewModel) ---------------------
final authProvider = NotifierProvider<LoginNotifier, AuthState>(
  LoginNotifier.new,
);
