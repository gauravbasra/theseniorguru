// import 'dart:async';
// import 'package:outreachhub_app/core/network/socket_config.dart';
// import 'package:socket_io_client/socket_io_client.dart' as io;
//
// class SocketService {
//   final SocketConfig _config;
//   io.Socket? _socket;
//
//   final _eventController = StreamController<Map<String, dynamic>>.broadcast();
//
//    SocketService(this._config);
//
//   Stream<Map<String, dynamic>> get eventStream=>_eventController.stream;
//
//   void connect() {
//     if (_socket != null) return;
//     _socket = io.io(_config.serverUrl, <String, dynamic>{
//       'autoConnect': false,
//       'transports': ['websocket'],
//     });
//
//     _socket!.onConnect((_){
//       print('Socket connected');
//       _socket?.emit('join_client_room', { 'client_id': "k9aAU7vaixKXzWYd" });
//
//     });
//     _socket!.onDisconnect((_) => print('Socket disconnected'));
//
//     _socket!.connect();
//
//     for (final eventName in _config.eventNames){
//       _socket!.on(eventName, (data){
//           _eventController.add({
//             'event': eventName,
//             'data': data,
//           });
//           _config.additionalHandlers?[eventName]?.call(data);
//       });
//     }
//
//     // _socket!.on('client_message_update', (data)=>{
//     //   _eventController.add({
//     //     'event':'message',
//     //     'data' : data
//     //   }),
//     //   print("Message received $data")
//     // });
//     // _socket?.on('client_activity_update', (data){
//     //   _eventController.add({
//     //     'event': 'activity',
//     //     'data' : data
//     //   });
//     //   print("client_activity_update client_activity_update client_activity_update $data");
//     // });
//     //
//     // _socket?.on('mode_updated', (data){
//     //   _eventController.add({
//     //     'event': 'chat_mode_update',
//     //     'data' :data
//     //   });
//     //   print("socket.on mode_updated mode_updated mode_updated $data");
//     // });
//   }
//
//   void disconnect(){
//     _socket?.disconnect();
//   }
//
//   void on(String event, Function(dynamic) callback){
//     _socket?.on(event, callback);
//   }
//
//   void emit(String event, dynamic data) {
//     _socket?.emit(event, data);
//   }
//
//   void dispose() {
//     disconnect();
//     _eventController.close();
//   }
//
// }