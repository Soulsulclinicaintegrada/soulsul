import 'package:flutter/material.dart';

class SectionTitle extends StatelessWidget {
  const SectionTitle({
    super.key,
    required this.title,
    this.subtitle,
  });

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          title,
          style: theme.textTheme.headlineLarge,
        ),
        if (subtitle != null) ...<Widget>[
          const SizedBox(height: 12),
          Text(
            subtitle!,
            style: theme.textTheme.bodyLarge,
          ),
        ],
      ],
    );
  }
}
