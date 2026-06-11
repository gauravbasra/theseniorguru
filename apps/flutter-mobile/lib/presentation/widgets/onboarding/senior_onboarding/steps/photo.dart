// import 'package:flutter/cupertino.dart';
// import 'package:flutter/material.dart';
// import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
// import 'package:theseniorguru_mobile/core/theme/tsg_colors.dart';
// import 'package:theseniorguru_mobile/presentation/layouts/onboarding_layout.dart';
//
// class SeniorPhoto extends StatelessWidget{
//   const SeniorPhoto({super.key});
//
//   @override
//   Widget build(BuildContext context) {
//     final theme = Theme.of(context);
//     return OnboardingLayout(
//       step: 2,
//       title: "Photo",
//       subtitle:
//       "Let's add your photo so friends and \nfamily can recognize you.",
//
//       child: Column(
//         children: [
//           Stack(
//             clipBehavior: Clip.none,
//             alignment: Alignment.bottomRight,
//             children: [
//               CircleAvatar(
//                 radius: 100,
//                 backgroundColor: Colors.grey.shade200,
//                 child: Icon(
//                   CupertinoIcons.person_fill,
//                   size: 90,
//                   color: theme.colorScheme.primary,
//                 ),
//               ),
//
//               Container(
//                 width: 50,
//                 height: 50,
//                 decoration: BoxDecoration(
//                   color: theme.colorScheme.primary.withValues(alpha: 0.08),
//                   shape: BoxShape.circle,
//                   border: Border.all(
//                     color: Colors.white,
//                     width: 3,
//                   ),
//                 ),
//                 child:  Icon(
//                   CupertinoIcons.camera_fill,
//                   color:theme.colorScheme.primary,
//                 ),
//               ),
//             ],
//           ),
//
//           const SizedBox(height: 60),
//
//          SizedBox(
//            width: double.infinity,
//            height: 48,
//            child: ElevatedButton(
//                onPressed: (){},
//                style: AppButtonTheme.primary(context),
//                child: Text("Take Photo")
//            ),
//          ),
//           const SizedBox(height: 20),
//           SizedBox(
//             width: double.infinity,
//             height: 48,
//             child: OutlinedButton(
//               onPressed: () {},
//               style: AppButtonTheme.outlineMuted,
//               child: const Text('Upload Photo'),
//             ),
//           )
//         ],
//       ),
//     );
//   }
// }

import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
import 'package:theseniorguru_mobile/core/theme/tsg_colors.dart';
import 'package:theseniorguru_mobile/presentation/layouts/onboarding_layout.dart';
import 'package:theseniorguru_mobile/presentation/widgets/common/buttons/primary.dart';

class SeniorPhoto extends StatefulWidget {
  const SeniorPhoto({super.key});

  @override
  State<SeniorPhoto> createState() => _SeniorPhotoState();
}

class _SeniorPhotoState extends State<SeniorPhoto> {
  final ImagePicker _picker = ImagePicker();

  File? _selectedImage;

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        imageQuality: 80,
        maxWidth: 1200,
      );

      if (image == null) return;

      setState(() {
        _selectedImage = File(image.path);
      });
    } catch (e) {
      debugPrint("Image picker error: $e");
    }
  }

  void _showImagePickerBottomSheet() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Wrap(
              children: [
                ListTile(
                  leading: const Icon(Icons.camera_alt),
                  title: const Text("Take Photo"),
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.camera);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.photo_library),
                  title: const Text("Upload Photo"),
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.gallery);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return OnboardingLayout(
      step: 2,
      title: "Photo",
      subtitle:
      "Let's add your photo so friends and family can recognize you.",
      child: Column(
        children: [
          GestureDetector(
            onTap: _showImagePickerBottomSheet,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.bottomRight,
              children: [
                CircleAvatar(
                  radius: 100,
                  backgroundColor: Colors.grey.shade200,
                  backgroundImage: _selectedImage != null
                      ?  FileImage(_selectedImage!)
                      : null,
                  child: _selectedImage == null
                      ? Icon(
                    CupertinoIcons.person_fill,
                    size: 90,
                    color: theme.colorScheme.primary,
                  )
                      : null,
                ),

                if(_selectedImage == null) Container(
                  width: 54,
                  height: 54,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withOpacity(0.1),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white,
                      width: 3,
                    ),
                  ),
                  child: Icon(
                    CupertinoIcons.camera_fill,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ],
            ),
          ),


          if(_selectedImage == null) ...[
            const SizedBox(height: 60),
            PrimaryButton(
                onPressed: () {
                  _pickImage(ImageSource.camera);
                },
                label: "Take Photo"
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              height: 50,
              child: OutlinedButton(
                style: AppButtonTheme.outlineMuted,
                onPressed: () {
                  _pickImage(ImageSource.gallery);
                },
                child: const Text("Upload Photo"),
              ),
            ),
          ],

          if (_selectedImage != null) ...[
            const SizedBox(height: 34),

            _changePhoto(),
            const SizedBox(height: 10),

            Text(
              "Photo selected successfully",
              style: TextStyle(
                color: Colors.green.shade700,
                fontWeight: FontWeight.w600,
              ),
            ),

            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: AppButtonTheme.primary(context),
                onPressed: () {
                  // TODO:
                  // Upload image to API
                  // ref.read(onboardingProvider.notifier)
                  //    .uploadProfileImage(_selectedImage!);
                },
                child: const Text("Continue"),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _changePhoto(){
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: () {
        _showImagePickerBottomSheet();
      },
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(
            CupertinoIcons.pencil,
            color: TsgColors.blue,
            size: 18, // match size to fit
          ),
          SizedBox(width: 4), // small spacing between icon and text
          Text(
            'Change',
            style: theme.textTheme.titleMedium?.copyWith(
              color: TsgColors.blue,
            ),
          ),
        ],
      ),
    );
  }
}