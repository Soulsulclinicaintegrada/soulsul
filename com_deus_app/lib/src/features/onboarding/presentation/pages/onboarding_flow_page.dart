import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/controllers/onboarding_controller.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/fasting_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/home_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/journey_choice_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/name_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/privacy_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/reminder_time_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/splash_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/purpose_page.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/pages/welcome_page.dart';

class OnboardingFlowPage extends StatelessWidget {
  const OnboardingFlowPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: onboardingController,
      builder: (BuildContext context, Widget? child) {
        return AnimatedSwitcher(
          duration: const Duration(milliseconds: 450),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          child: _buildStep(onboardingController.currentStep),
        );
      },
    );
  }

  Widget _buildStep(OnboardingStep step) {
    return switch (step) {
      OnboardingStep.splash => SplashPage(
          key: const ValueKey<String>('splash'),
          onCompleted: onboardingController.completeSplash,
        ),
      OnboardingStep.welcome => WelcomePage(
          key: const ValueKey<String>('welcome'),
          onStart: onboardingController.goToPathChoice,
        ),
      OnboardingStep.pathChoice => JourneyChoicePage(
          key: const ValueKey<String>('path-choice'),
          onBack: onboardingController.goBack,
        ),
      OnboardingStep.privacy => PrivacyPage(
          key: const ValueKey<String>('privacy'),
          onBack: onboardingController.goBack,
          onContinue: onboardingController.acknowledgePrivacy,
        ),
      OnboardingStep.name => NamePage(
          key: const ValueKey<String>('name'),
          initialValue: onboardingController.profile.name,
          onBack: onboardingController.goBack,
        ),
      OnboardingStep.purpose => PurposePage(
          key: const ValueKey<String>('purpose'),
          selectedFocus: onboardingController.profile.blessingFocus,
          onBack: onboardingController.goBack,
        ),
      OnboardingStep.fasting => FastingPage(
          key: const ValueKey<String>('fasting'),
          selectedValue: onboardingController.profile.includeFasting,
          onBack: onboardingController.goBack,
        ),
      OnboardingStep.schedule => ReminderTimePage(
          key: const ValueKey<String>('schedule'),
          initialValue: onboardingController.profile.reminderTime,
          onBack: onboardingController.goBack,
        ),
      OnboardingStep.home => HomePage(
          key: const ValueKey<String>('home'),
          name: onboardingController.profile.greetingName,
        ),
    };
  }
}
