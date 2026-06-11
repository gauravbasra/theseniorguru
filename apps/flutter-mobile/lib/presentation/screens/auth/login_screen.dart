import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:theseniorguru_mobile/core/routes/routes_name.dart';
import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
import 'package:theseniorguru_mobile/presentation/layouts/auth_layout.dart';
import 'package:theseniorguru_mobile/presentation/providers/auth/auth_providers.dart';
import 'package:theseniorguru_mobile/presentation/widgets/auth/auth_inter_link.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/form_fields/checkbox_field.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/form_fields/password_field.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/form_fields/radio_field.dart';
import '../../../core/utils/form_utils.dart';
import '../../../core/utils/validators.dart';
import '../../mixins/form_validators_mixin.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with FormValidatorsMixin {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();

  final FocusNode emailFocus = FocusNode();
  final FocusNode passwordFocus = FocusNode();

  final FocusNode buttonFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    // WidgetsBinding.instance.addPostFrameCallback((_)async{
    //   final token = await ref.read(notificationServiceProvider).getDeviceToken();
    //   ref.read(deviceTokenProvider.notifier).setToken(token);
    //   final vm  = ref.read(loginViewModel.notifier);
    //   await vm.loadRememberMe();
    //   final freshState = ref.read(loginViewModel);
    //   if(freshState.savedRememberMeData!=null){
    //     _emailController.text = freshState.savedRememberMeData?['email'];
    //     _passwordController.text = freshState.savedRememberMeData?['password'];
    //   }
    // });
  }

  Future<void> _handleLogin() async{
    final loginNotifier = ref.read(authProvider.notifier);
    if (_formKey.currentState!.validate()) {
      await loginNotifier.login(email: emailController.text, password:passwordController.text);
      final freshState = ref.read(authProvider);
      if (freshState.error != null) {
        // ToastService.errorToast(freshState.error!);
        // loginNotifier.clearError();
        return;
      }
      if(!mounted) return;
      print("Success");
      // context.goNamed(RoutesName.dashboard);
      // ToastService.successToast('Login successfully');
    }
  }

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();

    emailFocus.dispose();
    passwordFocus.dispose();

    buttonFocus.dispose();

    super.dispose();
  }

  static const labelToFieldSpacing = SizedBox(height: 6);
  static const fieldSpacing = SizedBox(height: 20);

  @override
  Widget build(BuildContext context) {
    final freshState = ref.watch(authProvider);
    print("freshState ${freshState.authResult?.token}");
    return AuthLayout(
      title: 'Welcome Back',
      des: "Sign in to access your health information \nand care services securely.",
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              const SizedBox(height: 10),

              _buildFieldLabel("Email Address"),
              labelToFieldSpacing,
              _buildEmailField(),

              fieldSpacing,

              _buildFieldLabel("Password"),
              labelToFieldSpacing,
              _buildPassword(),

              fieldSpacing,
              _buildRememberMe(),

              fieldSpacing,
              _buildLoginButton(),

              const SizedBox(height: 30),

              // _buildSecureSec(),
              // fieldSpacing,

              AuthInterLink(title: "Don\'t have an account? ", routeName: RoutesName.register, linkLabel:"Sign Up")
            ],
          ),
        ),
      ),
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
      validator: combineValidators([(v) => Validators.required(v, 'Password')]),
      onFieldSubmitted: (value) {
        FormUtils.fieldFocusChange(context, passwordFocus, buttonFocus);
      },
    );
  }

  Widget _buildRememberMe() {
    final loginState = ref.watch(authProvider);
    final loginNotifier = ref.read(authProvider.notifier);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        CheckboxField<int>(
          options: [
            ('Remember Me', 1),
            // FormFieldOption<int>(label: 'Remember Me', value: 1),
          ],
          onSelectionChange: (values) {
            final isSelected = values.isNotEmpty && values[0] == 1;
            loginNotifier.setRememberMe(isSelected);
          },
          initialSelected: loginState.isRememberMe ? [1] : [],
        ),

        // TextButton(onPressed: (){
        //   // context.goNamed(RoutesName.forgotPassword);
        // }, child: Text("Forgot Password ?", style: TextStyle(fontWeight: FontWeight.w500),))
      ],
    );
  }

  Widget _buildLoginButton() {
    final loginState = ref.watch(authProvider);
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        focusNode: buttonFocus,
        onPressed: loginState.loading ? null : _handleLogin,
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
            : const Text("Login"),
      ),
    );
  }

  Widget _buildSecureSec() {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: 10,
        children: [
          Icon(
            Icons.verified_user_outlined,
            color: theme.colorScheme.primary,
            size: 25,
          ),
          Text(
            "Secure login protected by \nenterprise-grade encryption.",
            style: theme.textTheme.bodySmall,
            textAlign: TextAlign.start,
          ),
        ],
      ),
    );
  }


}
