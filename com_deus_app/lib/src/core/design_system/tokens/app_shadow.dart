import 'package:flutter/material.dart';

class AppShadow {
  const AppShadow._();

  static List<BoxShadow> get soft => const <BoxShadow>[
        BoxShadow(
          color: Color(0x140E1610),
          blurRadius: 28,
          offset: Offset(0, 14),
        ),
      ];
}
