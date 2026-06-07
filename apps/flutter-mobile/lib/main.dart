import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'api/tsg_api_client.dart';

void main() {
  runApp(const TsgResidentApp());
}

const defaultApiBase = String.fromEnvironment(
  'TSG_API_BASE',
  defaultValue: 'https://mobile-api-nine.vercel.app',
);

typedef ApiRunner =
    Future<void> Function(
      String label,
      Future<Object?> Function(TsgApiClient client, ResidentAppState? state)
      action,
    );

class TsgResidentApp extends StatelessWidget {
  const TsgResidentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'TheSeniorGuru',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: TsgColors.canvas,
        colorScheme: ColorScheme.fromSeed(
          seedColor: TsgColors.purple,
          primary: TsgColors.purple,
          surface: TsgColors.card,
        ),
        fontFamily: 'SF Pro Text',
      ),
      home: const ResidentShell(),
    );
  }
}

class TsgColors {
  static const ink = Color(0xFF151129);
  static const muted = Color(0xFF716A80);
  static const canvas = Color(0xFFFFFCFA);
  static const card = Color(0xFFFFFFFF);
  static const cream = Color(0xFFFFF4E8);
  static const lilac = Color(0xFFF1E8F8);
  static const lilac2 = Color(0xFFFBF7FF);
  static const purple = Color(0xFF6D3B91);
  static const purple2 = Color(0xFF9B67BD);
  static const plum = Color(0xFF3E2854);
  static const green = Color(0xFF2F9D57);
  static const red = Color(0xFFF2555F);
  static const orange = Color(0xFFEFA64A);
  static const blue = Color(0xFF4A86D9);
  static const line = Color(0xFFE9E1ED);
  static const glass = Color(0xF8FFFFFF);
}

enum Screen {
  guru,
  today,
  companion,
  feed,
  more,
  onboardingWelcome,
  onboardingProfile,
  onboardingCircle,
  onboardingSafety,
  medications,
  medicationConfirm,
  refill,
  rideChat,
  rideMatches,
  rideStatus,
  companionChat,
  circle,
  person,
  createPost,
  events,
  wellness,
  vitals,
  familyHealth,
  risk,
  services,
  safety,
}

class ResidentShell extends StatefulWidget {
  const ResidentShell({super.key});

  @override
  State<ResidentShell> createState() => _ResidentShellState();
}

class _ResidentShellState extends State<ResidentShell> {
  Screen screen = Screen.guru;
  late final TsgApiClient apiClient;
  ResidentAppState? appState;
  String apiStatus = 'Connecting to mobile API...';
  bool apiBusy = false;

  @override
  void initState() {
    super.initState();
    apiClient = TsgApiClient(
      baseUrl: defaultApiBase,
      installationIdProvider: () async =>
          'flutter-resident-${DateTime.now().millisecondsSinceEpoch}',
    );
    _refreshState();
  }

  Future<void> _refreshState() async {
    setState(() {
      apiBusy = true;
      apiStatus = 'Loading resident data from API...';
    });
    try {
      final state = await apiClient.loadResidentState();
      if (!mounted) return;
      setState(() {
        appState = state;
        apiStatus = 'Live API connected';
        apiBusy = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        apiStatus = 'API not connected: $error';
        apiBusy = false;
      });
    }
  }

  Future<void> runApi(
    String label,
    Future<Object?> Function(TsgApiClient client, ResidentAppState? state)
    action,
  ) async {
    setState(() {
      apiBusy = true;
      apiStatus = '$label...';
    });
    try {
      await action(apiClient, appState);
      final state = await apiClient.loadResidentState();
      if (!mounted) return;
      setState(() {
        appState = state;
        apiStatus = '$label saved';
        apiBusy = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        apiStatus = '$label failed: $error';
        apiBusy = false;
      });
    }
  }

  int get tabIndex {
    return switch (screen) {
      Screen.guru ||
      Screen.rideChat ||
      Screen.rideMatches ||
      Screen.rideStatus => 0,
      Screen.today ||
      Screen.medications ||
      Screen.medicationConfirm ||
      Screen.refill ||
      Screen.onboardingWelcome ||
      Screen.onboardingProfile ||
      Screen.onboardingCircle ||
      Screen.onboardingSafety ||
      Screen.wellness ||
      Screen.vitals ||
      Screen.familyHealth ||
      Screen.risk ||
      Screen.safety => 1,
      Screen.companion || Screen.companionChat => 2,
      Screen.feed || Screen.createPost => 3,
      _ => 4,
    };
  }

  void go(Screen target) => setState(() => screen = target);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PhoneFrame(
        child: Stack(
          children: [
            Positioned.fill(
              child: SafeArea(
                bottom: false,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: _activeScreen(),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: BottomTabs(current: tabIndex, onTap: _onTab),
            ),
            Positioned(
              left: 16,
              right: 16,
              top: MediaQuery.of(context).padding.top + 4,
              child: ApiStatusPill(message: apiStatus, busy: apiBusy),
            ),
          ],
        ),
      ),
    );
  }

  void _onTab(int index) {
    go(
      [
        Screen.guru,
        Screen.today,
        Screen.companion,
        Screen.feed,
        Screen.more,
      ][index],
    );
  }

  Widget _activeScreen() {
    return switch (screen) {
      Screen.guru => GuruHome(
        key: const ValueKey('guru'),
        go: go,
        runApi: runApi,
      ),
      Screen.today => TodayHome(
        key: const ValueKey('today'),
        go: go,
        state: appState,
      ),
      Screen.companion => CompanionHome(
        key: const ValueKey('companion'),
        go: go,
      ),
      Screen.feed => FeedHome(key: const ValueKey('feed'), go: go),
      Screen.more => MoreHome(key: const ValueKey('more'), go: go),
      Screen.onboardingWelcome => OnboardingWelcome(
        key: const ValueKey('onboard1'),
        go: go,
      ),
      Screen.onboardingProfile => OnboardingProfile(
        key: const ValueKey('onboard2'),
        go: go,
      ),
      Screen.onboardingCircle => OnboardingCircle(
        key: const ValueKey('onboard3'),
        go: go,
      ),
      Screen.onboardingSafety => OnboardingSafety(
        key: const ValueKey('onboard4'),
        go: go,
      ),
      Screen.medications => MedicationsScreen(
        key: const ValueKey('meds'),
        go: go,
        state: appState,
      ),
      Screen.medicationConfirm => MedicationConfirm(
        key: const ValueKey('confirm'),
        go: go,
        state: appState,
        runApi: runApi,
      ),
      Screen.refill => RefillScreen(
        key: const ValueKey('refill'),
        go: go,
        state: appState,
        runApi: runApi,
      ),
      Screen.rideChat => RideChatScreen(
        key: const ValueKey('rideChat'),
        go: go,
        runApi: runApi,
      ),
      Screen.rideMatches => RideMatchesScreen(
        key: const ValueKey('matches'),
        go: go,
        state: appState,
        runApi: runApi,
      ),
      Screen.rideStatus => RideStatusScreen(
        key: const ValueKey('status'),
        go: go,
      ),
      Screen.companionChat => CompanionChat(
        key: const ValueKey('companionChat'),
        go: go,
      ),
      Screen.circle => CircleScreen(key: const ValueKey('circle'), go: go),
      Screen.person => PersonDetail(key: const ValueKey('person'), go: go),
      Screen.createPost => CreatePost(
        key: const ValueKey('createPost'),
        go: go,
        runApi: runApi,
      ),
      Screen.events => EventsScreen(
        key: const ValueKey('events'),
        go: go,
        runApi: runApi,
      ),
      Screen.wellness => WellnessScreen(
        key: const ValueKey('wellness'),
        go: go,
      ),
      Screen.vitals => VitalsScreen(key: const ValueKey('vitals'), go: go),
      Screen.familyHealth => FamilyHealthScreen(
        key: const ValueKey('family'),
        go: go,
      ),
      Screen.risk => RiskScreen(key: const ValueKey('risk'), go: go),
      Screen.services => ServicesScreen(
        key: const ValueKey('services'),
        go: go,
        state: appState,
        runApi: runApi,
      ),
      Screen.safety => SafetyScreen(
        key: const ValueKey('safety'),
        go: go,
        runApi: runApi,
      ),
    };
  }
}

class ApiStatusPill extends StatelessWidget {
  const ApiStatusPill({super.key, required this.message, required this.busy});

  final String message;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final connected =
        message.contains('connected') || message.contains('saved');
    final warning =
        message.contains('failed') || message.contains('not connected');
    return Align(
      alignment: Alignment.center,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: .9),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: warning
                ? TsgColors.red.withValues(alpha: .25)
                : TsgColors.line,
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x11000000),
              blurRadius: 14,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (busy)
              const SizedBox(
                width: 11,
                height: 11,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Icon(
                connected
                    ? CupertinoIcons.check_mark_circled_solid
                    : CupertinoIcons.exclamationmark_circle_fill,
                color: connected
                    ? TsgColors.green
                    : (warning ? TsgColors.red : TsgColors.orange),
                size: 14,
              ),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                message,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: TsgColors.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String requireMedicationId(ResidentAppState? state) {
  final medications = state?.medications ?? const <ResidentMedication>[];
  final medication = medications.isEmpty ? null : medications.first;
  if (medication == null || medication.id.isEmpty) {
    throw const TsgApiException(
      'No medication row available for this resident',
      409,
    );
  }
  return medication.id;
}

String requireTransportServiceId(ResidentAppState? state) {
  final services = state?.services ?? const <ResidentService>[];
  ResidentService? service;
  for (final item in services) {
    if (item.category.toLowerCase().contains('transport')) {
      service = item;
      break;
    }
  }
  service ??= services.isEmpty ? null : services.first;
  if (service == null || service.id.isEmpty) {
    throw const TsgApiException(
      'No service row available for ride booking',
      409,
    );
  }
  return service.id;
}

class PhoneFrame extends StatelessWidget {
  const PhoneFrame({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth.clamp(360.0, 430.0);
        return Center(
          child: Container(
            width: width,
            height: constraints.maxHeight,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFFFFFCFA),
                  Color(0xFFFFF8F2),
                  Color(0xFFFCF7FF),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(
                constraints.maxWidth > 500 ? 36 : 0,
              ),
              boxShadow: constraints.maxWidth > 500
                  ? const [BoxShadow(color: Color(0x22000000), blurRadius: 40)]
                  : null,
            ),
            clipBehavior: Clip.antiAlias,
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(-.8, -.95),
                  radius: 1.4,
                  colors: [Color(0xFFFFF1E4), Color(0x00FFF1E4)],
                ),
              ),
              child: child,
            ),
          ),
        );
      },
    );
  }
}

class BottomTabs extends StatelessWidget {
  const BottomTabs({super.key, required this.current, required this.onTap});

  final int current;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      (CupertinoIcons.sparkles, 'TSG Guru'),
      (CupertinoIcons.house_fill, 'Today'),
      (CupertinoIcons.chat_bubble_2, 'Companion'),
      (CupertinoIcons.heart, 'Feed'),
      (CupertinoIcons.ellipsis, 'More'),
    ];
    return Container(
      height: 86,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 18),
      decoration: BoxDecoration(
        color: TsgColors.glass.withValues(alpha: .94),
        backgroundBlendMode: BlendMode.srcOver,
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A2B1935),
            blurRadius: 28,
            offset: Offset(0, -12),
          ),
        ],
        border: const Border(top: BorderSide(color: TsgColors.line)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(tabs.length, (index) {
          final selected = current == index;
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onTap(index),
            child: SizedBox(
              width: 68,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (selected)
                    Container(
                      width: 44,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 7),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [TsgColors.purple2, TsgColors.purple],
                        ),
                        borderRadius: BorderRadius.circular(99),
                      ),
                    )
                  else
                    const SizedBox(height: 11),
                  Icon(
                    tabs[index].$1,
                    size: 24,
                    color: selected
                        ? TsgColors.purple
                        : const Color(0xFF62616A),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tabs[index].$2,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                      color: selected
                          ? TsgColors.purple
                          : const Color(0xFF62616A),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

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
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(22, topPadding, 22, 112),
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
                      if (title != null) H1(title!, size: 30),
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

class H1 extends StatelessWidget {
  const H1(this.text, {super.key, this.size = 34, this.center = false});
  final String text;
  final double size;
  final bool center;
  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: center ? TextAlign.center : TextAlign.start,
      style: TextStyle(
        fontFamily: 'Georgia',
        fontSize: size,
        height: 1.03,
        color: TsgColors.ink,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}

class SoftCard extends StatelessWidget {
  const SoftCard({
    super.key,
    required this.child,
    this.color = TsgColors.card,
    this.padding = const EdgeInsets.all(18),
    this.onTap,
  });

  final Widget child;
  final Color color;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color, Color.lerp(color, Colors.white, .72)!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: Colors.white.withValues(alpha: .9),
          width: 1.2,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x142D2038),
            blurRadius: 26,
            offset: Offset(0, 12),
          ),
          BoxShadow(
            color: Color(0x08FFFFFF),
            blurRadius: 2,
            offset: Offset(0, -1),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) return card;
    return GestureDetector(onTap: onTap, child: card);
  }
}

class PurpleButton extends StatelessWidget {
  const PurpleButton(this.label, {super.key, required this.onTap, this.icon});

  final String label;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFA66CC5), TsgColors.purple, Color(0xFF4F2A73)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(17),
          boxShadow: [
            BoxShadow(
              color: TsgColors.purple.withValues(alpha: .22),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, color: Colors.white, size: 18),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar({
    super.key,
    this.size = 52,
    this.label = 'A',
    this.tone = TsgColors.lilac,
    this.icon,
  });
  final double size;
  final String label;
  final Color tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            Colors.white,
            tone,
            Color.lerp(tone, TsgColors.purple2, .12)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A6D3B91),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Center(
        child: icon == null
            ? Text(
                label,
                style: TextStyle(
                  fontSize: size * .42,
                  fontWeight: FontWeight.w800,
                  color: TsgColors.purple,
                ),
              )
            : Icon(icon, color: TsgColors.purple, size: size * .48),
      ),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(
    this.text, {
    super.key,
    this.color = TsgColors.lilac,
    this.ink = TsgColors.purple,
  });
  final String text;
  final Color color;
  final Color ink;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(color: ink, fontSize: 12, fontWeight: FontWeight.w800),
      ),
    );
  }
}

class PhotoTile extends StatelessWidget {
  const PhotoTile({
    super.key,
    required this.icon,
    this.color = TsgColors.cream,
    this.width = 96,
    this.height = 92,
    this.accent = TsgColors.purple,
  });

  final IconData icon;
  final Color color;
  final double width;
  final double height;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: [Colors.white, color, Color.lerp(color, accent, .08)!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x102D2038),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: CustomPaint(
        painter: SoftIllustrationPainter(icon: icon, accent: accent),
      ),
    );
  }
}

class SoftIllustrationPainter extends CustomPainter {
  const SoftIllustrationPainter({required this.icon, required this.accent});
  final IconData icon;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width * .55, size.height * .55);
    final glow = Paint()
      ..shader =
          RadialGradient(
            colors: [
              accent.withValues(alpha: .22),
              accent.withValues(alpha: 0),
            ],
          ).createShader(
            Rect.fromCircle(center: center, radius: size.shortestSide * .62),
          );
    canvas.drawCircle(center, size.shortestSide * .5, glow);

    final bubble = Paint()..color = Colors.white.withValues(alpha: .72);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(
          size.width * .14,
          size.height * .18,
          size.width * .72,
          size.height * .62,
        ),
        const Radius.circular(22),
      ),
      bubble,
    );

    final tp = TextPainter(
      text: TextSpan(
        text: String.fromCharCode(icon.codePoint),
        style: TextStyle(
          fontSize: size.shortestSide * .46,
          fontFamily: icon.fontFamily,
          package: icon.fontPackage,
          color: accent,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(
      canvas,
      Offset((size.width - tp.width) / 2, (size.height - tp.height) / 2),
    );

    final shine = Paint()
      ..color = Colors.white.withValues(alpha: .62)
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(size.width * .2, size.height * .23),
      Offset(size.width * .36, size.height * .15),
      shine,
    );
    canvas.drawLine(
      Offset(size.width * .72, size.height * .78),
      Offset(size.width * .84, size.height * .7),
      shine,
    );
  }

  @override
  bool shouldRepaint(covariant SoftIllustrationPainter oldDelegate) {
    return oldDelegate.icon != icon || oldDelegate.accent != accent;
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action});
  final String title;
  final String? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: TsgColors.ink,
            ),
          ),
        ),
        if (action != null)
          Text(
            action!,
            style: const TextStyle(
              color: TsgColors.purple,
              fontWeight: FontWeight.w800,
            ),
          ),
      ],
    );
  }
}

class TodayHome extends StatelessWidget {
  const TodayHome({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final residentFirstName =
        (state?.residentName.split(' ').first.trim().isNotEmpty ?? false)
        ? state!.residentName.split(' ').first.trim()
        : 'Anita';
    final medication = state?.medications.isNotEmpty == true
        ? state!.medications.first
        : null;
    final medicationTitle = medication == null
        ? 'Medication due now'
        : '${medication.name} due now';
    final avatarLabel = residentFirstName.isEmpty
        ? 'A'
        : residentFirstName.characters.first.toUpperCase();
    return ScreenScaffold(
      children: [
        SizedBox(
          height: 132,
          child: Stack(
            children: [
              Positioned(
                left: 0,
                top: 2,
                width: 238,
                child: H1('Good morning,\n$residentFirstName', size: 34),
              ),
              const Positioned(
                left: 174,
                top: 73,
                child: Icon(
                  CupertinoIcons.sun_max_fill,
                  color: Color(0xFFFFC233),
                  size: 30,
                ),
              ),
              Positioned(
                right: 76,
                top: 18,
                child: IconButton(
                  onPressed: () {},
                  icon: const Icon(CupertinoIcons.bell, size: 29),
                ),
              ),
              Positioned(
                right: 0,
                top: 0,
                child: Avatar(
                  size: 62,
                  label: avatarLabel,
                  tone: const Color(0xFFFFE4D1),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 2),
        const Text(
          "Here's what's happening today.",
          style: TextStyle(color: TsgColors.muted, fontSize: 17),
        ),
        const SizedBox(height: 22),
        SoftCard(
          color: const Color(0xFFFFF6FB),
          child: Column(
            children: [
              Row(
                children: [
                  const Avatar(
                    size: 54,
                    icon: CupertinoIcons.capsule,
                    tone: Color(0xFFF1E5FF),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          medicationTitle,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: TsgColors.ink,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          '8:00 AM  •  1 tablet',
                          style: TextStyle(
                            color: TsgColors.muted,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(CupertinoIcons.chevron_right),
                ],
              ),
              const SizedBox(height: 18),
              PurpleButton(
                'Take Medication',
                onTap: () => go(Screen.medications),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SoftCard(
          color: const Color(0xFFFFFAF2),
          onTap: () => go(Screen.rideStatus),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'NEXT UP',
                      style: TextStyle(
                        color: TsgColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const H1('Cardiology Visit', size: 26),
                    const SizedBox(height: 6),
                    const Text(
                      'Tomorrow, 10:00 AM',
                      style: TextStyle(fontSize: 17, color: TsgColors.ink),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: () => go(Screen.rideStatus),
                      child: const Text('View details'),
                    ),
                  ],
                ),
              ),
              const PhotoTile(
                icon: CupertinoIcons.car_detailed,
                width: 112,
                height: 86,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SoftCard(
          color: const Color(0xFFFFEEF0),
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'MESSAGE FROM RITA •',
                      style: TextStyle(
                        color: Color(0xFFB24465),
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 8),
                    H1('Good morning Mom!', size: 23),
                    SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          'Thinking of you',
                          style: TextStyle(fontSize: 16, color: TsgColors.ink),
                        ),
                        SizedBox(width: 6),
                        Icon(
                          CupertinoIcons.heart_fill,
                          color: Color(0xFFFF5D87),
                          size: 18,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Stack(
                children: [
                  const Avatar(size: 68, label: 'R', tone: Color(0xFFFFDCD7)),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFF668D),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        CupertinoIcons.chat_bubble_fill,
                        size: 15,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SoftCard(
          color: const Color(0xFFF4FBF1),
          onTap: () => go(Screen.events),
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "TODAY'S ACTIVITY",
                      style: TextStyle(
                        color: TsgColors.green,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 8),
                    H1('Chair Yoga', size: 26),
                    SizedBox(height: 6),
                    Text(
                      '10:30 AM  •  Community Hall',
                      style: TextStyle(fontSize: 15, color: TsgColors.ink),
                    ),
                  ],
                ),
              ),
              const PhotoTile(
                icon: CupertinoIcons.rectangle_stack_person_crop,
                color: Color(0xFFE4F0DD),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: () {},
          child: Container(
            height: 96,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFF6871), TsgColors.red],
              ),
              borderRadius: BorderRadius.circular(18),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x22F2555F),
                  blurRadius: 20,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: const Row(
              children: [
                Icon(
                  CupertinoIcons.shield_lefthalf_fill,
                  color: Colors.white,
                  size: 44,
                ),
                SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'SOS',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        'Emergency help',
                        style: TextStyle(color: Colors.white, fontSize: 16),
                      ),
                    ],
                  ),
                ),
                CircleAvatar(
                  radius: 26,
                  backgroundColor: Color(0x22FFFFFF),
                  child: Icon(CupertinoIcons.phone_fill, color: Colors.white),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class GuruHome extends StatelessWidget {
  const GuruHome({super.key, required this.go, required this.runApi});
  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  Widget build(BuildContext context) {
    final requests = [
      (CupertinoIcons.car_detailed, 'I need a ride', Screen.rideChat),
      (CupertinoIcons.capsule, 'I need medication help', Screen.medications),
      (CupertinoIcons.bag, 'I need food', Screen.services),
      (CupertinoIcons.sparkles, 'I need cleaning', Screen.services),
      (CupertinoIcons.doc_text_search, 'I need diapers', Screen.services),
      (CupertinoIcons.heart, 'Feeling lonely', Screen.companionChat),
    ];
    return ScreenScaffold(
      title: 'How can we help?',
      children: [
        Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 15),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: TsgColors.line),
          ),
          child: const Row(
            children: [
              Icon(CupertinoIcons.search, color: TsgColors.muted),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'What do you need today?',
                  style: TextStyle(color: TsgColors.muted),
                ),
              ),
              CircleAvatar(
                radius: 18,
                backgroundColor: TsgColors.lilac,
                child: Icon(
                  CupertinoIcons.mic_fill,
                  size: 18,
                  color: TsgColors.purple,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        const Text(
          'Popular requests',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: TsgColors.ink,
          ),
        ),
        const SizedBox(height: 12),
        ...requests.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: SoftCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              onTap: () => go(item.$3),
              child: Row(
                children: [
                  Icon(item.$1, color: TsgColors.purple, size: 22),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      item.$2,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Icon(
                    CupertinoIcons.chevron_right,
                    size: 18,
                    color: TsgColors.muted,
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SoftCard(
          color: TsgColors.lilac2,
          onTap: () => go(Screen.rideChat),
          child: const Row(
            children: [
              Avatar(size: 62, icon: CupertinoIcons.chat_bubble_2_fill),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Guru Assistant',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 5),
                    Text(
                      'Tell us what you need in your own words.',
                      style: TextStyle(color: TsgColors.muted, height: 1.35),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class MedicationsScreen extends StatelessWidget {
  const MedicationsScreen({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final medications = state?.medications;
    final visibleMeds = medications == null || medications.isEmpty
        ? const [
            ResidentMedication(
              id: 'demo-lisinopril',
              name: 'Lisinopril 10mg',
              status: 'confirmed',
              remainingCount: 5,
            ),
            ResidentMedication(
              id: 'demo-metformin',
              name: 'Metformin 500mg',
              status: 'pending',
              remainingCount: 18,
            ),
            ResidentMedication(
              id: 'demo-atorvastatin',
              name: 'Atorvastatin 20mg',
              status: 'pending',
              remainingCount: 9,
            ),
          ]
        : medications;
    final first = visibleMeds[0];
    final second = visibleMeds.length > 1 ? visibleMeds[1] : null;
    final third = visibleMeds.length > 2 ? visibleMeds[2] : null;
    return ScreenScaffold(
      title: 'Medications',
      back: () => go(Screen.today),
      children: [
        Segmented(labels: const ['My meds', 'History'], selected: 0),
        const SizedBox(height: 22),
        medSection('Morning', '8:00 AM', [
          medRow(
            first.name,
            'Blood Pressure',
            TsgColors.green,
            medStatus(first),
            () => go(Screen.medicationConfirm),
          ),
        ]),
        if (second != null)
          medSection('Afternoon', '2:00 PM', [
            medRow(
              second.name,
              'Diabetes',
              TsgColors.orange,
              medStatus(second),
              () => go(Screen.medicationConfirm),
            ),
          ]),
        if (third != null)
          medSection('Evening', '8:00 PM', [
            medRow(
              third.name,
              'Cholesterol',
              TsgColors.orange,
              medStatus(third),
              () => go(Screen.refill),
            ),
          ]),
        const SizedBox(height: 18),
        Center(
          child: TextButton.icon(
            onPressed: () {},
            icon: const Icon(CupertinoIcons.plus, color: TsgColors.purple),
            label: const Text(
              'Add medication',
              style: TextStyle(
                color: TsgColors.purple,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget medSection(String title, String time, List<Widget> rows) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            Text(
              time,
              style: const TextStyle(color: TsgColors.muted, fontSize: 12),
            ),
          ],
        ),
        const SizedBox(height: 9),
        ...rows,
        const SizedBox(height: 16),
      ],
    );
  }

  Widget medRow(
    String name,
    String subtitle,
    Color color,
    String status,
    VoidCallback onTap,
  ) {
    return SoftCard(
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .13),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(CupertinoIcons.capsule, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w900)),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: TsgColors.muted),
                ),
              ],
            ),
          ),
          Pill(status, color: color.withValues(alpha: .12), ink: color),
        ],
      ),
    );
  }

  String medStatus(ResidentMedication medication) {
    final normalized = medication.status.toLowerCase();
    if (normalized.contains('confirm') || normalized.contains('taken')) {
      return 'Done';
    }
    if (normalized.contains('skip')) return 'Skipped';
    if (normalized.contains('snooze')) return 'Later';
    return 'Pending';
  }
}

class MedicationConfirm extends StatelessWidget {
  const MedicationConfirm({
    super.key,
    required this.go,
    required this.runApi,
    this.state,
  });
  final ValueChanged<Screen> go;
  final ApiRunner runApi;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final medication = state?.medications.isNotEmpty == true
        ? state!.medications.first
        : const ResidentMedication(
            id: 'demo-lisinopril',
            name: 'Lisinopril 10mg',
            status: 'pending',
            remainingCount: 5,
          );
    return ScreenScaffold(
      title: 'Confirm medication',
      back: () => go(Screen.medications),
      children: [
        SoftCard(
          color: const Color(0xFFFFFAF8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                medication.name,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              const Text(
                '8:00 AM  •  1 tablet',
                style: TextStyle(color: TsgColors.muted),
              ),
            ],
          ),
        ),
        const SizedBox(height: 42),
        const Center(
          child: H1('Did you take your\nmedication?', size: 26, center: true),
        ),
        const SizedBox(height: 24),
        const Center(
          child: Avatar(
            size: 74,
            icon: CupertinoIcons.capsule,
            tone: TsgColors.lilac,
          ),
        ),
        const SizedBox(height: 38),
        confirmButton(
          'Yes, I took it',
          CupertinoIcons.check_mark_circled,
          const Color(0xFFE7F8EA),
          TsgColors.green,
          () async {
            await runApi('Confirming medication dose', (client, state) {
              return client.confirmMedication(requireMedicationId(state));
            });
            go(Screen.today);
          },
        ),
        confirmButton(
          'Remind me later',
          CupertinoIcons.clock,
          Colors.white,
          TsgColors.ink,
          () async {
            await runApi('Snoozing medication reminder', (client, state) {
              return client.remindMedicationLater(requireMedicationId(state));
            });
            go(Screen.today);
          },
        ),
        confirmButton(
          'Skip this dose',
          CupertinoIcons.xmark_circle,
          Colors.white,
          TsgColors.ink,
          () async {
            await runApi('Skipping medication dose', (client, state) {
              return client.skipMedication(requireMedicationId(state));
            });
            go(Screen.today);
          },
        ),
        const SizedBox(height: 20),
        Center(
          child: TextButton.icon(
            onPressed: () {},
            icon: const Icon(
              CupertinoIcons.exclamationmark_circle,
              size: 17,
              color: TsgColors.purple,
            ),
            label: const Text(
              'Report an issue',
              style: TextStyle(color: TsgColors.purple),
            ),
          ),
        ),
      ],
    );
  }

  Widget confirmButton(
    String text,
    IconData icon,
    Color bg,
    Color ink,
    VoidCallback onTap,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(13),
            border: Border.all(color: TsgColors.line),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: ink, size: 18),
              const SizedBox(width: 8),
              Text(
                text,
                style: TextStyle(color: ink, fontWeight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RefillScreen extends StatelessWidget {
  const RefillScreen({
    super.key,
    required this.go,
    required this.runApi,
    this.state,
  });
  final ValueChanged<Screen> go;
  final ApiRunner runApi;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final medication = state?.medications.isNotEmpty == true
        ? state!.medications.first
        : const ResidentMedication(
            id: 'demo-lisinopril',
            name: 'Lisinopril 10mg',
            status: 'pending',
            remainingCount: 5,
          );
    final remaining = medication.remainingCount <= 0
        ? 5
        : medication.remainingCount;
    final progress = (remaining / 15).clamp(.05, 1.0);
    return ScreenScaffold(
      title: 'Refill needed',
      back: () => go(Screen.medications),
      children: [
        const SizedBox(height: 20),
        const Center(
          child: PhotoTile(
            icon: CupertinoIcons.capsule,
            width: 200,
            height: 160,
            color: Color(0xFFFFF4EA),
          ),
        ),
        const SizedBox(height: 30),
        Text(
          medication.name,
          style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        Text(
          '$remaining pills remaining',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            backgroundColor: TsgColors.line,
            color: TsgColors.orange,
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Running low. Please request a refill to stay on track.',
          style: TextStyle(color: TsgColors.muted, fontSize: 15, height: 1.35),
        ),
        const SizedBox(height: 28),
        PurpleButton(
          'Request Refill',
          onTap: () async {
            await runApi('Requesting medication refill', (client, state) {
              return client.requestMedicationRefill(requireMedicationId(state));
            });
            go(Screen.today);
          },
        ),
        const SizedBox(height: 20),
        Center(
          child: TextButton(
            onPressed: () {},
            child: const Text('Set low stock reminder'),
          ),
        ),
      ],
    );
  }
}

class RideChatScreen extends StatelessWidget {
  const RideChatScreen({super.key, required this.go, required this.runApi});
  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Help Assistant',
      back: () => go(Screen.guru),
      action: IconButton(
        onPressed: () {},
        icon: const CircleAvatar(
          backgroundColor: TsgColors.purple,
          child: Icon(CupertinoIcons.ellipsis, color: Colors.white),
        ),
      ),
      children: [
        chatBubble('I need a ride tomorrow.', true, 'You • 10:30 AM'),
        chatBubble(
          'Sure, I can help with that.\nWhere would you like to go?',
          false,
          'Guru • 10:30 AM',
        ),
        chatBubble('Doctor appointment.', true, 'You • 10:31 AM'),
        GestureDetector(
          onTap: () async {
            await runApi('Sending Guru ride request', (client, state) {
              return client.sendGuruMessage(
                'I need a ride to my doctor tomorrow',
                screen: 'help',
              );
            });
            go(Screen.rideMatches);
          },
          child: chatBubble(
            'Great! I found 3 transportation\noptions for you.',
            false,
            'Guru • 10:31 AM',
          ),
        ),
        const SizedBox(height: 30),
        GestureDetector(
          onTap: () async {
            await runApi('Loading transportation matches', (client, state) {
              return client.sendGuruMessage(
                'Show my ride matches for tomorrow',
                screen: 'ride_matches',
              );
            });
            go(Screen.rideMatches);
          },
          child: const Text(
            'View matches →',
            style: TextStyle(
              color: TsgColors.purple,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 94),
        inputBar(),
      ],
    );
  }
}

Widget chatBubble(String text, bool mine, String meta) {
  return Align(
    alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
    child: Container(
      constraints: const BoxConstraints(maxWidth: 260),
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: mine ? TsgColors.lilac : Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: const Radius.circular(17),
          topRight: const Radius.circular(17),
          bottomLeft: Radius.circular(mine ? 17 : 5),
          bottomRight: Radius.circular(mine ? 5 : 17),
        ),
        border: Border.all(color: TsgColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (mine)
            const Text(
              'You',
              style: TextStyle(
                fontSize: 12,
                color: TsgColors.purple,
                fontWeight: FontWeight.w800,
              ),
            ),
          Text(
            text,
            style: const TextStyle(
              fontSize: 16,
              color: TsgColors.ink,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              meta,
              style: const TextStyle(fontSize: 11, color: TsgColors.muted),
            ),
          ),
        ],
      ),
    ),
  );
}

Widget inputBar() {
  return Container(
    height: 56,
    padding: const EdgeInsets.only(left: 16, right: 8),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: TsgColors.line),
    ),
    child: const Row(
      children: [
        Expanded(
          child: Text(
            'Type or speak...',
            style: TextStyle(color: TsgColors.muted, fontSize: 16),
          ),
        ),
        CircleAvatar(
          radius: 20,
          backgroundColor: TsgColors.purple,
          child: Icon(CupertinoIcons.mic_fill, color: Colors.white, size: 18),
        ),
      ],
    ),
  );
}

class RideMatchesScreen extends StatelessWidget {
  const RideMatchesScreen({
    super.key,
    required this.go,
    required this.runApi,
    this.state,
  });
  final ValueChanged<Screen> go;
  final ApiRunner runApi;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Matched for you',
      subtitle: 'Tomorrow, May 25',
      back: () => go(Screen.rideChat),
      children: [
        rideOption(
          'CareRide',
          '4.8 (126)',
          r'$18 - $25',
          'Available',
          CupertinoIcons.car_detailed,
          () => bookRide('CareRide'),
        ),
        rideOption(
          'Senior Wheels',
          '4.6 (89)',
          r'$20 - $28',
          'Available',
          CupertinoIcons.person_3_fill,
          () => bookRide('Senior Wheels'),
        ),
        rideOption(
          'Community Cab',
          '4.7 (72)',
          r'$15 - $20',
          '2 seats left',
          CupertinoIcons.car_fill,
          () => bookRide('Community Cab'),
          warning: true,
        ),
        const SizedBox(height: 26),
        const Center(
          child: Text(
            'Prices are estimates',
            style: TextStyle(color: TsgColors.muted, fontSize: 12),
          ),
        ),
      ],
    );
  }

  Future<void> bookRide(String provider) async {
    await runApi('Creating $provider ride booking', (client, state) {
      return client.createRideBooking(
        serviceId: requireTransportServiceId(state),
        label: 'Cardiology Visit',
        time: 'Tomorrow, 10:00 AM',
      );
    });
    go(Screen.rideStatus);
  }

  Widget rideOption(
    String name,
    String rating,
    String price,
    String status,
    IconData icon,
    VoidCallback onTap, {
    bool warning = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: SoftCard(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Avatar(size: 52, icon: icon, tone: TsgColors.lilac),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    '★ $rating',
                    style: const TextStyle(
                      color: TsgColors.orange,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(price, style: const TextStyle(fontSize: 15)),
                  Text(
                    status,
                    style: TextStyle(
                      color: warning ? TsgColors.red : TsgColors.green,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(width: 80, child: PurpleButton('Book', onTap: onTap)),
          ],
        ),
      ),
    );
  }
}

class RideStatusScreen extends StatelessWidget {
  const RideStatusScreen({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final steps = [
      ('Request received', '10:31 AM', true),
      ('Driver assigned', '10:32 AM', true),
      ('Driver arriving', '9:45 AM', false),
      ('Completed', '', false),
    ];
    return ScreenScaffold(
      title: 'Request status',
      back: () => go(Screen.guru),
      children: [
        const SizedBox(height: 30),
        const Center(
          child: Avatar(
            size: 86,
            icon: CupertinoIcons.car_detailed,
            tone: TsgColors.lilac,
          ),
        ),
        const SizedBox(height: 18),
        const Center(
          child: Text(
            'Ride requested',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
          ),
        ),
        const SizedBox(height: 6),
        const Center(
          child: Text(
            'Tomorrow, May 25 • 10:00 AM',
            style: TextStyle(color: TsgColors.muted),
          ),
        ),
        const SizedBox(height: 28),
        ...steps.map(
          (step) => Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: Row(
              children: [
                Icon(
                  step.$3
                      ? CupertinoIcons.check_mark_circled_solid
                      : CupertinoIcons.circle,
                  color: step.$3 ? TsgColors.green : TsgColors.muted,
                  size: 22,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    step.$1,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                Text(step.$2, style: const TextStyle(color: TsgColors.muted)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 26),
        PurpleButton('View details', onTap: () => go(Screen.today)),
      ],
    );
  }
}

class CompanionHome extends StatelessWidget {
  const CompanionHome({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Companion',
      children: [
        const SizedBox(height: 22),
        const Center(
          child: Avatar(
            size: 136,
            icon: CupertinoIcons.smiley_fill,
            tone: TsgColors.lilac,
          ),
        ),
        const SizedBox(height: 22),
        const Center(
          child: Text(
            'Good morning, Anita',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
        ),
        const SizedBox(height: 6),
        const Center(
          child: Text(
            "I'm Guru, your AI companion.\nHow are you feeling today?",
            textAlign: TextAlign.center,
            style: TextStyle(color: TsgColors.muted, height: 1.35),
          ),
        ),
        const SizedBox(height: 22),
        GridView.count(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          crossAxisCount: 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 2.6,
          children: ['Great', 'Okay', 'Lonely', 'Worried'].map((mood) {
            return SoftCard(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              onTap: () => go(Screen.companionChat),
              child: Row(
                children: [
                  const Icon(
                    CupertinoIcons.smiley_fill,
                    color: TsgColors.orange,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    mood,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 24),
        inputBar(),
      ],
    );
  }
}

class CompanionChat extends StatelessWidget {
  const CompanionChat({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Chat with Guru',
      back: () => go(Screen.companion),
      children: [
        chatBubble("I didn't sleep well\nlast night.", true, 'You • 8:15 AM'),
        chatBubble(
          'I’m sorry to hear that. Want to talk about what kept you awake?',
          false,
          'Guru • 8:15 AM',
        ),
        chatBubble('Just too many\nthoughts.', true, 'You • 8:16 AM'),
        chatBubble(
          'I understand. Take a deep breath with me.',
          false,
          'Guru • 8:16 AM',
        ),
        const SizedBox(height: 120),
        inputBar(),
      ],
    );
  }
}

class CircleScreen extends StatelessWidget {
  const CircleScreen({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final people = [
      ('Rita Sharma', 'Daughter', 'R'),
      ('Arjun Sharma', 'Son', 'A'),
      ('Susan Patel', 'Friend', 'S'),
      ('Dr. Mehta', 'Physician', 'D'),
      ('Meena Joshi', 'Caregiver', 'M'),
    ];
    return ScreenScaffold(
      title: 'My Circle',
      back: () => go(Screen.more),
      children: [
        ...people.map(
          (p) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SoftCard(
              padding: const EdgeInsets.all(12),
              onTap: () => go(Screen.person),
              child: Row(
                children: [
                  Avatar(size: 46, label: p.$3, tone: const Color(0xFFFFE0CC)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.$1,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        Text(
                          p.$2,
                          style: const TextStyle(
                            color: TsgColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(CupertinoIcons.phone, color: TsgColors.purple),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        PurpleButton('Add Person', onTap: () {}),
      ],
    );
  }
}

class PersonDetail extends StatelessWidget {
  const PersonDetail({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Rita Sharma',
      subtitle: 'Daughter',
      back: () => go(Screen.circle),
      children: [
        const Center(
          child: Avatar(size: 118, label: 'R', tone: Color(0xFFFFD8C8)),
        ),
        const SizedBox(height: 22),
        Row(
          children: [
            Expanded(
              child: PurpleButton(
                'Call',
                icon: CupertinoIcons.phone_fill,
                onTap: () {},
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: PurpleButton(
                'Message',
                icon: CupertinoIcons.chat_bubble_fill,
                onTap: () {},
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: PurpleButton(
                'Video',
                icon: CupertinoIcons.video_camera_solid,
                onTap: () {},
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        infoCard(
          CupertinoIcons.hand_raised_fill,
          'Request help',
          'Ask Rita for help with rides, errands or more.',
        ),
        infoCard(
          CupertinoIcons.folder_fill,
          'View shared info',
          'Medical info, preferences and care.',
        ),
        infoCard(
          CupertinoIcons.clock_fill,
          'Recent activity',
          'You talked 2 days ago.',
        ),
      ],
    );
  }

  Widget infoCard(IconData icon, String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SoftCard(
        color: TsgColors.lilac2,
        child: Row(
          children: [
            Icon(icon, color: TsgColors.purple),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 4),
                  Text(body, style: const TextStyle(color: TsgColors.muted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class FeedHome extends StatelessWidget {
  const FeedHome({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Community Feed',
      action: IconButton(
        onPressed: () => go(Screen.createPost),
        icon: const Icon(
          CupertinoIcons.plus_circle_fill,
          color: TsgColors.purple,
          size: 30,
        ),
      ),
      children: [
        const Segmented(labels: ['For You', 'Following'], selected: 0),
        const SizedBox(height: 16),
        postCard(
          'Mary D.',
          'Beautiful morning walk\nwith my friends',
          CupertinoIcons.tree,
          '24',
        ),
        postCard(
          'Park View Community',
          'Community Lunch\nthis Friday at 1 PM.',
          CupertinoIcons.photo,
          '18',
        ),
      ],
    );
  }

  Widget postCard(String name, String body, IconData icon, String likes) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Avatar(
                  size: 42,
                  label: name.characters.first,
                  tone: const Color(0xFFFFDDCA),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    name,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                const Icon(CupertinoIcons.ellipsis),
              ],
            ),
            const SizedBox(height: 12),
            Text(body, style: const TextStyle(fontSize: 16, height: 1.3)),
            const SizedBox(height: 12),
            PhotoTile(
              icon: icon,
              width: double.infinity,
              height: 145,
              color: const Color(0xFFEAF4E6),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(
                  CupertinoIcons.heart_fill,
                  color: TsgColors.red,
                  size: 18,
                ),
                const SizedBox(width: 6),
                Text(likes),
                const SizedBox(width: 22),
                const Icon(CupertinoIcons.chat_bubble, size: 18),
                const SizedBox(width: 6),
                const Text('Comment'),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class CreatePost extends StatelessWidget {
  const CreatePost({super.key, required this.go, required this.runApi});
  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Create Post',
      back: () => go(Screen.feed),
      children: [
        Container(
          height: 156,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: TsgColors.line),
          ),
          child: const Align(
            alignment: Alignment.topLeft,
            child: Text(
              "What's on your mind?",
              style: TextStyle(color: TsgColors.muted),
            ),
          ),
        ),
        const SizedBox(height: 18),
        postOption(CupertinoIcons.photo, 'Photo / Video'),
        postOption(CupertinoIcons.question_circle, 'Ask a question'),
        postOption(CupertinoIcons.paperplane, 'Share update'),
        postOption(CupertinoIcons.lightbulb, 'Inspire others'),
        const SizedBox(height: 28),
        PurpleButton(
          'Post',
          onTap: () async {
            await runApi('Publishing community post', (client, state) {
              return client.createPost(
                'Beautiful morning walk with my friends',
              );
            });
            go(Screen.feed);
          },
        ),
      ],
    );
  }

  Widget postOption(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SoftCard(
        padding: const EdgeInsets.all(15),
        child: Row(
          children: [
            Icon(icon, color: TsgColors.purple),
            const SizedBox(width: 13),
            Text(text, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}

class EventsScreen extends StatelessWidget {
  const EventsScreen({super.key, required this.go, required this.runApi});
  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  Widget build(BuildContext context) {
    final events = [
      (
        'TODAY',
        'Chair Yoga',
        'Gentle yoga for all levels.',
        '10:30 AM - 11:30 AM',
        'Community Hall',
        '12',
        Icons.directions_walk_rounded,
        true,
      ),
      (
        'FRIDAY, MAY 24',
        'Movie Night',
        'A fun movie and snacks\nwith friends!',
        '7:00 PM - 9:30 PM',
        'Community Lounge',
        '18',
        CupertinoIcons.film,
        false,
      ),
      (
        'TOMORROW',
        'Memory Challenge',
        'Fun games to keep\nyour minds sharp.',
        '2:00 PM - 3:00 PM',
        'Activity Room',
        '10',
        CupertinoIcons.game_controller,
        false,
      ),
      (
        'SAT, MAY 25',
        'Community Lunch',
        'Delicious food and great\nconversation.',
        '12:00 PM - 1:30 PM',
        'Dining Room',
        '22',
        CupertinoIcons.square_grid_2x2,
        true,
      ),
      (
        'WED, MAY 29',
        'Art & Creativity',
        'Express yourself and have fun\nwith colors.',
        '1:00 PM - 2:30 PM',
        'Activity Room',
        '8',
        CupertinoIcons.paintbrush,
        false,
      ),
    ];
    return ScreenScaffold(
      title: 'Events',
      subtitle: 'Discover activities and events\nhappening in your community.',
      back: () => go(Screen.more),
      action: const Avatar(
        size: 48,
        icon: CupertinoIcons.calendar,
        tone: TsgColors.lilac2,
      ),
      children: [
        const Segmented(
          labels: ['Upcoming', 'This Week', 'This Month', 'My Events'],
          selected: 0,
        ),
        const SizedBox(height: 22),
        Row(
          children: [
            const Expanded(
              child: Text(
                'Upcoming Events',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
            ),
            TextButton(onPressed: () {}, child: const Text('View all')),
          ],
        ),
        ...events.map((e) => eventCard(e)),
      ],
    );
  }

  Widget eventCard(
    (String, String, String, String, String, String, IconData, bool) e,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: SoftCard(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            PhotoTile(
              icon: e.$7,
              width: 104,
              height: 104,
              color: e.$8 ? const Color(0xFFEFF9EF) : const Color(0xFFFFF3DE),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Pill(e.$1, color: TsgColors.lilac2),
                  const SizedBox(height: 8),
                  Text(
                    e.$2,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    e.$3,
                    style: const TextStyle(color: TsgColors.muted, height: 1.2),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '◷ ${e.$4}',
                    style: const TextStyle(fontSize: 12, color: TsgColors.ink),
                  ),
                  Text(
                    '⌖ ${e.$5}',
                    style: const TextStyle(fontSize: 12, color: TsgColors.ink),
                  ),
                ],
              ),
            ),
            Column(
              children: [
                Pill(
                  '${e.$6}\ngoing',
                  color: e.$8
                      ? const Color(0xFFEAF8E9)
                      : const Color(0xFFFFF4DE),
                  ink: TsgColors.ink,
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: 64,
                  height: 40,
                  child: PurpleButton(
                    'Join',
                    onTap: () {
                      runApi('Joining ${e.$2}', (client, state) {
                        return client.joinEvent(eventIdFor(e.$2), e.$2);
                      });
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String eventIdFor(String name) {
  return name
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
      .replaceAll(RegExp(r'_+$'), '');
}

class MoreHome extends StatelessWidget {
  const MoreHome({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final items = [
      (CupertinoIcons.person_2_fill, 'People / Circle', Screen.circle),
      (CupertinoIcons.square_grid_2x2_fill, 'Services', Screen.services),
      (CupertinoIcons.calendar, 'Events', Screen.events),
      (CupertinoIcons.shield_fill, 'Safety', Screen.safety),
      (CupertinoIcons.heart_fill, 'Wellness Score', Screen.wellness),
      (CupertinoIcons.waveform_path_ecg, 'Vitals Monitor', Screen.vitals),
      (
        CupertinoIcons.person_crop_circle_badge_checkmark,
        'Family Health View',
        Screen.familyHealth,
      ),
      (CupertinoIcons.shield_fill, 'Risk Intelligence', Screen.risk),
      (
        CupertinoIcons.person_badge_plus,
        'Onboarding Flow',
        Screen.onboardingWelcome,
      ),
    ];
    return ScreenScaffold(
      title: 'More',
      subtitle: 'Resident tools and care views.',
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF4C2D67), TsgColors.purple, Color(0xFFA269BE)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(26),
            boxShadow: [
              BoxShadow(
                color: TsgColors.purple.withValues(alpha: .24),
                blurRadius: 28,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: const Row(
            children: [
              Avatar(size: 64, label: 'A', tone: Color(0xFFFFE3D2)),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Anita Sharma',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Park View Community',
                      style: TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ),
              Icon(CupertinoIcons.gear_alt_fill, color: Colors.white),
            ],
          ),
        ),
        const SizedBox(height: 18),
        GridView.count(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.22,
          children: items.map((item) {
            return SoftCard(
              padding: const EdgeInsets.all(14),
              onTap: () => go(item.$3),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: TsgColors.lilac,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(item.$1, color: TsgColors.purple),
                  ),
                  const Spacer(),
                  Text(
                    item.$2,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 5),
                  const Icon(
                    CupertinoIcons.chevron_right,
                    color: TsgColors.muted,
                    size: 16,
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class ServicesScreen extends StatelessWidget {
  const ServicesScreen({
    super.key,
    required this.go,
    required this.runApi,
    this.state,
  });
  final ValueChanged<Screen> go;
  final ApiRunner runApi;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final services = [
      (
        'CareRide',
        'Transportation',
        '4.8',
        'Available tomorrow',
        CupertinoIcons.car_detailed,
        const Color(0xFFFFF3E8),
      ),
      (
        'HealthPlus Pharmacy',
        'Medicine delivery',
        '4.7',
        'Fast delivery',
        CupertinoIcons.capsule,
        const Color(0xFFEFF8ED),
      ),
      (
        'Comfort Cleaning',
        'Home care',
        '4.9',
        'Today, 3 PM open',
        CupertinoIcons.sparkles,
        const Color(0xFFF4EDFF),
      ),
      (
        'Fresh Meals',
        'Food delivery',
        '4.6',
        'Low sodium meals',
        CupertinoIcons.bag,
        const Color(0xFFFFF7DF),
      ),
    ];
    final categories = [
      (CupertinoIcons.car_detailed, 'Transport'),
      (CupertinoIcons.capsule, 'Medication'),
      (CupertinoIcons.bag, 'Food'),
      (CupertinoIcons.house_fill, 'Home Care'),
      (CupertinoIcons.calendar, 'Events'),
      (CupertinoIcons.ellipsis, 'More'),
    ];
    return ScreenScaffold(
      title: 'Services',
      subtitle: 'Find trusted help near you.',
      back: () => go(Screen.more),
      children: [
        Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 15),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(17),
            border: Border.all(color: TsgColors.line),
          ),
          child: const Row(
            children: [
              Icon(CupertinoIcons.search, color: TsgColors.muted),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Search services...',
                  style: TextStyle(color: TsgColors.muted),
                ),
              ),
              Icon(CupertinoIcons.slider_horizontal_3, color: TsgColors.purple),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const SectionHeader('AI matched for you', action: 'View all'),
        const SizedBox(height: 12),
        ...services.map(
          (s) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SoftCard(
              padding: const EdgeInsets.all(13),
              onTap: () async {
                if (s.$1 == 'CareRide') {
                  await runApi('Creating CareRide booking', (client, state) {
                    return client.createRideBooking(
                      serviceId: requireTransportServiceId(state),
                      label: 'Cardiology Visit',
                      time: 'Tomorrow, 10:00 AM',
                    );
                  });
                  go(Screen.rideStatus);
                  return;
                }
                await runApi('Creating ${s.$2} order', (client, state) {
                  return client.createSupportOrder(category: s.$2, label: s.$1);
                });
              },
              child: Row(
                children: [
                  PhotoTile(icon: s.$5, width: 72, height: 72, color: s.$6),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          s.$1,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          s.$2,
                          style: const TextStyle(color: TsgColors.muted),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '★ ${s.$3}',
                          style: const TextStyle(
                            color: TsgColors.orange,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          s.$4,
                          style: const TextStyle(
                            color: TsgColors.green,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    CupertinoIcons.chevron_right,
                    color: TsgColors.muted,
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        const SectionHeader('Browse categories'),
        const SizedBox(height: 12),
        GridView.count(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          crossAxisCount: 3,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1,
          children: categories.map((c) {
            return SoftCard(
              padding: const EdgeInsets.all(10),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(c.$1, color: TsgColors.purple, size: 24),
                  const SizedBox(height: 9),
                  Text(
                    c.$2,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class SafetyScreen extends StatelessWidget {
  const SafetyScreen({super.key, required this.go, required this.runApi});
  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Safety',
      subtitle: 'Fast help and trusted alerts.',
      back: () => go(Screen.more),
      children: [
        GestureDetector(
          onTap: () {
            runApi('Triggering SOS event', (client, state) {
              return client.triggerSos();
            });
          },
          child: Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFF7A7F), TsgColors.red, Color(0xFFD83D55)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: TsgColors.red.withValues(alpha: .26),
                  blurRadius: 30,
                  offset: const Offset(0, 14),
                ),
              ],
            ),
            child: const Row(
              children: [
                Icon(
                  CupertinoIcons.shield_lefthalf_fill,
                  color: Colors.white,
                  size: 52,
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SOS',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 34,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        'Emergency help',
                        style: TextStyle(color: Colors.white, fontSize: 17),
                      ),
                    ],
                  ),
                ),
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Color(0x22FFFFFF),
                  child: Icon(CupertinoIcons.phone_fill, color: Colors.white),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        const SectionHeader('Safety status'),
        const SizedBox(height: 12),
        safetyRow(
          CupertinoIcons.location_fill,
          'Location sharing',
          'On with Rita and Arjun',
          TsgColors.green,
        ),
        safetyRow(
          CupertinoIcons.bell_fill,
          'Check-in reminder',
          'Today at 7:30 PM',
          TsgColors.orange,
        ),
        safetyRow(
          CupertinoIcons.waveform_path_ecg,
          'Health monitoring',
          'Vitals look stable',
          TsgColors.green,
          onTap: () {
            runApi('Syncing health vitals', (client, state) {
              return client.syncHealthConsentAndVitals();
            });
          },
        ),
        safetyRow(
          CupertinoIcons.shield_fill,
          'Risk intelligence',
          'Low risk today',
          TsgColors.green,
          onTap: () => go(Screen.risk),
        ),
        const SizedBox(height: 16),
        SoftCard(
          color: const Color(0xFFF7F1FF),
          onTap: () => go(Screen.familyHealth),
          child: const Row(
            children: [
              Avatar(
                size: 54,
                icon: CupertinoIcons.person_crop_circle_badge_checkmark,
              ),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Family health view',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      'Share a clear summary with your trusted circle.',
                      style: TextStyle(color: TsgColors.muted, height: 1.3),
                    ),
                  ],
                ),
              ),
              Icon(CupertinoIcons.chevron_right, color: TsgColors.muted),
            ],
          ),
        ),
      ],
    );
  }

  Widget safetyRow(
    IconData icon,
    String title,
    String subtitle,
    Color color, {
    VoidCallback? onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: SoftCard(
        padding: const EdgeInsets.all(14),
        onTap: onTap,
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: TsgColors.muted,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              CupertinoIcons.chevron_right,
              color: TsgColors.muted,
              size: 18,
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingWelcome extends StatelessWidget {
  const OnboardingWelcome({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      topPadding: 12,
      children: [
        const FlowNumber(1),
        const Center(
          child: Text('Welcome', style: TextStyle(fontWeight: FontWeight.w800)),
        ),
        const SizedBox(height: 18),
        const Center(
          child: PhotoTile(
            icon: CupertinoIcons.person_2_fill,
            width: 178,
            height: 150,
            color: Color(0xFFFFEEE6),
          ),
        ),
        const SizedBox(height: 26),
        const Center(
          child: H1('Welcome to\nTheSeniorGuru', size: 28, center: true),
        ),
        const SizedBox(height: 10),
        const Center(
          child: Text(
            'Support, companionship and\ncare, all in one place.',
            textAlign: TextAlign.center,
            style: TextStyle(color: TsgColors.muted, height: 1.35),
          ),
        ),
        const SizedBox(height: 34),
        PurpleButton(
          'Create Account',
          onTap: () => go(Screen.onboardingProfile),
        ),
        const SizedBox(height: 18),
        Center(
          child: TextButton(
            onPressed: () => go(Screen.today),
            child: const Text('Sign In'),
          ),
        ),
      ],
    );
  }
}

class OnboardingProfile extends StatelessWidget {
  const OnboardingProfile({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      children: [
        const FlowNumber(2),
        const H1('Tell us about you', size: 28),
        const SizedBox(height: 8),
        const Text(
          'So we can personalize\nyour experience',
          style: TextStyle(color: TsgColors.muted, height: 1.3),
        ),
        const SizedBox(height: 22),
        field('Full name', 'Anita Sharma'),
        field('Age', '68'),
        field('Community (optional)', 'Park View Community'),
        field('Medical preferences', 'None selected'),
        const SizedBox(height: 20),
        PurpleButton('Continue', onTap: () => go(Screen.onboardingCircle)),
      ],
    );
  }
}

class OnboardingCircle extends StatelessWidget {
  const OnboardingCircle({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final people = [
      ('Add Daughter', 'Rita Sharma', 'R'),
      ('Add Son', 'Arjun Sharma', 'A'),
      ('Add Friend', 'Susan Patel', 'S'),
      ('Add Caregiver', 'Meena Joshi', 'M'),
    ];
    return ScreenScaffold(
      children: [
        const FlowNumber(3),
        const H1('Add your\ntrusted circle', size: 28),
        const SizedBox(height: 8),
        const Text(
          'People you trust, always\njust a tap away',
          style: TextStyle(color: TsgColors.muted, height: 1.3),
        ),
        const SizedBox(height: 22),
        ...people.map(
          (p) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SoftCard(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Avatar(size: 42, label: p.$3, tone: const Color(0xFFFFE0CC)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.$1,
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                        Text(
                          p.$2,
                          style: const TextStyle(
                            fontSize: 12,
                            color: TsgColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(CupertinoIcons.plus, color: TsgColors.purple),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        PurpleButton('Continue', onTap: () => go(Screen.onboardingSafety)),
      ],
    );
  }
}

class OnboardingSafety extends StatelessWidget {
  const OnboardingSafety({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      children: [
        const FlowNumber(4),
        const H1('Set up for\nyour safety', size: 28),
        const SizedBox(height: 8),
        const Text(
          "We'll be there when\nyou need us most",
          style: TextStyle(color: TsgColors.muted, height: 1.3),
        ),
        const SizedBox(height: 24),
        setupRow(CupertinoIcons.shield, 'SOS Contacts', '3 added'),
        setupRow(
          CupertinoIcons.doc_text,
          'Medical Information',
          '2 conditions',
        ),
        setupRow(
          CupertinoIcons.building_2_fill,
          'Preferred Hospital',
          'City Care Hospital',
        ),
        const SizedBox(height: 42),
        const Center(
          child: Avatar(size: 96, icon: CupertinoIcons.shield_lefthalf_fill),
        ),
        const SizedBox(height: 20),
        PurpleButton('Finish Setup', onTap: () => go(Screen.today)),
      ],
    );
  }
}

class FlowNumber extends StatelessWidget {
  const FlowNumber(this.value, {super.key});
  final int value;
  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 14,
      backgroundColor: TsgColors.purple,
      child: Text(
        '$value',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

Widget field(String label, String value) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: TsgColors.muted,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          height: 46,
          padding: const EdgeInsets.symmetric(horizontal: 13),
          alignment: Alignment.centerLeft,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(11),
            border: Border.all(color: TsgColors.line),
          ),
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    ),
  );
}

Widget setupRow(IconData icon, String title, String subtitle) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: SoftCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Icon(icon, color: TsgColors.purple),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: TsgColors.muted),
                ),
              ],
            ),
          ),
          const Icon(CupertinoIcons.chevron_right, size: 17),
        ],
      ),
    ),
  );
}

class WellnessScreen extends StatelessWidget {
  const WellnessScreen({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Sleep Recovery', 'Good', '+18', CupertinoIcons.moon_fill),
      ('Activity / Mobility', 'Good', '+15', Icons.directions_walk_rounded),
      ('Medication Adherence', 'Excellent', '+20', CupertinoIcons.capsule),
      ('Mood & Mind', 'Good', '+12', CupertinoIcons.smiley_fill),
      ('Heart Health', 'Good', '+17', CupertinoIcons.heart_fill),
    ];
    return ScreenScaffold(
      title: 'Wellness Contributors',
      back: () => go(Screen.more),
      children: [
        const Segmented(
          labels: ['Today', '7 Days', '30 Days', '90 Days'],
          selected: 0,
        ),
        const SizedBox(height: 22),
        Center(
          child: SizedBox(
            width: 220,
            height: 220,
            child: Stack(
              alignment: Alignment.center,
              children: [
                const CircularProgressIndicator(
                  value: .82,
                  strokeWidth: 18,
                  color: TsgColors.green,
                  backgroundColor: Color(0xFFE7F6E8),
                ),
                const Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '82',
                      style: TextStyle(
                        fontSize: 52,
                        fontWeight: FontWeight.w900,
                        color: TsgColors.ink,
                      ),
                    ),
                    Text(
                      'Wellness Score',
                      style: TextStyle(color: TsgColors.muted),
                    ),
                    SizedBox(height: 7),
                    Text(
                      'Doing Well',
                      style: TextStyle(
                        color: TsgColors.green,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        const Center(
          child: Text(
            '↗ Your score is higher than\nlast week (+6 points)',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, color: TsgColors.ink),
          ),
        ),
        const SizedBox(height: 22),
        const Text(
          "What's contributing to your score",
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        ...rows.map(
          (r) => Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: SoftCard(
              padding: const EdgeInsets.all(13),
              child: Row(
                children: [
                  Icon(r.$4, color: TsgColors.purple),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      r.$1,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  Pill(
                    r.$2,
                    color: const Color(0xFFEAF8E9),
                    ink: TsgColors.green,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    r.$3,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class VitalsScreen extends StatelessWidget {
  const VitalsScreen({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final vitals = [
      (
        'Resting Heart Rate',
        '72',
        'bpm',
        '30-day baseline: 69 bpm',
        CupertinoIcons.heart_fill,
      ),
      (
        'Heart Rate Variability',
        '48',
        'ms',
        '30-day baseline: 44 ms',
        CupertinoIcons.heart_circle_fill,
      ),
      (
        'Blood Oxygen (SpO₂)',
        '97',
        '%',
        'Normal range: 95 - 100%',
        CupertinoIcons.drop_fill,
      ),
      (
        'Respiratory Rate',
        '16',
        '/min',
        'Normal range: 12 - 20',
        Icons.air_rounded,
      ),
      (
        'Body Temperature',
        '98.3',
        '°F',
        'Normal range: 97.5 - 99.5',
        CupertinoIcons.thermometer,
      ),
      (
        'Blood Pressure',
        '118 / 76',
        'mmHg',
        'Normal range: < 130/80',
        CupertinoIcons.waveform_path_ecg,
      ),
    ];
    return ScreenScaffold(
      title: 'Vitals Monitor',
      back: () => go(Screen.more),
      children: [
        const Segmented(
          labels: ['Today', '7 Days', '30 Days', '90 Days'],
          selected: 0,
        ),
        const SizedBox(height: 16),
        ...vitals.map(
          (v) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SoftCard(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Icon(v.$5, color: TsgColors.purple),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                v.$1,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            const Text(
                              'Normal',
                              style: TextStyle(
                                color: TsgColors.green,
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        RichText(
                          text: TextSpan(
                            text: v.$2,
                            style: const TextStyle(
                              color: TsgColors.ink,
                              fontSize: 27,
                              fontWeight: FontWeight.w900,
                            ),
                            children: [
                              TextSpan(
                                text: ' ${v.$3}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          v.$4,
                          style: const TextStyle(
                            color: TsgColors.muted,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 8),
                        miniChart(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

Widget miniChart() {
  return SizedBox(
    height: 36,
    child: CustomPaint(
      painter: SparkPainter(),
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFFFE5E0), Color(0xFFE9F7E9), Color(0xFFFFF0CE)],
            stops: [.34, .35, .72],
          ),
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    ),
  );
}

class SparkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final line = Paint()
      ..color = TsgColors.purple
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    final dot = Paint()..color = TsgColors.ink;
    final path = Path()
      ..moveTo(0, size.height * .72)
      ..lineTo(size.width * .25, size.height * .63)
      ..lineTo(size.width * .46, size.height * .45)
      ..lineTo(size.width * .68, size.height * .57)
      ..lineTo(size.width, size.height * .35);
    canvas.drawPath(path, line);
    canvas.drawCircle(Offset(size.width * .46, size.height * .45), 4, dot);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class FamilyHealthScreen extends StatelessWidget {
  const FamilyHealthScreen({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final summary = [
      ('Medication', 'All taken', TsgColors.green, CupertinoIcons.capsule),
      ('Sleep', '7h 14m', TsgColors.green, CupertinoIcons.moon_fill),
      (
        'Activity',
        '4,280 steps',
        TsgColors.orange,
        Icons.directions_walk_rounded,
      ),
      (
        'Heart Rate',
        '72 bpm resting',
        TsgColors.green,
        CupertinoIcons.heart_fill,
      ),
      ('Mood', 'Good', TsgColors.green, CupertinoIcons.smiley_fill),
      ('Hydration', 'Good', TsgColors.green, CupertinoIcons.drop_fill),
    ];
    return ScreenScaffold(
      title: 'Family Health View',
      back: () => go(Screen.more),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [TsgColors.purple2, TsgColors.purple],
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  const Avatar(size: 58, label: 'A', tone: Color(0xFFFFE0CC)),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Anita Sharma',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          'Last check-in: Today, 8:12 AM',
                          style: TextStyle(color: Colors.white70),
                        ),
                      ],
                    ),
                  ),
                  Pill(
                    'Stable',
                    color: const Color(0xFFC9F8A8),
                    ink: TsgColors.green,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  const Expanded(
                    child: LinearProgressIndicator(
                      value: .87,
                      minHeight: 8,
                      backgroundColor: Color(0x44FFFFFF),
                      color: Color(0xFFA2E78A),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Text(
                    '87%',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          "Today's Summary",
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        SoftCard(
          child: Column(
            children: summary
                .map(
                  (s) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 9),
                    child: Row(
                      children: [
                        Icon(s.$4, color: s.$3),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            s.$1,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        Text(
                          s.$2,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          s.$3 == TsgColors.green
                              ? CupertinoIcons.check_mark_circled_solid
                              : CupertinoIcons.exclamationmark_circle_fill,
                          color: s.$3,
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
        ),
        const SizedBox(height: 14),
        const SoftCard(
          color: Color(0xFFFFFBEC),
          child: Row(
            children: [
              Icon(CupertinoIcons.lightbulb, color: TsgColors.orange),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Recommended Action\nEncourage a short walk today and check in with Mom this evening.',
                  style: TextStyle(height: 1.35),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class RiskScreen extends StatelessWidget {
  const RiskScreen({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final risks = [
      (
        'Today\nMay 13',
        'Normal',
        'All vitals and activities\nin normal range.',
        TsgColors.green,
      ),
      (
        'May 12',
        'Reduced Activity',
        'Steps were 18% below\nyour usual range.',
        TsgColors.orange,
      ),
      (
        'May 11',
        'Missed Medication',
        'Evening medication was\nmissed.',
        TsgColors.red,
      ),
      (
        'May 10',
        'Low Sleep',
        'Slept 4h 52m which is\nbelow your usual.',
        TsgColors.purple,
      ),
      (
        'May 9',
        'Normal',
        'All vitals and activities\nin normal range.',
        TsgColors.green,
      ),
    ];
    return ScreenScaffold(
      title: 'Risk Intelligence',
      back: () => go(Screen.more),
      children: [
        const Segmented(labels: ['Timeline', 'Risk Overview'], selected: 0),
        const SizedBox(height: 18),
        const SoftCard(
          color: Color(0xFFF4FFF0),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Overall Risk Level',
                      style: TextStyle(color: TsgColors.muted),
                    ),
                    Text(
                      'Low',
                      style: TextStyle(
                        color: TsgColors.green,
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Text(
                      'No urgent concerns',
                      style: TextStyle(color: TsgColors.ink),
                    ),
                  ],
                ),
              ),
              Avatar(
                size: 78,
                icon: CupertinoIcons.shield_fill,
                tone: Color(0xFFE0F9DA),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Risk Timeline',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 14),
        ...risks.map(
          (r) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Icon(
                      CupertinoIcons.check_mark_circled_solid,
                      color: r.$4,
                      size: 22,
                    ),
                    Container(width: 1, height: 60, color: TsgColors.line),
                  ],
                ),
                const SizedBox(width: 12),
                SizedBox(
                  width: 58,
                  child: Text(
                    r.$1,
                    style: const TextStyle(fontSize: 12, color: TsgColors.ink),
                  ),
                ),
                Expanded(
                  child: SoftCard(
                    padding: const EdgeInsets.all(13),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          r.$2,
                          style: TextStyle(
                            color: r.$4,
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          r.$3,
                          style: const TextStyle(
                            color: TsgColors.muted,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class Segmented extends StatelessWidget {
  const Segmented({super.key, required this.labels, required this.selected});
  final List<String> labels;
  final int selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: TsgColors.line),
      ),
      child: Row(
        children: List.generate(labels.length, (index) {
          final active = selected == index;
          return Expanded(
            child: Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? TsgColors.lilac : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                labels[index],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  color: active ? TsgColors.purple : TsgColors.muted,
                  fontWeight: active ? FontWeight.w900 : FontWeight.w600,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
