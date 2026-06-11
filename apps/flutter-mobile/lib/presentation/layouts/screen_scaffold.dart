import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../../core/theme/TSG_colors.dart';

class ScreenScaffold extends StatelessWidget {
  const ScreenScaffold({
    super.key,
    required this.children,
    this.title,
    this.subtitle,
    this.back,
    this.action,
    this.topPadding = 18,
  });

  final List<Widget> children;
  final String? title;
  final String? subtitle;
  final VoidCallback? back;
  final Widget? action;
  final double topPadding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        22,
        topPadding,
        22,
        MediaQuery.of(context).padding.bottom + 154,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null || back != null || action != null)
            Row(
              children: [
                if (back != null)
                  IconButton(
                    icon: const Icon(CupertinoIcons.chevron_left, size: 24),
                    onPressed: back,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints.tightFor(
                      width: 34,
                      height: 34,
                    ),
                  ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (title != null)
                        Text(title!, style: theme.textTheme.headlineLarge),
                      if (subtitle != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          subtitle!,
                          style: const TextStyle(
                            color: TsgColors.muted,
                            fontSize: 16,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                ?action,
              ],
            ),
          if (title != null || subtitle != null) const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }
}
