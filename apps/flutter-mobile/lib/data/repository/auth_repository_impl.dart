import 'package:theseniorguru_mobile/data/data_source/auth/remote.dart';
import 'package:theseniorguru_mobile/data/mapper/auth/auth_mapper.dart';
import 'package:theseniorguru_mobile/domain/entity/auth/auth_result.dart';
import '../../domain/repository/auth_repository.dart';
import '../data_source/auth/local.dart';

class AuthRepositoryImpl extends AuthRepository {
  final AuthLocalDatasource local;
  final AuthApiDataSource remote;
  AuthRepositoryImpl({required this.local, required this.remote});

  @override
  Future<AuthResult> register({
    required String fullName,
    required String phone,
    required String email,
    required String password,
    required String gender,
  }) async {
    final apiRes = await remote.register(
      fullName: fullName,
      phone: phone,
      email: email,
      password: password,
      gender: gender,
    );
    local.saveLoggedInUser(apiRes);
    return AuthResult(
      token: apiRes.token,
      user: apiRes.user.toEntity(),
      onboardingStatus: apiRes.onboardingStatus.toEntity()
    );
  }

  @override
  Future<AuthResult> login({
    required String email,
    required String password,
    bool isRememberMe = false,
  }) async {
    final apiRes = await remote.login(email, password);
    await local.saveLoggedInUser(apiRes);
    if (isRememberMe) {
      await local.saveRememberMe(email, password);
    } else {
      await local.clearRememberMe();
    }
    return AuthResult(
      token: apiRes.token,
      user: apiRes.user.toEntity(),
      onboardingStatus: apiRes.onboardingStatus.toEntity()
    );
  }

  @override
  Future<Map<String, dynamic>?> getRememberMeData() async {
    return await local.getRememberMe();
  }

  @override
  Future<AuthResult?> getLoggedInUserSession() async {
    final cached = await local.getLoggedInUser();

    return cached != null
        ? AuthResult(
            token: cached.token,
            user: cached.user.toEntity(),
            onboardingStatus: cached.onboardingStatus.toEntity()
          )
        : null;
  }
}
