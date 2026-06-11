import 'package:flutter/material.dart';
import 'package:fluttertoast/fluttertoast.dart';

class ToastService {
  static void  errorToast(String message){
    Fluttertoast.showToast(
      fontSize: 14,
      msg: message,
      backgroundColor: Colors.red,
      toastLength: Toast.LENGTH_LONG,
    );
  }

  static void  successToast(String message){
    Fluttertoast.showToast(
      fontSize: 14,
      msg: message,
      backgroundColor: Colors.green,
      toastLength: Toast.LENGTH_LONG,
    );
  }
}