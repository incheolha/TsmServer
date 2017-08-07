
// 일반사용자 대화기능 사용하기

var dateFormat = require('dateformat');
var fs = require('fs');
var gm = require('gm');
var moment = require('moment');
var conn = require('./db.js')



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


module.exports.auth = auth;                               // 1
module.exports.updateStatus = updateStatus;                //2
module.exports.updateLocation = updateLocation;            //3
module.exports.getPoint = getPoint;                        //4
module.exports.updateProfile = updateProfile;              //5
module.exports.deleteAccount = deleteAccount;              //6
module.exports.getUsers = getUsers;                        //7
module.exports.getFriendList = getFriendList;              //8
module.exports.addFriend = addFriend;                      //9
module.exports.deleteFriend = deleteFriend;                //10
module.exports.blockUser = blockUser;                      //11
module.exports.getBlockedUser = getBlockedUser;            //12
module.exports.getPerson = getPerson;                       //13
module.exports.releaseBlockedFriend = releaseBlockedFriend;     //14
module.exports.getPhoto = getPhoto;                             //15



