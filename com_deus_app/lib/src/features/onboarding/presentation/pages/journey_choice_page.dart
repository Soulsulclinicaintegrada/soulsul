import 'package:flutter/material.dart';
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
    final theme = Theme.of(context);

    return OnboardingScaffold(
      onBack: onBack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const SizedBox(height: 18),
          Text(
            'Escolha a forma da sua caminhada.',
            style: theme.textTheme.headlineLarge,
          ),
          const SizedBox(height: 16),
          Text(
            'Você pode seguir uma jornada pronta ou começar a partir do que está vivendo hoje.',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: const Color(0xFF5B625B),
            ),
          ),
          const SizedBox(height: 32),
          ChoiceCard(
            emoji: '📖',
            title: 'Caminhada Guiada',
            description: 'Siga uma jornada pronta baseada na Bíblia.',
            buttonLabel: 'Escolher',
            onPressed: () {
              onboardingController.selectJourneyStyle(JourneyStyle.guided);
            },
          ),
          const SizedBox(height: 18),
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
    );
  }
}
