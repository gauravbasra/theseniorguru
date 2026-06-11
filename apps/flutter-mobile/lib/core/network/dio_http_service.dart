import 'package:dio/dio.dart';
import '../error/dio_exception_mapper.dart';
import 'dio_client.dart';
import 'http_service.dart';

class DioHttpService extends HttpService {
  static const Duration timeoutDuration = Duration(seconds: 20);
  final Dio _dio;

  DioHttpService(): _dio = createDio();

  @override
  Future<dynamic> get(String url, {Map<String, dynamic>? queryParameters, CancelToken? cancelToken}) async {
    try {
      final response = await _dio.get(url, queryParameters:queryParameters,cancelToken: cancelToken ).timeout(timeoutDuration);
      return response.data;
    } on DioException catch (e) {
      throw DioExceptionMapper.map(e);
    }
  }

  @override
  Future<dynamic> post(String url, dynamic data, [CancelToken? cancelToken]) async {
    try {
      final response = await _dio.post(
          url,
          data:data,
          cancelToken: cancelToken
      );
      return response.data;
    } on DioException catch (e) {
      print("at Network $e");
      throw DioExceptionMapper.map(e);
      // handleExceptions(e);
    }
  }

}
