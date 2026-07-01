import 'package:flutter/material.dart';
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
    final theme = Theme.of(context);

    return OnboardingScaffold(
      onBack: onBack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const SizedBox(height: 18),
          Text(
            'Seu coração merece um lugar seguro.',
            style: theme.textTheme.headlineLarge,
          ),
          const SizedBox(height: 24),
          Text(
            'O que você escrever aqui será utilizado apenas para personalizar sua caminhada.\n\nSuas informações são protegidas por criptografia.\n\nNunca utilizaremos esse conteúdo para publicidade.\n\nVocê poderá apagar todo o histórico quando desejar.',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: const Color(0xFF535B53),
            ),
          ),
          const Spacer(),
          FilledButton(
            onPressed: onContinue,
            child: const Text('Entendi'),
          ),
        ],
      ),
    );
  }
}
