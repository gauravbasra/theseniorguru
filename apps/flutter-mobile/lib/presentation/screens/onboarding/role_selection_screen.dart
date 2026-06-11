import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:theseniorguru_mobile/presentation/layouts/layouts.dart';
import 'package:theseniorguru_mobile/presentation/layouts/screen_scaffold.dart';
import 'package:theseniorguru_mobile/presentation/providers/onboarding/role_selection_provider.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/avatar.dart';
import '../../../core/theme/tsg_colors.dart';
import '../../widgets/common/cards/soft_card.dart';

class RoleSelectionScreen extends ConsumerStatefulWidget {
  const RoleSelectionScreen({super.key});

  @override
  ConsumerState<RoleSelectionScreen> createState ()=> _RoleSelectionState();
}

class _RoleSelectionState extends ConsumerState<RoleSelectionScreen>{
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(roleSelectProvider);
    final notifier = ref.read(roleSelectProvider.notifier);
    return Scaffold(
      body: PhoneFrame(
        child: Center(
          child: ScreenScaffold(
            title: "Choose your role",
            subtitle: "Your first screen depends on how you support the circle.",
            children: [
              RoleChoiceCard(
                loading: state.loading && state.selectedRole == "senior",
                icon: CupertinoIcons.heart_fill,
                title: 'Senior',
                body: 'Set up your care profile, safety, health, rides, and Guru.',
                color: const Color(0xFFFFF3E7),
                onTap: () async {
                  notifier.roleSelect('senior');
                  // await runApi('Starting senior onboarding', (client, state) {
                  //   return client.startRoleSession('senior');
                  // });
                  // go(Screen.onboardingWelcome);
                },
              ),
              const SizedBox(height: 13),
              RoleChoiceCard(
                loading: state.loading && state.selectedRole == "trusted_person",
                icon: CupertinoIcons.person_2_fill,
                title: 'Trusted Circle',
                body: 'Join by invite to support a senior with approved visibility.',
                color: const Color(0xFFF1E8F8),
                onTap: () async {
                  // await runApi('Starting trusted circle onboarding', (client, state) {
                  //   return client.startRoleSession('trusted_person');
                  // });
                  // go(Screen.trustCircleInvite);
                },
              ),
              const SizedBox(height: 13),
              RoleChoiceCard(
                loading: state.loading && state.selectedRole == "business",
                icon: CupertinoIcons.building_2_fill,
                title: 'Business',
                body:
                'Register services, coverage, credentials, leads, and bookings.',
                color: const Color(0xFFEAF4FF),
                onTap: () async {
                  // await runApi('Starting business onboarding', (client, state) {
                  //   return client.startRoleSession('business');
                  // });
                  // go(Screen.businessType);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}


class RoleChoiceCard extends StatelessWidget {
  const RoleChoiceCard({
    this.loading = false,
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String body;
  final Color color;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SoftCard(
      color: color,
      onTap: loading ? null : onTap,
      child: Row(
        children: [
          Avatar(size: 56, icon: icon, tone: Colors.white),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  body,
                  style: const TextStyle(color: TsgColors.muted, height: 1.25),
                ),
              ],
            ),
          ),
          loading ? SizedBox(
              width: 16,
              height: 16,
              child:CircularProgressIndicator(
                strokeAlign: 1,
                strokeWidth: 2,
              )
          ) :
          Icon(CupertinoIcons.chevron_right, color:theme.colorScheme.primary),
        ],
      ),
    );
  }
}