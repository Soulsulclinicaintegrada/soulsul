import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/experience/presentation/pages/respire_intro_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/controllers/onboarding_controller.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/onboarding_flow_page.dart';

class AppEntryPage extends StatelessWidget {
  const AppEntryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: onboardingController,
      builder: (BuildContext context, Widget? child) {
        if (onboardingController.currentStep == OnboardingStep.respire) {
          return RespireIntroPage(
            onCompleted: onboardingController.completeRespire,
          );
        }

        return const OnboardingFlowPage();
      },
    );
  }
}
