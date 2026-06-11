import 'package:theseniorguru_mobile/data/data_source/onboarding/remote.dart';
import 'package:theseniorguru_mobile/domain/entity/auth/onboarding_status.dart';
import 'package:theseniorguru_mobile/domain/repository/onboarding_repository.dart';
import '../../domain/entity/auth/user.dart';
import '../data_source/auth/local.dart';
import '../mapper/auth/auth_mapper.dart';

class OnboardingRepositoryImpl extends OnboardingRepository {
  final AuthLocalDatasource local;
  final OnboardingApiSource remote;
  OnboardingRepositoryImpl({required this.local, required this.remote});

  @override
  Future<(User, OnboardingStatus)> roleSelect({required String role}) async{
    final apiRes = await remote.roleSelection(role);
    await local.saveUserDetail(apiRes.$1);
      await local.saveOnboardingStatus(apiRes.$2);

    return (apiRes.$1.toEntity(), apiRes.$2.toEntity());
  }

  @override
  Future<OnboardingStatus> seniorOnboardingStep({required int step, required String stepKey, required String screen,required Map<String, dynamic> data, bool skipped =false }) async{
    final apiRes = await remote.seniorOnboardingStep(step: step, stepKey: stepKey, screen: screen, data: data);
    await local.saveOnboardingStatus(apiRes);
    return apiRes.toEntity();
  }


}
