
// 일반사용자 대화기능 사용하기

var dateFormat = require('dateformat');
var fs = require('fs');
var gm = require('gm');
var moment = require('moment');
var conn = require('./db.js')


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

function sendPhotoMessage(call, callback){

}

module.exports.startConversation = startConversation;
module.exports.getConversations = getConversations;
module.exports.getMessages = getMessages;
module.exports.getLatestMessage = getLatestMessage;
module.exports.sendTextMessage = sendTextMessage;
module.exports.deleteConversation = deleteConversation;
module.exports.createReport = createReport;
module.exports.sendPhotoMessage = sendPhotoMessage;




