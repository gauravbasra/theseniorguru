class UserModel {
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
  const UserModel({
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

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      email: json['email'],
      phone: json['phone'],
      displayName: json['displayName'],
      gender: json['gender'],
      role: json['role'],
      status: json['status'],
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
      lastLoginAt: json['lastLoginAt'] != null
          ? DateTime.parse(json['lastLoginAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'phone': phone,
      'displayName': displayName,
      'gender': gender,
      'role': role,
      'status': status,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'lastLoginAt': lastLoginAt?.toIso8601String(),
    };
  }
}