import 'package:flutter/material.dart';

class NavigationKeys {
  NavigationKeys._();
  static final root = GlobalKey<NavigatorState>();

  static final home =
  GlobalKey<NavigatorState>(debugLabel: 'homeNav');
}