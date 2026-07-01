import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/theme/app_theme.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/onboarding_flow_page.dart';

class ComDeusApp extends StatelessWidget {
  const ComDeusApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Com Deus',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const OnboardingFlowPage(),
    );
  }
}
