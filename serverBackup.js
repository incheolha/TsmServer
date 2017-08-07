
//각종 필요 전역변수 모듈 선언
//dkddddd
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

app.use(cors());                                                               // cors 미들웨어 사용

/* 메인 sql연결을 수행하는 기능  
   원격서버: IP주소 및 비번은 항상 아래것을 연결해야함
*/

 var config = {
host:'127.0.0.1',
 user:'root',
  password: '3590dany',                                                        // 실제 db center 서버 비번:password:'L1c5l2Pzx2ozew',
 database:'sparki'
}

// 데이타 베이스 연결시 기능..... 만일 db다운시 재연결 ㅣ동 연결이 다시될때가지

var conn;
function handleDisconnect() {
  conn = mysql.createConnection(config);                                    // 연결 시도 함수

  conn.connect(function(err) {                                                 // db서버 점검 함수
    if(err) {                                                   
      console.log('db 연결시도 실패:', err);
      setTimeout(handleDisconnect, 2000);                                       // 2초간 연결지연시간을 기다리다가 2초가 서버 연결 부재 메세지 신고,
    } else {
      console.log('db서버가 정상적으로 연결되었습니다..... 감사해요');
    }                                   
  });                                     
                                          
  conn.on('error', function(err) {
    console.log('db error', err);
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {                               // db 서버를 재연결시도하거나 일시적을 연결을 잃어버렸을대 점검
      handleDisconnect();                         
    } else {                                      
      throw err;                                  
    }
  });
}

handleDisconnect();                                                             // 서버다운시 서버제호출

//error가 발생해도 서버가 죽지않게하기

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

//앱 실행시 로봇인지 아닌지를 확인하기위해 인증숫자를 입력받은 기능

        function getCaptcha(call, callback){

                console.log('this is getCaptcha in server: ' + JSON.stringify(call.request))


                var img;
                var string;
                var randomNum = parseInt(Math.random()*900000+100000)
                var p = new captchapng(75,25,randomNum); // width,height,numeric captcha
                  p.color(255, 255, 255, 255)  // First color: background (red, green, blue, alpha)
                  p.color(0, 0, 0, 255)

                  var getBase64 = p.getBase64();
                  img = new Buffer(getBase64,'base64');
                  string = randomNum.toString()
                  //callback({ code: grpc.status.OK, details: 'OK'});
                  callback(null,{key: string, captcha:img, timeout: 1});
              }

// 사용자 프로파일 설정

      function setUpProfile(call, callback){
        
            console.log('setUpProfile in server')
            var insertUser = 'insert into user (sex, age,country, nickname, status_message,status,latitude,longitude,image_url,created,last_logged) value (?,?,?,?,?,?,?,?,?,?,?)'
            var insertDevice = 'insert into device (user_id,device_code,device_token,sdk_version,app_version,device_name,os,created) value (?,?,?,?,?,?,?,?)'
            var user = call.request
            var device = call.request.device
    
            //console.log('call.request: ' + JSON.stringify(call.request))

            //if user exists
            var time = moment().format('YYYY-MM-DD kk:mm:ss')
    
            //var time = date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate() + ' '+date.getHours()+':'+date.getMinutes()+':'+date.getSeconds()

            conn.query(insertUser,[user.sex,user.age,
              user.country,user.nickname,user.status_message,user.status,user.latitude,user.longitude,user.image_url,time,time], function(err, rows){
                  
                      if(err){
                        callback(err,{user_id: 0})
                        //callback(null,{profileSetsucceed: false})
                        console.log('insertUser error: ' + err)
                      }else{
                              console.log('insertUser succeed: ')
                              conn.query(insertDevice,[rows.insertId,device.device_code,device.device_token,device.sdk_version,device.app_version,device.device_name,device.os,time], function(err1, rows1){
                                    if(err1){
                                      console.log('insertDevice error: ' + err1)
                                      callback(err,{user_id: 0})
                                    }else{
                                      console.log('insertDevice success')
                                      callback(null,{user_id:rows.insertId})
                                    }
                              })
                      }
              })
      }

//사용자 인증 설정

    function auth(call, callback){
          //console.log('auth: ' + JSON.stringify(call.request));
            var authCheck = 'select u.*,d.device_token from device as d inner join user as u on d.user_id = u.user_id where u.user_id=?'
            conn.query(authCheck,[call.request.user_id],function(err,rows){
                  if(err){
                    console.log('authCheck error: ' + err);
                    callback(err)
                  }else{

                    if(rows.length == 0){
                      console.log('authCheck success user does not exist');
                      callback(null,{userExist:'false'})
                    }else{
                      console.log('authCheck success user does exist');
                      callback(null,{userExist:'true'})
                    }
                  }
            })
    }


    // 사용자 위치 정보 가저요기

    function getPerson(call,callback){
      //console.log('getUser: ' + call.request);
                var GetPerson = 'select u.*,COALESCE(ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2),0) as distance from user as u where u.user_id = ?'
                conn.query(GetPerson,[call.request.latitude,call.request.longitude,call.request.latitude,call.request.user_id],function(err,rows){
                      if(err){
                        console.log('GetPerson error: ' + err);
                        callback(err)
                      }else{
                        console.log('GetPerson success');
                        callback(null,{user:rows[0]})
                      }
                })
    }


// 앱이 켜지거나 꺼질대 온라인인지 아닌지를 체크하는 함수 

      function updateStatus(call, callback){
        //console.log('updateStatus: ' + JSON.stringify(call.request));
            var updateStatus = 'update user set status=? where user_id=?'
            conn.query(updateStatus,[call.request.value,call.request.user_id],function(err,rows){
                    if(err){
                      console.log('updateStatus error: ' + err);
                      callback(err)
                    }else{
                      console.log('updateStatus success');
                      callback(null)
                    }
            })
      }

//사용자 최신 엡데이트 위치 파익하기

      function updateLocation(call, callback){
                //console.log('updateLocation: ' + JSON.stringify(call.request));
                var updateLocation = 'update user set latitude=?,longitude=? where user_id=?'
                conn.query(updateLocation,[call.request.latitude,call.request.longitude,call.request.user_id],function(err,rows){
                      if(err){
                        console.log('updateLocation error: ' + err);
                        callback(err)
                      }else{
                        console.log('updateLocation success');
                        callback(null)
                      }
                })
      }


function getPoint(call, callback){

}

//사용자 프로파일 사진을 보내는 기능

    function sendProfilePhoto(call, callback){
      //console.log('sendProfilePhoto in the server');
          if(fs.existsSync(__dirname+"/images/"+call.request.filename)){
            console.log('The requested image already exists!');
            callback(null)
          }else{
            console.log('The requested image does not exists!');
            gm(call.request.photo)
            .resize(700, 700,'!')
            .noProfile()
            .noise('laplacian')
            .write(__dirname+"/images/"+call.request.filename, function (err) {
                  if (err){
                    console.log('The image file failed to be saved! ' +err);
                    callback(err)
                  }
                  console.log('Created an image from a Buffer!');
              callback(null)
            });
          }
    }

  // 사용자 프로파일 업데이트 기능

      function updateProfile(call, callback){
        //mySQL automatically detects that you're updating a field with the same value it already contains, and doesn't actually update that field
        //console.log('updateProfile in server: ' + JSON.stringify(call.request));
        var updateUser = 'update user set sex=?,age=?,country=?,nickname=?,status_message=?,image_url=? where user_id=?'
        var request = call.request

        if(request.user_id){
              conn.query(updateUser,[request.sex,request.age,request.country,request.nickname
                ,request.status_message,request.image_url,request.user_id],function(err, rows){
                      if(err){
                        console.log('updateUser error: ' + err)
                        callback(err)
                      }else{
                        console.log('updateUser succeed')
                        callback(null)
                      }
              })
          }
        }

// 사진 가져오기 
      function getPhoto(call, callback){
        //console.log('getPhoto in the server: ' + JSON.stringify(call.request));

        if(call.request.filename == "" || call.request.filename == null){
                  if (fs.existsSync(__dirname+'/images/defaultImage.jpeg')) {
                          console.log('defaultImage file does exist!');
                          gm(__dirname+'/images/defaultImage.jpeg')
                          //.resize(100, 100)
                          .toBuffer(function (err, buffer) {
                                if (err){
                                  callback(err)
                                  console.log('getPhoto readFile Error: ' + err);
                                } else{
                                  callback(null,{photo:buffer})
                                  console.log('getPhoto readFile Success: ');
                                }
                          })
                  }else{
                    console.log('defaultImage file does not exist!');
                  }
        }else{
                  if (fs.existsSync(__dirname+'/images/'+call.request.filename)){
                        console.log('Image file does exist!');
                        gm(__dirname+'/images/'+call.request.filename)
                        //.resize(350,350)
                        .toBuffer(function (err, buffer) {
                                  if (err){
                                    callback(err)
                                    console.log('getPhoto readFile Error: ' + err);
                                  } else{
                                    callback(null,{photo:buffer})
                                    console.log('getPhoto readFile Success: ');
                                  }
                        })

                  }else{
                        console.log('Image file does not exist!');
                        gm(__dirname+'/images/defaultImage.jpeg')
                        //.resize(640, 960)
                        .toBuffer(function (err, buffer) {
                                if (err){
                                  callback(err)
                                  console.log('getPhoto readFile Error: ' + err);
                                } else{
                                  callback(null,{photo:buffer})
                                  console.log('getPhoto readFile Success: ');
                                }
                        })
                  }
            }
      }

// 사용자 계정 삭제하기 기능

        function deleteAccount(call, callback){
          //console.log('deleteAccount: ' + JSON.stringify(call.request));
          var deleteAccount = 'delete from user where user_id = ?'
          var conversation = 'select * from participants where user_id = ?'
          var deleteConversation = 'delete from conversation where conversation_id = ?'
          conn.query(deleteAccount,[call.request.user_id],function(err,rows){
                    if(err){
                      console.log('deleteAccount error: ' + err);
                      callback(err)
                    }else{
                              console.log('deleteAccount success');
                              conn.query(conversation,[call.request.user_id],function(err1,rows1){
                                        if(err1){
                                          console.log('conversation error in deleteAccount: ' + err);
                                          callback(err)
                                        }else{
                                                console.log('conversation successs in deleteAccount');
                                                      var counter = 0
                                                      if(rows1.length == 0){
                                                        console.log('there is no conversation exists!');
                                                        callback(null)
                                                      }else{
                                                                for(var i in rows1){
                                                                  counter++
                                                                        conn.query(deleteConversation,[rows1[i].conversation_id],function(err2,rows2){
                                                                                if(err2){
                                                                                  console.log('deleteConversation error in deleteAccount: ' + err2);
                                                                                  callback(err2)

                                                                                }else{
                                                                                  console.log('deleteConversation success in deleteAccount');
                                                                                      if(counter == rows1.length){
                                                                                        callback(null)
                                                                                      }
                                                                                }
                                                                        })
                                                                }
                                                      }
                                        }
                              })
                    }
          })
        }

//모든 사용자 위치정보를 가저오는 함수

      function getUsers(call, callback){
//console.log('getUsers in the server: ' + JSON.stringify(call.request));

        var getNearestMale = 'select dummy.* from (select @s:=@s+1 as number_id,u.*, ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2) AS distance from user as u ,(SELECT @s:= 0) as s where u.sex = ? order by distance asc) as dummy where dummy.number_id > ? limit 0,3'
        var getNearestFemale = 'select dummy.* from (select @s:=@s+1 as number_id,u.*, ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2) AS distance from user as u ,(SELECT @s:= 0) as s where u.sex = ? order by distance asc) as dummy where dummy.number_id > ? limit 0,3'
        var getLatestMale = 'select dummy.* from (select @s:=@s+1 as number_id,u.*, ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2) AS distance from user as u ,(SELECT @s:= 0) as s where u.sex = ? order by u.last_logged desc) as dummy where dummy.number_id > ? limit 0,3'
        var getLatestFemale = 'select dummy.* from (select @s:=@s+1 as number_id,u.*, ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2) AS distance from user as u ,(SELECT @s:= 0) as s where u.sex = ? order by u.last_logged desc) as dummy where dummy.number_id > ? limit 0,3'

//나를 제외하고 나의 성별과 반대되는 랜덤 사람들 50명
        var getRandomPeople = 'select dummy.* from (select @s:=@s+1 as number_id,u.*, ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2) AS distance from user as u ,(SELECT @s:= 0) as s where u.sex != ? and u.user_id != ? and status = 1 order by RAND()) as dummy limit 0,50'

        var request = call.request

//가장 가까운 남성명단 가져오기

              if(request.indicator == 'nearestMale'){
                //realm에 아무것도 없을때 -> 초기화 할때

                      if(request.number_id == 0){
                        console.log('nearestMale number_id == 1');
                        //dummy.number_id == 0 처음부터 불러옴
                        conn.query(getNearestMale,[request.latitude,request.longitude,request.latitude,'Male',0],function(err, rows){
                          if(err){
                            console.log('getNearestMale error in first: ' + err);
                            callback(err)
                          }else{
                            console.log('getNearestMale Success in first');
                            callback(null, {users: rows})
                          }
                        })
                      }else{//realm에 데이터 있을때
                        console.log('nearestMale number_id == ' + request.number_id);
                        conn.query(getNearestMale,[request.latitude,request.longitude,request.latitude,'Male',request.number_id],function(err, rows){
                          if(err){
                            console.log('getNearestMale error in second: ' + err);
                            callback(err)
                          }else{
                            console.log('getNearestMale Success in second');
                            callback(null, {users: rows})
                          }
                        })
                      }

//가장 가까운 여성 가져오기

              }else if(request.indicator == 'nearestFemale'){

                       //realm에 아무것도 없을때 -> 초기화 할때
                      if(request.number_id == 0){
                        console.log('nearestFemale number_id == 0');
                        //dummy.number_id == 0 처음부터 불러옴
                        conn.query(getNearestFemale,[request.latitude,request.longitude,request.latitude,'Female',0],function(err, rows){
                          if(err){
                            console.log('getNearestFemale error in first: ' + err);
                            callback(err)
                          }else{
                            console.log('getNearestFemale Success in first');
                            callback(null, {users: rows})
                          }
                        })
                      }else{//realm에 데이터 있을때
                        console.log('nearestFemale number_id == ' + request.number_id);
                        conn.query(getNearestFemale,[request.latitude,request.longitude,request.latitude,'Female',request.number_id],function(err, rows){
                          if(err){
                            console.log('getNearestFemale error in second: ' + err);
                            callback(err)
                          }else{
                            console.log('getNearestFemale Success in second');
                            callback(null, {users: rows})
                          }
                        })
                      }

//가장 최근 남자 명단 가져오기

              }else if(request.indicator == 'latestMale'){

                      if(request.number_id == 0){
                        console.log('latestMale number_id == 0');
                        //dummy.number_id == 0 realm에 데이터가 아무것도 없을때
                        conn.query(getLatestMale,[request.latitude,request.longitude,request.latitude,'Male',0],function(err, rows){
                              if(err){
                                console.log('getLatestMale error in first: ' + err);
                                callback(err)
                              }else{
                                console.log('getLatestMale Success in first');
                                callback(null, {users: rows})
                              }
                        })
                      }else{
                        console.log('latestMale number_id == ' + request.number_id);
                        conn.query(getLatestMale,[request.latitude,request.longitude,request.latitude,'Male',request.number_id],function(err, rows){
                            if(err){
                              console.log('getLatestMale error in second: ' + err);
                              callback(err)
                            }else{
                              console.log('getLatestMale Success in second');
                              callback(null, {users: rows})
                            }
                        })
                      }

//latestFemale -- 가장 최근 여성명단 가져오기

              }else if(request.indicator == 'latestFemale'){
                      if(request.number_id == 0){
                                console.log('latestFemale number_id == 1');
                                //dummy.number_id == 0 realm에 데이터가 아무것도 없을때
                                conn.query(getLatestFemale,[request.latitude,request.longitude,request.latitude,'Female',0],function(err, rows){
                                        if(err){
                                          console.log('getLatestFemale error in first: ' + err);
                                          callback(err)
                                        }else{
                                          console.log('getLatestFemale Success in first');
                                          callback(null, {users: rows})
                                        }
                                })
                      }else{
                              console.log('latestFemale number_id == ' + request.number_id);
                              conn.query(getLatestFemale,[request.latitude,request.longitude,request.latitude,'Female',request.number_id],function(err, rows){
                                      if(err){
                                        console.log('getLatestFemale error in first: ' + err);
                                        callback(err)
                                      }else{
                                        console.log('getLatestFemale Success in first');
                                        callback(null, {users: rows})
                                      }
                              })
                      }

//getRandomPeople 50명 - 해당하는 램덤 사용자 추출하기
              }else{
                      console.log('getRandomPeople');
                      conn.query(getRandomPeople,[request.latitude,request.longitude,request.latitude,request.indicator,request.number_id],function(err, rows){
                              if(err){
                                console.log('getRandomPeople error: ' + err);
                                callback(err)
                              }else{
                                console.log('getRandomPeople Success');
                                callback(null, {users: rows})
                              }
                      })
              }
      }


//친구 목록 가져오기

      function getFriendList(call, callback){
        //console.log('getFriendList: ' + JSON.stringify(call.request));

        var getFriendList = 'select u.* from user as u inner join friends as f on f.friend_id = u.user_id where f.user_id = ?'

            conn.query(getFriendList,[call.request.user_id],function(err,rows){
                if(err){
                  console.log('getFriendList error: ' + err);
                  callback(err)
                }else{
                  console.log('getFriendList success: ' + JSON.stringify(rows));
                  callback(null,{friends:rows})
                }
            })
      }

// 친구추가하기

      function addFriend(call, callback){

        //console.log('addFriend: ' + JSON.stringify(call.request));
        var time = moment().format('YYYY-MM-DD kk:mm:ss')

        var ifalreadyfriend = 'select * from friends as f where f.user_id = ? and f.friend_id = ?'
        var addFriend = 'insert into friends (user_id,friend_id,created) value (?,?,?)'

        conn.query(ifalreadyfriend,[call.request.my_id,call.request.friend_id],function(err0,rows0){
                if(err0){
                  console.log('ifalreadyfriend err: ' + err0);
                  callback(err0)
                }else{
                  console.log('ifalreadyfriend success');
                      if(rows0.length == 0){
                        console.log('ifalreadyfriend success rows0.length == 0');
                        conn.query(addFriend,[call.request.my_id,call.request.friend_id,time], function(err,rows){
                            if(err){
                              console.log('addFriend error: ' + err);
                              callback(err)
                            }else{
                              console.log('addFriend success');
                              callback(null)
                            }
                        })
                      }else{
                        console.log('ifalreadyfriend success rows0.length != 0');
                        callback(null)
                      }
                }
        })
      }

//친구 삭제하기

    function deleteFriend(call, callback){
      //console.log('deleteFriend: ' + JSON.stringify(call.request));

      var deleteFriend = 'delete from friends where user_id = ? and friend_id = ?'
      conn.query(deleteFriend,[call.request.my_id,call.request.friend_id],function(err,rows){
            if(err){
              console.log('deleteFriend error: ' + err);
              callback(err)
            }else{
              console.log('deleteFriend success');
              callback(null)
            }
      })
    }

// 친구 잠금장치 풀어주기 기능

    function releaseBlockedFriend(call, callback){
        var release = 'delete from block_list where user_id = ? and blocked_user_id = ?'

        conn.query(release,[call.request.my_id,call.request.blocked_friend_id],function(err,rows){
              if(err){
                console.log('releaseBlockedFriend error: ' + err)
                callback(err)
              }else{
                console.log('releaseBlockedFriend success')
                callback(null)
              }
        })
      }

// 잠금된 사용자 명단확보 기능

      function blockUser(call, callback){
        //console.log('blockUser: ' + JSON.stringify(call.request));
              var time = moment().format('YYYY-MM-DD kk:mm:ss')
              var ifalreadyblock = 'select * from block_list as b where b.user_id = ? and b.blocked_user_id = ?'
              var blockUser = 'insert into block_list (user_id,blocked_user_id,created) value (?,?,?)'
              var IfIamBlocked = 'select * from block_list as b where b.user_id = ? and b.blocked_user_id = ?'

                    if(call.request.indicator == 'IblockTheUser'){
                      console.log('IblockTheUser');
                      conn.query(ifalreadyblock,[call.request.my_id,call.request.blocked_user_id],function(err0,rows0){
                              if(err0){
                                console.log('ifalreadyblock err: ' + err0);
                                callback(err0)
                              }else{
                                console.log('ifalreadyblock success');
                                      if(rows0.length == 0){
                                        console.log('ifalreadyblock success rows0.length == 0');
                                        conn.query(blockUser,[call.request.my_id,call.request.blocked_user_id,time],function(err,rows){
                                                if(err){
                                                  console.log('blockUser error: ' + err);
                                                  callback(err)
                                                }else{
                                                  console.log('blockUser success');
                                                  callback(null,{result:'IblockTheUser'})
                                                }
                                        })

                                      }else{
                                        console.log('ifalreadyblock success rows0.length != 0');
                                        callback(null,{result:'IblockTheUser'})
                                      }
                              }
                      })
                    }else{
                      //call.request.indicator == 'IfIamBlocked'
                      //내가 쪽지를 보내는 사람이 나를 차단했는지 확인
                      console.log('IfIamBlocked');
                      conn.query(IfIamBlocked,[call.request.blocked_user_id,call.request.my_id],function(err, rows){
                              if(err){
                                console.log('ifIamBlocked error: ' + err);
                                callback(err)
                              }else{
                                console.log('ifIamBlocked success');
                                      if(rows.length == 0){
                                        console.log('this person not block me');
                                        conn.query(ifalreadyblock,[call.request.my_id,call.request.blocked_user_id],function(err1,rows1){
                                                if(err1){
                                                  console.log(err1);
                                                  callback(err1)
                                                }else{
                                                        if(rows1.length == 0){
                                                          console.log('IDidNotBlockThisPerson')
                                                          callback(null,{result:'IDidNotBlockThisPerson'})
                                                        }else{
                                                          console.log('IblockedTheUser')
                                                          callback(null,{result:'IblockedTheUser'})
                                                        }
                                                }
                                        })
                                      }else{
                                        console.log('this person block me');
                                        callback(null,{result:'IamBlocked'})
                                      }

                              }
                      })
                    }
      }

//일반사용자 잠금하기 기능

      function getBlockedUser(call, callback){
        console.log('getBlockedUser: ' + JSON.stringify(call.request));
        var getBlockedUser = 'select u.* from user as u inner join block_list as b on b.blocked_user_id = u.user_id where b.user_id = ?'

        conn.query(getBlockedUser,[call.request.my_id],function(err, rows){
              if(err){
                console.log('getBlockedUser error: ' + err);
                callback(err)
              }else{
                console.log('getBlockedUser success: ' + JSON.stringify(rows));
                callback(null,{blockedFriends:rows})
              }
        })
      }

// 일반사용자 대화기능 사용하기
      function startConversation(call, callback){

        var time = moment().format('YYYY-MM-DD kk:mm:ss')

        //console.log('startConversation in server: ' + JSON.stringify(call.request));
        var checkIfUserExist = 'select * from user where user_id = ?'
        var insertConversation = 'insert into conversation (created, updated) value (?,?)'
        var checkIfWeAlreadyChat = 'select * from participants as p inner join participants as p2 on p.conversation_id = p2.conversation_id where p.user_id = ? and p2.user_id = ?'
        var insertParticipants = 'insert into participants (conversation_id, user_id) value (?,?)'


              conn.query(checkIfUserExist,[call.request.counter_id],function(error, result){
                //말을 거는 상대방이 탈퇴했는지 안했는지 체크
                      if(error){
                        console.log('checkIfUserExist in startConversation Error: ' + error);
                        callback(error)
                      }else{
                              if(result.length == 0){
                                //상대방 탈퇴
                                console.log('user does not exist in startConversation');
                                callback(null,{c_id:0,sender_id:0,receiver_id:0,message:""})
                              }else{
                                //상대방 탈퇴X
                                console.log('user does exist in startConversation');

                                //이미 대화하고 있는 상대인지 체크
                                      conn.query(checkIfWeAlreadyChat,[call.request.my_id,call.request.counter_id],function(error1,result1){
                                              if(error1){
                                                console.log('checkIfWeAlreadyChat error: ' + error1);
                                                callback(error1)
                                              }else{
                                                console.log('checkIfWeAlreadyChat success');
                                                      if(result1.length == 0){
                                                        console.log('We are not chatting in checkIfWeAlreadyChat');
                                                              conn.query(insertConversation, [time,time], function(err, rows){
                                                                      if(err){
                                                                        console.log('insertConversation Error: ' + err);
                                                                        callback(err)
                                                                      }else{
                                                                        console.log('insertConversation Success ');
                                                                        //first, insert participants myself
                                                                        conn.query(insertParticipants,[rows.insertId,call.request.my_id], function(err1, rows1){
                                                                                if(err1){
                                                                                  console.log('insertParticipants Error: ' + err1);
                                                                                  callback(err1)
                                                                                }else{
                                                                                  //second, insert participants counter
                                                                                      conn.query(insertParticipants,[rows.insertId,call.request.counter_id], function(err2, rows2){
                                                                                              if(err2){
                                                                                                console.log('insertParticipants Error: ' + err2);
                                                                                                callback(err2)
                                                                                              }else{
                                                                                                console.log('insertMessage Success ');
                                                                                                callback(null,{c_id:rows.insertId,sender_id:call.request.my_id,receiver_id:call.request.counter_id,message:call.request.content})
                                                                                              }
                                                                                      })
                                                                                }
                                                                          })
                                                                      }
                                                                    })
                                                    }else{
                                                          console.log('We are already chatting in checkIfWeAlreadyChat');
                                                          var updateAlreadyChattingConversation = 'update conversation set updated=? where conversation_id = ?'
                                                          conn.query(updateAlreadyChattingConversation,[time,result1[0].conversation_id],function(er,ro){
                                                                  if(er){
                                                                    console.log('updateAlreadyChattingConversation error: ' + er);
                                                                    callback(er)
                                                                  }else{
                                                                    console.log('updateAlreadyChattingConversation success ');
                                                                    callback(null,{c_id:result1[0].conversation_id,sender_id:call.request.my_id,receiver_id:call.request.counter_id,message:call.request.content})
                                                                  }
                                                          })
                                                    }
                                              }
                                      })
                              }
                      }
              })
      }

// 대화가 가져오기
      function getConversations(call, callback){
        //console.log('getConversations in server: ' + JSON.stringify(call.request));

        var getConversations = 'select c.conversation_id,c.created, u.user_id, u.sex,u.age,u.country,u.nickname,u.status_message,u.status,u.image_url,u.last_logged,COALESCE(ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2),0) as distance from conversation as c inner join participants as p on c.conversation_id = p.conversation_id  inner join user as u on p.`user_id` = u.user_id and p.user_id != ? where c.conversation_id in (select p.conversation_id from participants as p where p.user_id =?) order by c.updated DESC'

              conn.query(getConversations,[call.request.latitude,call.request.longitude,call.request.latitude,call.request.my_id,call.request.my_id], function(err, conversations){
                      if(err){
                        callback(null);
                        console.log('getConversation' +err);
                      }else{
                        console.log("getConversation success");
                      // console.log(conversations);
                        callback(null,{conversations: conversations})
                      }
              })
      }

// 메세지 가져오기

      function getMessages(call, callback){
        //console.log('getMessages in server: ' + JSON.stringify(call.request));

        var selectMessages = 'select m.* from message as m where m.conversation_id = ? and m.message_id < ? order by m.message_id asc limit 0,5'
        var initSelectMessages = 'select m.* from message as m where m.conversation_id = ? order by m.message_id asc limit 0,5'
              if(call.request.message_id == 0){
                      conn.query(initSelectMessages,[call.request.conversation_id], function(err, rows){
                              if(err){
                                console.log('initSelectMessages Error: ' + err);
                                callback(err,{messages:null})
                              }else{
                                console.log('initSelectMessages Success: ' + JSON.stringify(rows));
                                callback(null,{messages:rows})
                              }
                      })
              }else{
                      conn.query(selectMessages,[call.request.conversation_id, call.request.message_id], function(err, rows){
                              if(err){
                                console.log('selectMessages Error: ' + err);
                                callback(err,{messages:null})
                              }else{
                                console.log('selectMessages Success');
                                callback(null,{messages:rows})
                              }
                      })
              }
      }

//가장 최근 메세지 가져오기

      function getLatestMessage(param){
              var getLatestMessage = 'SELECT * FROM message WHERE message_id = (SELECT MAX(message_id) FROM message where conversation_id = ?)'
              var result = conn.query(getLatestMessage,[param],function(err1, rows1){
                      if(err1){
                        console.log('getLatestMessage Error: ' + err1);
                      }else{
                        console.log('getLatestMessage Success: ' + JSON.stringify(rows1[0]));

                      }
              })
              return result
            }

function sendTextMessage(call, callback){

  // console.log('sendTextMessage in server: ' + JSON.stringify(call.request));
  //
  // var insertMessage = 'insert into message (conversation_id, sender_id,receiver_id,message, attachment_url,created, type) value (?,?,?,?,?,?,?)'
  //
  // var getLatestMessage = 'SELECT * FROM message WHERE message_id = (SELECT MAX(message_id) FROM message where conversation_id = ?)'
  //
  // var request = call.request
  //
  // var date = new Date()
  // var time = dateFormat(date, 'yyyy-mm-dd hh:mm:ss');
  //
  // conn.query(insertMessage,[request.conversation_id,request.my_id,request.receiver_id,request.content,'some url',time,'TEXT'],function(err, rows){
  //   if(err){
  //     console.log('insertMessage Error: ' + err);
  //     callback(err)
  //   }else{
  //     console.log('insertMessage Success');
  //     conn.query(getLatestMessage,[request.conversation_id],function(err1, rows1){
  //       if(err1){
  //         console.log('getLatestMessage Error: ' + err1);
  //       }else{
  //         console.log('getLatestMessage Success: ' + JSON.stringify(rows1[0]));
  //         callback(null,{message:rows1[0]})
  //       }
  //     })
  //
  //   }
  // })
}



function sendPhotoMessage(call, callback){

}


//대화 지우기 
    function deleteConversation(call, callback){
      //console.log('deleteConversation: ' + JSON.stringify(call.request));
      var deleteConversation = 'delete from conversation where conversation_id=?'
      conn.query(deleteConversation,[call.request.conversation_id],function(err,rows){
            if(err){
              console.log('deleteConversation error: ' + err);
              callback(err)
            }else{
              console.log('deleteConversation success');
              callback(null)
            }
      })
    }

// 게시판 가져오기
      function getBoards(call, callback){
        //console.log('getBoards in server: ' + JSON.stringify(call.request));

        //0 as number_id - > 코드 재활용할려면 moreForNearest를 따로 할수 없기 때문에 그냥 default로 넣어준거 신경 X
        var initTotal = 'select b.*, u.`sex`,u.`age`,u.`nickname`,COALESCE(ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2),0) as distance from board as b inner join user as u on b.`user_id` = u.`user_id` ORDER BY b.board_id DESC limit 0,5'
        var moreBoards = 'select b.*, u.`sex`,u.`age`,u.`nickname`,COALESCE(ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2),0) as distance from board as b inner join user as u on b.`user_id` = u.`user_id` where b.board_id < ? ORDER BY b.board_id DESC limit 0,5'
        var initSex = 'select b.*, u.`sex`,u.`age`,u.`nickname`,COALESCE(ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2),0) as distance from board as b inner join user as u on b.`user_id` = u.`user_id` where u.sex = ? ORDER BY b.board_id DESC limit 0,5'
        var moreForSex = 'select b.*, u.`sex`,u.`age`,u.`nickname`,COALESCE(ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),2),0) as distance from board as b inner join user as u on b.`user_id` = u.`user_id` where b.board_id < ? and u.sex = ? ORDER BY b.board_id DESC limit 0,5'
        var moreForNearest = 'select dummy2.* from (select @s:=@s+1 as board_id,dummy.* from (select b.user_id,b.content,b.image_url,b.created, u.`sex`,u.`age`,u.`nickname`,COALESCE(ROUND((6371*acos(cos(radians(?))*cos(radians(u.latitude))*cos(radians(u.longitude)-radians(?))+sin(radians(?))*sin(radians(u.latitude)))),7),0) as distance from board as b inner join user as u on b.`user_id` = u.`user_id` order by distance asc limit 0,5) as dummy,(SELECT @s:= 0) as s limit 0,5) as dummy2 where dummy2.board_id > ?'

        var request = call.request

        //if call.request.board_id = 1, get DB from top to 100
        //COALESCE - > if null, make it 0 - > 처음 앱 열때 board의 처음 id가 1이 아닐수도 있기때문에

        if(request.indicator == 'total'){
                if(request.board_id == 0){
                  console.log('board_id in total == 0');
                  conn.query(initTotal,[request.latitude,request.longitude,request.latitude],function(err, rows){
                          if(err){
                            console.log('initTotal Error: ' + err);
                            callback(err, {boards: null})
                          }else{
                            console.log('initTotal Success');
                            callback(null, {boards:rows})
                          }
                  })
                }else{
                  console.log('board_id in total == ' + request.board_id);
                  conn.query(moreBoards,[request.latitude,request.longitude,request.latitude,request.board_id],function(err, rows){
                          if(err){
                            console.log('moreBoards Error: ' + err);
                            callback(err, {boards: null})
                          }else{
                            console.log('moreBoards Success');
                            callback(null, {boards:rows})
                          }
                  })
                }
        }else if(request.indicator == 'male'){
          if(request.board_id == 0){
            console.log('board_id in initSex male == 0');
            conn.query(initSex,[request.latitude,request.longitude,request.latitude,'Male'],function(err, rows){
              if(err){
                console.log('initSex Error male: ' + err);
                callback(err, {boards: null})
              }else{
                console.log('initSex Success male');
                callback(null, {boards:rows})
              }
            })
          }else{
            console.log('board_id in moreForSex male == ' + request.board_id);
            conn.query(moreForSex,[request.latitude,request.longitude,request.latitude,request.board_id,'Male'],function(err, rows){
              if(err){
                console.log('moreForSex Error male: ' + err);
                callback(err, {boards: null})
              }else{
                console.log('moreForSex Success male');
                callback(null, {boards:rows})
              }
            })
          }
        }else if(request.indicator == 'female'){
                if(request.board_id == 0){
                  console.log('board_id in initSex female == 0');
                  conn.query(initSex,[request.latitude,request.longitude,request.latitude,'Female'],function(err, rows){
                          if(err){
                            console.log('initSex Error female: ' + err);
                            callback(err, {boards: null})
                          }else{
                            console.log('initSex Success female');
                            callback(null, {boards:rows})
                          }
                  })
                }else{
                  console.log('board_id in moreForSex female == ' + request.board_id);
                  conn.query(moreForSex,[request.latitude,request.longitude,request.latitude,request.board_id,'Female'],function(err, rows){
                          if(err){
                            console.log('moreForSex Error female: ' + err);
                            callback(err, {boards: null})
                          }else{
                            console.log('moreForSex Success female');
                            callback(null, {boards:rows})
                          }
                  })
                }
        }else{
          //around
                if(request.board_id == 0){
                  console.log('board_id in around  == 0');
                  conn.query(moreForNearest,[request.latitude,request.longitude,request.latitude,'0'],function(err, rows){
                          if(err){
                            console.log('around Error : ' + err);
                            callback(err, {boards: null})
                          }else{
                            console.log('around Success: ' + JSON.stringify(rows));
                            callback(null, {boards:rows})
                          }
                  })
                }else{
                  console.log('board_id in around  == ' + request.board_id);
                  conn.query(moreForNearest,[request.latitude,request.longitude,request.latitude,request.board_id],function(err, rows){
                          if(err){
                            console.log('around Error: ' + err);
                            callback(err, {boards: null})
                          }else{
                            console.log('around Success');
                            callback(null, {boards:rows})
                          }
                  })
                }
        }
    }


// 게시판 생성하기

      function createMyBoard(call, callback){

        var insertBoard = 'insert into board (user_id, content, image_url,created) value (?,?,?,?)'
        var request = call.request
        var time = moment().format('YYYY-MM-DD kk:mm:ss')
        //console.log('createMyBoard in server: ' + JSON.stringify(call.request) + ' - ' + time);

              conn.query(insertBoard,[request.user_id,request.content,request.image_url,time], function(err, rows){
                      if(err){
                        console.log('insertBoard Error: ' + err);
                        callback(err)
                      }else{
                        console.log('insertBoard Success');
                        callback(null)
                      }
              })

        }


// 내 게사판 지우기
      function deleteMyBoard(call, callback){
        //console.log('deleteMyBoard: ' + JSON.stringify(call.request));

        var deleteMyBoard = 'delete from board where user_id = ?'
              conn.query(deleteMyBoard,[call.request.user_id],function(err, rows){
                      if(err){
                        console.log('deleteMyBoard error: ' + err);
                        callback(err)
                      }else{
                        console.log('deleteMyBoard success');
                        callback(null)
                      }
              })
      }

// 보고서 생성하기
      function createReport(call, callback){
        //console.log('createReport: ' + JSON.stringify(call.request));
            var createReport = 'insert into report (user_id,participant_id,reason) value (?,?,?)'

            conn.query(createReport,[call.request.user_id,call.request.participant_id,call.request.reason],function(err, rows){
                    if(err){
                      console.log('createReport error: ' + err);
                      callback(err)
                    }else{
                      console.log('createReport success');
                      callback(null)
                    }
            })
      }


//grpc setting
//server starts
 server.addProtoService(proto.Main.service, {getCaptcha: getCaptcha, setUpProfile: setUpProfile,sendProfilePhoto:sendProfilePhoto});

 server.addProtoService(proto.AuthorizedMain.service, {auth:auth,updateStatus:updateStatus,updateLocation:updateLocation,getPoint:getPoint,
   updateProfile: updateProfile,getPhoto:getPhoto, deleteAccount:deleteAccount,getUsers:getUsers,getFriendList:getFriendList,addFriend:addFriend,
   deleteFriend:deleteFriend,blockUser:blockUser,getBlockedUser:getBlockedUser,getPerson:getPerson,releaseBlockedFriend:releaseBlockedFriend,startConversation:startConversation,getMessages:getMessages,
   getConversations:getConversations,sendTextMessage:sendTextMessage,sendPhotoMessage:sendPhotoMessage,
   deleteConversation:deleteConversation,getBoards:getBoards,createMyBoard:createMyBoard,deleteMyBoard:deleteMyBoard,createReport:createReport});
   server.bind('0.0.0.0:9003', grpc.ServerCredentials.createInsecure());
   server.start();
   console.log('GRPC server running on port:', '0.0.0.0:9003');
