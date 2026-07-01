import 'package:flutter/material.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class HomePage extends StatelessWidget {
  const HomePage({
    super.key,
    required this.name,
  });

  final String name;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return OnboardingScaffold(
      includeSafeTopSpace: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const SizedBox(height: 18),
          Text(
            'Bom dia, $name.',
            style: theme.textTheme.displayMedium,
          ),
          const SizedBox(height: 20),
          Text(
            'Hoje Deus preparou alguns minutos para estar com você.',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: const Color(0xFF576057),
            ),
          ),
          const Spacer(),
          Text(
            'Dia 1',
            style: theme.textTheme.titleMedium?.copyWith(
              color: theme.colorScheme.primary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Antes da luz',
            style: theme.textTheme.headlineLarge,
          ),
          const SizedBox(height: 28),
          FilledButton(
            onPressed: () {},
            child: const Text('Continuar caminhada'),
          ),
          const SizedBox(height: 18),
        ],
      ),
    );
  }
}
