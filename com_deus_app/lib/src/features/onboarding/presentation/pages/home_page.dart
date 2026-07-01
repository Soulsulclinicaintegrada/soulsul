import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/primary_button.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/domain/entities/onboarding_profile.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class HomePage extends StatelessWidget {
  const HomePage({
    super.key,
    required this.profile,
  });

  final OnboardingProfile profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final purpose = _purposeLabel(profile.blessingFocus);
    final fasting = profile.includeFasting == true ? 'Incluído' : 'Agora não';

    return OnboardingScaffold(
      includeSafeTopSpace: true,
      child: EntranceTransition(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Spacer(flex: 2),
            Text(
              'Bom dia, ${profile.greetingName}.',
              style: theme.textTheme.displayLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 340),
              child: Text(
                'Hoje Deus preparou alguns minutos para estar com você.',
                style: theme.textTheme.bodyLarge,
              ),
            ),
            const Spacer(flex: 3),
            Text(
              'Dia 1',
              style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Antes da luz',
              style: theme.textTheme.displayMedium?.copyWith(fontSize: 38),
            ),
            const SizedBox(height: AppSpacing.xl),
            PrimaryButton(
              label: 'Continuar caminhada',
              onPressed: () {
                onboardingController.openJourneyCatalog();
              },
            ),
            const SizedBox(height: AppSpacing.xxl),
            Text(
              'Propósito',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              purpose,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Jejum',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: AppSpacing.xxs),
            Text(
              fasting,
              style: theme.textTheme.titleMedium,
            ),
            const Spacer(flex: 2),
          ],
        ),
      ),
    );
  }

  String _purposeLabel(BlessingFocus? focus) {
    return switch (focus) {
      BlessingFocus.anxiety => 'Ansiedade',
      BlessingFocus.marriage => 'Casamento',
      BlessingFocus.family => 'Família',
      BlessingFocus.finances => 'Financeiro',
      BlessingFocus.peace => 'Paz',
      BlessingFocus.other => 'Outro',
      null => 'Caminhada pessoal',
    };
  }
}
