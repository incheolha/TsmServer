
/* 메인 sql연결을 수행하는 기능  
   원격서버: IP주소 및 비번은 항상 아래것을 연결해야함
*/

var mysql = require('mysql');


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

module.exports = conn;

