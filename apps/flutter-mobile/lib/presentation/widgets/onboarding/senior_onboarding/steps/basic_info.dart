import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
import 'package:theseniorguru_mobile/presentation/layouts/onboarding_layout.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/form_fields/date_field.dart';

class BasicInfo extends StatelessWidget{
  const BasicInfo({super.key});
  final  labelSpacer = const SizedBox(height: 5,);
  final  fieldSpacer = const SizedBox(height: 18);
  @override
  Widget build(BuildContext context) {
    final formKey = GlobalKey<FormState>();
    final theme = Theme.of(context);
    return OnboardingLayout(
      step: 4,
      title: "Basic Info",
      subtitle:
      "Tell me a bit about you.",

      child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildFormLabel(theme, "Full Name"),
              labelSpacer,
             TextFormField(
               decoration: InputDecoration(
                 hintText: "Full Name"
               ),
             ),

              fieldSpacer,

              _buildFormLabel(theme, "Date of Birth"),
              labelSpacer,
              DateField(),
              fieldSpacer,

              _buildFormLabel(theme, "Phone Number"),
              labelSpacer,
              TextFormField(
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                    hintText: "Phone Number"
                ),
              ),

              fieldSpacer,

              _buildFormLabel(theme, "Email Address"),
              labelSpacer,
              TextFormField(
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                    hintText: "Email Address"
                ),
              ),
              fieldSpacer,
              _buildFormLabel(theme, "Address"),
              labelSpacer,
              TextFormField(
                minLines: 3,
                maxLines: 5,
                keyboardType: TextInputType.multiline,
                decoration: InputDecoration(
                  hintText: "Address",

                ),
              ),

              const SizedBox(height: 40,),
             SizedBox(
               width: double.infinity,
               height: 48,
               child:  ElevatedButton(
                   onPressed: (){},
                   style: AppButtonTheme.primary(context),
                   child: Text("Continue")
               ),
             )


            ],
          ),
      ),
    );
  }


  Widget _buildFormLabel (ThemeData theme, String label){
    return Text(label, style: theme.textTheme.bodySmall,);
  }

}