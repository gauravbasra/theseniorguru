import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'api/tsg_api_client.dart';
import 'services/native_health_service.dart';

Future<String> _stableInstallationId() async {
  final prefs = await SharedPreferences.getInstance();
  const key = 'tsg_installation_id';
  final existing = prefs.getString(key);
  if (existing != null && existing.isNotEmpty) return existing;
  final newId = 'flutter-${const Uuid().v4()}';
  await prefs.setString(key, newId);
  return newId;
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  assert(seniorStepSpecs.length >= 14, 'seniorStepSpecs must have at least 14 entries');
  assert(trustCircleStepSpecs.length >= 5, 'trustCircleStepSpecs must have at least 5 entries');
  assert(businessStepSpecs.length >= 5, 'businessStepSpecs must have at least 5 entries');
  // Catch Flutter framework errors and prevent blank white screen
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('FlutterError: ${details.exceptionAsString()}');
  };
  runApp(const TsgResidentApp());
}

const defaultApiBase = String.fromEnvironment(
  'TSG_API_BASE',
  defaultValue: 'https://mobile-api-nine.vercel.app',
);

const initialScreenKey = String.fromEnvironment('TSG_INITIAL_SCREEN');
const androidGoogleMapsKey = String.fromEnvironment('GOOGLE_MAPS_API_KEY');

typedef ApiRunner =
    Future<bool> Function(
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
  onboardingRole,
  onboardingWelcome,
  seniorPhoto,
  seniorVerify,
  onboardingProfile,
  seniorAddress,
  seniorHealth,
  seniorMedications,
  seniorDevices,
  seniorPermissions,
  seniorMusic,
  onboardingCircle,
  seniorPrivacy,
  seniorSos,
  seniorRoutine,
  onboardingSafety,
  trustCircleInvite,
  trustCircleRelationship,
  trustCircleProfile,
  trustCircleMessaging,
  trustCircleAlerts,
  trustCircleVisibility,
  trustCircleEmergency,
  trustCirclePreview,
  trustCircleSettings,
  businessType,
  businessProfile,
  businessVerification,
  businessOwnerVerify,
  businessServices,
  businessPricing,
  businessAvailability,
  businessServiceArea,
  businessLeadRules,
  businessCommunication,
  businessReview,
  businessDone,
  businessSettings,
  medications,
  medicationConfirm,
  refill,
  guruChat,
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
  safetyMap,
  trustCircleMore,
  businessDashboard,
  businessLeads,
  businessBookings,
  businessMessages,
  businessMore,
}

enum AppRole { senior, trustedCircle, business }

class BottomTabDestination {
  const BottomTabDestination(this.icon, this.label, this.screen);

  final IconData icon;
  final String label;
  final Screen screen;
}

class ResidentShell extends StatefulWidget {
  const ResidentShell({super.key});

  @override
  State<ResidentShell> createState() => _ResidentShellState();
}

class _ResidentShellState extends State<ResidentShell> {
  late Screen screen;
  late final TsgApiClient apiClient;
  ResidentAppState? appState;
  AppRole appRole = initialRoleFromKey(initialScreenKey);
  String apiStatus = 'Connecting to mobile API...';
  bool apiBusy = false;
  String? _guruChatInitialMessage;
  String? _companionChatInitialMessage;
  String? _pendingConfirmMedId;

  @override
  void initState() {
    super.initState();
    screen = initialScreenFromKey(initialScreenKey);
    apiClient = TsgApiClient(
      baseUrl: defaultApiBase,
      installationIdProvider: _stableInstallationId,
    );
    _refreshState();
    NativeHealthService().collectRecentVitals().then((snapshot) {
      if (snapshot.available && snapshot.readings.isNotEmpty) {
        apiClient.syncHealthConsentAndVitals(
          source: snapshot.source,
          readings: snapshot.readings,
          dataTypes: snapshot.consentDataTypes,
        );
      }
    }).catchError((_) {});
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
        appRole = roleFromState(state, fallback: appRole);
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

  Future<bool> runApi(
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
      if (!mounted) return false;
      setState(() {
        appState = state;
        appRole = roleFromState(state, fallback: appRole);
        apiStatus = '$label saved';
        apiBusy = false;
      });
      return true;
    } catch (error) {
      if (!mounted) return false;
      setState(() {
        apiStatus = '$label failed: $error';
        apiBusy = false;
      });
      return false;
    }
  }

  int get tabIndex {
    final index = bottomTabsForRole(appRole).indexWhere((tab) {
      return tab.screen == primaryTabForScreen(screen, appRole);
    });
    return index < 0 ? 0 : index;
  }

  void go(Screen target) => setState(() {
    screen = target;
    final role = roleForScreen(target);
    if (role != null) appRole = role;
  });

  void _goGuruChat(String initialMessage) => setState(() {
    _guruChatInitialMessage = initialMessage;
    screen = Screen.guruChat;
  });

  void _goCompanionChat(String initialMessage) => setState(() {
    _companionChatInitialMessage = initialMessage;
    screen = Screen.companionChat;
  });

  void _goConfirmMed(String medicationId) => setState(() {
    _pendingConfirmMedId = medicationId;
    screen = Screen.medicationConfirm;
  });

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
              child: BottomTabs(
                tabs: bottomTabsForRole(appRole),
                current: tabIndex,
                onTap: _onTab,
                bottomInset: MediaQuery.of(context).padding.bottom,
              ),
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
    final tabs = bottomTabsForRole(appRole);
    if (index < 0 || index >= tabs.length) return;
    go(tabs[index].screen);
  }

  Widget _activeScreen() {
    return switch (screen) {
      Screen.guru => GuruHome(
        key: const ValueKey('guru'),
        go: go,
        runApi: runApi,
        goGuruChat: _goGuruChat,
      ),
      Screen.guruChat => GuruChatScreen(
        key: ValueKey('guru-chat-${_guruChatInitialMessage ?? ''}'),
        go: go,
        apiClient: apiClient,
        state: appState,
        initialMessage: _guruChatInitialMessage,
      ),
      Screen.today => TodayHome(
        key: const ValueKey('today'),
        go: go,
        state: appState,
      ),
      Screen.companion => CompanionHome(
        key: const ValueKey('companion'),
        go: go,
        goCompanionChat: _goCompanionChat,
      ),
      Screen.feed => FeedHome(key: const ValueKey('feed'), go: go),
      Screen.more => MoreHome(key: const ValueKey('more'), go: go),
      Screen.trustCircleMore => TrustCircleMore(
        key: const ValueKey('trust-more'),
        go: go,
      ),
      Screen.businessDashboard => BusinessDashboard(
        key: const ValueKey('business-dashboard'),
        go: go,
        state: appState,
      ),
      Screen.businessLeads => BusinessLeadsScreen(
        key: const ValueKey('business-leads'),
        go: go,
        state: appState,
      ),
      Screen.businessBookings => BusinessBookingsScreen(
        key: const ValueKey('business-bookings'),
        go: go,
        state: appState,
      ),
      Screen.businessMessages => BusinessMessagesScreen(
        key: const ValueKey('business-messages'),
        go: go,
      ),
      Screen.businessMore => BusinessMoreScreen(
        key: const ValueKey('business-more'),
        go: go,
        state: appState,
      ),
      Screen.onboardingRole => OnboardingRoleSelection(
        key: const ValueKey('onboard-role'),
        go: go,
        runApi: runApi,
      ),
      Screen.onboardingWelcome => OnboardingWelcome(
        key: const ValueKey('onboard1'),
        go: go,
      ),
      Screen.seniorPhoto => SeniorStepScreen(
        key: const ValueKey('senior-photo'),
        step: seniorStepSpecs[1],
        go: go,
      ),
      Screen.seniorVerify => SeniorStepScreen(
        key: const ValueKey('senior-verify'),
        step: seniorStepSpecs[2],
        go: go,
      ),
      Screen.onboardingProfile => OnboardingProfile(
        key: const ValueKey('onboard2'),
        go: go,
      ),
      Screen.seniorAddress => SeniorStepScreen(
        key: const ValueKey('senior-address'),
        step: seniorStepSpecs[4],
        go: go,
      ),
      Screen.seniorHealth => SeniorStepScreen(
        key: const ValueKey('senior-health'),
        step: seniorStepSpecs[5],
        go: go,
      ),
      Screen.seniorMedications => SeniorStepScreen(
        key: const ValueKey('senior-meds'),
        step: seniorStepSpecs[6],
        go: go,
      ),
      Screen.seniorDevices => SeniorStepScreen(
        key: const ValueKey('senior-devices'),
        step: seniorStepSpecs[7],
        go: go,
      ),
      Screen.seniorPermissions => SeniorStepScreen(
        key: const ValueKey('senior-permissions'),
        step: seniorStepSpecs[8],
        go: go,
      ),
      Screen.seniorMusic => SeniorStepScreen(
        key: const ValueKey('senior-music'),
        step: seniorStepSpecs[9],
        go: go,
      ),
      Screen.onboardingCircle => OnboardingCircle(
        key: const ValueKey('onboard3'),
        go: go,
      ),
      Screen.seniorPrivacy => SeniorStepScreen(
        key: const ValueKey('senior-privacy'),
        step: seniorStepSpecs[11],
        go: go,
      ),
      Screen.seniorSos => SeniorStepScreen(
        key: const ValueKey('senior-sos'),
        step: seniorStepSpecs[12],
        go: go,
      ),
      Screen.seniorRoutine => SeniorStepScreen(
        key: const ValueKey('senior-routine'),
        step: seniorStepSpecs[13],
        go: go,
        runApi: runApi,
      ),
      Screen.onboardingSafety => OnboardingSafety(
        key: const ValueKey('onboard4'),
        go: go,
        runApi: runApi,
      ),
      Screen.trustCircleInvite => TrustCircleInviteScreen(
        key: const ValueKey('trust-invite'),
        go: go,
        runApi: runApi,
      ),
      Screen.trustCircleRelationship => TrustCircleStepScreen(
        key: const ValueKey('trust-relationship'),
        step: trustCircleStepSpecs[1],
        go: go,
      ),
      Screen.trustCircleProfile => TrustCircleProfileScreen(
        key: const ValueKey('trust-profile'),
        go: go,
        runApi: runApi,
      ),
      Screen.trustCircleMessaging => TrustCircleStepScreen(
        key: const ValueKey('trust-messaging'),
        step: trustCircleStepSpecs[3],
        go: go,
      ),
      Screen.trustCircleAlerts => TrustCircleStepScreen(
        key: const ValueKey('trust-alerts'),
        step: trustCircleStepSpecs[4],
        go: go,
      ),
      Screen.trustCircleVisibility => TrustCircleStepScreen(
        key: const ValueKey('trust-visibility'),
        step: trustCircleStepSpecs[5],
        go: go,
      ),
      Screen.trustCircleEmergency => TrustCircleStepScreen(
        key: const ValueKey('trust-emergency'),
        step: trustCircleStepSpecs[6],
        go: go,
      ),
      Screen.trustCirclePreview => TrustCircleStepScreen(
        key: const ValueKey('trust-preview'),
        step: trustCircleStepSpecs[7],
        go: go,
        runApi: runApi,
      ),
      Screen.trustCircleSettings => TrustCircleSettingsScreen(
        key: const ValueKey('trust-settings'),
        go: go,
      ),
      Screen.businessType => BusinessStepScreen(
        key: const ValueKey('business-type'),
        step: businessStepSpecs[0],
        go: go,
      ),
      Screen.businessProfile => BusinessProfileScreen(
        key: const ValueKey('business-profile'),
        go: go,
        runApi: runApi,
      ),
      Screen.businessVerification => BusinessStepScreen(
        key: const ValueKey('business-verification'),
        step: businessStepSpecs[2],
        go: go,
      ),
      Screen.businessOwnerVerify => BusinessStepScreen(
        key: const ValueKey('business-owner'),
        step: businessStepSpecs[3],
        go: go,
      ),
      Screen.businessServices => BusinessServicesScreen(
        key: const ValueKey('business-services'),
        go: go,
        runApi: runApi,
      ),
      Screen.businessPricing => BusinessStepScreen(
        key: const ValueKey('business-pricing'),
        step: businessStepSpecs[5],
        go: go,
      ),
      Screen.businessAvailability => BusinessStepScreen(
        key: const ValueKey('business-availability'),
        step: businessStepSpecs[6],
        go: go,
      ),
      Screen.businessServiceArea => BusinessStepScreen(
        key: const ValueKey('business-area'),
        step: businessStepSpecs[7],
        go: go,
      ),
      Screen.businessLeadRules => BusinessStepScreen(
        key: const ValueKey('business-leads-rules'),
        step: businessStepSpecs[8],
        go: go,
      ),
      Screen.businessCommunication => BusinessStepScreen(
        key: const ValueKey('business-comm'),
        step: businessStepSpecs[9],
        go: go,
      ),
      Screen.businessReview => BusinessStepScreen(
        key: const ValueKey('business-review'),
        step: businessStepSpecs[10],
        go: go,
        runApi: runApi,
      ),
      Screen.businessDone => BusinessDoneScreen(
        key: const ValueKey('business-done'),
        go: go,
      ),
      Screen.businessSettings => BusinessSettingsScreen(
        key: const ValueKey('business-settings'),
        go: go,
      ),
      Screen.medications => MedicationsScreen(
        key: const ValueKey('meds'),
        go: go,
        goConfirm: _goConfirmMed,
        apiClient: apiClient,
        state: appState,
      ),
      Screen.medicationConfirm => MedicationConfirm(
        key: ValueKey('confirm-${_pendingConfirmMedId ?? 'none'}'),
        go: go,
        apiClient: apiClient,
        medicationId: _pendingConfirmMedId,
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
        key: ValueKey('companion-chat-${_companionChatInitialMessage ?? ''}'),
        go: go,
        apiClient: apiClient,
        state: appState,
        initialMessage: _companionChatInitialMessage,
      ),
      Screen.circle => CircleScreen(key: const ValueKey('circle'), go: go),
      Screen.person => PersonDetail(
        key: const ValueKey('person'),
        go: go,
        state: appState,
      ),
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
        state: appState,
      ),
      Screen.vitals => VitalsScreen(
        key: const ValueKey('vitals'),
        go: go,
        state: appState,
      ),
      Screen.familyHealth => FamilyHealthScreen(
        key: const ValueKey('family'),
        go: go,
        state: appState,
      ),
      Screen.risk => RiskScreen(
        key: const ValueKey('risk'),
        go: go,
        state: appState,
      ),
      Screen.services => ServicesScreen(
        key: const ValueKey('services'),
        go: go,
        state: appState,
        runApi: runApi,
        goGuruChat: _goGuruChat,
      ),
      Screen.safety => SafetyScreen(
        key: const ValueKey('safety'),
        go: go,
        runApi: runApi,
        state: appState,
      ),
      Screen.safetyMap => SafetyMapScreen(
        key: const ValueKey('safety-map'),
        go: go,
        state: appState,
      ),
    };
  }
}

Screen initialScreenFromKey(String key) {
  return switch (key) {
    'today' => Screen.today,
    'wellness' => Screen.wellness,
    'vitals' => Screen.vitals,
    'familyHealth' => Screen.familyHealth,
    'risk' => Screen.risk,
    'events' => Screen.events,
    'services' => Screen.services,
    'safety' => Screen.safety,
    'onboarding' => Screen.onboardingRole,
    'onboardingRole' => Screen.onboardingRole,
    'trustCircle' => Screen.trustCircleInvite,
    'businessOnboarding' => Screen.businessType,
    'business' => Screen.businessDashboard,
    'trusted' => Screen.familyHealth,
    _ => Screen.guru,
  };
}

AppRole initialRoleFromKey(String key) {
  return switch (key) {
    'trustCircle' || 'trusted' => AppRole.trustedCircle,
    'businessOnboarding' || 'business' => AppRole.business,
    _ => AppRole.senior,
  };
}

AppRole roleFromState(ResidentAppState state, {required AppRole fallback}) {
  final role = stringValue(mapValue(state.raw['user'])['role']);
  return switch (role) {
    'trusted_person' || 'trust_circle' => AppRole.trustedCircle,
    'business' => AppRole.business,
    'senior' => AppRole.senior,
    _ => fallback,
  };
}

AppRole? roleForScreen(Screen screen) {
  return switch (screen) {
    Screen.trustCircleInvite ||
    Screen.trustCircleProfile ||
    Screen.trustCircleRelationship ||
    Screen.trustCircleMessaging ||
    Screen.trustCircleAlerts ||
    Screen.trustCircleVisibility ||
    Screen.trustCircleEmergency ||
    Screen.trustCirclePreview ||
    Screen.trustCircleSettings ||
    Screen.trustCircleMore => AppRole.trustedCircle,
    Screen.businessType ||
    Screen.businessProfile ||
    Screen.businessVerification ||
    Screen.businessOwnerVerify ||
    Screen.businessServices ||
    Screen.businessPricing ||
    Screen.businessAvailability ||
    Screen.businessServiceArea ||
    Screen.businessLeadRules ||
    Screen.businessCommunication ||
    Screen.businessReview ||
    Screen.businessDone ||
    Screen.businessSettings ||
    Screen.businessDashboard ||
    Screen.businessLeads ||
    Screen.businessBookings ||
    Screen.businessMessages ||
    Screen.businessMore => AppRole.business,
    Screen.onboardingWelcome ||
    Screen.seniorPhoto ||
    Screen.seniorVerify ||
    Screen.onboardingProfile ||
    Screen.seniorAddress ||
    Screen.seniorHealth ||
    Screen.seniorMedications ||
    Screen.seniorDevices ||
    Screen.seniorPermissions ||
    Screen.seniorMusic ||
    Screen.onboardingCircle ||
    Screen.seniorPrivacy ||
    Screen.seniorSos ||
    Screen.seniorRoutine ||
    Screen.onboardingSafety => AppRole.senior,
    _ => null,
  };
}

List<BottomTabDestination> bottomTabsForRole(AppRole role) {
  return switch (role) {
    AppRole.senior => const [
      BottomTabDestination(CupertinoIcons.sparkles, 'TSG Guru', Screen.guru),
      BottomTabDestination(CupertinoIcons.house_fill, 'Today', Screen.today),
      BottomTabDestination(
        CupertinoIcons.chat_bubble_2,
        'Companion',
        Screen.companion,
      ),
      BottomTabDestination(CupertinoIcons.heart, 'Feed', Screen.feed),
      BottomTabDestination(CupertinoIcons.ellipsis, 'More', Screen.more),
    ],
    AppRole.trustedCircle => const [
      BottomTabDestination(
        CupertinoIcons.heart_circle_fill,
        'Overview',
        Screen.familyHealth,
      ),
      BottomTabDestination(
        CupertinoIcons.waveform_path_ecg,
        'Vitals',
        Screen.vitals,
      ),
      BottomTabDestination(CupertinoIcons.shield_fill, 'Risk', Screen.risk),
      BottomTabDestination(
        CupertinoIcons.person_2_fill,
        'Circle',
        Screen.circle,
      ),
      BottomTabDestination(
        CupertinoIcons.ellipsis,
        'More',
        Screen.trustCircleMore,
      ),
    ],
    AppRole.business => const [
      BottomTabDestination(
        CupertinoIcons.square_grid_2x2_fill,
        'Dashboard',
        Screen.businessDashboard,
      ),
      BottomTabDestination(
        CupertinoIcons.person_crop_circle_badge_plus,
        'Leads',
        Screen.businessLeads,
      ),
      BottomTabDestination(
        CupertinoIcons.calendar_badge_plus,
        'Bookings',
        Screen.businessBookings,
      ),
      BottomTabDestination(
        CupertinoIcons.chat_bubble_2_fill,
        'Messages',
        Screen.businessMessages,
      ),
      BottomTabDestination(
        CupertinoIcons.ellipsis,
        'More',
        Screen.businessMore,
      ),
    ],
  };
}

Screen primaryTabForScreen(Screen screen, AppRole role) {
  return switch (role) {
    AppRole.senior => switch (screen) {
      Screen.guru ||
      Screen.guruChat ||
      Screen.rideChat ||
      Screen.rideMatches ||
      Screen.rideStatus => Screen.guru,
      Screen.today ||
      Screen.medications ||
      Screen.medicationConfirm ||
      Screen.refill ||
      Screen.onboardingWelcome ||
      Screen.seniorPhoto ||
      Screen.seniorVerify ||
      Screen.onboardingProfile ||
      Screen.seniorAddress ||
      Screen.seniorHealth ||
      Screen.seniorMedications ||
      Screen.seniorDevices ||
      Screen.seniorPermissions ||
      Screen.seniorMusic ||
      Screen.onboardingCircle ||
      Screen.seniorPrivacy ||
      Screen.seniorSos ||
      Screen.seniorRoutine ||
      Screen.onboardingSafety ||
      Screen.onboardingRole ||
      Screen.wellness ||
      Screen.vitals ||
      Screen.familyHealth ||
      Screen.risk ||
      Screen.safety => Screen.today,
      Screen.companion || Screen.companionChat => Screen.companion,
      Screen.feed || Screen.createPost => Screen.feed,
      _ => Screen.more,
    },
    AppRole.trustedCircle => switch (screen) {
      Screen.familyHealth ||
      Screen.trustCircleInvite ||
      Screen.trustCircleRelationship ||
      Screen.trustCircleProfile ||
      Screen.trustCircleMessaging ||
      Screen.trustCircleAlerts ||
      Screen.trustCircleVisibility ||
      Screen.trustCircleEmergency ||
      Screen.trustCirclePreview => Screen.familyHealth,
      Screen.vitals => Screen.vitals,
      Screen.risk || Screen.safety => Screen.risk,
      Screen.circle || Screen.person => Screen.circle,
      _ => Screen.trustCircleMore,
    },
    AppRole.business => switch (screen) {
      Screen.businessProfile ||
      Screen.businessType ||
      Screen.businessVerification ||
      Screen.businessOwnerVerify ||
      Screen.businessServices ||
      Screen.businessPricing ||
      Screen.businessAvailability ||
      Screen.businessServiceArea ||
      Screen.businessLeadRules ||
      Screen.businessCommunication ||
      Screen.businessReview ||
      Screen.businessDone ||
      Screen.businessDashboard => Screen.businessDashboard,
      Screen.businessLeads || Screen.services => Screen.businessLeads,
      Screen.businessBookings => Screen.businessBookings,
      Screen.businessMessages => Screen.businessMessages,
      Screen.businessSettings || Screen.businessMore => Screen.businessMore,
      _ => Screen.businessMore,
    },
  };
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

int supportOrderEstimateCents(String category) {
  return switch (category.toLowerCase()) {
    'food' => 2200,
    'grocery' => 4500,
    'pharmacy' => 1200,
    'cleaning' => 6500,
    'handyman' => 8500,
    'home_care' => 7000,
    _ => 2500,
  };
}

Color wellnessScoreColor(int score) {
  if (score >= 80) return TsgColors.green;
  if (score >= 65) return TsgColors.blue;
  if (score >= 50) return TsgColors.orange;
  return TsgColors.red;
}

Color wellnessTrackColor(int score) {
  if (score >= 80) return const Color(0xFFE5F6EA);
  if (score >= 65) return const Color(0xFFE9F1FC);
  if (score >= 50) return const Color(0xFFFFF3DD);
  return const Color(0xFFFFE7EA);
}

String wellnessLabel(int score) {
  if (score >= 80) return 'Doing Well';
  if (score >= 65) return 'Stable';
  if (score >= 50) return 'Watch';
  return 'Needs Check-In';
}

String wellnessChangeText(int change) {
  if (change > 0) {
    return '↗ Your score is higher than\nlast week (+$change points)';
  }
  if (change < 0) {
    return '↘ Your score is lower than\nlast week ($change points)';
  }
  return 'Your score is steady compared\nwith last week';
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
  const BottomTabs({
    super.key,
    required this.tabs,
    required this.current,
    required this.onTap,
    required this.bottomInset,
  });

  final List<BottomTabDestination> tabs;
  final int current;
  final ValueChanged<int> onTap;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 86 + bottomInset,
      padding: EdgeInsets.fromLTRB(14, 10, 14, 18 + bottomInset),
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
                    tabs[index].icon,
                    size: 24,
                    color: selected
                        ? TsgColors.purple
                        : const Color(0xFF62616A),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tabs[index].label,
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
  const PurpleButton(
    this.label, {
    super.key,
    required this.onTap,
    this.icon,
    this.color = TsgColors.purple,
  });

  final String label;
  final VoidCallback onTap;
  final IconData? icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 50,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              color.withValues(alpha: .78),
              color,
              Color.lerp(color, Colors.black, .28)!,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(17),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: .22),
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
  const SectionHeader(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

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
          GestureDetector(
            onTap: onAction,
            child: Text(
              action!,
              style: const TextStyle(
                color: TsgColors.purple,
                fontWeight: FontWeight.w800,
              ),
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
        : 'Senior';
    final medication = state?.medications.isNotEmpty == true
        ? state!.medications.first
        : null;
    final medicationTitle = medication == null
        ? 'Medication due now'
        : '${medication.name} due now';
    final avatarLabel = residentFirstName.isEmpty
        ? 'A'
        : residentFirstName.characters.first.toUpperCase();
    final contextIntel = residentSurfaceSection(state, 'contextIntelligence');
    final guidanceItems = listOfMaps(contextIntel['guidanceItems']);
    final sections = listOfMaps(contextIntel['sections']);
    final rawBookings = listOfMaps(state?.raw['bookings']);
    final nextBooking = rawBookings.isNotEmpty ? rawBookings.first : null;
    final bookingTitle = stringValue(nextBooking?['label'], fallback: 'Upcoming Appointment');
    final bookingDate = stringValue(nextBooking?['scheduledFor'], fallback: 'Tomorrow, 10:00 AM');
    final rawEvents = listOfMaps(state?.raw['events']);
    final nextEvent = rawEvents.isNotEmpty ? rawEvents.first : null;
    final eventTitle = stringValue(nextEvent?['name'] ?? nextEvent?['label'], fallback: 'Chair Yoga');
    final eventTime = stringValue(nextEvent?['time'], fallback: '10:30 AM  •  Community Hall');
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
                  onPressed: () {
                    showCupertinoDialog(
                      context: context,
                      builder: (_) => CupertinoAlertDialog(
                        title: const Text('Notifications'),
                        content: const Text('No new notifications.'),
                        actions: [CupertinoDialogAction(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
                      ),
                    );
                  },
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
        ContextGuidanceCard(items: guidanceItems),
        const SizedBox(height: 14),
        ContextStatusGrid(sections: sections),
        const SizedBox(height: 14),
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
                    H1(bookingTitle, size: 26),
                    const SizedBox(height: 6),
                    Text(
                      bookingDate,
                      style: const TextStyle(fontSize: 17, color: TsgColors.ink),
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "TODAY'S ACTIVITY",
                      style: TextStyle(
                        color: TsgColors.green,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    H1(eventTitle, size: 26),
                    const SizedBox(height: 6),
                    Text(
                      eventTime,
                      style: const TextStyle(fontSize: 15, color: TsgColors.ink),
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
          onTap: () => go(Screen.safety),
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
  const GuruHome({
    super.key,
    required this.go,
    required this.runApi,
    required this.goGuruChat,
  });
  final ValueChanged<Screen> go;
  final ApiRunner runApi;
  final ValueChanged<String> goGuruChat;

  @override
  Widget build(BuildContext context) {
    // (Screen?, String?) = (navigate to screen, or open guru chat with this message)
    final requests = [
      (CupertinoIcons.car_detailed, 'I need a ride', Screen.rideChat, null),
      (CupertinoIcons.capsule, 'I need medication help', Screen.medications, null),
      (CupertinoIcons.hammer_fill, 'Home repair needed', null, 'I need home repair help'),
      (CupertinoIcons.sparkles, 'I need cleaning', null, 'I need house cleaning'),
      (CupertinoIcons.bag, 'I need food', null, 'I need food delivered'),
      (CupertinoIcons.heart, 'Feeling lonely', Screen.companionChat, null),
    ];
    return ScreenScaffold(
      title: 'How can we help?',
      children: [
        GestureDetector(
          onTap: () => goGuruChat(''),
          child: Container(
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
              onTap: () {
                if (item.$4 != null) {
                  goGuruChat(item.$4!);
                } else if (item.$3 != null) {
                  go(item.$3!);
                }
              },
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
                  if (item.$4 != null)
                    const Pill(
                      'Find Pros',
                      color: Color(0xFFEDE8FF),
                      ink: TsgColors.purple,
                    ),
                  const SizedBox(width: 6),
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
          onTap: () => goGuruChat(''),
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

// ---------------------------------------------------------------------------
// Guru Chat with Thumbtack Pro Integration
// ---------------------------------------------------------------------------

enum _ChatRole { user, guru }

class _ChatEntry {
  const _ChatEntry({required this.role, required this.text, this.pros = const []});
  final _ChatRole role;
  final String text;
  final List<ServicePro> pros;

  static _ChatEntry user(String text) =>
      _ChatEntry(role: _ChatRole.user, text: text);
  static _ChatEntry guru(String text, {List<ServicePro> pros = const []}) =>
      _ChatEntry(role: _ChatRole.guru, text: text, pros: pros);
}

class GuruChatScreen extends StatefulWidget {
  const GuruChatScreen({
    super.key,
    required this.go,
    required this.apiClient,
    this.state,
    this.initialMessage,
  });
  final ValueChanged<Screen> go;
  final TsgApiClient apiClient;
  final ResidentAppState? state;
  final String? initialMessage;

  @override
  State<GuruChatScreen> createState() => _GuruChatScreenState();
}

class _GuruChatScreenState extends State<GuruChatScreen> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final List<_ChatEntry> _messages = [];
  final Set<String> _selectedProIds = {};
  bool _loading = false;
  bool _rfqSent = false;

  String get _firstName {
    final full = widget.state?.residentName ?? '';
    return full.isNotEmpty ? full.split(' ').first : 'there';
  }

  @override
  void initState() {
    super.initState();
    final initial = widget.initialMessage?.trim() ?? '';
    if (initial.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _send(initial));
    } else {
      _messages.add(_ChatEntry.guru(
        'Hi $_firstName! 😊 I\'m your Guru assistant — I\'m here to help with anything you need.\n\n'
        'Whether it\'s a home repair, cleaning, lawn care, or just finding a trusted local pro — just tell me what\'s going on and I\'ll take care of the rest.',
      ));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ── Intent detection ─────────────────────────────────────────────────

  static String? _detectIntent(String message) {
    final m = message.toLowerCase();
    if (RegExp(r'leak|pipe|plumb|faucet|toilet|drain|flood|water damage').hasMatch(m)) return 'plumbing';
    if (RegExp(r'clean|maid|housekeep|sweep|vacuum|dust|scrub|tidy').hasMatch(m)) return 'cleaning';
    if (RegExp(r'electric|outlet|wire|circuit|breaker|power outage|light fixture').hasMatch(m)) return 'electrical';
    if (RegExp(r'lawn|grass|garden|landscape|mow|trim|yard|hedge').hasMatch(m)) return 'landscaping';
    if (RegExp(r'paint|wall color|ceiling|repaint').hasMatch(m)) return 'painting';
    if (RegExp(r'pest|bug|insect|rodent|termite|cockroach|ant|mouse').hasMatch(m)) return 'pest_control';
    if (RegExp(r'move|moving|haul|junk removal|furniture removal').hasMatch(m)) return 'moving';
    if (RegExp(r'care|caregiver|nurse|aide|companion|elder care').hasMatch(m)) return 'home_care';
    if (RegExp(r'repair|fix|broken|handyman|install|mount|assemble|drywall|tile').hasMatch(m)) return 'handyman';
    return null;
  }

  static String _intentLabel(String intent) => switch (intent) {
    'plumbing'     => 'Plumbing',
    'cleaning'     => 'Cleaning',
    'electrical'   => 'Electrical',
    'landscaping'  => 'Lawn Care',
    'painting'     => 'Painting',
    'pest_control' => 'Pest Control',
    'moving'       => 'Moving & Hauling',
    'home_care'    => 'Home Care',
    'handyman'     => 'Handyman',
    _              => 'Home Service',
  };

  static String _intentAck(String intent) => switch (intent) {
    'plumbing'     => 'Oh no, a leak can be really stressful — don\'t worry, I\'ve got you! 🔧\nLet me find trusted plumbers near you right now...',
    'cleaning'     => 'Great idea — a clean home makes such a difference! 🧹\nSearching for top-rated cleaning pros in your area...',
    'electrical'   => 'Electrical issues can feel scary — you\'re right to get help quickly. ⚡\nLooking for licensed electricians near you...',
    'landscaping'  => 'A beautiful yard is so important! 🌿\nFinding lawn care and landscaping pros in your area...',
    'painting'     => 'A fresh coat of paint can totally transform a space! 🎨\nSearching for painters near you...',
    'pest_control' => 'I completely understand — pests are no fun at all! 🐛\nFinding pest control specialists near you...',
    'moving'       => 'Moving can be overwhelming — I\'m here to make it easier for you! 📦\nSearching for moving and hauling help nearby...',
    'home_care'    => 'Finding the right care provider is so important — I want to help you find someone you can truly trust. 💙\nSearching for vetted home care providers near you...',
    'handyman'     => 'Happy to help get that sorted! 🔨\nSearching for experienced handymen in your area...',
    _              => 'Let me check our trusted partner network for pros near you... 🔍',
  };

  // Demo pros shown immediately when backend has no Thumbtack wired yet
  static List<ServicePro> _demoPros(String intent) {
    final label = _intentLabel(intent);
    return [
      ServicePro(
        id: 'demo-$intent-gp',
        name: 'Guru Certified $label Pro',
        category: label,
        source: 'guru_partner',
        rating: 4.9,
        reviewCount: 214,
        location: 'Near you',
        badge: 'Guru Vetted',
      ),
      ServicePro(
        id: 'demo-$intent-tt',
        name: "Mike's $label Services",
        category: label,
        source: 'thumbtack',
        rating: 4.8,
        reviewCount: 127,
        location: 'Near you',
        priceLabel: r'$85/hr',
        badge: 'Top Pro',
      ),
      ServicePro(
        id: 'demo-$intent-angi',
        name: 'QuickFix $label',
        category: label,
        source: 'angi',
        rating: 4.6,
        reviewCount: 58,
        location: 'Near you',
        priceLabel: r'$70/hr',
      ),
    ];
  }

  // ── Emotional / greeting detection ───────────────────────────────────────

  static bool _isGreeting(String m) =>
      RegExp(r'^(hi|hello|hey|good morning|good afternoon|good evening|howdy)[\s!.,?]*$').hasMatch(m.toLowerCase().trim());

  static bool _isEmotional(String m) =>
      RegExp(r"stress|worried|scared|anxious|overwhelm|lonely|tired|pain|hurt|help me|don.t know").hasMatch(m.toLowerCase());

  static String _emotionalReply(String firstName) =>
      'I hear you, $firstName — and I\'m right here with you. 💙\n\n'
      'You don\'t have to figure this out alone. Tell me a bit more about what\'s going on and I\'ll do everything I can to help.';

  static String _greetingReply(String firstName) =>
      'Hi $firstName! So great to hear from you 😊\n\n'
      'What can I help you with today? You can ask me about home repairs, cleaning, lawn care, finding local services — anything really!';

  static String _noIntentReply(String firstName) =>
      'I want to make sure I help you with exactly the right thing, $firstName. 🤔\n\n'
      'Could you tell me a bit more? For example:\n'
      '• "My sink is leaking"\n'
      '• "I need someone to clean my home"\n'
      '• "My lights aren\'t working"\n\n'
      'Or if you\'re looking for a specific type of service, just say so and I\'ll search for trusted pros near you!';

  // ── Conversation history for API context ─────────────────────────────────

  List<Map<String, String>> _buildHistory() {
    return _messages.map((m) => {
      'role': m.role == _ChatRole.user ? 'user' : 'assistant',
      'content': m.text,
    }).toList();
  }

  // ── Core send logic ──────────────────────────────────────────────────────

  Future<void> _send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _loading) return;

    final m = trimmed.toLowerCase();
    final intent = _detectIntent(trimmed);
    final isGreeting = _isGreeting(m);
    final isEmotional = _isEmotional(m);

    setState(() {
      _messages.add(_ChatEntry.user(trimmed));
      _loading = true;
      _selectedProIds.clear();
      _rfqSent = false;
      // Instant warm acknowledgment before any API responds
      if (intent != null) {
        _messages.add(_ChatEntry.guru(_intentAck(intent)));
      }
    });
    _controller.clear();
    _scrollToBottom();

    // For greetings and emotional messages, respond locally without API round-trip
    if (isGreeting && intent == null) {
      await Future.delayed(const Duration(milliseconds: 600));
      if (!mounted) return;
      setState(() {
        _messages.add(_ChatEntry.guru(_greetingReply(_firstName)));
        _loading = false;
      });
      _scrollToBottom();
      return;
    }

    if (isEmotional && intent == null) {
      await Future.delayed(const Duration(milliseconds: 700));
      if (!mounted) return;
      setState(() {
        _messages.add(_ChatEntry.guru(_emotionalReply(_firstName)));
        _loading = false;
      });
      _scrollToBottom();
      return;
    }

    try {
      Map<String, dynamic> guruResponse = {};
      List<ServicePro> fetchedPros = [];
      final history = _buildHistory();

      await Future.wait([
        // Guru conversational response with full chat history
        widget.apiClient
            .post('/api/guru/chat', {
              'message': trimmed,
              'screen': 'services',
              'residentName': widget.state?.residentName ?? '',
              'community': widget.state?.community ?? '',
              'history': history,
              if (widget.state?.zip != null) 'zip': widget.state!.zip,
              if (intent != null) 'intent': intent,
              if (intent != null) 'serviceCategory': intent,
            })
            .then((r) => guruResponse = r)
            .catchError((_) => <String, dynamic>{}),

        // Pro search in parallel
        if (intent != null)
          widget.apiClient
              .post('/api/services/find-pros', {
                'category': intent,
                'recipientName': widget.state?.residentName ?? '',
                'address': widget.state?.community ?? '',
                'limit': 3,
              })
              .then((r) {
                final raw = listOfMaps(r['pros'] ?? r['data'] ?? r['providers']);
                if (raw.isNotEmpty) fetchedPros = raw.map(ServicePro.fromJson).toList();
              })
              .catchError((_) => null),
      ]);

      if (!mounted) return;

      // Priority: backend pros > fetched pros > demo pros
      final backendProsRaw = listOfMaps(
        guruResponse['service_pros'] ?? guruResponse['pros'] ??
        guruResponse['thumbtack_pros'] ?? guruResponse['guru_pros'],
      );
      final finalPros = backendProsRaw.isNotEmpty
          ? backendProsRaw.map(ServicePro.fromJson).toList()
          : fetchedPros.isNotEmpty
              ? fetchedPros
              : (intent != null ? _demoPros(intent) : <ServicePro>[]);

      // Build empathetic reply
      final rawReply = stringValue(
        guruResponse['reply'] ?? guruResponse['message'] ?? guruResponse['text'],
      );
      final replyText = rawReply.isNotEmpty
          ? rawReply
          : finalPros.isNotEmpty
              ? 'Great news, $_firstName! 🎉 I found ${finalPros.length} local pros near you from Google.\n\nJust tap **Call Now** on any card to reach them directly — no waiting!'
              : intent != null
                  ? _noIntentReply(_firstName)
                  : _noIntentReply(_firstName);

      setState(() {
        // Replace ack bubble with real reply + pro cards
        if (intent != null &&
            _messages.isNotEmpty &&
            _messages.last.role == _ChatRole.guru &&
            _messages.last.pros.isEmpty) {
          _messages.removeLast();
        }
        _messages.add(_ChatEntry.guru(replyText, pros: finalPros));
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      final fallback = intent != null ? _demoPros(intent) : <ServicePro>[];
      setState(() {
        if (_messages.isNotEmpty &&
            _messages.last.role == _ChatRole.guru &&
            _messages.last.pros.isEmpty) {
          _messages.removeLast();
        }
        _messages.add(_ChatEntry.guru(
          fallback.isNotEmpty
              ? 'Here are some pros near you, $_firstName! 🏠\n\nTap **Call Now** on any card to reach them directly.'
              : 'I\'m having a little trouble connecting right now, $_firstName. Please try again in a moment — I\'ll be right here! 💙',
          pros: fallback,
        ));
        _loading = false;
      });
    }
    _scrollToBottom();
  }

  Future<void> _sendRfq() async {
    if (_selectedProIds.isEmpty || _rfqSent) return;
    final proIds = _selectedProIds.toList();
    final issue = _messages
        .where((m) => m.role == _ChatRole.user)
        .map((m) => m.text)
        .join(' ');
    setState(() {
      _loading = true;
    });
    try {
      await widget.apiClient.requestServiceQuotes(
        proIds: proIds,
        issue: issue,
        recipientName: widget.state?.residentName ?? '',
        address: widget.state?.community ?? '',
      );
      if (!mounted) return;
      setState(() {
        _rfqSent = true;
        _loading = false;
        _selectedProIds.clear();
        _messages.add(_ChatEntry.guru(
          'Done, $_firstName! ✅ Your request has been sent to ${proIds.length} pro${proIds.length > 1 ? 's' : ''}.\n\nThey\'ll reach out to you soon. Is there anything else I can help you with?',
        ));
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _messages.add(_ChatEntry.guru(
          'Could not send the request right now. Please try again.',
        ));
      });
    }
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final hasProsAvailable = _messages.any((m) => m.pros.isNotEmpty);
    return Column(
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 14, 8, 0),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(CupertinoIcons.chevron_left, size: 24),
                onPressed: () => widget.go(Screen.guru),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints.tightFor(width: 40, height: 40),
              ),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'TSG Guru',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: TsgColors.ink,
                      ),
                    ),
                    Text(
                      'Powered by Thumbtack',
                      style: TextStyle(fontSize: 12, color: TsgColors.muted),
                    ),
                  ],
                ),
              ),
              const Avatar(size: 38, icon: CupertinoIcons.sparkles),
            ],
          ),
        ),
        const SizedBox(height: 8),
        const Divider(color: TsgColors.line, height: 1),
        // Chat area
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            itemCount: _messages.length + (_loading ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _messages.length) {
                return _TypingBubble();
              }
              final entry = _messages[index];
              if (entry.role == _ChatRole.user) {
                return _UserBubble(text: entry.text);
              }
              return _GuroBubble(
                text: entry.text,
                pros: entry.pros,
                selectedProIds: _selectedProIds,
                onTogglePro: (id) {
                  setState(() {
                    if (_selectedProIds.contains(id)) {
                      _selectedProIds.remove(id);
                    } else {
                      _selectedProIds.add(id);
                    }
                  });
                },
              );
            },
          ),
        ),
        // Input
        Container(
          padding: EdgeInsets.fromLTRB(
            12,
            10,
            12,
            MediaQuery.of(context).padding.bottom + 90,
          ),
          decoration: const BoxDecoration(
            color: TsgColors.glass,
            border: Border(top: BorderSide(color: TsgColors.line)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  enabled: !_loading,
                  decoration: InputDecoration(
                    hintText: hasProsAvailable
                        ? 'Select pros above or ask a follow-up...'
                        : 'Describe what you need...',
                    hintStyle: const TextStyle(
                      color: TsgColors.muted,
                      fontSize: 15,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: TsgColors.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: TsgColors.line),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: TsgColors.purple),
                    ),
                  ),
                  onSubmitted: _send,
                  textInputAction: TextInputAction.send,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => _send(_controller.text),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [TsgColors.purple2, TsgColors.purple],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    CupertinoIcons.arrow_up,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12, left: 48),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [TsgColors.purple2, TsgColors.purple],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(18),
            topRight: Radius.circular(4),
            bottomLeft: Radius.circular(18),
            bottomRight: Radius.circular(18),
          ),
          boxShadow: [
            BoxShadow(
              color: TsgColors.purple.withValues(alpha: .18),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Text(
          text,
          style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
        ),
      ),
    );
  }
}

class _GuroBubble extends StatelessWidget {
  const _GuroBubble({
    required this.text,
    required this.pros,
    required this.selectedProIds,
    required this.onTogglePro,
  });
  final String text;
  final List<ServicePro> pros;
  final Set<String> selectedProIds;
  final ValueChanged<String> onTogglePro;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 8, right: 48),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            decoration: BoxDecoration(
              color: TsgColors.lilac2,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(4),
                topRight: Radius.circular(18),
                bottomLeft: Radius.circular(18),
                bottomRight: Radius.circular(18),
              ),
              border: Border.all(color: TsgColors.line),
            ),
            child: Text(
              text,
              style: const TextStyle(
                color: TsgColors.ink,
                fontSize: 15,
                height: 1.4,
              ),
            ),
          ),
          if (pros.isNotEmpty) ...[
            ...pros.map(
              (pro) => _ProCard(
                pro: pro,
                selected: selectedProIds.contains(pro.id),
                onToggle: () => onTogglePro(pro.id),
              ),
            ),
            const SizedBox(height: 4),
          ],
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class _TypingBubble extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12, right: 48),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: TsgColors.lilac2,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: TsgColors.line),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: TsgColors.purple,
              ),
            ),
            SizedBox(width: 10),
            Text(
              'Guru is thinking...',
              style: TextStyle(color: TsgColors.muted, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

// Source badge metadata for each partner network.
({String label, Color bg, Color ink}) _sourceBadge(String source) {
  return switch (source) {
    'guru_partner' => (
      label: 'Guru Partner',
      bg: const Color(0xFFEDE8FF),
      ink: TsgColors.purple,
    ),
    'thumbtack' => (
      label: 'Thumbtack',
      bg: const Color(0xFFE8F3FF),
      ink: const Color(0xFF1B72C0),
    ),
    'angi' => (
      label: 'Angi',
      bg: const Color(0xFFFFEEE8),
      ink: const Color(0xFFD45D1A),
    ),
    'taskrabbit' => (
      label: 'TaskRabbit',
      bg: const Color(0xFFE9F5E1),
      ink: const Color(0xFF3F7A1A),
    ),
    'care_com' => (
      label: 'Care.com',
      bg: const Color(0xFFE8EFFF),
      ink: const Color(0xFF1A4CC0),
    ),
    'amazon_home' => (
      label: 'Amazon',
      bg: const Color(0xFFFFF5E0),
      ink: const Color(0xFFB35A00),
    ),
    _ => (
      label: '3rd Party',
      bg: const Color(0xFFF2F2F2),
      ink: TsgColors.muted,
    ),
  };
}

class _ProCard extends StatelessWidget {
  const _ProCard({
    required this.pro,
    required this.selected,
    required this.onToggle,
  });
  final ServicePro pro;
  final bool selected;
  final VoidCallback onToggle;

  void _call() {
    if (pro.phone != null) {
      launchUrl(Uri(scheme: 'tel', path: pro.phone!));
    }
  }

  @override
  Widget build(BuildContext context) {
    final badge = _sourceBadge(pro.source);
    final isGuruPartner = pro.source == 'guru_partner';
    final hasPhone = pro.phone != null && pro.phone!.isNotEmpty;
    final isOpen = pro.isOpenNow;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: TsgColors.card,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: TsgColors.line, width: 1),
        boxShadow: const [
          BoxShadow(color: Color(0x0E2D2038), blurRadius: 14, offset: Offset(0, 6)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // \u2500\u2500 Top row: avatar + info \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
          Padding(
            padding: const EdgeInsets.fromLTRB(13, 13, 13, 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: badge.bg,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    isGuruPartner
                        ? CupertinoIcons.star_circle_fill
                        : CupertinoIcons.building_2_fill,
                    color: badge.ink,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        pro.name,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: TsgColors.ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          if (pro.rating > 0) ...[
                            Text(
                              '\u2605 ${pro.rating.toStringAsFixed(1)}',
                              style: const TextStyle(
                                color: TsgColors.orange,
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                              ),
                            ),
                            if (pro.reviewCount > 0) ...[
                              const SizedBox(width: 4),
                              Text(
                                '(${pro.reviewCount})',
                                style: const TextStyle(fontSize: 12, color: TsgColors.muted),
                              ),
                            ],
                            const SizedBox(width: 8),
                          ],
                          if (isOpen != null)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: isOpen
                                    ? const Color(0xFFDCFCE7)
                                    : const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                isOpen ? 'Open Now' : 'Closed',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: isOpen
                                      ? const Color(0xFF16A34A)
                                      : const Color(0xFFDC2626),
                                ),
                              ),
                            ),
                        ],
                      ),
                      if (pro.location != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          pro.location!,
                          style: const TextStyle(fontSize: 12, color: TsgColors.muted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      if (pro.badge != null) ...[
                        const SizedBox(height: 3),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: badge.bg,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            pro.badge!,
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: badge.ink),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          // \u2500\u2500 Phone number display \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
          if (hasPhone)
            Padding(
              padding: const EdgeInsets.fromLTRB(13, 0, 13, 8),
              child: Row(
                children: [
                  const Icon(CupertinoIcons.phone_fill, size: 13, color: TsgColors.muted),
                  const SizedBox(width: 5),
                  Text(
                    pro.phone!,
                    style: const TextStyle(fontSize: 13, color: TsgColors.muted, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          // \u2500\u2500 Action buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
          Padding(
            padding: const EdgeInsets.fromLTRB(13, 0, 13, 13),
            child: Row(
              children: [
                if (hasPhone)
                  Expanded(
                    child: GestureDetector(
                      onTap: _call,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(CupertinoIcons.phone_fill, color: Colors.white, size: 16),
                            SizedBox(width: 6),
                            Text(
                              'Call Now',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                if (hasPhone && pro.website != null) const SizedBox(width: 8),
                if (pro.website != null)
                  Expanded(
                    child: GestureDetector(
                      onTap: () => launchUrl(Uri.parse(pro.website!), mode: LaunchMode.externalApplication),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 11),
                        decoration: BoxDecoration(
                          color: badge.bg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: badge.ink.withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(CupertinoIcons.globe, color: badge.ink, size: 15),
                            const SizedBox(width: 5),
                            Text(
                              'Website',
                              style: TextStyle(
                                color: badge.ink,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                if (!hasPhone && pro.website == null)
                  // Demo card \u2014 no real contact yet
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(CupertinoIcons.info_circle, color: TsgColors.muted, size: 15),
                          SizedBox(width: 6),
                          Text(
                            'Contact info loading...',
                            style: TextStyle(color: TsgColors.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PartnerChip extends StatelessWidget {
  const _PartnerChip({
    required this.label,
    required this.sublabel,
    required this.bg,
    required this.ink,
    required this.icon,
  });
  final String label;
  final String sublabel;
  final Color bg;
  final Color ink;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ink.withValues(alpha: .18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: ink, size: 18),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: ink,
                ),
              ),
              Text(
                sublabel,
                style: TextStyle(fontSize: 10, color: ink.withValues(alpha: .7)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
// ---------------------------------------------------------------------------

class MedicationsScreen extends StatefulWidget {
  const MedicationsScreen({
    super.key,
    required this.go,
    required this.goConfirm,
    required this.apiClient,
    this.state,
  });
  final ValueChanged<Screen> go;
  final ValueChanged<String> goConfirm;
  final TsgApiClient apiClient;
  final ResidentAppState? state;

  @override
  State<MedicationsScreen> createState() => _MedicationsScreenState();
}

class _MedicationsScreenState extends State<MedicationsScreen> {
  List<ResidentMedication> _meds = [];
  List<Map<String, dynamic>> _interactions = [];
  bool _loading = true;
  String _loadError = '';
  bool _showAddForm = false;

  // Add medication form fields
  final _nameCtrl = TextEditingController();
  final _freqCtrl = TextEditingController();
  final _condCtrl = TextEditingController();
  final _strengthCtrl = TextEditingController();
  final _countCtrl = TextEditingController();
  bool _addBusy = false;
  bool _scanBusy = false;
  String? _addError;
  Map<String, dynamic>? _addInteractionWarning;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _freqCtrl.dispose();
    _condCtrl.dispose();
    _strengthCtrl.dispose();
    _countCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _loadError = ''; });
    try {
      final data = await widget.apiClient.getMedicationDashboard();
      final rawMeds = listOfMaps(data['medications'] ?? data['meds'] ?? []);
      final rawAlerts = listOfMaps(data['interactions'] ?? data['alerts'] ?? []);
      if (!mounted) return;
      setState(() {
        _meds = rawMeds.map(ResidentMedication.fromJson).toList();
        _interactions = rawAlerts
            .where((a) => a['acknowledged'] != true)
            .toList();
        _loading = false;
      });
    } catch (e) {
      // Fall back to state from ResidentShell if API fails
      final fallback = widget.state?.medications ?? const [];
      if (!mounted) return;
      setState(() {
        _meds = fallback.isNotEmpty
            ? fallback
            : const [
                ResidentMedication(
                  id: 'demo-lisinopril',
                  name: 'Lisinopril 10mg',
                  status: 'confirmed',
                  remainingCount: 14,
                  frequency: 'once daily',
                  condition: 'Blood Pressure',
                ),
                ResidentMedication(
                  id: 'demo-metformin',
                  name: 'Metformin 500mg',
                  status: 'pending',
                  remainingCount: 6,
                  frequency: 'twice daily',
                  condition: 'Diabetes',
                ),
              ];
        _loading = false;
        _loadError = fallback.isEmpty ? 'Could not load medications' : '';
      });
    }
  }

  /// Opens camera, runs ML Kit OCR, sends text to Groq, pre-fills form fields.
  Future<void> _scanLabel() async {
    setState(() { _scanBusy = true; _addError = null; });
    try {
      // 1. Pick image from camera
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
        preferredCameraDevice: CameraDevice.rear,
      );
      if (pickedFile == null) {
        setState(() => _scanBusy = false);
        return;
      }

      // 2. ML Kit on-device OCR
      final inputImage = InputImage.fromFilePath(pickedFile.path);
      final textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final RecognizedText recognizedText =
          await textRecognizer.processImage(inputImage);
      await textRecognizer.close();

      final rawOcr = recognizedText.text.trim();
      if (rawOcr.isEmpty) {
        setState(() {
          _scanBusy = false;
          _addError = 'Could not read text from image. Try better lighting or a flatter label.';
        });
        return;
      }

      // 3. Send to Groq for structured parsing
      final result = await widget.apiClient.scanMedicationLabel(rawOcr);
      final parsed = result['parsed'] as Map<String, dynamic>? ?? {};
      final drugInfo = result['drugInfo'] as Map<String, dynamic>?;

      if (!mounted) return;

      // 4. Pre-fill the form fields
      final name = stringValue(
          parsed['name'] ?? parsed['genericName'], fallback: '');
      final strength = stringValue(parsed['strength'], fallback: '');
      final freq = stringValue(parsed['frequency'], fallback: '');
      final condition = stringValue(
          parsed['condition'] ?? drugInfo?['indication'], fallback: '');

      setState(() {
        _scanBusy = false;
        _showAddForm = true;
        if (name.isNotEmpty) _nameCtrl.text = name;
        if (strength.isNotEmpty) _strengthCtrl.text = strength;
        if (freq.isNotEmpty) _freqCtrl.text = freq;
        if (condition.isNotEmpty) _condCtrl.text = condition;
        if (_countCtrl.text.isEmpty) _countCtrl.text = '30';
        // Show Beers/NTI info from drug reference
        if (drugInfo != null &&
            (drugInfo['beersListCaution'] == true ||
                drugInfo['narrowTherapeuticIndex'] == true)) {
          _addInteractionWarning = {
            'drug_a': name,
            'drug_b': 'reference check',
            'severity': drugInfo['narrowTherapeuticIndex'] == true
                ? 'HIGH'
                : 'MODERATE',
            'description': drugInfo['narrowTherapeuticIndex'] == true
                ? 'Narrow therapeutic index — small dose changes have large effects. Monitor carefully.'
                : 'This medication is on the Beers Criteria list for older adults. Use with caution.',
          };
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _scanBusy = false;
        _addError = 'Scan failed: ${e.toString()}';
      });
    }
  }

  Future<void> _addMedication() async {
    final name = _nameCtrl.text.trim();
    final freq = _freqCtrl.text.trim();
    if (name.isEmpty || freq.isEmpty) {
      setState(() => _addError = 'Name and frequency are required');
      return;
    }
    setState(() { _addBusy = true; _addError = null; _addInteractionWarning = null; });
    try {
      final result = await widget.apiClient.addMedication(
        name: name,
        frequency: freq,
        condition: _condCtrl.text.trim().isNotEmpty ? _condCtrl.text.trim() : null,
        strength: _strengthCtrl.text.trim().isNotEmpty ? _strengthCtrl.text.trim() : null,
        remainingCount: int.tryParse(_countCtrl.text.trim()) ?? 30,
      );
      final rawWarnings = listOfMaps(result['warnings'] ?? []);
      if (!mounted) return;
      if (rawWarnings.isNotEmpty) {
        setState(() {
          _addInteractionWarning = rawWarnings.first;
          _addBusy = false;
        });
      } else {
        _nameCtrl.clear(); _freqCtrl.clear();
        _condCtrl.clear(); _strengthCtrl.clear(); _countCtrl.clear();
        setState(() { _showAddForm = false; _addBusy = false; });
        await _load();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() { _addError = e.toString(); _addBusy = false; });
    }
  }

  String _medStatusLabel(ResidentMedication m) {
    final s = m.status.toLowerCase();
    if (s.contains('confirm') || s.contains('taken')) return 'Done';
    if (s.contains('skip')) return 'Skipped';
    if (s.contains('snooze')) return 'Later';
    return 'Pending';
  }

  Color _medStatusColor(ResidentMedication m) {
    final s = m.status.toLowerCase();
    if (s.contains('confirm') || s.contains('taken')) return TsgColors.green;
    if (s.contains('skip')) return TsgColors.muted;
    return TsgColors.orange;
  }

  Color _inventoryColor(ResidentMedication m) {
    if (m.isCriticalSupply) return const Color(0xFFE53935);
    if (m.isLowSupply) return TsgColors.orange;
    return TsgColors.green;
  }

  String _daysLabel(ResidentMedication m) {
    final d = m.daysSupplyRemaining;
    if (d == null) return '${m.remainingCount} left';
    if (d <= 0) return 'Out of stock';
    if (d == 1) return '1 day left';
    return '$d days left';
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Medications',
      back: () => widget.go(Screen.today),
      action: GestureDetector(
        onTap: () => setState(() => _showAddForm = !_showAddForm),
        child: Icon(
          _showAddForm ? CupertinoIcons.xmark : CupertinoIcons.plus,
          color: TsgColors.purple,
        ),
      ),
      children: [
        // ── Interaction alerts ─────────────────────────────────────────
        ..._interactions.map((alert) => _interactionBanner(alert)),

        // ── Add medication form ────────────────────────────────────────
        if (_showAddForm) ...[
          _addMedicationForm(),
          const SizedBox(height: 20),
        ],

        // ── Loading / error ────────────────────────────────────────────
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_meds.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Column(
              children: [
                const Icon(CupertinoIcons.capsule, size: 48, color: TsgColors.muted),
                const SizedBox(height: 12),
                const Text(
                  'No medications yet',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
                const SizedBox(height: 6),
                Text(
                  _loadError.isNotEmpty ? _loadError : 'Tap + to add your first medication',
                  style: const TextStyle(color: TsgColors.muted),
                ),
                const SizedBox(height: 16),
                TextButton.icon(
                  onPressed: _load,
                  icon: const Icon(CupertinoIcons.refresh, color: TsgColors.purple),
                  label: const Text('Refresh', style: TextStyle(color: TsgColors.purple)),
                ),
              ],
            ),
          )
        else ...[
          // Group by dose time
          ..._buildMedSections(),
        ],
      ],
    );
  }

  Widget _interactionBanner(Map<String, dynamic> alert) {
    final severity = stringValue(alert['severity'], fallback: 'MODERATE');
    final isHigh = severity == 'HIGH';
    final color = isHigh ? const Color(0xFFE53935) : TsgColors.orange;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: .3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(CupertinoIcons.exclamationmark_triangle_fill, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${stringValue(alert["drug_a"])} + ${stringValue(alert["drug_b"])}',
                  style: TextStyle(fontWeight: FontWeight.w800, color: color, fontSize: 13),
                ),
                const SizedBox(height: 2),
                Text(
                  stringValue(alert['description'], fallback: 'Drug interaction detected'),
                  style: const TextStyle(fontSize: 12, color: TsgColors.ink),
                ),
              ],
            ),
          ),
          Pill(severity, color: color.withValues(alpha: .12), ink: color),
        ],
      ),
    );
  }

  Widget _addMedicationForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: TsgColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Add Medication',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              ),
              // Camera scan button
              GestureDetector(
                onTap: _scanBusy ? null : _scanLabel,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: TsgColors.purple.withValues(alpha: .1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: _scanBusy
                      ? const SizedBox(
                          width: 16, height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: TsgColors.purple))
                      : const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(CupertinoIcons.camera, size: 15,
                                color: TsgColors.purple),
                            SizedBox(width: 5),
                            Text('Scan Label',
                                style: TextStyle(
                                    fontSize: 12,
                                    color: TsgColors.purple,
                                    fontWeight: FontWeight.w700)),
                          ],
                        ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Point camera at your prescription label to auto-fill',
            style: TextStyle(fontSize: 11, color: TsgColors.muted),
          ),
          const SizedBox(height: 10),
          _field(_nameCtrl, 'Medication name *', 'e.g. Lisinopril 10mg'),
          const SizedBox(height: 8),
          _field(_strengthCtrl, 'Strength / dose', 'e.g. 10mg'),
          const SizedBox(height: 8),
          _field(_freqCtrl, 'Frequency *', 'e.g. once daily, twice daily'),
          const SizedBox(height: 8),
          _field(_condCtrl, 'Condition / reason', 'e.g. Blood Pressure'),
          const SizedBox(height: 8),
          _field(_countCtrl, 'Pills in hand', '30', numeric: true),
          if (_addInteractionWarning != null) ...[
            const SizedBox(height: 10),
            _interactionBanner(_addInteractionWarning!),
            const Text(
              'Interaction detected — please consult your doctor. You can still add this medication.',
              style: TextStyle(fontSize: 12, color: TsgColors.muted),
            ),
          ],
          if (_addError != null) ...[
            const SizedBox(height: 8),
            Text(_addError!, style: const TextStyle(color: Color(0xFFE53935), fontSize: 12)),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: GestureDetector(
              onTap: _addBusy ? null : _addMedication,
              child: Container(
                height: 48,
                decoration: BoxDecoration(
                  color: TsgColors.purple,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: _addBusy
                      ? const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('Save Medication',
                          style: TextStyle(
                              color: Colors.white, fontWeight: FontWeight.w800)),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(
    TextEditingController ctrl,
    String label,
    String hint, {
    bool numeric = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Container(
          height: 40,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: TsgColors.line),
          ),
          child: TextField(
            controller: ctrl,
            keyboardType: numeric ? TextInputType.number : TextInputType.text,
            style: const TextStyle(fontSize: 14),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: const TextStyle(color: TsgColors.muted, fontSize: 13),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12),
              border: InputBorder.none,
            ),
          ),
        ),
      ],
    );
  }

  List<Widget> _buildMedSections() {
    // Group medications by dose time
    final morning = <ResidentMedication>[];
    final afternoon = <ResidentMedication>[];
    final evening = <ResidentMedication>[];
    final other = <ResidentMedication>[];

    for (final m in _meds) {
      final t = (m.doseTime ?? '').toLowerCase();
      if (t.contains('morning') || t.contains('8:00 am') || t.contains('am')) {
        morning.add(m);
      } else if (t.contains('afternoon') || t.contains('noon') || t.contains('2:')) {
        afternoon.add(m);
      } else if (t.contains('evening') || t.contains('night') || t.contains('pm')) {
        evening.add(m);
      } else {
        other.add(m);
      }
    }
    // If no time info, show all under "Today"
    if (morning.isEmpty && afternoon.isEmpty && evening.isEmpty) {
      return [_medSection('Today', _meds)];
    }
    return [
      if (morning.isNotEmpty) _medSection('Morning', morning, time: '8:00 AM'),
      if (afternoon.isNotEmpty) _medSection('Afternoon', afternoon, time: '2:00 PM'),
      if (evening.isNotEmpty) _medSection('Evening', evening, time: '8:00 PM'),
      if (other.isNotEmpty) _medSection('Other', other),
    ];
  }

  Widget _medSection(String title, List<ResidentMedication> meds, {String? time}) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(title,
                  style: const TextStyle(fontWeight: FontWeight.w900)),
            ),
            if (time != null)
              Text(time,
                  style: const TextStyle(color: TsgColors.muted, fontSize: 12)),
          ],
        ),
        const SizedBox(height: 9),
        ...meds.map(_medCard),
        const SizedBox(height: 16),
      ],
    );
  }

  Widget _medCard(ResidentMedication m) {
    final statusColor = _medStatusColor(m);
    final invColor = _inventoryColor(m);
    final daysLabel = _daysLabel(m);
    final isDone = m.status.toLowerCase().contains('confirm') ||
        m.status.toLowerCase().contains('taken');
    return SoftCard(
      padding: const EdgeInsets.all(14),
      onTap: isDone
          ? null
          : () => widget.goConfirm(m.id),
      child: Row(
        children: [
          Stack(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: .13),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(CupertinoIcons.capsule, color: statusColor, size: 20),
              ),
              if (m.beersCaution || m.narrowTherapeuticIndex)
                Positioned(
                  right: -2,
                  top: -2,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: const BoxDecoration(
                      color: Color(0xFFE53935),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(CupertinoIcons.exclamationmark,
                        size: 9, color: Colors.white),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(m.name,
                    style: const TextStyle(fontWeight: FontWeight.w900)),
                if (m.condition != null)
                  Text(m.condition!,
                      style: const TextStyle(
                          fontSize: 12, color: TsgColors.muted)),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Icon(CupertinoIcons.capsule_fill,
                        size: 11, color: invColor),
                    const SizedBox(width: 3),
                    Text(daysLabel,
                        style: TextStyle(
                            fontSize: 11,
                            color: invColor,
                            fontWeight: FontWeight.w600)),
                    if (m.isLowSupply) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: invColor.withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          m.isCriticalSupply ? 'Refill NOW' : 'Refill soon',
                          style: TextStyle(
                              fontSize: 10,
                              color: invColor,
                              fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (!isDone)
            Pill(_medStatusLabel(m),
                color: statusColor.withValues(alpha: .12), ink: statusColor)
          else
            const Icon(CupertinoIcons.checkmark_circle_fill,
                color: TsgColors.green, size: 22),
        ],
      ),
    );
  }
}

class MedicationConfirm extends StatefulWidget {
  const MedicationConfirm({
    super.key,
    required this.go,
    required this.runApi,
    required this.apiClient,
    this.state,
    this.medicationId,
  });
  final ValueChanged<Screen> go;
  final ApiRunner runApi;
  final TsgApiClient apiClient;
  final ResidentAppState? state;
  final String? medicationId;

  @override
  State<MedicationConfirm> createState() => _MedicationConfirmState();
}

class _MedicationConfirmState extends State<MedicationConfirm> {
  bool _confirming = false;
  String? _confirmResult;
  int? _daysRemaining;
  bool _refillNeeded = false;
  bool _confirmed = false;

  ResidentMedication get _medication {
    final id = widget.medicationId;
    if (id != null && id.isNotEmpty) {
      final found = widget.state?.medications.where((m) => m.id == id).firstOrNull;
      if (found != null) return found;
    }
    return widget.state?.medications.isNotEmpty == true
        ? widget.state!.medications.first
        : const ResidentMedication(
            id: 'demo-lisinopril',
            name: 'Lisinopril 10mg',
            status: 'pending',
            remainingCount: 14,
            frequency: 'once daily',
            condition: 'Blood Pressure',
          );
  }

  Future<void> _confirmDose() async {
    setState(() => _confirming = true);
    try {
      final result = await widget.apiClient.confirmMedication(_medication.id);
      if (!mounted) return;
      final days = result['daysSupplyRemaining'] is int
          ? result['daysSupplyRemaining'] as int
          : null;
      final refill = result['refillNeeded'] == true;
      setState(() {
        _confirming = false;
        _confirmed = true;
        _daysRemaining = days;
        _refillNeeded = refill;
        _confirmResult = 'Dose confirmed!';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _confirming = false;
        _confirmResult = 'Error: ${e.toString()}';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final med = _medication;
    final doseInfo = [
      if (med.doseTime != null && med.doseTime!.isNotEmpty) med.doseTime!,
      '1 tablet',
      if (med.frequency != null && med.frequency!.isNotEmpty) med.frequency!,
    ].join('  •  ');

    return ScreenScaffold(
      title: 'Confirm medication',
      back: () => widget.go(Screen.medications),
      children: [
        // Medication card
        SoftCard(
          color: const Color(0xFFFFFAF8),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: TsgColors.lilac,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(CupertinoIcons.capsule,
                    color: TsgColors.purple, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(med.name,
                        style: const TextStyle(fontWeight: FontWeight.w900)),
                    if (doseInfo.isNotEmpty)
                      Text(doseInfo,
                          style: const TextStyle(
                              color: TsgColors.muted, fontSize: 13)),
                    if (med.condition != null)
                      Text(med.condition!,
                          style: const TextStyle(
                              fontSize: 12, color: TsgColors.muted)),
                  ],
                ),
              ),
              // Days supply badge
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '${med.remainingCount}',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: med.isLowSupply
                          ? const Color(0xFFE53935)
                          : TsgColors.ink,
                    ),
                  ),
                  const Text('pills left',
                      style: TextStyle(
                          fontSize: 10, color: TsgColors.muted)),
                ],
              ),
            ],
          ),
        ),

        // Beers criteria or narrow-therapeutic warning
        if (med.beersCaution || med.narrowTherapeuticIndex) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3E0),
              borderRadius: BorderRadius.circular(10),
              border:
                  Border.all(color: TsgColors.orange.withValues(alpha: .4)),
            ),
            child: Row(
              children: [
                const Icon(CupertinoIcons.exclamationmark_triangle_fill,
                    color: TsgColors.orange, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    med.narrowTherapeuticIndex
                        ? 'Narrow therapeutic index — take exactly as prescribed. Do not skip doses.'
                        : 'Beers Criteria medication — monitor for side effects.',
                    style: const TextStyle(fontSize: 12, color: TsgColors.ink),
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 36),

        if (_confirmed) ...[
          // Confirmation success state
          const Center(
            child: Icon(CupertinoIcons.check_mark_circled_solid,
                color: TsgColors.green, size: 72),
          ),
          const SizedBox(height: 16),
          const Center(
            child: Text('Dose recorded!',
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: TsgColors.green)),
          ),
          if (_daysRemaining != null) ...[
            const SizedBox(height: 8),
            Center(
              child: Text(
                '$_daysRemaining days of supply remaining',
                style: TextStyle(
                    color: _refillNeeded
                        ? const Color(0xFFE53935)
                        : TsgColors.muted),
              ),
            ),
          ],
          if (_refillNeeded) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3E0),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: TsgColors.orange.withValues(alpha: .5)),
              ),
              child: Row(
                children: [
                  const Icon(CupertinoIcons.bell_fill,
                      color: TsgColors.orange, size: 18),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Running low — a refill request has been sent automatically.',
                      style: TextStyle(fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 28),
          _actionButton(
            'Back to Today',
            CupertinoIcons.house,
            TsgColors.purple,
            Colors.white,
            () => widget.go(Screen.today),
          ),
          const SizedBox(height: 10),
          _actionButton(
            'View All Medications',
            CupertinoIcons.capsule,
            const Color(0xFFF1E8F8),
            TsgColors.purple,
            () => widget.go(Screen.medications),
          ),
        ] else ...[
          // Confirm prompt
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
          if (_confirming)
            const Center(child: CircularProgressIndicator())
          else ...[
            _actionButton(
              'Yes, I took it',
              CupertinoIcons.check_mark_circled,
              const Color(0xFFE7F8EA),
              TsgColors.green,
              _confirmDose,
            ),
            _actionButton(
              'Remind me later',
              CupertinoIcons.clock,
              Colors.white,
              TsgColors.ink,
              () async {
                await widget.runApi('Snoozing medication reminder',
                    (client, state) {
                  return client.remindMedicationLater(_medication.id);
                });
                widget.go(Screen.today);
              },
            ),
            _actionButton(
              'Skip this dose',
              CupertinoIcons.xmark_circle,
              Colors.white,
              TsgColors.ink,
              () async {
                await widget.runApi('Skipping medication dose',
                    (client, state) {
                  return client.skipMedication(_medication.id);
                });
                widget.go(Screen.today);
              },
            ),
            if (_confirmResult != null && _confirmResult!.startsWith('Error')) ...[
              const SizedBox(height: 8),
              Center(
                child: Text(_confirmResult!,
                    style: const TextStyle(
                        color: Color(0xFFE53935), fontSize: 12)),
              ),
            ],
          ],
          const SizedBox(height: 20),
          Center(
            child: TextButton.icon(
              onPressed: () async {
                await launchUrl(Uri.parse(
                    'mailto:support@theseniorguru.com?subject=Issue%20Report'));
              },
              icon: const Icon(CupertinoIcons.exclamationmark_circle,
                  size: 17, color: TsgColors.purple),
              label: const Text('Report an issue',
                  style: TextStyle(color: TsgColors.purple)),
            ),
          ),
        ],
      ],
    );
  }

  Widget _actionButton(
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
              Text(text,
                  style: TextStyle(color: ink, fontWeight: FontWeight.w800)),
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
            onPressed: () {
              showCupertinoDialog(
                context: context,
                builder: (_) => CupertinoAlertDialog(
                  title: const Text('Low Stock Reminder'),
                  content: const Text('We\'ll remind you when your supply drops below a 7-day supply.'),
                  actions: [
                    CupertinoDialogAction(onPressed: () => Navigator.pop(context), child: const Text('Not Now')),
                    CupertinoDialogAction(isDefaultAction: true, onPressed: () { Navigator.pop(context); runApi('Setting reminder', (c, s) => c.post('/api/medications/low-stock-reminder', {})); }, child: const Text('Enable')),
                  ],
                ),
              );
            },
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
        onPressed: () {
          showCupertinoModalPopup(
            context: context,
            builder: (_) => CupertinoActionSheet(
              actions: [
                CupertinoActionSheetAction(onPressed: () { Navigator.pop(context); go(Screen.today); }, child: const Text('Cancel ride')),
                CupertinoActionSheetAction(onPressed: () => Navigator.pop(context), child: const Text('Contact support')),
              ],
              cancelButton: CupertinoActionSheetAction(onPressed: () => Navigator.pop(context), child: const Text('Dismiss')),
            ),
          );
        },
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

Widget inputBar({BuildContext? context}) {
  return Builder(
    builder: (ctx) => Container(
      height: 56,
      padding: const EdgeInsets.only(left: 16, right: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: TsgColors.line),
      ),
      child: Row(
        children: [
          const Expanded(
            child: Text(
              'Type or speak...',
              style: TextStyle(color: TsgColors.muted, fontSize: 16),
            ),
          ),
          GestureDetector(
            onTap: () {
              showCupertinoDialog(
                context: ctx,
                builder: (_) => CupertinoAlertDialog(
                  title: const Text('Voice Input'),
                  content: const Text('Voice input is coming soon. Please type your request.'),
                  actions: [CupertinoDialogAction(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))],
                ),
              );
            },
            child: const CircleAvatar(
              radius: 20,
              backgroundColor: TsgColors.purple,
              child: Icon(CupertinoIcons.mic_fill, color: Colors.white, size: 18),
            ),
          ),
        ],
      ),
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
      subtitle: 'Tomorrow, ${_tomorrowLabel()}',
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
        pickupLabel: state?.community ?? '',
        riderName: state?.residentName ?? '',
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
    final now = DateTime.now();
    final fmt = (DateTime t) => '${t.hour % 12 == 0 ? 12 : t.hour % 12}:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';
    final steps = [
      ('Request received', fmt(now.subtract(const Duration(minutes: 2))), true),
      ('Driver assigned', fmt(now.subtract(const Duration(minutes: 1))), true),
      ('Driver arriving', fmt(now.add(const Duration(minutes: 15))), false),
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
        Center(
          child: Text(
            'Tomorrow, ${_tomorrowLabel()} • 10:00 AM',
            style: const TextStyle(color: TsgColors.muted),
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
        PurpleButton('View details', onTap: () => go(Screen.rideStatus)),
      ],
    );
  }
}

class CompanionHome extends StatelessWidget {
  const CompanionHome({super.key, required this.go, required this.goCompanionChat});
  final ValueChanged<Screen> go;
  final ValueChanged<String> goCompanionChat;

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
            'Good morning',
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
              onTap: () => goCompanionChat("I'm feeling $mood today."),
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

class CompanionChat extends StatefulWidget {
  const CompanionChat({
    super.key,
    required this.go,
    required this.apiClient,
    this.state,
    this.initialMessage,
  });
  final ValueChanged<Screen> go;
  final TsgApiClient apiClient;
  final ResidentAppState? state;
  final String? initialMessage;

  @override
  State<CompanionChat> createState() => _CompanionChatState();
}

class _CompanionChatState extends State<CompanionChat> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final List<_ChatEntry> _messages = [];
  bool _loading = false;

  String get _firstName {
    final full = widget.state?.residentName ?? '';
    return full.isNotEmpty ? full.split(' ').first : 'there';
  }

  @override
  void initState() {
    super.initState();
    final initial = widget.initialMessage?.trim() ?? '';
    if (initial.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _send(initial));
    } else {
      _messages.add(_ChatEntry.guru(
        "Hi $_firstName! 😊 I'm Guru, your companion.\n\n"
        "How are you feeling today? I'm here to listen.",
      ));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  List<Map<String, String>> _buildHistory() {
    return _messages.map((m) => {
      'role': m.role == _ChatRole.user ? 'user' : 'assistant',
      'content': m.text,
    }).toList();
  }

  Future<void> _send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || _loading) return;

    setState(() {
      _messages.add(_ChatEntry.user(trimmed));
      _loading = true;
    });
    _controller.clear();
    _scrollToBottom();

    try {
      final history = _buildHistory();
      final response = await widget.apiClient.post('/api/guru/chat', {
        'message': trimmed,
        'screen': 'companion',
        'residentName': widget.state?.residentName ?? '',
        'community': widget.state?.community ?? '',
        'history': history,
      });

      if (!mounted) return;
      final reply = stringValue(
        response['reply'] ?? response['message'] ?? response['text'],
      );
      setState(() {
        _messages.add(_ChatEntry.guru(
          reply.isNotEmpty
              ? reply
              : "I'm here for you, $_firstName. Tell me more about how you're feeling.",
        ));
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _messages.add(_ChatEntry.guru(
          "I'm having a little trouble connecting right now, $_firstName. "
          "I'm still here with you — please try again in a moment. 💙",
        ));
        _loading = false;
      });
    }
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 14, 8, 0),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(CupertinoIcons.chevron_left, size: 24),
                onPressed: () => widget.go(Screen.companion),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints.tightFor(width: 40, height: 40),
              ),
              const Expanded(
                child: Text(
                  'Chat with Guru',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: TsgColors.ink,
                  ),
                ),
              ),
              const Avatar(size: 38, icon: CupertinoIcons.smiley_fill, tone: TsgColors.lilac),
            ],
          ),
        ),
        const SizedBox(height: 8),
        const Divider(color: TsgColors.line, height: 1),
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            itemCount: _messages.length + (_loading ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == _messages.length) {
                return _TypingBubble();
              }
              final entry = _messages[index];
              if (entry.role == _ChatRole.user) {
                return _UserBubble(text: entry.text);
              }
              return _GuroBubble(
                text: entry.text,
                pros: const [],
                selectedProIds: const {},
                onTogglePro: (_) {},
              );
            },
          ),
        ),
        Container(
          padding: EdgeInsets.fromLTRB(
            12,
            10,
            12,
            MediaQuery.of(context).padding.bottom + 90,
          ),
          decoration: const BoxDecoration(
            color: TsgColors.glass,
            border: Border(top: BorderSide(color: TsgColors.line)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  enabled: !_loading,
                  decoration: InputDecoration(
                    hintText: 'Type how you\'re feeling...',
                    hintStyle: const TextStyle(
                      color: TsgColors.muted,
                      fontSize: 15,
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: TsgColors.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: TsgColors.line),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: TsgColors.purple),
                    ),
                  ),
                  onSubmitted: _send,
                  textInputAction: TextInputAction.send,
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => _send(_controller.text),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [TsgColors.purple2, TsgColors.purple],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    CupertinoIcons.arrow_up,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class CircleScreen extends StatelessWidget {
  const CircleScreen({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final statePeople = state?.people ?? [];
    return ScreenScaffold(
      title: 'My Circle',
      back: () => go(Screen.more),
      children: [
        if (statePeople.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(
              child: Text(
                'No contacts added yet.\nTap "Add Person" to get started.',
                style: TextStyle(color: TsgColors.muted),
                textAlign: TextAlign.center,
              ),
            ),
          )
        else
          ...statePeople.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SoftCard(
                padding: const EdgeInsets.all(12),
                onTap: () => go(Screen.person),
                child: Row(
                  children: [
                    Avatar(
                      size: 46,
                      label: p.name.isNotEmpty ? p.name.characters.first.toUpperCase() : '?',
                      tone: const Color(0xFFFFE0CC),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p.name,
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const Text(
                            'Trust Circle',
                            style: TextStyle(
                              color: TsgColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (p.phone.isNotEmpty)
                      GestureDetector(
                        onTap: () async {
                          try {
                            await launchPhoneCall(p.phone);
                          } catch (_) {}
                        },
                        child: const Icon(CupertinoIcons.phone, color: TsgColors.purple),
                      ),
                  ],
                ),
              ),
            ),
          ),
        const SizedBox(height: 14),
        PurpleButton('Add Person', onTap: () => go(Screen.trustCircleInvite)),
      ],
    );
  }
}

class PersonDetail extends StatelessWidget {
  const PersonDetail({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final person = state?.people.isNotEmpty == true ? state!.people.first : null;
    final name = person?.name.isNotEmpty == true ? person!.name : 'Contact';
    final phone = person?.phone.isNotEmpty == true ? person!.phone : '';
    final initial = name.trim().isEmpty
        ? '?'
        : name.trim().characters.first.toUpperCase();
    return ScreenScaffold(
      title: name,
      subtitle: 'Trust Circle Contact',
      back: () => go(Screen.circle),
      children: [
        Center(
          child: Avatar(size: 118, label: initial, tone: const Color(0xFFFFD8C8)),
        ),
        const SizedBox(height: 22),
        Row(
          children: [
            Expanded(
              child: PurpleButton(
                'Call',
                icon: CupertinoIcons.phone_fill,
                onTap: () async {
                  try { await launchPhoneCall(phone); } catch (_) {}
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: PurpleButton(
                'Message',
                icon: CupertinoIcons.chat_bubble_fill,
                onTap: () async {
                  try { await launchSms(phone); } catch (_) {}
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: PurpleButton(
                'Video',
                icon: CupertinoIcons.video_camera_solid,
                onTap: () async {
                  try { await launchSms(phone, body: 'Can we start a video call?'); } catch (_) {}
                },
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
          context,
          'Community Member',
          'Beautiful morning walk\nwith my friends',
          CupertinoIcons.tree,
          '24',
        ),
        postCard(
          context,
          'Your Community',
          'Community Lunch\ncoming up soon.',
          CupertinoIcons.photo,
          '18',
        ),
      ],
    );
  }

  Widget postCard(BuildContext context, String name, String body, IconData icon, String likes) {
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
                GestureDetector(
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Liked'), duration: Duration(seconds: 1)),
                  ),
                  child: const Icon(
                    CupertinoIcons.heart_fill,
                    color: TsgColors.red,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 6),
                Text(likes),
                const SizedBox(width: 22),
                GestureDetector(
                  onTap: () => go(Screen.createPost),
                  child: const Icon(CupertinoIcons.chat_bubble, size: 18),
                ),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () => go(Screen.createPost),
                  child: const Text('Comment'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class CreatePost extends StatefulWidget {
  const CreatePost({super.key, required this.go, required this.runApi});
  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  State<CreatePost> createState() => _CreatePostState();
}

class _CreatePostState extends State<CreatePost> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Create Post',
      back: () => widget.go(Screen.feed),
      children: [
        Container(
          height: 156,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: TsgColors.line),
          ),
          child: TextField(
            controller: _controller,
            maxLines: null,
            expands: true,
            textAlignVertical: TextAlignVertical.top,
            decoration: const InputDecoration(
              hintText: "What's on your mind?",
              hintStyle: TextStyle(color: TsgColors.muted),
              border: InputBorder.none,
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
            final text = _controller.text.trim();
            if (text.isEmpty) return;
            await widget.runApi('Publishing community post', (client, state) {
              return client.createPost(text);
            });
            widget.go(Screen.feed);
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
            TextButton(onPressed: () => go(Screen.events), child: const Text('View all')),
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
        'Role Onboarding',
        Screen.onboardingRole,
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
                      'My Profile',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'TheSeniorGuru',
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

class TrustCircleMore extends StatelessWidget {
  const TrustCircleMore({super.key, required this.go});

  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    final items = [
      (
        CupertinoIcons.heart_circle_fill,
        'Family Health View',
        Screen.familyHealth,
      ),
      (CupertinoIcons.waveform_path_ecg, 'Vitals Monitor', Screen.vitals),
      (CupertinoIcons.shield_fill, 'Risk Timeline', Screen.risk),
      (CupertinoIcons.person_2_fill, 'Trusted Circle', Screen.circle),
      (CupertinoIcons.bell_fill, 'Safety Alerts', Screen.safety),
      (
        CupertinoIcons.slider_horizontal_3,
        'Trust Circle Settings',
        Screen.trustCircleSettings,
      ),
      (
        CupertinoIcons.person_badge_plus,
        'Invite Setup',
        Screen.trustCircleInvite,
      ),
    ];
    return ScreenScaffold(
      title: 'Circle tools',
      subtitle: 'Approved care visibility and family actions.',
      children: [
        SoftCard(
          color: const Color(0xFFF8F2FF),
          child: const Row(
            children: [
              Avatar(size: 58, label: 'R', tone: Color(0xFFF1E8F8)),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Rita Sharma',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 5),
                    Text(
                      'Daughter · Approved visibility',
                      style: TextStyle(color: TsgColors.muted),
                    ),
                  ],
                ),
              ),
              Icon(CupertinoIcons.lock_shield_fill, color: TsgColors.purple),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ...items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SoftCard(
              padding: const EdgeInsets.all(16),
              onTap: () => go(item.$3),
              child: Row(
                children: [
                  Avatar(size: 44, icon: item.$1, tone: TsgColors.lilac),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Text(
                      item.$2,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const Icon(
                    CupertinoIcons.chevron_right,
                    color: TsgColors.muted,
                    size: 17,
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

class BusinessDashboard extends StatelessWidget {
  const BusinessDashboard({super.key, required this.go, required this.state});

  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final business = mapValue(state?.raw['business']);
    final name = stringValue(business['name'], fallback: 'CareRide');
    final status = stringValue(
      business['status'],
      fallback: 'pending_review',
    ).replaceAll('_', ' ');
    final rawBookings = listOfMaps(state?.raw['bookings']);
    final leadsCount = rawBookings.length;
    final bookingsCount = state?.services.length ?? 0;
    return ScreenScaffold(
      title: 'Business',
      subtitle: 'Provider operations and service requests.',
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF293B5F), Color(0xFF3F6F91), Color(0xFF86B6A8)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(26),
            boxShadow: const [
              BoxShadow(
                color: Color(0x223F6F91),
                blurRadius: 28,
                offset: Offset(0, 14),
              ),
            ],
          ),
          child: Row(
            children: [
              const Avatar(
                size: 62,
                icon: CupertinoIcons.car_detailed,
                tone: Colors.white,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 21,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Profile status: $status',
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              ),
              const Icon(CupertinoIcons.checkmark_seal, color: Colors.white),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: BusinessMetricCard(
                label: 'New leads',
                value: '$leadsCount',
                icon: CupertinoIcons.person_crop_circle_badge_plus,
                onTap: () => go(Screen.businessLeads),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: BusinessMetricCard(
                label: 'Bookings',
                value: '$bookingsCount',
                icon: CupertinoIcons.calendar_badge_plus,
                onTap: () => go(Screen.businessBookings),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SoftCard(
          onTap: () => go(Screen.businessMessages),
          child: const Row(
            children: [
              Avatar(
                size: 48,
                icon: CupertinoIcons.chat_bubble_2_fill,
                tone: Color(0xFFEAF4FF),
              ),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Messages and coordination',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
                ),
              ),
              Icon(CupertinoIcons.chevron_right, color: TsgColors.muted),
            ],
          ),
        ),
      ],
    );
  }
}

class BusinessMetricCard extends StatelessWidget {
  const BusinessMetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      padding: const EdgeInsets.all(15),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Avatar(size: 40, icon: icon, tone: const Color(0xFFEAF4FF)),
          const SizedBox(height: 14),
          Text(
            value,
            style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: const TextStyle(
              color: TsgColors.muted,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class RoleStatusChip extends StatelessWidget {
  const RoleStatusChip(this.label, {super.key, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class BusinessLeadsScreen extends StatelessWidget {
  const BusinessLeadsScreen({super.key, required this.go, required this.state});

  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final rawBookings = listOfMaps(state?.raw['bookings']);
    return ScreenScaffold(
      title: 'Leads',
      subtitle: 'Service requests routed to this provider.',
      children: [
        if (rawBookings.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(
              child: Text(
                'No service leads at this time.',
                style: TextStyle(color: TsgColors.muted),
                textAlign: TextAlign.center,
              ),
            ),
          )
        else
          ...rawBookings.map(
            (b) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SoftCard(
                child: Row(
                  children: [
                    const Avatar(
                      size: 46,
                      icon: CupertinoIcons.car_detailed,
                      tone: Color(0xFFEAF4FF),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            stringValue(b['label'], fallback: 'Service request'),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            stringValue(b['scheduledFor']),
                            style: const TextStyle(color: TsgColors.muted),
                          ),
                        ],
                      ),
                    ),
                    RoleStatusChip(
                      stringValue(b['status'], fallback: 'New'),
                      color: TsgColors.green,
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

class BusinessBookingsScreen extends StatelessWidget {
  const BusinessBookingsScreen({super.key, required this.go, this.state});

  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final rawBookings = listOfMaps(state?.raw['bookings']);
    return ScreenScaffold(
      title: 'Bookings',
      subtitle: 'Confirmed and pending provider work.',
      children: [
        if (rawBookings.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(
              child: Text(
                'No bookings at this time.',
                style: TextStyle(color: TsgColors.muted),
                textAlign: TextAlign.center,
              ),
            ),
          )
        else
          ...rawBookings.map(
            (b) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SoftCard(
                child: Row(
                  children: [
                    const Avatar(
                      size: 44,
                      icon: CupertinoIcons.calendar,
                      tone: Color(0xFFF1E8F8),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            stringValue(b['scheduledFor'], fallback: 'Upcoming'),
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            stringValue(b['label'], fallback: 'Booking'),
                            style: const TextStyle(color: TsgColors.muted),
                          ),
                        ],
                      ),
                    ),
                    RoleStatusChip(
                      stringValue(b['status'], fallback: 'Confirmed'),
                      color: TsgColors.green,
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

class BusinessMessagesScreen extends StatelessWidget {
  const BusinessMessagesScreen({super.key, required this.go});

  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Messages',
      subtitle: 'Requests, family coordination, and booking updates.',
      children: const [
        SoftCard(
          child: Row(
            children: [
              Avatar(size: 46, label: 'A', tone: Color(0xFFFFF3E7)),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Resident',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Ride confirmation for cardiology visit',
                      style: TextStyle(color: TsgColors.muted),
                    ),
                  ],
                ),
              ),
              Text('9:30 AM', style: TextStyle(color: TsgColors.muted)),
            ],
          ),
        ),
      ],
    );
  }
}

class BusinessMoreScreen extends StatelessWidget {
  const BusinessMoreScreen({super.key, required this.go, this.state});

  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final items = [
      (
        CupertinoIcons.building_2_fill,
        'Business profile',
        Screen.businessProfile,
      ),
      (
        CupertinoIcons.slider_horizontal_3,
        'Business settings',
        Screen.businessSettings,
      ),
      (
        CupertinoIcons.square_grid_2x2_fill,
        'Services',
        Screen.businessServices,
      ),
      (CupertinoIcons.chart_bar_fill, 'Performance', Screen.businessDashboard),
      (CupertinoIcons.speaker_2_fill, 'Promotions', Screen.businessSettings),
      (CupertinoIcons.chat_bubble_2_fill, 'Messages', Screen.businessMessages),
      (CupertinoIcons.calendar_badge_plus, 'Bookings', Screen.businessBookings),
    ];
    return ScreenScaffold(
      title: 'Business tools',
      subtitle: 'Provider profile, services, and operations.',
      children: [
        ...items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SoftCard(
              padding: const EdgeInsets.all(16),
              onTap: () => go(item.$3),
              child: Row(
                children: [
                  Avatar(
                    size: 44,
                    icon: item.$1,
                    tone: const Color(0xFFEAF4FF),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Text(
                      item.$2,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const Icon(
                    CupertinoIcons.chevron_right,
                    color: TsgColors.muted,
                    size: 17,
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

class TrustCircleSettingsScreen extends StatelessWidget {
  const TrustCircleSettingsScreen({super.key, required this.go});

  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Trust Circle Settings',
      subtitle: 'Edit invite access, alerts, visibility, and emergency role.',
      back: () => go(Screen.trustCircleMore),
      children: [
        SettingsSection(
          title: 'Relationship and Contact',
          rows: const [
            ('Relationship', 'Daughter'),
            ('Phone', '+1 (655) 987-6543'),
            ('Email', 'rita.sharma@email.com'),
            ('Time zone', '(PST) Pacific Time'),
          ],
        ),
        SettingsSection(
          title: 'Alerts and Messaging',
          rows: const [
            ('Routine updates', '9:00 AM - 8:00 PM'),
            ('Quiet hours', '8:00 PM - 8:00 AM'),
            ('SOS alerts', 'On'),
            ('Emergency alerts', 'Call + SMS'),
          ],
        ),
        SettingsSection(
          title: 'Data Visibility',
          rows: const [
            ('Basic info', 'Allowed'),
            ('Daily check-ins', 'Allowed'),
            ('Medications', 'Allowed'),
            ('Appointments', 'Allowed'),
            ('Health analytics', 'Locked'),
            ('Location history', 'Locked'),
          ],
        ),
      ],
    );
  }
}

class BusinessSettingsScreen extends StatelessWidget {
  const BusinessSettingsScreen({super.key, required this.go});

  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Business Settings',
      subtitle:
          'Edit services, pricing, service area, leads, ads, and contact rules.',
      back: () => go(Screen.businessMore),
      children: [
        SettingsSection(
          title: 'Services and Pricing',
          rows: const [
            ('Local Ride', r'$18 - $25'),
            ('Airport Ride', r'$55 - $65'),
            ('Doctor Appointment Ride', r'$25'),
            ('Senior Shopping Trip', r'$20'),
          ],
        ),
        SettingsSection(
          title: 'Location and Availability',
          rows: const [
            ('Service radius', '15 miles around Sunnyvale'),
            ('Zip codes', '80124, 80126, 80129, 80202'),
            ('Hours', 'Mon - Sun, 6:00 AM - 10:00 PM'),
            ('Same-day service', 'On'),
            ('Emergency service', 'On'),
          ],
        ),
        SettingsSection(
          title: 'Leads and Promotion',
          rows: const [
            ('Max leads per day', '10'),
            ('Preferred lead type', 'All rides'),
            ('Urgent requests', 'Accepted'),
            ('Recurring requests', 'Accepted'),
            ('Platform advertising', 'Ready to create promotion'),
          ],
        ),
        SettingsSection(
          title: 'Communication',
          rows: const [
            ('SMS', 'On'),
            ('Email', 'On'),
            ('Phone call', 'On'),
            ('In-app notifications', 'On'),
            ('Auto-reply', 'Thank you. We will get back to you shortly.'),
          ],
        ),
      ],
    );
  }
}

class BusinessDoneScreen extends StatelessWidget {
  const BusinessDoneScreen({super.key, required this.go});

  final ValueChanged<Screen> go;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: "You're all set!",
      subtitle:
          'Your account is under review. We will notify you once it is approved.',
      children: [
        const Center(
          child: Avatar(
            size: 112,
            icon: CupertinoIcons.checkmark_shield_fill,
            tone: Color(0xFFE4F7EA),
          ),
        ),
        const SizedBox(height: 22),
        SoftCard(
          color: const Color(0xFFEAF8EF),
          child: const Row(
            children: [
              Icon(CupertinoIcons.car_detailed, color: TsgColors.green),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'CareRide is ready for profile review, service approval, and marketplace matching.',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        PurpleButton(
          'Go to Dashboard',
          color: TsgColors.green,
          onTap: () => go(Screen.businessDashboard),
        ),
      ],
    );
  }
}

class SettingsSection extends StatelessWidget {
  const SettingsSection({super.key, required this.title, required this.rows});

  final String title;
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: SoftCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 12),
            ...rows.map(
              (row) => GestureDetector(
                onTap: () => showDialog(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: Text('Edit ${row.$1}'),
                    content: TextFormField(initialValue: row.$2),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('Done'),
                      ),
                    ],
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          row.$1,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Flexible(
                        child: Text(
                          row.$2,
                          textAlign: TextAlign.right,
                          style: const TextStyle(color: TsgColors.muted),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(
                        CupertinoIcons.pencil,
                        size: 15,
                        color: TsgColors.muted,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ServicesScreen extends StatelessWidget {
  const ServicesScreen({
    super.key,
    required this.go,
    required this.runApi,
    required this.goGuruChat,
    this.state,
  });
  final ValueChanged<Screen> go;
  final ApiRunner runApi;
  final ValueChanged<String> goGuruChat;
  final ResidentAppState? state;

  // TSG-native services booked directly through the backend.
  // Thumbtack services (cleaning, handyman, plumbing, etc.) open the Guru chat.
  static const _thumbtackCategories = {
    'cleaning',
    'handyman',
    'home_care',
    'plumbing',
    'electrical',
    'landscaping',
    'painting',
  };

  @override
  Widget build(BuildContext context) {
    // (label, category, availability, icon, color, guruMessage or null)
    // guruMessage != null → route through Thumbtack Guru chat
    final services = [
      (
        'CareRide',
        'Transportation',
        'Available tomorrow',
        CupertinoIcons.car_detailed,
        const Color(0xFFFFF3E8),
        null,
      ),
      (
        'HealthPlus Pharmacy',
        'pharmacy',
        'Fast delivery',
        CupertinoIcons.capsule,
        const Color(0xFFEFF8ED),
        null,
      ),
      (
        'Comfort Cleaning',
        'cleaning',
        'Find vetted pros',
        CupertinoIcons.sparkles,
        const Color(0xFFF4EDFF),
        'I need house cleaning',
      ),
      (
        'Fresh Meals',
        'food',
        'Low sodium meals',
        CupertinoIcons.bag,
        const Color(0xFFFFF7DF),
        null,
      ),
      (
        'Handyman Help',
        'handyman',
        'Find vetted pros',
        CupertinoIcons.hammer_fill,
        const Color(0xFFEAF4FF),
        'I need a handyman for home repair',
      ),
      (
        'Groceries',
        'grocery',
        'Essentials delivered',
        CupertinoIcons.cart_fill,
        const Color(0xFFEFF8ED),
        null,
      ),
    ];

    // (icon, label, guruMessage or null)
    // guruMessage != null → Thumbtack category, opens Guru chat
    final categories = [
      (CupertinoIcons.car_detailed, 'Transport', null),
      (CupertinoIcons.capsule, 'Medication', null),
      (CupertinoIcons.bag, 'Food', null),
      (CupertinoIcons.cart_fill, 'Groceries', null),
      (CupertinoIcons.hammer_fill, 'Handyman', 'I need a handyman'),
      (CupertinoIcons.house_fill, 'Home Care', 'I need home care help'),
      (CupertinoIcons.drop_fill, 'Plumbing', 'I need a plumber'),
      (CupertinoIcons.bolt_fill, 'Electrical', 'I need an electrician'),
      (CupertinoIcons.leaf_arrow_circlepath, 'Lawn Care', 'I need lawn care'),
    ];

    return ScreenScaffold(
      title: 'Services',
      subtitle: 'Find trusted help near you.',
      back: () => go(Screen.more),
      children: [
        // Search bar — opens Guru chat for any service query
        GestureDetector(
          onTap: () => goGuruChat(''),
          child: Container(
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
                    'What do you need? Ask the Guru...',
                    style: TextStyle(color: TsgColors.muted),
                  ),
                ),
                Icon(CupertinoIcons.sparkles, color: TsgColors.purple),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),

        // Thumbtack banner — home service CTA
        GestureDetector(
          onTap: () => goGuruChat(''),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1B72C0), Color(0xFF0E4F8A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(18),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x221B72C0),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .18),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    CupertinoIcons.hammer_fill,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Need a plumber, cleaner, or handyman?',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          height: 1.3,
                        ),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'Ask the Guru — we will find vetted pros from our network and top platforms.',
                        style: TextStyle(
                          color: Color(0xCCFFFFFF),
                          fontSize: 12,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  CupertinoIcons.chevron_right,
                  color: Colors.white,
                  size: 16,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),

        const SectionHeader('Your Services'),
        const SizedBox(height: 12),
        ...services.map((s) {
          final isThumbtatck = s.$6 != null;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SoftCard(
              padding: const EdgeInsets.all(13),
              onTap: () async {
                if (isThumbtatck) {
                  goGuruChat(s.$6!);
                  return;
                }
                if (s.$2 == 'Transportation') {
                  await runApi('Creating CareRide booking', (client, st) {
                    return client.createRideBooking(
                      serviceId: requireTransportServiceId(st),
                      label: 'Cardiology Visit',
                      time: 'Tomorrow, 10:00 AM',
                      pickupLabel: st?.community ?? '',
                      riderName: st?.residentName ?? '',
                    );
                  });
                  go(Screen.rideStatus);
                  return;
                }
                await runApi('Creating ${s.$2} order', (client, st) {
                  return client.createSupportOrder(
                    category: s.$2,
                    label: s.$1,
                    providerBillCents: supportOrderEstimateCents(s.$2),
                    recipientName: st?.residentName ?? '',
                    deliveryAddress: st?.community ?? '',
                  );
                });
              },
              child: Row(
                children: [
                  PhotoTile(icon: s.$4, width: 72, height: 72, color: s.$5),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                s.$1,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            if (isThumbtatck)
                              const Pill(
                                'Find Pros',
                                color: Color(0xFFEDE8FF),
                                ink: TsgColors.purple,
                              ),
                          ],
                        ),
                        Text(
                          s.$2,
                          style: const TextStyle(color: TsgColors.muted),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          s.$3,
                          style: TextStyle(
                            color: isThumbtatck
                                ? const Color(0xFF1B72C0)
                                : TsgColors.green,
                            fontWeight: FontWeight.w700,
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
          );
        }),
        const SizedBox(height: 20),
        const SectionHeader('Partner Networks'),
        const SizedBox(height: 4),
        const Text(
          'Pros sourced from our vetted network and top platforms.',
          style: TextStyle(fontSize: 13, color: TsgColors.muted),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _PartnerChip(
                label: 'Guru Partners',
                sublabel: 'TSG Vetted',
                bg: Color(0xFFEDE8FF),
                ink: TsgColors.purple,
                icon: CupertinoIcons.star_circle_fill,
              ),
              SizedBox(width: 8),
              _PartnerChip(
                label: 'Thumbtack',
                sublabel: 'Home Services',
                bg: Color(0xFFE8F3FF),
                ink: Color(0xFF1B72C0),
                icon: CupertinoIcons.hammer_fill,
              ),
              SizedBox(width: 8),
              _PartnerChip(
                label: 'Angi',
                sublabel: 'Home Pros',
                bg: Color(0xFFFFEEE8),
                ink: Color(0xFFD45D1A),
                icon: CupertinoIcons.house_fill,
              ),
              SizedBox(width: 8),
              _PartnerChip(
                label: 'TaskRabbit',
                sublabel: 'Handywork',
                bg: Color(0xFFE9F5E1),
                ink: Color(0xFF3F7A1A),
                icon: CupertinoIcons.checkmark_seal_fill,
              ),
              SizedBox(width: 8),
              _PartnerChip(
                label: 'Care.com',
                sublabel: 'Caregivers',
                bg: Color(0xFFE8EFFF),
                ink: Color(0xFF1A4CC0),
                icon: CupertinoIcons.heart_fill,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
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
            final isThumbtatck = c.$3 != null;
            return SoftCard(
              padding: const EdgeInsets.all(10),
              color: isThumbtatck
                  ? const Color(0xFFF0F7FF)
                  : TsgColors.card,
              onTap: () {
                if (isThumbtatck) {
                  goGuruChat(c.$3!);
                } else {
                  go(Screen.services);
                }
              },
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    c.$1,
                    color: isThumbtatck
                        ? const Color(0xFF1B72C0)
                        : TsgColors.purple,
                    size: 24,
                  ),
                  const SizedBox(height: 7),
                  Text(
                    c.$2,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: isThumbtatck
                          ? const Color(0xFF1B72C0)
                          : TsgColors.ink,
                    ),
                  ),
                  if (isThumbtatck) ...[
                    const SizedBox(height: 3),
                    const Text(
                      'via Partners',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 9,
                        color: Color(0xFF1B72C0),
                      ),
                    ),
                  ],
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class SafetyScreen extends StatefulWidget {
  const SafetyScreen({
    super.key,
    required this.go,
    required this.runApi,
    this.state,
  });
  final ValueChanged<Screen> go;
  final ApiRunner runApi;
  final ResidentAppState? state;

  @override
  State<SafetyScreen> createState() => _SafetyScreenState();
}

class _SafetyScreenState extends State<SafetyScreen> {
  Position? position;
  String locationStatus = 'Tap to sync live location';
  String safeZoneStatus = 'Not synced';
  bool syncingLocation = false;

  @override
  Widget build(BuildContext context) {
    final hasLocation = position != null;
    final center = hasLocation
        ? LatLng(position!.latitude, position!.longitude)
        : const LatLng(37.3688, -122.0363);
    return ScreenScaffold(
      title: 'Safety',
      subtitle: 'Fast help and trusted alerts.',
      back: () => widget.go(Screen.more),
      children: [
        GestureDetector(
          onTap: () async {
            final confirmed = await showCupertinoDialog<bool>(
              context: context,
              builder: (_) => CupertinoAlertDialog(
                title: const Text('Send SOS Alert?'),
                content: const Text('This will immediately alert your care circle and emergency contacts.'),
                actions: [
                  CupertinoDialogAction(isDestructiveAction: true, onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                  CupertinoDialogAction(isDefaultAction: true, onPressed: () => Navigator.pop(context, true), child: const Text('Send SOS')),
                ],
              ),
            );
            if (confirmed != true) return;
            try {
              await widget.runApi('Sending SOS alert', (client, state) => client.triggerSos());
            } catch (e) {
              if (mounted) {
                showCupertinoDialog(
                  context: context,
                  builder: (_) => CupertinoAlertDialog(
                    title: const Text('SOS Failed'),
                    content: Text('Could not send SOS: $e\n\nCall 911 directly if this is an emergency.'),
                    actions: [CupertinoDialogAction(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
                  ),
                );
              }
            }
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
        SoftCard(
          padding: const EdgeInsets.all(0),
          onTap: () => widget.go(Screen.safetyMap),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: SizedBox(
              height: 214,
              child: Stack(
                children: [
                  if (androidGoogleMapsKey.isNotEmpty)
                    Positioned.fill(
                      child: GoogleMap(
                        initialCameraPosition: CameraPosition(
                          target: center,
                          zoom: hasLocation ? 15 : 12,
                        ),
                        markers: {
                          Marker(
                            markerId: const MarkerId('resident-location'),
                            position: center,
                            infoWindow: InfoWindow(
                              title: hasLocation
                                  ? 'Current location'
                                  : 'Waiting for location',
                              snippet: safeZoneStatus,
                            ),
                          ),
                        },
                        circles: {
                          Circle(
                            circleId: const CircleId('safe-zone'),
                            center: center,
                            radius: hasLocation ? 250 : 500,
                            strokeColor: TsgColors.green,
                            fillColor: TsgColors.green.withValues(alpha: .12),
                            strokeWidth: 2,
                          ),
                        },
                        myLocationEnabled: hasLocation,
                        myLocationButtonEnabled: false,
                        zoomControlsEnabled: false,
                        compassEnabled: false,
                      ),
                    )
                  else
                    Positioned.fill(
                      child: Container(
                        color: const Color(0xFFEEEEEE),
                        child: const Center(child: Text('Map unavailable', style: TextStyle(color: TsgColors.muted))),
                      ),
                    ),
                  Positioned(
                    top: 12,
                    right: 12,
                    child: GestureDetector(
                      onTap: () => widget.go(Screen.safetyMap),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: .94),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: TsgColors.line),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              CupertinoIcons.arrow_up_left_arrow_down_right,
                              size: 16,
                              color: TsgColors.purple,
                            ),
                            SizedBox(width: 6),
                            Text(
                              'Open map',
                              style: TextStyle(
                                color: TsgColors.purple,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: 12,
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .92),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: TsgColors.line),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            hasLocation
                                ? CupertinoIcons.location_solid
                                : CupertinoIcons.location,
                            color: hasLocation
                                ? TsgColors.green
                                : TsgColors.orange,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              locationStatus,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
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
        ),
        const SizedBox(height: 12),
        const SectionHeader('Safety status'),
        const SizedBox(height: 12),
        safetyRow(
          CupertinoIcons.location_fill,
          'Location sharing',
          syncingLocation ? 'Syncing live location...' : safeZoneStatus,
          TsgColors.green,
          onTap: _syncLocation,
        ),
        safetyRow(
          CupertinoIcons.bell_fill,
          'Check-in reminder',
          'Today at 7:30 PM',
          TsgColors.orange,
          onTap: () {
            widget.runApi('Creating safety check-in', (client, state) {
              return client.sendGuruMessage(
                'Set a safety check-in for tonight at 7:30 PM.',
                screen: 'safety',
              );
            });
          },
        ),
        safetyRow(
          CupertinoIcons.waveform_path_ecg,
          'Health monitoring',
          'Vitals look stable',
          TsgColors.green,
          onTap: () {
            widget.runApi('Syncing wearable health data', (
              client,
              state,
            ) async {
              final snapshot = await NativeHealthService()
                  .collectRecentVitals();
              return client.syncHealthConsentAndVitals(
                source: snapshot.source,
                readings: snapshot.readings,
                dataTypes: snapshot.consentDataTypes,
              );
            });
          },
        ),
        safetyRow(
          CupertinoIcons.shield_fill,
          'Risk intelligence',
          'Low risk today',
          TsgColors.green,
          onTap: () => widget.go(Screen.risk),
        ),
        const SizedBox(height: 16),
        SoftCard(
          color: const Color(0xFFF7F1FF),
          onTap: () => widget.go(Screen.familyHealth),
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

  Future<void> _syncLocation() async {
    if (syncingLocation) return;
    setState(() {
      syncingLocation = true;
      locationStatus = 'Requesting phone location...';
    });
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          locationStatus = 'Location services are off on this phone.';
          safeZoneStatus = 'Location disabled';
          syncingLocation = false;
        });
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() {
          locationStatus = 'Location permission is not granted.';
          safeZoneStatus = 'Permission needed';
          syncingLocation = false;
        });
        return;
      }
      final current = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      setState(() {
        position = current;
        locationStatus =
            '${current.latitude.toStringAsFixed(5)}, ${current.longitude.toStringAsFixed(5)}';
        safeZoneStatus = 'Sending safe-zone check...';
      });
      final synced = await widget.runApi('Syncing safety location', (
        client,
        state,
      ) {
        return client.syncSafetyLocation(
          lat: current.latitude,
          lng: current.longitude,
          accuracyMeters: current.accuracy.roundToDouble(),
          label: 'Phone location',
          movementStatus: current.speed > 0.6 ? 'moving' : 'still',
          lastKnownSpeedMph:
              (current.speed * 2.236936 * 10).roundToDouble() / 10,
          safeZoneStatus: null,
        );
      });
      if (!mounted) return;
      setState(() {
        safeZoneStatus = synced ? 'Safe-zone check synced' : 'Sync failed';
        syncingLocation = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        locationStatus = 'Location sync failed: $error';
        safeZoneStatus = 'Sync failed';
        syncingLocation = false;
      });
    }
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

class SafetyMapScreen extends StatelessWidget {
  const SafetyMapScreen({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final telemetry = mapValue(mapValue(state?.raw['safety'])['latestTelemetry']);
    final lat = doubleValue(telemetry['lat'], fallback: 37.3688);
    final lng = doubleValue(telemetry['lng'], fallback: -122.0363);
    final hasTelemetry = telemetry.isNotEmpty;
    final center = LatLng(lat, lng);
    final safeZone = surfaceText(telemetry['safe_zone_status'], 'Unknown');
    final label = surfaceText(telemetry['location_label'], 'Current location');
    return Scaffold(
      body: Stack(
        children: [
          if (androidGoogleMapsKey.isNotEmpty)
            Positioned.fill(
              child: GoogleMap(
                initialCameraPosition: CameraPosition(
                  target: center,
                  zoom: hasTelemetry ? 16 : 12,
                ),
                markers: {
                  Marker(
                    markerId: const MarkerId('resident-location-full'),
                    position: center,
                    infoWindow: InfoWindow(title: label, snippet: safeZone),
                  ),
                },
                circles: {
                  Circle(
                    circleId: const CircleId('resident-safe-zone-full'),
                    center: center,
                    radius: 300,
                    strokeWidth: 3,
                    strokeColor: TsgColors.green,
                    fillColor: TsgColors.green.withValues(alpha: .12),
                  ),
                },
                myLocationEnabled: hasTelemetry,
                myLocationButtonEnabled: true,
                zoomControlsEnabled: false,
              ),
            )
          else
            Positioned.fill(
              child: Container(
                color: const Color(0xFFEEEEEE),
                child: const Center(child: Text('Map requires Google Maps API key', style: TextStyle(color: TsgColors.muted))),
              ),
            ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                children: [
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => go(Screen.safety),
                        child: Container(
                          width: 48,
                          height: 48,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Color(0x262D2038),
                                blurRadius: 18,
                                offset: Offset(0, 8),
                              ),
                            ],
                          ),
                          child: const Icon(CupertinoIcons.chevron_left),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: .94),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: TsgColors.line),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'Live Safety Map',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 17,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                hasTelemetry
                                    ? '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}'
                                    : 'No safety telemetry synced yet',
                                style: const TextStyle(
                                  color: TsgColors.muted,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .95),
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: TsgColors.line),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x1E2D2038),
                          blurRadius: 24,
                          offset: Offset(0, 12),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          safeZone.toLowerCase() == 'inside'
                              ? 'Inside safe zone'
                              : 'Safe-zone status: $safeZone',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          androidGoogleMapsKey.isEmpty
                              ? 'Google Maps Android key is missing in this APK build. Coordinates are synced, but map tiles may not render.'
                              : 'Latest phone location is synced with the safety engine.',
                          style: const TextStyle(
                            color: TsgColors.muted,
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
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
        PurpleButton('Create Account', onTap: () => go(Screen.seniorPhoto)),
        const SizedBox(height: 18),
        Center(
          child: TextButton(
            onPressed: () => go(Screen.onboardingRole),
            child: const Text('Sign In'),
          ),
        ),
      ],
    );
  }
}

class OnboardingRoleSelection extends StatelessWidget {
  const OnboardingRoleSelection({
    super.key,
    required this.go,
    required this.runApi,
  });

  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Choose your role',
      subtitle: 'Your first screen depends on how you support the circle.',
      back: () => go(Screen.more),
      children: [
        RoleChoiceCard(
          icon: CupertinoIcons.heart_fill,
          title: 'Senior',
          body: 'Set up your care profile, safety, health, rides, and Guru.',
          color: const Color(0xFFFFF3E7),
          onTap: () async {
            await runApi('Starting senior onboarding', (client, state) {
              return client.startRoleSession('senior');
            });
            go(Screen.onboardingWelcome);
          },
        ),
        const SizedBox(height: 13),
        RoleChoiceCard(
          icon: CupertinoIcons.person_2_fill,
          title: 'Trusted Circle',
          body: 'Join by invite to support a senior with approved visibility.',
          color: const Color(0xFFF1E8F8),
          onTap: () async {
            await runApi('Starting trusted circle onboarding', (client, state) {
              return client.startRoleSession('trusted_person');
            });
            go(Screen.trustCircleInvite);
          },
        ),
        const SizedBox(height: 13),
        RoleChoiceCard(
          icon: CupertinoIcons.building_2_fill,
          title: 'Business',
          body:
              'Register services, coverage, credentials, leads, and bookings.',
          color: const Color(0xFFEAF4FF),
          onTap: () async {
            await runApi('Starting business onboarding', (client, state) {
              return client.startRoleSession('business');
            });
            go(Screen.businessType);
          },
        ),
      ],
    );
  }
}

class RoleChoiceCard extends StatelessWidget {
  const RoleChoiceCard({
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

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      color: color,
      onTap: onTap,
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
          const Icon(CupertinoIcons.chevron_right, color: TsgColors.purple),
        ],
      ),
    );
  }
}

class OnboardingStepSpec {
  const OnboardingStepSpec({
    required this.flow,
    required this.step,
    required this.total,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.next,
    this.back,
    this.heroIcon,
    this.fields = const [],
    this.cards = const [],
    this.toggles = const [],
    this.primaryLabel = 'Continue',
  });

  final String flow;
  final int step;
  final int total;
  final String title;
  final String subtitle;
  final Color accent;
  final Screen next;
  final Screen? back;
  final IconData? heroIcon;
  final List<(String, String)> fields;
  final List<(IconData, String, String)> cards;
  final List<(String, bool)> toggles;
  final String primaryLabel;
}

enum EvidenceMediaKind { image, video }

class EvidenceCaptureSpec {
  const EvidenceCaptureSpec({
    required this.subjectRole,
    required this.evidenceType,
    required this.mediaKind,
    required this.captureMethod,
  });

  final String subjectRole;
  final String evidenceType;
  final EvidenceMediaKind mediaKind;
  final String captureMethod;
}

EvidenceCaptureSpec? evidenceCaptureSpecForOption(
  OnboardingStepSpec step,
  String optionLabel,
) {
  final label = optionLabel.toLowerCase();
  final flow = step.flow.toLowerCase();
  final subjectRole = flow.contains('business')
      ? 'business_owner'
      : flow.contains('trust')
      ? 'trust_circle'
      : 'senior';
  final isUpload =
      label.contains('upload') ||
      label.contains('license') ||
      label.contains('certificate') ||
      label.contains('government') ||
      label.contains('insurance');
  if (label.contains('take photo') ||
      label.contains('upload photo') ||
      label.contains('owner photo')) {
    return EvidenceCaptureSpec(
      subjectRole: subjectRole,
      evidenceType: 'profile_photo',
      mediaKind: EvidenceMediaKind.image,
      captureMethod: isUpload ? 'upload' : 'camera',
    );
  }
  if (label.contains('turn your head') ||
      label.contains('blink') ||
      label.contains('face match')) {
    return EvidenceCaptureSpec(
      subjectRole: subjectRole,
      evidenceType: 'liveness_video',
      mediaKind: EvidenceMediaKind.video,
      captureMethod: 'camera',
    );
  }
  if (label.contains('business license')) {
    return EvidenceCaptureSpec(
      subjectRole: subjectRole,
      evidenceType: 'business_license',
      mediaKind: EvidenceMediaKind.image,
      captureMethod: 'upload',
    );
  }
  if (label.contains('insurance')) {
    return EvidenceCaptureSpec(
      subjectRole: subjectRole,
      evidenceType: 'insurance',
      mediaKind: EvidenceMediaKind.image,
      captureMethod: 'upload',
    );
  }
  if (label.contains('government id')) {
    return EvidenceCaptureSpec(
      subjectRole: subjectRole,
      evidenceType: 'government_id',
      mediaKind: EvidenceMediaKind.image,
      captureMethod: 'upload',
    );
  }
  return null;
}

Future<void> captureOnboardingEvidence({
  required OnboardingStepSpec step,
  required String optionLabel,
  required ApiRunner runApi,
}) async {
  final spec = evidenceCaptureSpecForOption(step, optionLabel);
  if (spec == null) return;
  final picker = ImagePicker();
  final source = spec.captureMethod == 'upload'
      ? ImageSource.gallery
      : ImageSource.camera;
  final picked = spec.mediaKind == EvidenceMediaKind.video
      ? await picker.pickVideo(
          source: source,
          maxDuration: const Duration(seconds: 12),
        )
      : await picker.pickImage(
          source: source,
          imageQuality: 82,
          maxWidth: 1400,
        );
  if (picked == null) return;
  const maxBytes = 10 * 1024 * 1024;
  final fileSize = await picked.length();
  if (fileSize > maxBytes) return;
  final bytes = await picked.readAsBytes();
  await runApi('Saving ${optionLabel.toLowerCase()}', (client, state) {
    return client.captureEvidence(
      subjectRole: spec.subjectRole,
      evidenceType: spec.evidenceType,
      localUri: picked.path,
      captureMethod: spec.captureMethod,
      fileName: picked.name,
      mimeType: picked.mimeType,
      base64Data: base64Encode(bytes),
      metadata: {
        'onboardingFlow': step.flow,
        'onboardingStep': step.step,
        'optionLabel': optionLabel,
      },
    );
  });
}

final seniorStepSpecs = <OnboardingStepSpec>[
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 1,
    total: 14,
    title: 'Welcome!',
    subtitle:
        'I am Guru, your AI companion. I am here to make daily life easier, safer and more connected.',
    accent: TsgColors.purple,
    next: Screen.seniorPhoto,
    heroIcon: CupertinoIcons.hand_raised_fill,
    primaryLabel: 'Get Started',
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 2,
    total: 14,
    title: 'Photo',
    subtitle: 'Add your photo so friends and family can recognize you.',
    accent: TsgColors.purple,
    back: Screen.onboardingWelcome,
    next: Screen.seniorVerify,
    heroIcon: CupertinoIcons.camera_fill,
    cards: const [
      (CupertinoIcons.camera_fill, 'Take Photo', 'Use camera'),
      (CupertinoIcons.photo_fill, 'Upload Photo', 'Choose existing'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 3,
    total: 14,
    title: 'Verify',
    subtitle: 'Short safety check to confirm it is really you.',
    accent: TsgColors.purple,
    back: Screen.seniorPhoto,
    next: Screen.onboardingProfile,
    heroIcon: CupertinoIcons.video_camera_solid,
    cards: const [
      (CupertinoIcons.arrow_right, 'Turn your head right', 'Completed'),
      (CupertinoIcons.check_mark, 'Blink your eyes', 'Completed'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 4,
    total: 14,
    title: 'Basic Info',
    subtitle: 'Tell me a bit about you.',
    accent: TsgColors.purple,
    back: Screen.seniorVerify,
    next: Screen.seniorAddress,
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 5,
    total: 14,
    title: 'Address',
    subtitle: 'Where should Guru coordinate help?',
    accent: TsgColors.purple,
    back: Screen.onboardingProfile,
    next: Screen.seniorHealth,
    fields: const [
      ('Home', '123 Greenview Dr, Sunnyvale, CA 94086'),
      ('Community', 'Park View Community'),
      ('Preferred hospital', 'City Care Hospital'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 6,
    total: 14,
    title: 'Health Snapshot',
    subtitle: 'Select what applies to you. You can update anytime.',
    accent: TsgColors.purple,
    back: Screen.seniorAddress,
    next: Screen.seniorMedications,
    cards: const [
      (CupertinoIcons.heart_fill, 'Heart Condition', 'Track gently'),
      (CupertinoIcons.drop_fill, 'High Blood Pressure', 'Baseline'),
      (CupertinoIcons.memories, 'Memory Concerns', 'Support'),
      (CupertinoIcons.person_fill, 'Mobility Limitation', 'Fall aware'),
      (CupertinoIcons.ear, 'Vision / Hearing', 'Accessibility'),
      (CupertinoIcons.bandage_fill, 'Arthritis / Joint Pain', 'Activity'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 7,
    total: 14,
    title: 'Medications',
    subtitle: 'Add medications so I can remind you.',
    accent: TsgColors.purple,
    back: Screen.seniorHealth,
    next: Screen.seniorDevices,
    heroIcon: CupertinoIcons.capsule_fill,
    cards: const [
      (CupertinoIcons.pencil, 'Add Manually', 'Lisinopril 10mg'),
      (CupertinoIcons.camera, 'Scan Medication Bottle', 'Use camera'),
      (CupertinoIcons.tray_arrow_down_fill, 'Import from Pharmacy', 'Connect'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 8,
    total: 14,
    title: 'Connect Devices',
    subtitle: 'Connect your devices to track your health.',
    accent: TsgColors.purple,
    back: Screen.seniorMedications,
    next: Screen.seniorPermissions,
    cards: const [
      (CupertinoIcons.heart_fill, 'Apple Health', 'Connect'),
      (CupertinoIcons.heart_fill, 'Fitbit', 'Connect'),
      (CupertinoIcons.location_north_fill, 'Garmin', 'Connect'),
      (CupertinoIcons.circle_grid_3x3_fill, 'Samsung Health', 'Connect'),
      (CupertinoIcons.timer, 'Oura', 'Connect'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 9,
    total: 14,
    title: 'Permissions',
    subtitle: 'Allow permissions to enable core features.',
    accent: TsgColors.purple,
    back: Screen.seniorDevices,
    next: Screen.seniorMusic,
    cards: const [
      (
        CupertinoIcons.location_fill,
        'Location',
        'Used for rides, emergencies and check-ins',
      ),
      (
        CupertinoIcons.bell_fill,
        'Notifications',
        'Reminders and important alerts',
      ),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 10,
    total: 14,
    title: 'Music',
    subtitle: 'What music do you enjoy?',
    accent: TsgColors.purple,
    back: Screen.seniorPermissions,
    next: Screen.onboardingCircle,
    cards: const [
      (CupertinoIcons.music_note_2, 'Old Hindi Songs', 'Favorite'),
      (CupertinoIcons.music_note, 'Bhajans', 'Favorite'),
      (CupertinoIcons.play_circle_fill, 'Spotify', 'Connect'),
      (CupertinoIcons.music_albums_fill, 'Apple Music', 'Connect'),
      (CupertinoIcons.play_rectangle_fill, 'YouTube Music', 'Connect'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 11,
    total: 14,
    title: 'Trust Circle',
    subtitle: 'Who should I contact if you need help?',
    accent: TsgColors.purple,
    back: Screen.seniorMusic,
    next: Screen.seniorPrivacy,
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 12,
    total: 14,
    title: 'Privacy Controls',
    subtitle: 'Choose what your circle can see.',
    accent: TsgColors.purple,
    back: Screen.onboardingCircle,
    next: Screen.seniorSos,
    toggles: const [
      ('Daily check-ins', true),
      ('Medications', true),
      ('Appointments', true),
      ('Location history', false),
      ('Health analytics', true),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 13,
    total: 14,
    title: 'SOS Setup',
    subtitle: 'Set the emergency escalation order.',
    accent: TsgColors.purple,
    back: Screen.seniorPrivacy,
    next: Screen.seniorRoutine,
    cards: const [
      (CupertinoIcons.person_2_fill, 'Rita Sharma', 'Primary contact'),
      (CupertinoIcons.phone_fill, '911', 'Emergency fallback'),
      (CupertinoIcons.building_2_fill, 'Community Staff', 'Backup support'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Senior onboarding flow',
    step: 14,
    total: 14,
    title: 'Daily Routine',
    subtitle: 'Set up your daily rhythm and alerts.',
    accent: TsgColors.purple,
    back: Screen.seniorSos,
    next: Screen.today,
    primaryLabel: 'Finish Setup',
    toggles: const [
      ('Emergency alerts', true),
      ('Medication alerts', true),
      ('Appointments', true),
      ('Location', false),
      ('Health data', true),
      ('Daily check-ins', true),
    ],
  ),
];

final trustCircleStepSpecs = <OnboardingStepSpec>[
  OnboardingStepSpec(
    flow: 'Trust circle onboarding flow',
    step: 1,
    total: 8,
    title: 'Invite',
    subtitle: 'You have been invited to a Trust Circle.',
    accent: TsgColors.purple,
    next: Screen.trustCircleRelationship,
    heroIcon: CupertinoIcons.person_crop_circle_badge_checkmark,
    primaryLabel: 'Accept Invite',
  ),
  OnboardingStepSpec(
    flow: 'Trust circle onboarding flow',
    step: 2,
    total: 8,
    title: 'Relationship',
    subtitle: 'What is your relationship with this senior?',
    accent: TsgColors.purple,
    back: Screen.trustCircleInvite,
    next: Screen.trustCircleProfile,
    cards: const [
      (CupertinoIcons.check_mark_circled_solid, 'Daughter', 'Selected'),
      (CupertinoIcons.person_fill, 'Son', 'Option'),
      (CupertinoIcons.heart_fill, 'Spouse', 'Option'),
      (CupertinoIcons.person_2_fill, 'Caregiver', 'Option'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Trust circle onboarding flow',
    step: 3,
    total: 8,
    title: 'Contact Info',
    subtitle: 'Your contact information.',
    accent: TsgColors.purple,
    back: Screen.trustCircleRelationship,
    next: Screen.trustCircleMessaging,
  ),
  OnboardingStepSpec(
    flow: 'Trust circle onboarding flow',
    step: 4,
    total: 8,
    title: 'Messaging Rules',
    subtitle: 'When can we message you?',
    accent: TsgColors.purple,
    back: Screen.trustCircleProfile,
    next: Screen.trustCircleAlerts,
    toggles: const [
      ('Routine updates: 9:00 AM - 8:00 PM', true),
      ('Quiet hours: 8:00 PM - 8:00 AM', true),
      ('Urgent alerts anytime', true),
      ('Emergency alerts by call + SMS', true),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Trust circle onboarding flow',
    step: 5,
    total: 8,
    title: 'Alert Preferences',
    subtitle: 'Which alerts do you want to receive?',
    accent: TsgColors.purple,
    back: Screen.trustCircleMessaging,
    next: Screen.trustCircleVisibility,
    toggles: const [
      ('Missed check-ins', true),
      ('Medication alerts', true),
      ('Health alerts', true),
      ('Mood / wellness alerts', false),
      ('Location alerts', true),
      ('SOS alerts', true),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Trust circle onboarding flow',
    step: 6,
    total: 8,
    title: 'Data Visibility',
    subtitle: 'What can you see?',
    accent: TsgColors.purple,
    back: Screen.trustCircleAlerts,
    next: Screen.trustCircleEmergency,
    toggles: const [
      ('Basic info', true),
      ('Daily check-ins', true),
      ('Medications', true),
      ('Appointments', true),
      ('Health analytics', false),
      ('Location history', false),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Trust circle onboarding flow',
    step: 7,
    total: 8,
    title: 'Emergency Role',
    subtitle: 'What is your role in emergencies?',
    accent: TsgColors.purple,
    back: Screen.trustCircleVisibility,
    next: Screen.trustCirclePreview,
    toggles: const [
      ('Primary contact', true),
      ('I can call 911 if needed', true),
      ('I can contact community staff', true),
      ('I can book services on behalf of this senior', false),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Trust circle onboarding flow',
    step: 8,
    total: 8,
    title: 'Dashboard Preview',
    subtitle: 'Control what your dashboard looks like.',
    accent: TsgColors.purple,
    back: Screen.trustCircleEmergency,
    next: Screen.familyHealth,
    primaryLabel: 'Go to Dashboard',
    cards: const [
      (
        CupertinoIcons.person_fill,
        'Senior Member',
        'All good - checked in 2h ago',
      ),
      (CupertinoIcons.capsule_fill, 'Next Medication', 'Call 8 AM'),
      (CupertinoIcons.calendar, 'Upcoming Appointment', 'May 10 - 10:00 AM'),
      (
        CupertinoIcons.check_mark_circled_solid,
        'Today Plan',
        '3 tasks remaining',
      ),
    ],
  ),
];

final businessStepSpecs = <OnboardingStepSpec>[
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 1,
    total: 11,
    title: 'Business Type',
    subtitle: 'What type of service do you provide?',
    accent: TsgColors.green,
    next: Screen.businessProfile,
    cards: const [
      (CupertinoIcons.car_detailed, 'Transportation', 'Rides'),
      (CupertinoIcons.bag_fill, 'Meals', 'Food'),
      (CupertinoIcons.house_fill, 'Home Care', 'Support'),
      (CupertinoIcons.sparkles, 'Cleaning', 'Home'),
      (CupertinoIcons.person_2_fill, 'Companionship', 'Social'),
      (CupertinoIcons.capsule_fill, 'Pharmacy', 'Medication'),
      (CupertinoIcons.wrench_fill, 'Handyman', 'Repairs'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 2,
    total: 11,
    title: 'Business Info',
    subtitle: 'Tell us about your business.',
    accent: TsgColors.green,
    back: Screen.businessType,
    next: Screen.businessVerification,
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 3,
    total: 11,
    title: 'Verification',
    subtitle: 'Verify your business.',
    accent: TsgColors.green,
    back: Screen.businessProfile,
    next: Screen.businessOwnerVerify,
    cards: const [
      (CupertinoIcons.doc_text_fill, 'Business License', 'Upload'),
      (CupertinoIcons.link, 'Insurance Certificate', 'Upload'),
      (CupertinoIcons.person_crop_square_fill, 'Owner Photo', 'Upload'),
      (CupertinoIcons.creditcard_fill, 'Government ID', 'Upload'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 4,
    total: 11,
    title: 'Owner Verification',
    subtitle: 'Let us verify it is really you.',
    accent: TsgColors.green,
    back: Screen.businessVerification,
    next: Screen.businessServices,
    heroIcon: CupertinoIcons.person_crop_circle_badge_checkmark,
    cards: const [
      (CupertinoIcons.arrow_right, 'Blink your eyes', 'Completed'),
      (CupertinoIcons.check_mark, 'Face match', 'Passed'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 5,
    total: 11,
    title: 'Services',
    subtitle: 'Add the services you offer.',
    accent: TsgColors.green,
    back: Screen.businessOwnerVerify,
    next: Screen.businessPricing,
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 6,
    total: 11,
    title: 'Pricing',
    subtitle: 'Set transparent pricing.',
    accent: TsgColors.green,
    back: Screen.businessServices,
    next: Screen.businessAvailability,
    fields: const [
      ('Local Ride', r'$18 - $25'),
      ('Airport Ride', r'$55 - $65'),
      ('Doctor Appointment Ride', r'$25'),
      ('Senior Shopping Trip', r'$20'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 7,
    total: 11,
    title: 'Availability',
    subtitle: 'When are you available?',
    accent: TsgColors.green,
    back: Screen.businessPricing,
    next: Screen.businessServiceArea,
    fields: const [
      ('Days', 'Sun, Mon, Tue, Wed, Thu, Fri, Sat'),
      ('Hours', '6:00 AM - 10:00 PM'),
    ],
    toggles: const [('Same-day service', true), ('Emergency service', true)],
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 8,
    total: 11,
    title: 'Service Area',
    subtitle: 'Where do you provide service?',
    accent: TsgColors.green,
    back: Screen.businessAvailability,
    next: Screen.businessLeadRules,
    heroIcon: CupertinoIcons.map_fill,
    fields: const [
      ('Radius', '15 miles around Sunnyvale, CA'),
      ('Zip codes', '80124, 80126, 80129, 80202'),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 9,
    total: 11,
    title: 'Lead Preferences',
    subtitle: 'What leads do you want?',
    accent: TsgColors.green,
    back: Screen.businessServiceArea,
    next: Screen.businessCommunication,
    fields: const [
      ('Max leads per day', '10'),
      ('Preferred lead type', 'All rides'),
      ('Min. job value', r'$15'),
    ],
    toggles: const [
      ('Accept urgent requests', true),
      ('Accept recurring requests', true),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 10,
    total: 11,
    title: 'Communication',
    subtitle: 'How should we contact you?',
    accent: TsgColors.green,
    back: Screen.businessLeadRules,
    next: Screen.businessReview,
    toggles: const [
      ('SMS', true),
      ('Email', true),
      ('Phone call', true),
      ('In-app notifications', true),
    ],
    fields: const [
      ('Auto-reply message', "Thank you. We will get back to you shortly."),
    ],
  ),
  OnboardingStepSpec(
    flow: 'Business onboarding flow',
    step: 11,
    total: 11,
    title: 'Review',
    subtitle: 'Review your information before submitting.',
    accent: TsgColors.green,
    back: Screen.businessCommunication,
    next: Screen.businessDone,
    primaryLabel: 'Submit for Review',
    cards: const [
      (CupertinoIcons.car_detailed, 'Business Type', 'Transportation'),
      (CupertinoIcons.square_grid_2x2_fill, 'Services', '4 services added'),
      (
        CupertinoIcons.location_fill,
        'Service Area',
        '15 miles around Sunnyvale',
      ),
      (CupertinoIcons.clock_fill, 'Availability', 'Mon - Sun, 6AM - 10PM'),
      (CupertinoIcons.check_mark_circled_solid, 'Verification', 'In review'),
    ],
  ),
];

class SeniorStepScreen extends StatelessWidget {
  const SeniorStepScreen({
    super.key,
    required this.step,
    required this.go,
    this.runApi,
  });

  final OnboardingStepSpec step;
  final ValueChanged<Screen> go;
  final ApiRunner? runApi;

  @override
  Widget build(BuildContext context) {
    return OnboardingSpecScreen(
      step: step,
      go: go,
      runApi: runApi,
      onFinish: (runner) async {
        await runner?.call('Completing senior onboarding', (client, state) {
          return client.completeSeniorOnboarding();
        });
      },
    );
  }
}

class TrustCircleStepScreen extends StatelessWidget {
  const TrustCircleStepScreen({
    super.key,
    required this.step,
    required this.go,
    this.runApi,
  });

  final OnboardingStepSpec step;
  final ValueChanged<Screen> go;
  final ApiRunner? runApi;

  @override
  Widget build(BuildContext context) {
    return OnboardingSpecScreen(
      step: step,
      go: go,
      runApi: runApi,
      onFinish: (runner) async {
        await runner?.call('Completing trusted circle onboarding', (
          client,
          state,
        ) {
          return client.completeTrustCircleOnboarding();
        });
      },
    );
  }
}

class BusinessStepScreen extends StatelessWidget {
  const BusinessStepScreen({
    super.key,
    required this.step,
    required this.go,
    this.runApi,
  });

  final OnboardingStepSpec step;
  final ValueChanged<Screen> go;
  final ApiRunner? runApi;

  @override
  Widget build(BuildContext context) {
    return OnboardingSpecScreen(
      step: step,
      go: go,
      runApi: runApi,
      onFinish: (runner) async {
        await runner?.call('Submitting business onboarding', (client, state) {
          return client.completeBusinessOnboarding();
        });
      },
    );
  }
}

class OnboardingSpecScreen extends StatelessWidget {
  const OnboardingSpecScreen({
    super.key,
    required this.step,
    required this.go,
    this.runApi,
    this.onFinish,
  });

  final OnboardingStepSpec step;
  final ValueChanged<Screen> go;
  final ApiRunner? runApi;
  final Future<void> Function(ApiRunner? runApi)? onFinish;

  @override
  Widget build(BuildContext context) {
    final isFinish =
        step.primaryLabel.toLowerCase().contains('finish') ||
        step.primaryLabel.toLowerCase().contains('submit') ||
        step.primaryLabel.toLowerCase().contains('dashboard');
    return ScreenScaffold(
      title: step.title,
      subtitle: step.subtitle,
      back: step.back == null ? null : () => go(step.back!),
      children: [
        RoleFlowHeader(step),
        if (step.heroIcon != null) ...[
          const SizedBox(height: 18),
          Center(
            child: Avatar(
              size: 104,
              icon: step.heroIcon!,
              tone: step.accent.withValues(alpha: .12),
            ),
          ),
        ],
        if (step.fields.isNotEmpty) ...[
          const SizedBox(height: 18),
          ...step.fields.map((item) => field(item.$1, item.$2)),
        ],
        if (step.cards.isNotEmpty) ...[
          const SizedBox(height: 18),
          ...step.cards.map(
            (item) => OnboardingOptionCard(
              item: item,
              accent: step.accent,
              onTap:
                  runApi == null ||
                      evidenceCaptureSpecForOption(step, item.$2) == null
                  ? null
                  : () {
                      captureOnboardingEvidence(
                        step: step,
                        optionLabel: item.$2,
                        runApi: runApi!,
                      );
                    },
            ),
          ),
        ],
        if (step.toggles.isNotEmpty) ...[
          const SizedBox(height: 18),
          ...step.toggles.map(
            (item) => OnboardingToggleRow(item: item, accent: step.accent),
          ),
        ],
        const SizedBox(height: 22),
        PurpleButton(
          step.primaryLabel,
          color: step.accent,
          onTap: () async {
            if (isFinish) await onFinish?.call(runApi);
            go(step.next);
          },
        ),
      ],
    );
  }
}

class RoleFlowHeader extends StatelessWidget {
  const RoleFlowHeader(this.step, {super.key});
  final OnboardingStepSpec step;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: step.accent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            step.flow.toUpperCase(),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const Spacer(),
        Text(
          '${step.step} / ${step.total}',
          style: TextStyle(color: step.accent, fontWeight: FontWeight.w900),
        ),
      ],
    );
  }
}

class OnboardingOptionCard extends StatelessWidget {
  const OnboardingOptionCard({
    super.key,
    required this.item,
    required this.accent,
    this.onTap,
  });

  final (IconData, String, String) item;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SoftCard(
        padding: const EdgeInsets.all(13),
        onTap: onTap,
        child: Row(
          children: [
            Avatar(
              size: 42,
              icon: item.$1,
              tone: accent.withValues(alpha: .12),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.$2,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.$3,
                    style: const TextStyle(
                      fontSize: 12,
                      color: TsgColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            Icon(CupertinoIcons.chevron_right, color: accent, size: 18),
          ],
        ),
      ),
    );
  }
}

class OnboardingToggleRow extends StatefulWidget {
  const OnboardingToggleRow({
    super.key,
    required this.item,
    required this.accent,
  });

  final (String, bool) item;
  final Color accent;

  @override
  State<OnboardingToggleRow> createState() => _OnboardingToggleRowState();
}

class _OnboardingToggleRowState extends State<OnboardingToggleRow> {
  late bool _value;

  @override
  void initState() {
    super.initState();
    _value = widget.item.$2;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SoftCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                widget.item.$1,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            CupertinoSwitch(
              value: _value,
              activeTrackColor: widget.accent,
              onChanged: (v) => setState(() => _value = v),
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingProfile extends StatefulWidget {
  const OnboardingProfile({super.key, required this.go});
  final ValueChanged<Screen> go;

  @override
  State<OnboardingProfile> createState() => _OnboardingProfileState();
}

class _OnboardingProfileState extends State<OnboardingProfile> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _age = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  final _stateField = TextEditingController();
  final _zip = TextEditingController();
  final _careNeeds = TextEditingController();

  @override
  void dispose() {
    _fullName.dispose(); _age.dispose(); _phone.dispose(); _email.dispose();
    _address.dispose(); _city.dispose(); _stateField.dispose(); _zip.dispose();
    _careNeeds.dispose();
    super.dispose();
  }

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
        Form(
          key: _formKey,
          child: Column(
            children: [
              formField('Full name', _fullName, required: true),
              formField('Age', _age, keyboardType: TextInputType.number),
              formField('Phone', _phone, keyboardType: TextInputType.phone),
              formField('Email', _email, keyboardType: TextInputType.emailAddress),
              formField('Address', _address),
              formField('City', _city),
              formField('State', _stateField),
              formField('ZIP', _zip, keyboardType: TextInputType.number),
              formField('Care needs', _careNeeds),
            ],
          ),
        ),
        const SizedBox(height: 20),
        PurpleButton('Continue', onTap: () {
          if (_formKey.currentState?.validate() ?? true) {
            widget.go(Screen.seniorAddress);
          }
        }),
      ],
    );
  }
}

Widget formField(
  String label,
  TextEditingController controller, {
  bool required = false,
  TextInputType? keyboardType,
}) {
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
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          validator: required
              ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
              : null,
          decoration: InputDecoration(
            contentPadding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(11),
              borderSide: const BorderSide(color: TsgColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(11),
              borderSide: const BorderSide(color: TsgColors.line),
            ),
          ),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
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
              onTap: () => go(Screen.trustCircleInvite),
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
        PurpleButton('Continue', onTap: () => go(Screen.seniorPrivacy)),
      ],
    );
  }
}

class OnboardingSafety extends StatelessWidget {
  const OnboardingSafety({super.key, required this.go, required this.runApi});
  final ValueChanged<Screen> go;
  final ApiRunner runApi;

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
        PurpleButton(
          'Finish Setup',
          onTap: () async {
            await runApi('Completing senior onboarding', (client, state) {
              return client.completeSeniorOnboarding();
            });
            go(Screen.today);
          },
        ),
      ],
    );
  }
}

class TrustCircleInviteScreen extends StatelessWidget {
  const TrustCircleInviteScreen({
    super.key,
    required this.go,
    required this.runApi,
  });

  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Trusted Circle',
      subtitle: 'Join only from a senior or family invitation.',
      back: () => go(Screen.onboardingRole),
      children: [
        const FlowNumber(1),
        const SizedBox(height: 18),
        const H1('Enter invite\ncode', size: 30),
        const SizedBox(height: 12),
        field('Invite code', ''),
        field('Senior', ''),
        field('Requested role', ''),
        const SizedBox(height: 14),
        SoftCard(
          color: const Color(0xFFF8F2FF),
          child: const Row(
            children: [
              Icon(CupertinoIcons.lock_shield_fill, color: TsgColors.purple),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Access is limited to what the senior approved.',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        PurpleButton(
          'Accept Invite',
          onTap: () => go(Screen.trustCircleRelationship),
        ),
      ],
    );
  }
}

class TrustCircleProfileScreen extends StatefulWidget {
  const TrustCircleProfileScreen({
    super.key,
    required this.go,
    required this.runApi,
  });

  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  State<TrustCircleProfileScreen> createState() => _TrustCircleProfileScreenState();
}

class _TrustCircleProfileScreenState extends State<TrustCircleProfileScreen> {
  final _fullName = TextEditingController();
  final _relationship = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _inviteCode = TextEditingController();

  @override
  void dispose() {
    _fullName.dispose(); _relationship.dispose(); _phone.dispose();
    _email.dispose(); _inviteCode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Your access',
      subtitle: 'Confirm contact, alerts, and emergency override.',
      back: () => widget.go(Screen.trustCircleInvite),
      children: [
        const FlowNumber(2),
        const SizedBox(height: 18),
        formField('Full name', _fullName, required: true),
        formField('Relationship', _relationship),
        formField('Phone', _phone, keyboardType: TextInputType.phone),
        formField('Email', _email, keyboardType: TextInputType.emailAddress),
        formField('Invite code', _inviteCode),
        const SizedBox(height: 18),
        PurpleButton('Continue', onTap: () async {
          await widget.runApi('Submitting trust circle profile', (client, state) {
            return client.completeTrustCircleOnboarding(
              payload: buildTrustCircleOnboardingPayload(
                fullName: _fullName.text.trim(),
                phone: _phone.text.trim(),
                email: _email.text.trim(),
                relationship: _relationship.text.trim(),
                inviteCode: _inviteCode.text.trim(),
              ),
            );
          });
          widget.go(Screen.trustCircleMessaging);
        }),
      ],
    );
  }
}

class BusinessProfileScreen extends StatefulWidget {
  const BusinessProfileScreen({
    super.key,
    required this.go,
    required this.runApi,
  });

  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  State<BusinessProfileScreen> createState() => _BusinessProfileScreenState();
}

class _BusinessProfileScreenState extends State<BusinessProfileScreen> {
  final _businessName = TextEditingController();
  final _ownerName = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _serviceType = TextEditingController();

  @override
  void dispose() {
    _businessName.dispose(); _ownerName.dispose(); _phone.dispose();
    _email.dispose(); _address.dispose(); _serviceType.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Business setup',
      subtitle: 'Create the provider profile before leads can route to you.',
      back: () => widget.go(Screen.onboardingRole),
      children: [
        const FlowNumber(1),
        const SizedBox(height: 18),
        formField('Business name', _businessName, required: true),
        formField('Owner / manager', _ownerName),
        formField('Phone', _phone, keyboardType: TextInputType.phone),
        formField('Email', _email, keyboardType: TextInputType.emailAddress),
        formField('Address', _address),
        formField('Business / service type', _serviceType),
        const SizedBox(height: 18),
        PurpleButton('Continue', onTap: () async {
          await widget.runApi('Submitting business profile', (client, state) {
            return client.completeBusinessOnboarding(
              buildBusinessOnboardingPayload(
                businessName: _businessName.text.trim(),
                ownerName: _ownerName.text.trim(),
                phone: _phone.text.trim(),
                email: _email.text.trim(),
                address: _address.text.trim(),
                serviceType: _serviceType.text.trim(),
              ),
            );
          });
          widget.go(Screen.businessVerification);
        }),
      ],
    );
  }
}

class BusinessServicesScreen extends StatelessWidget {
  const BusinessServicesScreen({
    super.key,
    required this.go,
    required this.runApi,
  });

  final ValueChanged<Screen> go;
  final ApiRunner runApi;

  @override
  Widget build(BuildContext context) {
    return ScreenScaffold(
      title: 'Services & review',
      subtitle: 'Add coverage, lead rules, and required verification.',
      back: () => go(Screen.businessProfile),
      children: [
        const FlowNumber(2),
        const SizedBox(height: 18),
        field(
          'Services',
          'Doctor rides, pharmacy pickup, assisted transportation',
        ),
        field('Service area', '25 miles, 80124, 80126, 80129, 80202'),
        field('Lead capacity', '12 per day'),
        field('Verification', 'License and insurance required'),
        const SizedBox(height: 14),
        SoftCard(
          color: const Color(0xFFEAF4FF),
          child: const Row(
            children: [
              Icon(CupertinoIcons.checkmark_shield_fill, color: TsgColors.blue),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Business profiles are submitted for review before seniors can book.',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        PurpleButton('Continue', onTap: () => go(Screen.businessPricing)),
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

Map<String, dynamic> residentSurface(ResidentAppState? state) {
  return mapValue(state?.raw['residentSurface']);
}

Map<String, dynamic> residentSurfaceSection(
  ResidentAppState? state,
  String key,
) {
  return mapValue(residentSurface(state)[key]);
}

String surfaceText(Object? value, String fallback) {
  final text = stringValue(value);
  return text.isEmpty ? fallback : text;
}

double doubleValue(Object? value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  return double.tryParse(stringValue(value)) ?? fallback;
}

String _tomorrowLabel() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final tomorrow = DateTime.now().add(const Duration(days: 1));
  return '${months[tomorrow.month - 1]} ${tomorrow.day}';
}

Future<void> launchPhoneCall(String phone) async {
  final uri = Uri(scheme: 'tel', path: phone);
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
    throw Exception('Phone call could not be opened');
  }
}

Future<void> launchSms(String phone, {String body = ''}) async {
  final uri = Uri(
    scheme: 'sms',
    path: phone,
    queryParameters: body.isEmpty ? null : {'body': body},
  );
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
    throw Exception('Message composer could not be opened');
  }
}

Color contextSeverityColor(String severity) {
  final key = severity.toLowerCase();
  if (key.contains('high') || key.contains('emergency')) return TsgColors.red;
  if (key.contains('watch') || key.contains('medium')) return TsgColors.orange;
  if (key.contains('info')) return TsgColors.blue;
  return TsgColors.green;
}

IconData contextDomainIcon(String domain) {
  final key = domain.toLowerCase();
  if (key.contains('environment')) return CupertinoIcons.cloud_sun_fill;
  if (key.contains('transport')) return CupertinoIcons.car_detailed;
  if (key.contains('mobility')) return Icons.directions_walk_rounded;
  if (key.contains('social') || key.contains('isolation')) {
    return CupertinoIcons.person_2_fill;
  }
  if (key.contains('safety')) return CupertinoIcons.shield_fill;
  if (key.contains('medication')) return CupertinoIcons.capsule_fill;
  return CupertinoIcons.sparkles;
}

class ContextGuidanceCard extends StatelessWidget {
  const ContextGuidanceCard({super.key, required this.items});
  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    final guidance = items.isNotEmpty
        ? items.take(3).toList()
        : [
            {
              'domain': 'environment',
              'severity': 'watch',
              'title': 'High pollen today',
              'body': 'Limit outdoor activity this afternoon.',
            },
            {
              'domain': 'health',
              'severity': 'info',
              'title': 'Hydration reminder recommended',
              'body': 'Keep water nearby through the afternoon.',
            },
          ];
    return SoftCard(
      color: const Color(0xFFF8F3FF),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Avatar(
                size: 40,
                icon: CupertinoIcons.sparkles,
                tone: Color(0xFFEFE2FF),
              ),
              SizedBox(width: 12),
              Expanded(child: H1("Today's Guidance", size: 24)),
            ],
          ),
          const SizedBox(height: 14),
          ...guidance.map((item) {
            final domain = stringValue(item['domain']);
            final severity = stringValue(item['severity']);
            final color = contextSeverityColor(severity);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: .12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      contextDomainIcon(domain),
                      color: color,
                      size: 17,
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          surfaceText(item['title'], 'Guru guidance'),
                          style: const TextStyle(
                            fontSize: 16,
                            color: TsgColors.ink,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          surfaceText(item['body'], ''),
                          style: const TextStyle(
                            fontSize: 14,
                            height: 1.3,
                            color: TsgColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class ContextStatusGrid extends StatelessWidget {
  const ContextStatusGrid({super.key, required this.sections});
  final List<Map<String, dynamic>> sections;

  @override
  Widget build(BuildContext context) {
    final tiles = sections.isNotEmpty
        ? sections.take(5).toList()
        : [
            {'key': 'health', 'label': 'Health', 'status': 'Stable'},
            {
              'key': 'environment',
              'label': 'Environment',
              'status': 'Pollen High',
              'severity': 'watch',
            },
            {'key': 'mobility', 'label': 'Mobility', 'status': 'Normal'},
            {
              'key': 'social',
              'label': 'Social',
              'status': 'No family contact 4d',
              'severity': 'watch',
            },
            {'key': 'safety', 'label': 'Safety', 'status': 'Protected'},
          ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: tiles.map((tile) {
        final severity = stringValue(tile['severity']).isEmpty
            ? 'good'
            : stringValue(tile['severity']);
        final color = contextSeverityColor(severity);
        return Container(
          width: 106,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: color.withValues(alpha: .18)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x102D2038),
                blurRadius: 18,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                contextDomainIcon(stringValue(tile['key'] ?? tile['label'])),
                color: color,
                size: 18,
              ),
              const SizedBox(height: 7),
              Text(
                surfaceText(tile['label'], 'Status'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: TsgColors.muted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                surfaceText(tile['status'], 'Stable'),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: TsgColors.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  height: 1.15,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class HistoricalMissingCard extends StatelessWidget {
  const HistoricalMissingCard({super.key, required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      color: const Color(0xFFFFFBF4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(CupertinoIcons.exclamationmark_triangle_fill, color: TsgColors.orange),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(height: 5),
                Text(body, style: const TextStyle(color: TsgColors.muted, height: 1.3)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class HealthTrendPlaceholder extends StatelessWidget {
  const HealthTrendPlaceholder({super.key, required this.range, this.readings = const []});
  final String range;
  final List<Map<String, dynamic>> readings;

  @override
  Widget build(BuildContext context) {
    final values = readings
        .map((row) => doubleValue(
              row['heart_rate'] ??
                  row['heartRate'] ??
                  row['resting_heart_rate'] ??
                  row['value'],
            ))
        .where((value) => value > 0)
        .toList(growable: false);
    return SoftCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(CupertinoIcons.chart_bar_alt_fill, color: TsgColors.purple),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  range,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 92,
            child: values.length >= 2
                ? CustomPaint(
                    painter: SimpleLineChartPainter(values: values),
                    child: const SizedBox.expand(),
                  )
                : const Center(
                    child: Text(
                      'No chartable API history yet',
                      style: TextStyle(color: TsgColors.muted),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class SimpleLineChartPainter extends CustomPainter {
  const SimpleLineChartPainter({required this.values});
  final List<double> values;

  @override
  void paint(Canvas canvas, Size size) {
    final minValue = values.reduce(math.min);
    final maxValue = values.reduce(math.max);
    final span = math.max(1.0, maxValue - minValue);
    final gridPaint = Paint()
      ..color = TsgColors.line
      ..strokeWidth = 1;
    final linePaint = Paint()
      ..color = TsgColors.purple
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    for (var i = 0; i < 4; i++) {
      final y = size.height * i / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = values.length == 1 ? 0.0 : size.width * i / (values.length - 1);
      final y = size.height - ((values[i] - minValue) / span * size.height);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, linePaint);
  }

  @override
  bool shouldRepaint(covariant SimpleLineChartPainter oldDelegate) {
    return oldDelegate.values != values;
  }
}

class WellnessScreen extends StatefulWidget {
  const WellnessScreen({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  State<WellnessScreen> createState() => _WellnessScreenState();
}

class _WellnessScreenState extends State<WellnessScreen> {
  int selectedRange = 0;
  static const rangeLabels = ['Today', '7 Days', '30 Days', '90 Days'];

  @override
  Widget build(BuildContext context) {
    final wellness = residentSurfaceSection(widget.state, 'wellness');
    final scoreRow = mapValue(wellness['score']);
    final score = intValue(
      scoreRow['wellness_score'],
      fallback: 82,
    ).clamp(0, 100);
    final label = surfaceText(scoreRow['score_label'], wellnessLabel(score));
    final change = intValue(scoreRow['change_from_prior'], fallback: 6);
    final rows = [
      ('Sleep Recovery', 'Good', '+18', CupertinoIcons.moon_fill),
      ('Activity / Mobility', 'Good', '+15', Icons.directions_walk_rounded),
      ('Medication Adherence', 'Excellent', '+20', CupertinoIcons.capsule),
      ('Mood & Mind', 'Good', '+12', CupertinoIcons.smiley_fill),
      ('Heart Health', 'Good', '+17', CupertinoIcons.heart_fill),
    ];
    return ScreenScaffold(
      title: 'Wellness Contributors',
      back: () => widget.go(Screen.more),
      children: [
        Segmented(
          labels: rangeLabels,
          selected: selectedRange,
          onChanged: (index) => setState(() => selectedRange = index),
        ),
        const SizedBox(height: 22),
        if (selectedRange == 0)
          Center(
            child: WellnessScoreGauge(score: score, label: label),
          )
        else
          HistoricalMissingCard(
            title: '${rangeLabels[selectedRange]} wellness history',
            body:
                'No API-backed wellness score snapshots were returned for this range yet.',
          ),
        const SizedBox(height: 20),
        if (selectedRange == 0)
          Center(
            child: Text(
              wellnessChangeText(change),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, color: TsgColors.ink),
            ),
          )
        else
          HealthTrendPlaceholder(range: rangeLabels[selectedRange]),
        if (selectedRange != 0)
          const SizedBox(height: 12),
        if (selectedRange != 0)
          const Text(
            'Historical trend charts require saved daily wellness snapshots from the API.',
            style: TextStyle(color: TsgColors.muted, height: 1.3),
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

class WellnessScoreGauge extends StatelessWidget {
  const WellnessScoreGauge({
    super.key,
    required this.score,
    required this.label,
  });

  final int score;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = wellnessScoreColor(score);
    return SizedBox(
      width: 214,
      height: 214,
      child: CustomPaint(
        painter: WellnessRingPainter(score: score, color: color),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(38),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$score',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 56,
                    height: .92,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Wellness Score',
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: TsgColors.muted, fontSize: 14),
                ),
                const SizedBox(height: 8),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class WellnessRingPainter extends CustomPainter {
  const WellnessRingPainter({required this.score, required this.color});

  final int score;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final strokeWidth = math.max(12.0, size.width * .072);
    final inset = strokeWidth / 2;
    final rect = Rect.fromLTWH(
      inset,
      inset,
      size.width - strokeWidth,
      size.height - strokeWidth,
    );
    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = strokeWidth
      ..color = wellnessTrackColor(score);
    final progress = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = strokeWidth
      ..color = color;

    canvas.drawArc(rect, -math.pi / 2, math.pi * 2, false, track);
    canvas.drawArc(
      rect,
      -math.pi / 2,
      math.pi * 2 * (score.clamp(0, 100) / 100),
      false,
      progress,
    );
  }

  @override
  bool shouldRepaint(WellnessRingPainter oldDelegate) {
    return oldDelegate.score != score || oldDelegate.color != color;
  }
}

class VitalsScreen extends StatefulWidget {
  const VitalsScreen({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  State<VitalsScreen> createState() => _VitalsScreenState();
}

class _VitalsScreenState extends State<VitalsScreen> {
  int selectedRange = 0;
  static const rangeLabels = ['Today', '7 Days', '30 Days', '90 Days'];

  @override
  Widget build(BuildContext context) {
    final vitals = listOfMaps(
      residentSurfaceSection(widget.state, 'vitals')['monitor'],
    );
    final readings = listOfMaps(mapValue(widget.state?.raw['healthVitals'])['readings']);
    final rows = vitals;
    return ScreenScaffold(
      title: 'Vitals Monitor',
      back: () => widget.go(Screen.more),
      children: [
        Segmented(
          labels: rangeLabels,
          selected: selectedRange,
          onChanged: (index) => setState(() => selectedRange = index),
        ),
        const SizedBox(height: 16),
        if (selectedRange == 0)
          HealthTrendPlaceholder(
            range: readings.isEmpty ? 'No readings synced' : 'Latest readings',
            readings: readings,
          )
        else
          HistoricalMissingCard(
            title: '${rangeLabels[selectedRange]} vitals history',
            body: readings.isEmpty
                ? 'No wearable or Health Connect readings were returned by the API.'
                : 'Only ${readings.length} recent reading(s) were returned by the API. Historical range aggregation is not available yet.',
          ),
        const SizedBox(height: 16),
        if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(
              child: Text(
                'No vitals synced from health device.',
                style: TextStyle(color: TsgColors.muted),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ...rows.map(
          (v) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SoftCard(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Icon(
                    vitalIcon(stringValue(v['vital_key'])),
                    color: vitalColor(stringValue(v['vital_key'])),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                surfaceText(v['label'], 'Vital'),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            Text(
                              surfaceText(v['status_label'], 'Normal'),
                              style: const TextStyle(
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
                            text: surfaceText(v['value_text'], '0'),
                            style: const TextStyle(
                              color: TsgColors.ink,
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                            ),
                            children: [
                              TextSpan(
                                text: ' ${surfaceText(v['unit'], '')}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          surfaceText(
                            v['baseline_text'],
                            'Baseline unavailable',
                          ),
                          style: const TextStyle(
                            color: TsgColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(width: 92, child: miniChart()),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  IconData vitalIcon(String key) {
    if (key.contains('heart') || key == 'hrv') return CupertinoIcons.heart_fill;
    if (key.contains('oxygen')) return CupertinoIcons.drop_fill;
    if (key.contains('respiratory')) return Icons.air_rounded;
    if (key.contains('temperature')) return CupertinoIcons.thermometer;
    if (key.contains('pressure')) return CupertinoIcons.waveform_path_ecg;
    return CupertinoIcons.waveform_path_ecg;
  }

  Color vitalColor(String key) {
    if (key.contains('heart')) return TsgColors.red;
    if (key.contains('oxygen')) return TsgColors.blue;
    if (key.contains('respiratory')) return TsgColors.blue;
    if (key.contains('temperature')) return TsgColors.green;
    return TsgColors.purple;
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
  const FamilyHealthScreen({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    final family = residentSurfaceSection(state, 'familyHealth');
    final summaryItems = listOfMaps(family['summary_items']);
    final summary = summaryItems.isNotEmpty
        ? summaryItems
        : [
            {'label': 'Medication', 'value': 'All taken', 'status': 'good'},
            {'label': 'Sleep', 'value': '7h 14m', 'status': 'good'},
            {'label': 'Activity', 'value': '4,280 steps', 'status': 'watch'},
            {
              'label': 'Heart Rate',
              'value': '72 bpm resting',
              'status': 'good',
            },
            {'label': 'Mood', 'value': 'Good', 'status': 'good'},
            {'label': 'Hydration', 'value': 'Good', 'status': 'good'},
          ];
    final confidence = intValue(
      family['health_confidence_percent'],
      fallback: 87,
    );
    final residentName = state?.residentName ?? 'Resident';
    final residentInitial = residentName.trim().isNotEmpty
        ? residentName.trim().characters.first.toUpperCase()
        : 'R';
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
                  Avatar(
                    size: 58,
                    label: residentInitial,
                    tone: const Color(0xFFFFE0CC),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          residentName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const Text(
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
                  Expanded(
                    child: LinearProgressIndicator(
                      value: confidence / 100,
                      minHeight: 8,
                      backgroundColor: const Color(0x44FFFFFF),
                      color: const Color(0xFFA2E78A),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    '$confidence%',
                    style: const TextStyle(
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
                        Icon(
                          familyIcon(stringValue(s['label'])),
                          color: familyColor(stringValue(s['status'])),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            surfaceText(s['label'], 'Summary'),
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        Flexible(
                          child: Text(
                            surfaceText(s['value'], ''),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            textAlign: TextAlign.right,
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Icon(
                          familyColor(stringValue(s['status'])) ==
                                  TsgColors.green
                              ? CupertinoIcons.check_mark_circled_solid
                              : CupertinoIcons.exclamationmark_circle_fill,
                          color: familyColor(stringValue(s['status'])),
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

  IconData familyIcon(String label) {
    final key = label.toLowerCase();
    if (key.contains('med')) return CupertinoIcons.capsule;
    if (key.contains('sleep')) return CupertinoIcons.moon_fill;
    if (key.contains('activity')) return Icons.directions_walk_rounded;
    if (key.contains('heart')) return CupertinoIcons.heart_fill;
    if (key.contains('mood')) return CupertinoIcons.smiley_fill;
    if (key.contains('hydration')) return CupertinoIcons.drop_fill;
    return CupertinoIcons.check_mark_circled;
  }

  Color familyColor(String status) {
    return status.toLowerCase().contains('watch')
        ? TsgColors.orange
        : TsgColors.green;
  }
}

class RiskScreen extends StatelessWidget {
  const RiskScreen({super.key, required this.go, this.state});
  final ValueChanged<Screen> go;
  final ResidentAppState? state;

  @override
  Widget build(BuildContext context) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final now = DateTime.now();
    String dayLabel(int daysAgo) {
      final d = now.subtract(Duration(days: daysAgo));
      return '${months[d.month - 1]} ${d.day}';
    }
    final risks = [
      (
        'Today\n${dayLabel(0)}',
        'Normal',
        'All vitals and activities\nin normal range.',
        TsgColors.green,
      ),
      (
        dayLabel(1),
        'Reduced Activity',
        'Steps were 18% below\nyour usual range.',
        TsgColors.orange,
      ),
      (
        dayLabel(2),
        'Missed Medication',
        'Evening medication was\nmissed.',
        TsgColors.red,
      ),
      (
        dayLabel(3),
        'Low Sleep',
        'Slept 4h 52m which is\nbelow your usual.',
        TsgColors.purple,
      ),
      (
        dayLabel(4),
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
  const Segmented({
    super.key,
    required this.labels,
    required this.selected,
    this.onChanged,
  });
  final List<String> labels;
  final int selected;
  final ValueChanged<int>? onChanged;

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
            child: Semantics(
              button: onChanged != null,
              selected: active,
              label: labels[index],
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onChanged == null ? null : () => onChanged!(index),
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
              ),
            ),
          );
        }),
      ),
    );
  }
}
