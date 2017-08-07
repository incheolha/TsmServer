
//각종 필요 전역변수 모듈 선언

var express = require('express');
var http = require('http');
var path = require('path');

var dateFormat = require('dateformat');
var fs = require('fs');
var gm = require('gm');

var captchapng = require('captchapng');
var mysql = require('mysql');

var cors = require('cors');                                                     // cross origin 연결 허용 

var app = express();


//var PROTO_PATH = __dirname+'/../Spark.I/proto/main.proto'

var PROTO_PATH = __dirname+'/proto/main.proto';
const grpc = require('grpc');
const proto = grpc.load(PROTO_PATH).main;

var server = new grpc.Server();                                                // grpc.Server 전역변수 선언


var conn = require('./db');

var mainProto = require('./mainProto');                          // GRPC proto main service 실행
var boardProto = require('./boardProto');
var userProto = require('./userProto');
var conversationProto = require('./conversationProto');

app.use(cors());                                                               // cors 미들웨어 사용


process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err.stack);
    //more error info
    //console.log('Caught exception: ' + err.stack);
});

// socket 서버 구동 함수 

var httpServer = http.createServer(app).listen(9004, function(req, res) {
    console.log('express server가 시작되었습니다.......');
    app.setMaxListeners(0);                                                           // 웹서버 memory leaking 현상방지
});

var io = require('socket.io').listen(httpServer,{pingTimeout: 1000, pingInterval: 1000});
// var io = require('socket.io').listen(9004);

io.sockets.setMaxListeners(0);                                                      // Disable memory leak 현상 발생 제거
var apn = require('apn');
var moment = require('moment');


//애플 push메세지 연결모드 설정

var apnProvider = new apn.Provider({
     token: {
        key: __dirname+'/certificate/APNsAuthKey_W77PTWR5NP.p8',
        keyId: 'W77PTWR5NP',
        teamId: 'Q2U9LDN4EX',
    },
    production: true                                                               // Set to true if sending a notification to a production iOS app
});


// 채팅 클라이언트 명단 확보

var userList = [];                                                                        //사용자에 관한 정보를 저장하기위한 전역변수
io.sockets.on('connection', function(clientSocket){
  
  console.log('socket connection: ' + clientSocket.id);
        function getConnectedList(){
            let list = []
            for (let client in io.sockets.connected){
                list.push(client);
              }
              return list
            }


  // becomeActive 현재 활동중인 클라이언트 정보획득

                  var becomeActive = function(sender_id,push,silent,device_token) {                             //이 함수는 무조건 clientSocket.on 켜지기 전에 변수로 선언되어야 함
                    console.log('test: '+sender_id + ' - ' + push + ' - ' + silent + ' - ' + device_token);       //가입된 유저가 앱을켰거나 처음 회원가입하는 회원일때 invoke되어짐
                    
                    var info = new Object()
                    info.socket_id = clientSocket.id                                                              //클라이언트 소켓 아이디
                    info.user_id = sender_id                                                                      //sender Id 회원가입시 사용자 아이디
                    info.isOn = true                                                                              //메세지 송신자 디바이스가 켜있는지 여부확인
                    info.push = push                                                                              //푸쉬메세지
                    info.silent = silent                                                                          //무음 여부
                    info.device_token = device_token                                                              //디바이스 정보


                        if(userList.length == 0){
                          //서버가 재시작되었을때
                          console.log('becomeActive userList.length == 0');
                          userList.push(info)

                        }else{
                          for(var i = 0; i < userList.length; i++){

                            if(userList[i].user_id == sender_id){
                              console.log('becomeActive userList[i].user_id == sender_id');
                              userList[i].socket_id = clientSocket.id
                              userList[i].isOn = true
                                if(!userList[i].device_token){
                                  userList[i].device_token = device_token
                                }
                              break
                            }else{
                                if(i == userList.length - 1){
                                  console.log('becomeActive userList does not have ' + sender_id);
                                  userList.push(info)
                                  break
                                }
                            }
                          }
                        }



                    //console.log('becomeActive: ' + JSON.stringify(userList));

                    // 오프라인대 발생한 나에게 보내온 메세지를 서버에 저장되었다가 다시 온라인이 되면 table(holdmessage) 에 저장된 메세지를 다시 호출할때 사용

                    var receiveOfflineMessage = 'select * from holdedMessage where receiver_id = ?'
                    var deleteOfflineMessage = 'delete from holdedMessage where receiver_id = ?'
                    
                        conn.query(receiveOfflineMessage,[sender_id],function(err,rows){
                                if(err){
                                  console.log('receiveOfflineMessage error: ' + err);
                                }else{

                                      if(rows.length == 0){
                                          console.log('there is no offlineMessage on me');

                                      }else{
                                                                                  
                                            io.to(clientSocket.id).emit('newChatMessage',rows)
                                            conn.query(deleteOfflineMessage,[sender_id],function(err1,rows1){
                            
                                              if(err1){
                                                console.log('deleteOfflineMessage error: ' + err1);
                                              }else{
                                                console.log('deleteOfflineMessage success');
                                              }

                                            });
                                      };
                                };
                        });
                              
                  }

                  clientSocket.on('becomeActive',becomeActive)                                                      //실제 userList[]에 들어있는 활동하는 사용자 확보

  //sendMessage 처리함수


                  var sendMessage = function(c_id,sender_id,receiver_id,message,attachment_url,time,type){

                    var time1 = moment().format('YYYY-MM-DD kk:mm:ss')
                    var note = new apn.Notification();                                                              // apple push notification 객체생성
                    console.log('sendMessage: ' + getConnectedList());

                    for(var i = 0; i < userList.length; i++){

                      if(userList[i].user_id == receiver_id){
                            console.log('sendMessage user exist');
                            var info = new Object()
                            info.c_id = c_id                                                                      //대화시 발생하는 아이디
                            info.sender_id = sender_id                                                            //송신자 아이디
                            info.receiver_id = receiver_id                                                        //수신자 아이디   
                            info.message = message                                                                //채팅 메세지
                            info.attachment_url = attachment_url                                                  //사용자 프로파일 사진에 사용하는 url
                            info.time = time                                                                      //사용자 실시간 채팅 시간
                            info.type = type                                                                      //

                    /************   push notification 설정영역
                               사용자 디바이스가 무음 사용시 
                              사용자 디바이스가 무음이 아닌경우
                      */

                                  if(userList[i].silent == true){                                                               //무음 사용시
                                    //note.badge = 1;
                                    note.contentAvailable = false;
                                    note.topic = ".dhtprbs";
                                    note.alert = "New Message"
                                  }
                                  if(userList[i].silent == false){                                                             //무음 사용을 하지 않을시 기본값임
                                    //note.badge = 1;
                                    note.sound = "ping.aiff";
                                    note.topic = ".dhtprbs";
                                    note.alert = "New Message"

                                  }


                      /********        사용자 디바이스가 켜져있는지 여부확인후 설정
                                      
                                      userList[i].isOn == true    
                                                                  사용자 디바이스가 on상태인경우
                                                                  앱이 스크린상에 있을때(유저가 앱을 forground에서 실행하고 있을때
                                      userList[i].isOn == false
                                                                  사용자 디바이스가 꺼져있는경우userList[i].isOn == false 
                                                                  앱이 스크린상에 없을때(유저가 앱을 background에서 실행하고 있거나, 앱을 종료 시켰을 때)
                                                                  데이타베이스에 있는 holdeMessage테이블에 채팅 문자저장

                      **********/


                                  if(userList[i].isOn == true){                                                       
                                                                                                                      
                                              console.log('userList[i].isOn == true');
                                              if(io.sockets.connected[userList[i].socket_id] != undefined){
                                                console.log('io.sockets.connected['+userList[i].socket_id+'] is connected -> ' + getConnectedList());
                                              }else{
                                                console.log('io.sockets.connected['+userList[i].socket_id+'] is not connected -> '+ getConnectedList());
                                              }

                                      clientSocket.to(userList[i].socket_id).emit('newChatMessage',new Array(info))
                                      break

                                  }else{                                                                              

                                          var holdedMessage = 'insert into holdedMessage (c_id,sender_id,receiver_id,message,attachment_url,time,type) value (?,?,?,?,?,?,?)'
                                          
                                          conn.query(holdedMessage,[c_id,sender_id,receiver_id,message,attachment_url,time,type],function(err,rows){
                                            if(err){
                                              console.log('holdedMessage error in userList[i].push == true and isOn == false: ' + err);
                                            }else{
                                              console.log('holdedMessage success in userList[i].push == true and isOn == false');
                                            }
                                          });

                                            if(userList[i].push == true){
                                              //push message
                                                  apnProvider.send(note, userList[i].device_token).then( (response) => {
                                                      response.sent.forEach( (token) => {
                                                        console.log('response.sent: ' + JSON.stringify(response.sent));
                                                      });
                                                      response.failed.forEach( (failure) => {
                                                        if (failure.error) {
                                                          // A transport-level error occurred (e.g. network problem)
                                                          console.log('response.failed.error: ' + JSON.stringify(response.failed.error));
                                                        } else {
                                                          // `failure.status` is the HTTP status code
                                                          // `failure.response` is the JSON payload
                                                          console.log('response.failed: ' + JSON.stringify(response.failed));
                                                      }
                                                    })
                                                  })

                                                break

                                            }else{
                                              //userList[i].push == false
                                            }
                                  }
                          }else{
                                                                                                                //사용자가 없는 경우 userList[i].user_id != receiver_id
                                        if(i == userList.length - 1){
                                          console.log('user does not exist in sendMessage')
                                          break
                                        }
                          }
                        }

                        /* 채탱 대화를 엡데이트시 발생함
                            conversation table을 업데이트 시켜야만 함
                        */

                              var updateConversationUpdated = 'update conversation set updated=? where conversation_id=?'
                              conn.query(updateConversationUpdated,[time1,c_id],function(err,rows){
                                if(err){
                                  console.log('updateConversationUpdated error in sendMessage: '+err);
                                }else{
                                  console.log('updateConversationUpdated success in sendMessage');

                                }
                              })
                      }

                      clientSocket.on('sendMessage',sendMessage);

  
      // 백그라운드 작업 

                      var background = function(user_id){
                            console.log('background: ' + user_id);
                              for (var i=0; i<userList.length; i++) {
                                if (userList[i].user_id == user_id) {
                                  userList[i].isOn = false;
                                  break;
                                }
                              }
                      }
                      clientSocket.on('background',background)

// push 메세지 처리 

                        var pushTrue = function(user_id){
                              console.log('pushTrue: ' + user_id);
                              for(var i = 0; i < userList.length; i++){
                                if(userList[i].user_id == user_id){
                                  //console.log('pushTrue');
                                  userList[i].push = true
                                  break
                                }
                              }
                        }
                        clientSocket.on('pushTrue',pushTrue)

                      // push 메세지가 없을경우

                        var pushFalse = function(user_id){
                              console.log('pushFalse: ' + user_id);
                              for(var i = 0; i < userList.length; i++){
                                if(userList[i].user_id == user_id){
                                  //console.log('pushFalse');
                                  userList[i].push = false
                                  break
                                }
                              }
                        }
                        clientSocket.on('pushFalse',pushFalse)

// 디바이스 무음 처리

                        var silentTrue = function(user_id){
                              console.log('silentTrue: ' + user_id);
                              for(var i = 0; i < userList.length; i++){
                                if(userList[i].user_id == user_id){
                                  //console.log('silentTrue');
                                  userList[i].silent = true
                                  break
                                }
                              }
                        }
                        clientSocket.on('silentTrue',silentTrue)

                        var silentFalse = function(user_id){
                          console.log('silentFalse: ' + user_id);
                          for(var i = 0; i < userList.length; i++){
                            if(userList[i].user_id == user_id){
                              //console.log('silentFalse');
                              userList[i].silent = false
                              break
                            }
                          }
                                    //    clientSocket.removeListener('silentFalse',silentFalse)
                        }
                        clientSocket.on('silentFalse',silentFalse)

// 소켓 연결이 해제되는 경우 처리

                        var disconnect = function(){
                          for (var i=0; i<userList.length; i++) {
                            if (userList[i].socket_id == clientSocket.id) {
                              userList[i].isOn = false;
                              break;
                            }
                          }
                                  //    clientSocket.removeListener('connection',disconnect)
                          console.log('user disconnected: ' + clientSocket.id);
                        }

                        clientSocket.on('disconnect',disconnect)

// 비등록 클라이언트 처리

                      var unregister = function(user_id){

                            console.log('unregister: ' + user_id)
                            for(var i = 0; i < userList.length; i++){
                              if(userList[i].user_id == user_id){
                                userList.splice(i,1)
                                break
                              }
                            }
                      }
                      clientSocket.on('unregister',unregister)


//   //앱을 완전히 종료 시켰을때 (정지된 상태 아님)
//   clientSocket.on('disconnect', function(){
//
//     // for(var i = 0; i < userList.length; i++){
//     //   if(userList[i].user_id == user_id){
//     //     userList.splice(i,1)
//     //     break
//     //   }
//     // }
//
//     for (var i=0; i<userList.length; i++) {
//       if (userList[i].socket_id == clientSocket.id) {
//         userList[i].isOn = false;
//         break;
//       }
//     }
//     //clientSocket.removeAllListeners()
//     console.log('user disconnected: ' + clientSocket.id);
//   });
 });




//GRPC methods 설정하는 기능

/* 
    mainProto에 정의된 함수들
*/
//  앱 실행시 로봇인지 아닌지를 확인하기위해 인증숫자를 입력받은 기능
mainProto.getCaptcha;
// 사용자 프로파일 설정
mainProto.setUpProfile;
//사용자 프로파일 사진을 보내는 기능
mainProto.sendProfilePhoto;

/* 
    userProto에 정의된 함수들
*/

//사용자 인증 설정
userProto.auth; 
// 앱이 켜지거나 꺼질대 온라인인지 아닌지를 체크하는 함수 
userProto.updateStatus;           
//사용자 최신 엡데이트 위치 파익하기
userProto.updateLocation;  
  // 사용자 위치 정보 가저요기
userProto.getPoint;  
// 사용자 프로파일 업데이트 기능                      
userProto.updateProfile;  
// 사용자 계정 삭제하기 기능            
userProto.deleteAccount;              
userProto.getUsers;  
//친구 목록 가져오기                      
userProto.getFriendList;  
// 친구추가하기            
userProto.addFriend;    
//친구 삭제하기                  
userProto.deleteFriend;    
// 잠금된 사용자 명단확보 기능            
userProto.blockUser;    
//일반사용자 잠금하기 기능                  
userProto.getBlockedUser;   
//모든 사용자 위치정보를 가저오는 함수         
userProto.getPerson;   
// 친구 잠금장치 풀어주기 기능                    
userProto.releaseBlockedFriend;   
// 사진 가져오기   
userProto.getPhoto;                             
/* conversation proto 에 들어있는 함수
*/

conversationProto.startconversationProto;
conversationProto.getconversationProtos;
conversationProto.getMessages;
conversationProto.getLatestMessage;
conversationProto.sendTextMessage;
conversationProto.deleteconversationProto;
conversationProto.createReport;
conversationProto.sendPhotoMessage;


// 내 게사판 지우기
boardProto.getBoards;
boardProto.createMyBoard;
boardProto.deleteMyBoard;

//grpc setting
//server starts
 server.addProtoService(proto.Main.service, {getCaptcha: mainProto.getCaptcha, setUpProfile: mainProto.setUpProfile,sendProfilePhoto:mainProto.sendProfilePhoto});

 server.addProtoService(proto.AuthorizedMain.service, {auth:userProto.auth,updateStatus:userProto.updateStatus,updateLocation:userProto.updateLocation,getPoint:userProto.getPoint,
   updateProfile:userProto.updateProfile,getPhoto:userProto.getPhoto, deleteAccount:userProto.deleteAccount,getUsers:userProto.getUsers,getFriendList:userProto.getFriendList,addFriend:userProto.addFriend,
   deleteFriend:userProto.deleteFriend,blockUser:userProto.blockUser,getBlockedUser:userProto.getBlockedUser,getPerson:userProto.getPerson,releaseBlockedFriend:userProto.releaseBlockedFriend,startConversation:conversationProto.startConversation,getMessages:conversationProto.getMessages,
   getConversations:conversationProto.getConversations,sendTextMessage:conversationProto.sendTextMessage,sendPhotoMessage:conversationProto.sendPhotoMessage,
   deleteConversation:conversationProto.deleteConversation,getBoards:boardProto.getBoards,createMyBoard:boardProto.createMyBoard,deleteMyBoard:boardProto.deleteMyBoard,createReport:createReport});
   server.bind('0.0.0.0:9003', grpc.ServerCredentials.createInsecure());
   server.start();
   console.log('GRPC server running on port:', '0.0.0.0:9003');
