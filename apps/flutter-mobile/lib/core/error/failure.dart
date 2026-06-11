abstract class Failure implements Exception {
  final String  _message;

  const Failure(this._message);

  @override
  String toString(){
    return _message;
  }
}


/// Network related Error (No Internet, Timeout)
class NetworkFailure extends Failure{
  const NetworkFailure([String? message]):super(message ?? 'Please Check your internet connection !');
}

/// Server Failure (500, 502).
class ServerFailure extends Failure{
  const ServerFailure([String? message]):super(message ?? "Server Error | Please try again later");
}

/// 401 or 403 session End  or UnAuthorized Request

class UnauthorizedFailure extends Failure{
  const UnauthorizedFailure([String? message]):super(message ?? "UnAuthorized Request | Please login");
}

///  404 – Resource Not found

class NotFoundFailure extends Failure{
  const  NotFoundFailure([String? message]):super(message ?? "The requested data is not available.");
}

/// 400, 422 –Validation Error
class ValidationFailure extends Failure {
  const ValidationFailure(super._message);
}

/// RequestCancel
class CancelFailure extends Failure{
  const CancelFailure():super("Request Cancel");
}

/// UnKnown Error
class UnknownFailure extends Failure {
  const UnknownFailure([String? message]):super(message ?? "Something went wrong | Please try again later") ;
}