import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/presentation/providers/auth/auth_providers.dart';
// import '../../presentation/view_models/auth/auth_view_models.dart';

class AppInterceptor extends Interceptor {
  final ProviderContainer container;
  AppInterceptor(this.container);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler){
      final token = container.read(authProvider).authResult?.token;
      if(token !=null){
        options.headers['Authorization'] = 'Bearer $token';
      }
      super.onRequest(options, handler);
  }

}