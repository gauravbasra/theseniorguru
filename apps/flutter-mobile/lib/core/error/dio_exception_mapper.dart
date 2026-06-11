import 'dart:io';
import 'package:dio/dio.dart';
import 'failure.dart';


class DioExceptionMapper {
  static Failure map(DioException e) {
    print("e.type ${e.type}");
    // 1. Timeout or Connection error
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return const NetworkFailure("Connection Timeout | Please check Internet");
    }

    //2. Bad Request
    if(e.type == DioExceptionType.badResponse){
      return _mapResponse(e.response!.statusCode, e.response!.data);
    }

    // 3. DioExceptionType.cancel (Request Cancel)

    if(e.type == DioExceptionType.cancel){
      return const CancelFailure();
    }

    // 4. No Internet Connection
    if(e.type == DioExceptionType.connectionError){
      return const NetworkFailure("No Internet Connection");
    }

    // 5. Unknown error
    if (e.error is SocketException) {
      print("ddd");
      return const NetworkFailure('No Internet Connection');
    }

    return const UnknownFailure('Something went wrong');
  }


  ///Based on HTTP STATUS CODE ERROR

  static Failure _mapResponse(int? statusCode, dynamic data){
    final serverMessage = data is Map<String, dynamic>
        ? (data['message']?.toString() ?? data['error']?.toString())
        : null;

    switch(statusCode){
      case 400:
        return ValidationFailure(serverMessage ?? 'Wrong Request!');
      case 401:
      case 403:
        return UnauthorizedFailure(serverMessage ?? "Unauthorized Request");

      case 404:
        return NotFoundFailure(serverMessage ?? 'No data found');
      case  422:
        return ValidationFailure(serverMessage ?? 'Invalid data');
      case 500:
        return ServerFailure(serverMessage ?? 'Internal server error!');
      default:
        return ServerFailure('Server Error (code: $statusCode)');
    }
  }
}
