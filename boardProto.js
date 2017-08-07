
// 일반사용자 대화기능 사용하기

var dateFormat = require('dateformat');
var fs = require('fs');
var gm = require('gm');
var moment = require('moment');
var conn = require('./db.js')

//게시판 가져오기
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


module.exports.getBoards = getBoards;
module.exports.createMyBoard = createMyBoard;
module.exports.deleteMyBoard = deleteMyBoard;
