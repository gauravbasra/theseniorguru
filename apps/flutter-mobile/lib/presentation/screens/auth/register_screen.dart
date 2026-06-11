import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:theseniorguru_mobile/core/routes/routes_name.dart';
import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
import 'package:theseniorguru_mobile/presentation/layouts/auth_layout.dart';
import 'package:theseniorguru_mobile/presentation/providers/auth/auth_providers.dart';
import 'package:theseniorguru_mobile/presentation/widgets/auth/auth_inter_link.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/form_fields/password_field.dart';
import '../../../core/utils/form_utils.dart';
import '../../../core/utils/validators.dart';
import '../../mixins/form_validators_mixin.dart';
import '../../utils/toast_service.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<RegisterScreen>
    with FormValidatorsMixin {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController nameController = TextEditingController();
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final TextEditingController confirmPasswordController =
      TextEditingController();

  final FocusNode nameFocus = FocusNode();
  final FocusNode phoneFocus = FocusNode();
  final FocusNode emailFocus = FocusNode();
  final FocusNode passwordFocus = FocusNode();
  final FocusNode confirmPasswordFocus = FocusNode();
  final FocusNode buttonFocus = FocusNode();
  String selectedGender = '';

  @override
  void initState() {
    super.initState();
  }

  Future<void> _handleRegister() async {
    final loginNotifier = ref.read(authProvider.notifier);



    if (_formKey.currentState!.validate()) {
      if (passwordController.text != confirmPasswordController.text) return;
      print("sagar");
      await loginNotifier.register(
        email: emailController.text,
        phone: phoneController.text,
        fullName: nameController.text,
        gender: selectedGender,
        password: passwordController.text,
      );
      if (!mounted) return;
      final freshState = ref.read(authProvider);
      if (freshState.error != null) {
        // ToastService.errorToast(freshState.error!);
        // loginNotifier.clearError();
        return;
      }
      if (!mounted) return;
      context.goNamed(RoutesName.roleSelection);
      ToastService.successToast('Register successfully');
    }
  }

  @override
  void dispose() {
    nameController.dispose();
    phoneController.dispose();
    emailController.dispose();
    passwordController.dispose();
    confirmPasswordController.dispose();

    nameFocus.dispose();
    phoneFocus.dispose();
    emailFocus.dispose();
    passwordFocus.dispose();
    confirmPasswordFocus.dispose();
    buttonFocus.dispose();

    super.dispose();
  }

  static const labelToFieldSpacing = SizedBox(height: 6);
  static const fieldSpacing = SizedBox(height: 20);
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final registerState = ref.watch(authProvider);
    return AuthLayout(
      title: 'Create Your Account',
      des: "Join Senior GURU to manage care, appointments and family support.",
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              const SizedBox(height: 6),
             if(registerState.error != null) Text("${registerState.error}", style: TextStyle(color: Colors.red),),
              _buildFieldLabel("Full Name"),
              labelToFieldSpacing,
              _buildNameField(),

              fieldSpacing,

              _buildFieldLabel("Phone Number"),
              labelToFieldSpacing,
              _buildPhoneField(),

              fieldSpacing,

              _buildFieldLabel("Email Address"),
              labelToFieldSpacing,
              _buildEmailField(),

              fieldSpacing,

              _buildFieldLabel("Password"),
              labelToFieldSpacing,
              _buildPassword(),

              fieldSpacing,

              _buildFieldLabel("Confirm Password"),
              labelToFieldSpacing,
              _buildConfirmPassword(),

              fieldSpacing,
              // _buildRememberMe(),
              //
              // fieldSpacing,
              _buildFieldLabel("Gender"),
              labelToFieldSpacing,
              Row(
                spacing: 10,
                children: [
                  _genderOption(value: 'male', label: 'Male', theme: theme),
                  _genderOption(value: 'female', label: 'Female', theme: theme),
                  _genderOption(value: 'other', label: 'Other', theme: theme),
                ],
              ),

              fieldSpacing,
              _buildLoginButton(),

              const SizedBox(height: 24),

              AuthInterLink(
                title: "Already have an account? ",
                routeName: RoutesName.login,
                linkLabel: "Log In",
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNameField() {
    return TextFormField(
      focusNode: nameFocus,
      controller: nameController,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      decoration: InputDecoration(hintText: "Enter your full name"),
      validator: combineValidators([Validators.required]),
      onFieldSubmitted: (value) {
        FormUtils.fieldFocusChange(context, nameFocus, phoneFocus);
      },
    );
  }

  Widget _buildPhoneField() {
    return TextFormField(
      keyboardType: TextInputType.phone,
      focusNode: phoneFocus,
      controller: phoneController,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      decoration: InputDecoration(hintText: "Enter your phone Number"),
      validator: combineValidators([Validators.phone]),
      onFieldSubmitted: (value) {
        FormUtils.fieldFocusChange(context, phoneFocus, emailFocus);
      },
    );
  }

  Widget _buildEmailField() {
    return TextFormField(
      keyboardType: TextInputType.emailAddress,
      focusNode: emailFocus,
      controller: emailController,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      decoration: InputDecoration(hintText: "Enter email address"),
      validator: combineValidators([Validators.email]),
      onFieldSubmitted: (value) {
        FormUtils.fieldFocusChange(context, emailFocus, passwordFocus);
      },
    );
  }

  Widget _buildFieldLabel(String label) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(label, style: TextStyle(fontWeight: FontWeight.w500)),
    );
  }

  Widget _buildPassword() {
    return PasswordField(
      focus: passwordFocus,
      controller: passwordController,
      validator: combineValidators([(v) => Validators.password(v)]),
      onFieldSubmitted: (value) {
        FormUtils.fieldFocusChange(
          context,
          passwordFocus,
          confirmPasswordFocus,
        );
      },
    );
  }

  Widget _buildConfirmPassword() {
    return PasswordField(
      focus: confirmPasswordFocus,
      controller: confirmPasswordController,
      hintText: "Re-enter your password",
      validator: combineValidators([
        (v) => Validators.required(v, 'Confirm Password'),
        (v) {
          if (v != passwordController.text) {
            return 'Passwords do not match';
          }
          return null;
        },
      ]),
      onFieldSubmitted: (value) {
        FormUtils.fieldFocusChange(context, confirmPasswordFocus, buttonFocus);
      },
    );
  }

  Widget _buildLoginButton() {
    final loginState = ref.watch(authProvider);

    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        focusNode: buttonFocus,
        onPressed: loginState.loading ? null : _handleRegister,
        style: AppButtonTheme.primary(context),
        child: loginState.loading
            ? const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(width: 8),
                  Text("Please wait..."),
                ],
              )
            : const Text("Create Account"),
      ),
    );
  }

  Widget _genderOption({
    required String value,
    required String label,
    required ThemeData theme,
  }) {
    final isSelected = selectedGender == value;

    return GestureDetector(
      onTap: () {
        setState(() {
          selectedGender = value;
        });
      },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
            color: isSelected ? theme.colorScheme.primary : Colors.black,
            size: 18,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(color: Colors.black, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
