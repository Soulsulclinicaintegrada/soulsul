import 'package:flutter/material.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_radius.dart';
import 'package:com_deus_app/src/core/design_system/tokens/app_spacing.dart';

class QuoteBlock extends StatelessWidget {
  const QuoteBlock({
    super.key,
    required this.text,
    this.author,
  });

  final String text;
  final String? author;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0xFFE7DED0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            '“$text”',
            style: theme.textTheme.titleLarge?.copyWith(
              fontFamily: 'Georgia',
              fontWeight: FontWeight.w500,
            ),
          ),
          if (author != null) ...<Widget>[
            const SizedBox(height: AppSpacing.md),
            Text(
              author!,
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ],
      ),
    );
  }
}
