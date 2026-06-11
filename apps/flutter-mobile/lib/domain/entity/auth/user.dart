class User {
  final String id;
  final String email;
  final String phone;
  final String displayName;
  final String gender;
  final String? role;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? lastLoginAt;

  const User({
    required this.id,
    required this.email,
    required this.phone,
    required this.displayName,
    required this.gender,
    required this.role,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.lastLoginAt,
  });
}