
import 'package:theseniorguru_mobile/domain/entity/auth/auth_result.dart';

abstract class AuthRepository {

  Future<AuthResult> register({required String fullName, required String phone,  required String email,required String password, required String gender });

  Future<AuthResult> login({required String email,required String password, bool isRememberMe = false});

  Future<AuthResult?> getLoggedInUserSession();

  Future<Map<String, dynamic>?> getRememberMeData();
}