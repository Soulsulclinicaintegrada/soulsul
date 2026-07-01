import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_radius.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';

class JournalCard extends StatelessWidget {
  const JournalCard({
    super.key,
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF8),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0xFFEBE0D1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(title, style: theme.textTheme.titleLarge),
          const SizedBox(height: AppSpacing.sm),
          Text(body, style: theme.textTheme.bodyLarge),
        ],
      ),
    );
  }
}
