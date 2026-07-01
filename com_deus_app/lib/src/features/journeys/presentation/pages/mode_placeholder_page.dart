import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/primary_button.dart';
import 'package:com_deus_app/src/core/design_system/components/quote_of_the_day.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class ModePlaceholderPage extends StatelessWidget {
  const ModePlaceholderPage({
    super.key,
    required this.title,
    required this.message,
    required this.onBack,
  });

  final String title;
  final String message;
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
            SectionTitle(
              title: title,
              subtitle: message,
            ),
            const SizedBox(height: AppSpacing.xl),
            const QuoteOfTheDay(
              title: 'Quote Of The Day',
              quote: 'O amor permanece quando escolhemos caminhar sem pressa.',
              reference: 'Com Deus',
            ),
            const SizedBox(height: AppSpacing.xl),
            PrimaryButton(
              label: 'Voltar',
              onPressed: onBack,
            ),
          ],
        ),
      ),
    );
  }
}
