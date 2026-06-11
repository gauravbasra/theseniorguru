import 'package:dio/dio.dart';
import '../di/global_container.dart';
import 'app_interceptor.dart';


Dio createDio(){
  final dio = Dio(
      BaseOptions(
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      )
  );

  dio.interceptors.add(AppInterceptor(globalContainer));

  return dio;

}