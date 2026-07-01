import 'package:flutter/material.dart';

class AppTypography {
  const AppTypography._();

  static const String editorialFont = 'Georgia';

  static TextTheme buildTextTheme(Color textColor, Color mutedColor) {
    return TextTheme(
      displayLarge: TextStyle(
        fontFamily: editorialFont,
        fontSize: 44,
        height: 1.02,
        fontWeight: FontWeight.w700,
        letterSpacing: -1.8,
        color: textColor,
      ),
      displayMedium: TextStyle(
        fontFamily: editorialFont,
        fontSize: 40,
        height: 1.05,
        fontWeight: FontWeight.w700,
        letterSpacing: -1.6,
        color: textColor,
      ),
      headlineLarge: TextStyle(
        fontFamily: editorialFont,
        fontSize: 34,
        height: 1.12,
        fontWeight: FontWeight.w700,
        letterSpacing: -1.2,
        color: textColor,
      ),
      headlineMedium: TextStyle(
        fontFamily: editorialFont,
        fontSize: 28,
        height: 1.16,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.8,
        color: textColor,
      ),
      headlineSmall: TextStyle(
        fontFamily: editorialFont,
        fontSize: 24,
        height: 1.2,
        fontWeight: FontWeight.w700,
        color: textColor,
      ),
      titleLarge: TextStyle(
        fontSize: 21,
        height: 1.26,
        fontWeight: FontWeight.w600,
        color: textColor,
      ),
      titleMedium: TextStyle(
        fontSize: 17,
        height: 1.3,
        fontWeight: FontWeight.w600,
        color: textColor,
      ),
      bodyLarge: TextStyle(
        fontSize: 17,
        height: 1.7,
        fontWeight: FontWeight.w400,
        color: mutedColor,
      ),
      bodyMedium: TextStyle(
        fontSize: 15,
        height: 1.65,
        fontWeight: FontWeight.w400,
        color: mutedColor,
      ),
      bodySmall: TextStyle(
        fontSize: 13,
        height: 1.5,
        fontWeight: FontWeight.w400,
        color: mutedColor,
      ),
      labelLarge: TextStyle(
        fontSize: 16,
        height: 1.2,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.1,
        color: textColor,
      ),
    );
  }
}
