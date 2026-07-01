import 'package:flutter/material.dart';

class OnboardingScaffold extends StatelessWidget {
  const OnboardingScaffold({
    super.key,
    required this.child,
    this.onBack,
    this.includeSafeTopSpace = false,
  });

  final Widget child;
  final VoidCallback? onBack;
  final bool includeSafeTopSpace;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          color: Color(0xFFF6F0E7),
        ),
        child: Stack(
          children: <Widget>[
            const _AmbientBackground(),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                child: Column(
                  children: <Widget>[
                    if (onBack != null)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: IconButton.filledTonal(
                          onPressed: onBack,
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white.withOpacity(0.72),
                          ),
                          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                        ),
                      )
                    else if (includeSafeTopSpace)
                      const SizedBox(height: 12),
                    Expanded(child: child),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AmbientBackground extends StatelessWidget {
  const _AmbientBackground();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: <Widget>[
          Positioned(
            top: -70,
            right: -40,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFE5DEC9).withOpacity(0.55),
              ),
            ),
          ),
          Positioned(
            bottom: -90,
            left: -60,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFDCE5D2).withOpacity(0.5),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
