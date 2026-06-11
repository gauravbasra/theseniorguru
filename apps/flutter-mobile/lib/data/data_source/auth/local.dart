import 'package:theseniorguru_mobile/core/constant/app_constant.dart';
import 'package:theseniorguru_mobile/data/models/auth/auth_response_model.dart';
import 'package:theseniorguru_mobile/data/models/auth/user_model.dart';
import '../../../core/storage/pref_storage.dart';
import '../../../core/storage/secure_storage.dart';
import '../../models/auth/onboarding_status_model.dart';

abstract class AuthLocalDatasource{
  Future<void> saveLoggedInUser(AuthResponseModel authData);
  Future<AuthResponseModel?> getLoggedInUser();
  Future<void> saveRememberMe(String email, String password);
  Future<Map<String, dynamic>?> getRememberMe();
  Future<void> clearRememberMe();
  Future<void> logout();
  Future<void> saveOnboardingStatus(OnboardingStatusModel status);
  Future<void> saveUserDetail(UserModel user);
}

class AuthLocalDatasourceImpl implements AuthLocalDatasource {
  final PrefStorage prefStorage;
  final SecureStorage secureStorage;
  const AuthLocalDatasourceImpl({required this.secureStorage, required this.prefStorage});


  @override
  Future<void> saveLoggedInUser(AuthResponseModel authData) async {
    try {
      await secureStorage.setSecureString(
        Constant.currentUserAuthKey,
        authData.token,
      );

      await prefStorage.setPrefJson(
        Constant.currentUserProfile,
        authData.user.toJson(),
      );

      await saveOnboardingStatus(authData.onboardingStatus);


    } catch (e) {
      // optional: log error
      print('Error saving user: $e');
    }
  }

  // AuthLocalDatasourceImpl में
  @override
  Future<void> saveOnboardingStatus(OnboardingStatusModel status) async {
    await prefStorage.setPrefJson(Constant.onboardingStatusKey, status.toJson());
  }

  @override
  Future<void> saveUserDetail(UserModel user) async {
    await prefStorage.setPrefJson(Constant.currentUserProfile, user.toJson());
  }

  @override
  Future<AuthResponseModel?> getLoggedInUser() async {
    try {
      final token = await secureStorage
          .getSecureString(Constant.currentUserAuthKey);

      final userJson = await prefStorage
          .getPrefJson(Constant.currentUserProfile);
      final onboardingStatus = await prefStorage
          .getPrefJson(Constant.onboardingStatusKey);

      if (token == null || userJson == null || onboardingStatus ==null) return null;

      return AuthResponseModel(
        token: token,
        user: UserModel.fromJson(userJson),
        onboardingStatus: OnboardingStatusModel.fromJson(onboardingStatus)
      );
    } catch (e) {
      return null;
    }
  }

  @override
  Future<void> saveRememberMe(String email, String password) async{
    try{
      await secureStorage.setSecureJson(Constant.currUserRememberMeDetail, {'email':email, 'password':password});
    }catch(e){
      print('Error during save rememberMe $e');
    }
  }

  @override
  Future<Map<String, dynamic>?> getRememberMe() async {
    final data = await secureStorage
        .getSecureJson(Constant.currUserRememberMeDetail);

    return data;
  }

  @override
  Future<void> clearRememberMe() async{
    await secureStorage.removeSecure(Constant.currUserRememberMeDetail);
  }

  @override
  Future<void> logout() async{
    // await secureStorage.removeSecure(AppConstant.currentUserAuthKey);
    // await prefStorage.removePref(AppConstant.currentUserProfile);
  }
}

