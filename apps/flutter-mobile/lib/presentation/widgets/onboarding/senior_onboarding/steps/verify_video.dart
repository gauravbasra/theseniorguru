// import 'package:flutter/cupertino.dart';
// import 'package:flutter/material.dart';
// import 'package:theseniorguru_mobile/core/theme/button_theme.dart';
// import 'package:theseniorguru_mobile/presentation/layouts/onboarding_layout.dart';
//
// class VerifyVideo extends StatelessWidget{
//   const VerifyVideo({super.key});
//
//   @override
//   Widget build(BuildContext context) {
//     final theme = Theme.of(context);
//     return OnboardingLayout(
//       step: 3,
//       title: "Verify (Video)",
//       subtitle:
//       "Lets verify it's you for your safety.",
//
//       child: Column(
//         children: [
//           const SizedBox(height: 20),
//           Center(
//             child: CircleAvatar(
//               radius: 100,
//               backgroundColor: Colors.black.withValues(alpha:0.05),
//               child: Center(
//                 child: Icon(CupertinoIcons.video_camera_solid, size: 120,),
//               ),
//               // backgroundImage: AssetImage(
//               //   "assets/images/profile.png",
//               // ),
//             ),
//           ),
//           const SizedBox(height: 20),
//           Text("00:05", style: theme.textTheme.bodyMedium,),
//
//           const SizedBox(height: 30),
//
//           Text("Turn Your head to right", style: TextStyle(
//             fontSize: 18,
//             color: theme.colorScheme.primary,
//             fontWeight: FontWeight.w500
//           ),),
//           const SizedBox(height: 50),
//           Row(
//             mainAxisAlignment: MainAxisAlignment.center,
//             spacing: 30,
//             children: [
//                 Container(
//                   width: 40,
//                   height: 40,
//                   decoration: BoxDecoration(
//                     borderRadius: BorderRadius.circular(8),
//                     color: theme.colorScheme.primary.withValues(alpha: 0.06),
//                   ),
//                   child: Center(
//                     child: Icon(Icons.arrow_forward_rounded, color: theme.colorScheme.primary,),
//                   ),
//                 ),
//
//               Container(
//                 width: 40,
//                 height: 40,
//                 decoration: BoxDecoration(
//                   borderRadius: BorderRadius.circular(8),
//                   color: theme.colorScheme.primary.withValues(alpha: 0.06),
//                 ),
//                 child: Center(
//                   child: Icon(Icons.check, color: theme.colorScheme.primary,),
//                 ),
//               )
//             ],
//           )
//           // SizedBox(
//           //   width: double.infinity,
//           //   height: 50,
//           //   child: ElevatedButton(
//           //       onPressed: (){},
//           //       style: AppButtonTheme.primary(context),
//           //       child: Text("Take Photo")
//           //   ),
//           // ),
//           // const SizedBox(height: 20),
//           // SizedBox(
//           //   width: double.infinity,
//           //   height: 50,
//           //   child: OutlinedButton(
//           //     onPressed: () {},
//           //     style: AppButtonTheme.outlineMuted,
//           //     child: const Text('Upload Photo'),
//           //   ),
//           // )
//         ],
//       ),
//     );
//   }
// }

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

class VerifyVideo extends StatefulWidget {
  const VerifyVideo({super.key});

  @override
  State<VerifyVideo> createState() => _VerifyVideoDemoState();
}

class _VerifyVideoDemoState extends State<VerifyVideo> {
  CameraController? _controller;

  final FaceDetector _faceDetector = FaceDetector(
    options: FaceDetectorOptions(
      enableClassification: true,
      enableTracking: true,
    ),
  );

  bool _processing = false;

  String instruction = "Place your face in frame";
  bool verified = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    final cameras = await availableCameras();

    final frontCamera = cameras.firstWhere(
          (camera) => camera.lensDirection == CameraLensDirection.front,
    );

    _controller = CameraController(
      frontCamera,
      ResolutionPreset.medium,
      enableAudio: false,
    );

    await _controller!.initialize();

    await _controller!.startImageStream(_processCameraImage);

    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _processCameraImage(CameraImage image) async {
    if (_processing || verified) return;

    _processing = true;

    try {
      // NOTE:
      // For a real app you must convert CameraImage
      // to InputImage properly.
      //
      // This demo only shows verification logic.

      setState(() {
        instruction = "Turn your head right";
      });

      // Fake success after few seconds
      await Future.delayed(const Duration(seconds: 3));

      if (!mounted) return;

      setState(() {
        verified = true;
        instruction = "Verification Complete";
      });
    } catch (_) {} finally {
      _processing = false;
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    _faceDetector.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null ||
        !_controller!.value.isInitialized) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text("Face Verification"),
      ),
      body: Column(
        children: [
          Expanded(
            child: CameraPreview(_controller!),
          ),

          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Text(
                  instruction,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                  ),
                ),

                const SizedBox(height: 16),

                Icon(
                  verified
                      ? Icons.check_circle
                      : Icons.face,
                  size: 60,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}