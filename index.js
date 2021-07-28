const WebSocketServer = require('websocket').server;
const http = require('http');
const port = 3000;  //포트
const server = http.createServer(function(request, response) {  //일반 HTTP 요청 처리
    console.log((new Date()) + ' Can not get information reqeust of http  ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(port, function() {
    console.log((new Date()) + ' Server is listening on port 3000');
});
 
const wsServer = new WebSocketServer({  //웹소켓 서버 생성
    httpServer: server,
    autoAcceptConnections: false
});
const rooms = new Map();  //채팅방 목록을 담을 객체
const requestType = {  //메시지 타입
    A:'welcome',
    B:'send',
    C:'bye',
    D:'beforList'
}

wsServer.on('request', function (request) {
    console.log(request);
    const user = request.resourceURL.query.user;  //사용자 ID
    const room = request.resourceURL.query.room;  //방번호
    if( NUL(user) || NUL(room)){
        return;
    }

    var connection = request.accept();   //들어온 커넥션 객체
    sendBeforUserList(connection, room); //이미 들어와있는 사용자 목록을 전송

    rooms.set(user,{user:user, room:room, con:connection});  //방 목록에 자신 추가
    msgSender(rooms.get(user), null, requestType.A);  //로그인 타입으로 메시지 전송

    connection.on('message', function (message) {  //채팅메시지가 도달하면
        msgSender(rooms.get(user), message, requestType.B);
    });

    connection.on('close', function(reasonCode, description) {   //커넥션이 끊기면
        msgSender(rooms.get(user), null, requestType.C).then((callbak)=>{  //방에서 나감을 알리고
            rooms.delete(user);  //방 목록에서 삭제
        }).catch((err)=>{
            console.log(err);
        });
    });
});

//파라미터 확인용 함수
function NUL(obj){
    if(obj == undefined || obj == null || obj.length == 0){
        return true;
    }
    return false;
}

//메시지를 보내는 함수
function msgSender(identify, message, type){
    return new Promise((resolve, reject)=>{
        for(let target of rooms.entries()) {  //방 목록 객체를 반복문을 활용해 발송
            if(identify.room == target[1].room){  //같은방에 있는 사람이면 전송
                //타입별 전송 구간(최초접속,메시지전송,방나감)
                if (type == requestType.A ) {  
                    var res = JSON.stringify({param:'room in',fromUser:identify.user, type:type});
                    target[1].con.sendUTF(res);
                } else if (type == requestType.B && message.type === 'utf8') {
                    var res = JSON.stringify({param:message.utf8Data,fromUser:identify.user, type:type});
                    target[1].con.sendUTF(res);
                } else if (type == requestType.C) {
                    var res = JSON.stringify({param:'room out',fromUser:identify.user, type:type});
                    target[1].con.sendUTF(res);
                }
            }
        }
        resolve('succ');        
    });    
}

//방 접속 시 이미 들어와있는 목록을 받기위한 함수
function sendBeforUserList(connection, room){
    new Promise((resolve, reject)=>{
        var beforList = new Array();
        for(let target of rooms.entries()) {  //반복문을 통해 사용자 리스트를 배열에 담아서
            if(room == target[1].room){
                beforList.push(target[1].user);
            }
        }
        resolve(beforList);        
    }).then((list)=>{
        var res = JSON.stringify({param:'',users:list, type:requestType.D});  //막 들어온 사용자한테 해당 대상을 전달.
        connection.sendUTF(res);
    }).catch((err)=>{
        console.log(err);
    });
}
