import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/components/entrance_transition.dart';
import 'package:com_deus_app/src/core/design_system/components/primary_button.dart';
import 'package:com_deus_app/src/core/design_system/components/section_title.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class PrivacyPage extends StatelessWidget {
  const PrivacyPage({
    super.key,
    required this.onBack,
    required this.onContinue,
  });

  final VoidCallback onBack;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return OnboardingScaffold(
      onBack: onBack,
      child: EntranceTransition(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const SizedBox(height: 18),
            const SectionTitle(
              title: 'Seu coração merece um lugar seguro.',
            ),
            const SizedBox(height: 24),
            Text(
              'O que você escrever aqui será utilizado apenas para personalizar sua caminhada.\n\nSuas informações são protegidas por criptografia.\n\nNunca utilizaremos esse conteúdo para publicidade.\n\nVocê poderá apagar todo o histórico quando desejar.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const Spacer(),
            PrimaryButton(
              label: 'Entendi',
              onPressed: onContinue,
            ),
          ],
        ),
      ),
    );
  }
}
