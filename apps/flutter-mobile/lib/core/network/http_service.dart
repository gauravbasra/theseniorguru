import 'package:dio/dio.dart';

abstract class HttpService {
  Future<dynamic> get(String url, {Map<String, dynamic>? queryParameters, CancelToken? cancelToken});

  Future<dynamic> post(String url, dynamic data, [CancelToken? cancelToken]);
}