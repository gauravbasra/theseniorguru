import 'package:theseniorguru_mobile/core/config/api_urls.dart';
import 'package:theseniorguru_mobile/data/mapper/auth/auth_mapper.dart';
import 'package:theseniorguru_mobile/data/models/auth/onboarding_status_model.dart';
import 'package:theseniorguru_mobile/data/models/auth/user_model.dart';
import 'package:theseniorguru_mobile/data/models/onboarding/senior_onboarding_step_model.dart';
import '../../../core/network/http_service.dart';

abstract class OnboardingApiSource {

  Future<(UserModel, OnboardingStatusModel)> roleSelection(String role);
  Future<OnboardingStatusModel>  seniorOnboardingStep({required int step, required String stepKey, required String screen,required Map<String, dynamic> data, bool skipped =false });
}

class OnboardingApiSourceImpl implements OnboardingApiSource {
  final HttpService apiServices;
  const OnboardingApiSourceImpl({required this.apiServices});

  @override
  Future<(UserModel, OnboardingStatusModel)> roleSelection(String role) async{
    final res = await apiServices.post(ApiUrls.roleSelection, {
      "role": role
    });
    return (UserModel.fromJson(res['user']), OnboardingStatusModel.fromJson(res['onboarding_status']));
  }

  @override
  Future<OnboardingStatusModel> seniorOnboardingStep({required int step, required String stepKey, required String screen,required Map<String, dynamic> data, bool skipped =false }) async{
    final data = {
      "step": 1,
      "stepKey": "welcome",
      "screen": "onboardingWelcome",
      "data": {},
      "skipped": false
    };
    final res = await apiServices.post(ApiUrls.seniorOnboardingStep, data);

    return SeniorOnboardingStepResponse.fromJson(res).toStepResModel();
  }


}
