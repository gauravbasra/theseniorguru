import 'package:flutter/material.dart';


class CheckboxField<T> extends StatefulWidget {
  final List<(String, T)> options;
  final List<T>? initialSelected;
  final void Function(List<T> selectedValue)? onSelectionChange;
  const CheckboxField({
    required this.options,
    this.initialSelected,
    this.onSelectionChange,
    super.key,
  });

  @override
  State<CheckboxField<T>> createState() => _CheckboxFieldState<T>();
}

class _CheckboxFieldState<T> extends State<CheckboxField<T>> {
  late List<T> selectedValues;

  @override
  void initState() {
    super.initState();
    selectedValues = widget.initialSelected != null
        ? List<T>.from(widget.initialSelected!)
        : [];
  }

  @override
  void didUpdateWidget(covariant CheckboxField<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialSelected != oldWidget.initialSelected) {
      selectedValues = widget.initialSelected != null
          ? List<T>.from(widget.initialSelected!)
          : [];
    }
  }

  void _onItemChange(bool? checked, T value) {
    setState(() {
      if (checked == true) {
        if (!selectedValues.contains(value)) {
          selectedValues.add(value);
        }
      } else {
        selectedValues.remove(value);
      }
    });

    if (widget.onSelectionChange != null) {
      widget.onSelectionChange!(selectedValues);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: widget.options.map((option) {
        final isChecked = selectedValues.contains(option.$2);
        return GestureDetector(
          onTap: () => _onItemChange(!isChecked, option.$2),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Checkbox(
                  checkColor: theme.colorScheme.onPrimary,
                  activeColor: theme.colorScheme.primary,
                  side: const BorderSide(width: 1.5, color: Colors.black45),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadiusGeometry.circular(2),
                  ),
                  value: isChecked,
                  onChanged: (checked) => _onItemChange(checked, option.$2),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                ),
                const SizedBox(width: 4),
                Text(option.$1, style: TextStyle(fontWeight: FontWeight.w500),),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

