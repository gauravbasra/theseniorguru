import 'package:flutter/material.dart';

class AssetsImage extends StatelessWidget {
  final String path;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Color? color;
  const AssetsImage({
    super.key,
    required this.path,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.color,
  });

  bool get _isSvg => path.toLowerCase().endsWith(".svg");

  @override
  Widget build(BuildContext context) {
    if (_isSvg) {
      return SizedBox();
      // return  SvgPicture.asset(
      //   path,
      //   width: width,
      //   height: height,
      //   fit: fit,
      //   colorFilter:
      //   color != null ? ColorFilter.mode(color!, BlendMode.srcIn) : null,
      //   placeholderBuilder: (context) => SizedBox(
      //     width: width,
      //     height: height,
      //     child: const Center(
      //       child: SizedBox(
      //         width: 16,
      //         height: 16,
      //         child: CircularProgressIndicator(strokeWidth: 2),
      //       ),
      //     ),
      //   ),
      // );
    } else {
      return Image.asset(
        path,
        width: width,
        height: height,
        fit: fit,
        color: color,
      );
    }
  }
}