
// 일반사용자 대화기능 사용하기

var dateFormat = require('dateformat');
var fs = require('fs');
var gm = require('gm');
var moment = require('moment');
var conn = require('./db.js')

var captchapng = require('captchapng');

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



module.exports.getCaptcha = getCaptcha;
module.exports.setUpProfile = setUpProfile;
module.exports.sendProfilePhoto = sendProfilePhoto;
