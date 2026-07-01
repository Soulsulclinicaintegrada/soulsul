import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/di/service_locator.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/onboarding_scaffold.dart';
import 'package:com_deus_app/src/features/onboarding/presentation/widgets/selectable_pill.dart';

class ReminderTimePage extends StatefulWidget {
  const ReminderTimePage({
    super.key,
    required this.initialValue,
    required this.onBack,
  });

  final String initialValue;
  final VoidCallback onBack;

  @override
  State<ReminderTimePage> createState() => _ReminderTimePageState();
}

class _ReminderTimePageState extends State<ReminderTimePage> {
  static const List<String> _presetOptions = <String>[
    '09h',
    '10h',
    '11h',
    '12h',
    'Personalizado',
  ];

  late String _selectedValue;
  late final TextEditingController _textController;

  bool get _isCustom => _selectedValue == 'Personalizado';

  String get _resolvedTime {
    if (_isCustom) {
      return _textController.text.trim();
    }
    return _selectedValue;
  }

  @override
  void initState() {
    super.initState();
    final existing = widget.initialValue.trim();
    final preset = _presetOptions.contains(existing) ? existing : null;
    _selectedValue = preset ?? '09h';
    _textController = TextEditingController(
      text: preset == null && existing.isNotEmpty ? existing : '',
    );
    if (preset == null && existing.isNotEmpty) {
      _selectedValue = 'Personalizado';
    }
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
            'Escolha um horário para separar esse momento com Deus.',
            style: theme.textTheme.headlineLarge,
          ),
          const SizedBox(height: 28),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: _presetOptions
                .map(
                  (String option) => SelectablePill(
                    label: option,
                    isSelected: _selectedValue == option,
                    onTap: () {
                      setState(() {
                        _selectedValue = option;
                      });
                    },
                  ),
                )
                .toList(),
          ),
          if (_isCustom) ...<Widget>[
            const SizedBox(height: 22),
            TextField(
              controller: _textController,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Ex.: 20h30',
              ),
            ),
          ],
          const Spacer(),
          FilledButton(
            onPressed: _resolvedTime.isEmpty
                ? null
                : () {
                    onboardingController.saveReminderTime(_resolvedTime);
                  },
            child: const Text('Continuar'),
          ),
        ],
      ),
    );
  }
}
