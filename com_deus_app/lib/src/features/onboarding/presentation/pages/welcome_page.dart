import 'package:flutter/material.dart';
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Spacer(),
          Text(
            'Bem-vinda.',
            style: theme.textTheme.displayMedium,
          ),
          const SizedBox(height: 24),
          Text(
            'Durante os próximos 30 dias você não vai apenas ler um devocional.\n\nVocê vai caminhar com Deus.',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: const Color(0xFF505750),
            ),
          ),
          const Spacer(),
          FilledButton(
            onPressed: onStart,
            child: const Text('Começar caminhada'),
          ),
        ],
      ),
    );
  }
}
