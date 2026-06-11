class SocketConfig {
  final String serverUrl;
  final List<String> eventNames;
  final Map<String, Function(dynamic)>? additionalHandlers;

  SocketConfig({
    required this.serverUrl,
    this.eventNames = const [],
    this.additionalHandlers,
  });
}