import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';

class NamePage extends StatefulWidget {
  const NamePage({
    super.key,
    required this.initialValue,
    required this.onBack,
  });

  final String initialValue;
  final VoidCallback onBack;

  @override
  State<NamePage> createState() => _NamePageState();
}

class _NamePageState extends State<NamePage> {
  late final TextEditingController _textController;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return OnboardingScaffold(
      onBack: widget.onBack,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const SizedBox(height: 18),
          Text(
            'Como você gostaria de ser chamada?',
            style: theme.textTheme.headlineLarge,
          ),
          const SizedBox(height: 26),
          TextField(
            controller: _textController,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Seu nome',
            ),
          ),
          const Spacer(),
          FilledButton(
            onPressed: _textController.text.trim().isEmpty
                ? null
                : () {
                    onboardingController.saveName(_textController.text);
                  },
            child: const Text('Continuar'),
          ),
        ],
      ),
    );
  }
}
