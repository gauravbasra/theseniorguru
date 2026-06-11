import 'package:theseniorguru_mobile/core/config/api_urls.dart';
import 'package:theseniorguru_mobile/data/models/auth/auth_response_model.dart';
import '../../../core/network/http_service.dart';

abstract class AuthApiDataSource {
  Future<AuthResponseModel> register({
    required String fullName,
    required String phone,
    required String email,
    required String password,
    required String gender,
  });

  Future<AuthResponseModel> login(String email, String password);
}

class AuthApiDatasourceImpl implements AuthApiDataSource {
  final HttpService apiServices;
  const AuthApiDatasourceImpl({required this.apiServices});

  @override
  Future<AuthResponseModel> register({
    required String fullName,
    required String phone,
    required String email,
    required String password,
    required String gender,
  }) async {
    final Map<String, dynamic> registerData = {
      "fullName": fullName,
      "gender": gender,
      "phone": phone,
      "email": email,
      "password": password,
    };
    final res = await apiServices.post(ApiUrls.register, registerData);

    return AuthResponseModel.fromJson(res);
  }

  @override
  Future<AuthResponseModel> login(String email, String password) async{
    final res = await apiServices.post(ApiUrls.login, {
      'email': email,
      'password': password,
    });
    return AuthResponseModel.fromJson(res);
  }
}
