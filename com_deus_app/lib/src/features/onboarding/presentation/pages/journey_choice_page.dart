import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/choice_card.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class JourneyChoicePage extends StatelessWidget {
  const JourneyChoicePage({
    super.key,
    required this.onBack,
  });

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return OnboardingScaffold(
      onBack: onBack,
      child: EntranceTransition(
        child: ListView(
          padding: EdgeInsets.zero,
          children: <Widget>[
            const SizedBox(height: AppSpacing.sm),
            const SectionTitle(
              title: 'Escolha a forma da sua caminhada.',
              subtitle:
                  'Você pode seguir uma jornada pronta ou começar a partir do que está vivendo hoje.',
            ),
            const SizedBox(height: AppSpacing.xl),
            ChoiceCard(
              emoji: '📖',
              title: 'Caminhada Guiada',
              description: 'Siga uma jornada pronta baseada na Bíblia.',
              buttonLabel: 'Escolher',
              onPressed: () {
                onboardingController.selectJourneyStyle(JourneyStyle.guided);
              },
            ),
            const SizedBox(height: AppSpacing.lg),
            ChoiceCard(
              emoji: '🤍',
              title: 'Caminhada Acompanhada',
              description:
                  'Conte o momento que você está vivendo para receber reflexões alinhadas à Palavra.',
              buttonLabel: 'Escolher',
              onPressed: () {
                onboardingController.selectJourneyStyle(JourneyStyle.accompanied);
              },
            ),
          ],
        ),
      ),
    );
  }
}
