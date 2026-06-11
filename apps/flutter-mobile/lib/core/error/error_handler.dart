import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'failure.dart';

class ErrorHandler {
  final Ref _ref;
  const ErrorHandler(this._ref);
   void handle(Failure failure, {StackTrace? stack}){
    if(failure is CancelFailure) return;

    if(failure is UnauthorizedFailure){
      // _handleUnauthorized();
      return;
    }
  }


  // void _handleUnauthorized() async {
  //   final router = _ref.read(routerProvider);
  //   await _ref.read(loginViewModel.notifier).logout();
  //   // _ref.read(loginProvider.notifier).clearState();
  //   router.go('/login');
  // }
}

final errorHandlerProvider = Provider.autoDispose<ErrorHandler>((ref){
  return ErrorHandler(ref);
});