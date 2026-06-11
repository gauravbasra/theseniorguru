import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:theseniorguru_mobile/presentation/layouts/layouts.dart';

import '../../../core/theme/tsg_colors.dart';

class GuruHomeScreen extends StatelessWidget {
  const GuruHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // final requests = [
    //   (CupertinoIcons.car_detailed, 'I need a ride', Screen.rideChat),
    //   (CupertinoIcons.capsule, 'I need medication help', Screen.medications),
    //   (CupertinoIcons.bag, 'I need food', Screen.services),
    //   (CupertinoIcons.sparkles, 'I need cleaning', Screen.services),
    //   (CupertinoIcons.doc_text_search, 'I need diapers', Screen.services),
    //   (CupertinoIcons.heart, 'Feeling lonely', Screen.companionChat),
    // ];
    return Scaffold(
      body: PhoneFrame(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 10),
                Text("How can we help?", style: theme.textTheme.headlineLarge,),
                const SizedBox(height: 20,),
                _buildSearchBox()
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBox(){
    return Container(
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
    );
  }
}