import 'package:flutter/material.dart';

class DateField extends StatefulWidget {
  const DateField({super.key});

  @override
  State<DateField> createState() => _DateFieldScreenState();
}

class _DateFieldScreenState extends State<DateField> {
  final TextEditingController _dateController = TextEditingController();

  @override
  void dispose() {
    _dateController.dispose();
    super.dispose();
  }
  Future<void> _selectDate(BuildContext context) async {
    final DateTime? pickedDate = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );

    // 3. Format and update the text field text if a date was selected
    if (pickedDate != null) {
      setState(() {
        // Simple manual formatting: YYYY-MM-DD
        _dateController.text = "${pickedDate.toLocal()}".split(' ')[0];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: _dateController,
      readOnly: true,
      onTap: () => _selectDate(context),
      decoration: const InputDecoration(
        hintText: 'YYYY-MM-DD',
        prefixIcon: Icon(Icons.calendar_today, size: 18,),
        border: OutlineInputBorder(),
      ),
    );
  }
}