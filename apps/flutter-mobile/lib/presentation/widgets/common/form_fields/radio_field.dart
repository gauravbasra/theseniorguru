import 'package:flutter/material.dart';


class RadioField extends StatelessWidget{
  final bool selected;
  final VoidCallback onChanged;
  const RadioField({super.key, required this.onChanged,required this.selected});

  @override
  Widget build(BuildContext context) {
    final primaryColor = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: onChanged,
      child: Row(
        children: [
          Container(
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: primaryColor),
              color: selected ? primaryColor : Colors.transparent,
            ),
            child: Center(
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected ? Colors.white : Colors.transparent,
                ),
              ),
            ),
          )
        ],
      ),
    );
  }
}