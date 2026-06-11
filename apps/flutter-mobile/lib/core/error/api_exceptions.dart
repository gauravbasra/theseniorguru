// class ApiExceptions implements Exception {
//   final String  _message;
//
//   ApiExceptions(this._message);
//
//   @override
//   String toString(){
//     return _message;
//   }
// }
//
// class FetchDataException extends ApiExceptions{
//   FetchDataException([String? message]) : super(message ?? 'Error during Fetch Api');
// }
//
// class BadRequestException extends ApiExceptions {
//   BadRequestException([String? message]):super(message ?? 'Bad Request' );
// }
//
// class UnAuthorizedException extends ApiExceptions {
//   UnAuthorizedException([String? message]):super(message ?? 'Unauthorised request');
// }
//
// class InvalidInputException extends ApiExceptions {
//   InvalidInputException([String? message]):super(message ?? 'Invalid Input');
// }
//
//
// class RequestCancelException extends ApiExceptions{
//   RequestCancelException([String? message]):super(message ?? 'Request cancelled');
// }