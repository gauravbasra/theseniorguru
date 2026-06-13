import 'package:geolocator/geolocator.dart';

/// Provides the resident's live phone location for Guru chat (weather and
/// local service search). The senior may be away from home — at a relative's
/// house, on a trip — so we always prefer fresh GPS over a stored address.
class LocationService {
  LocationService._();
  static final LocationService instance = LocationService._();

  Position? _lastPosition;
  DateTime? _lastFetchedAt;
  static const _freshness = Duration(minutes: 5);

  /// Returns {lat, lon} from the phone's GPS, or null if location is
  /// unavailable/denied. Uses a short-lived cache so rapid chat messages
  /// don't each trigger a fresh GPS fix.
  Future<({double lat, double lon})?> getCurrentLatLon() async {
    final cached = _lastPosition;
    final fetchedAt = _lastFetchedAt;
    if (cached != null &&
        fetchedAt != null &&
        DateTime.now().difference(fetchedAt) < _freshness) {
      return (lat: cached.latitude, lon: cached.longitude);
    }

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return _fallbackToLastKnown();

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return _fallbackToLastKnown();
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 8),
        ),
      );
      _lastPosition = position;
      _lastFetchedAt = DateTime.now();
      return (lat: position.latitude, lon: position.longitude);
    } catch (_) {
      return _fallbackToLastKnown();
    }
  }

  Future<({double lat, double lon})?> _fallbackToLastKnown() async {
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last == null) return null;
      _lastPosition = last;
      _lastFetchedAt = DateTime.now();
      return (lat: last.latitude, lon: last.longitude);
    } catch (_) {
      return null;
    }
  }
}
