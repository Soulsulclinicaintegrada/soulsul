import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/primary_button.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class WelcomePage extends StatelessWidget {
  const WelcomePage({
    super.key,
    required this.onStart,
  });

  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return OnboardingScaffold(
      child: EntranceTransition(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Spacer(),
            Text(
              'Bem-vinda.',
              style: theme.textTheme.displayLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Durante os próximos 30 dias você não vai apenas ler um devocional.\n\nVocê vai caminhar com Deus.',
              style: theme.textTheme.bodyLarge,
            ),
            const Spacer(),
            PrimaryButton(
              label: 'Começar caminhada',
              onPressed: onStart,
            ),
          ],
        ),
      ),
    );
  }
}
