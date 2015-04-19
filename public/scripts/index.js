var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cylon = require('cylon');

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

io.on('connection', function(socket){
	
	console.log('GEO connected');
	
	socket.on('disconnect', function(){
		console.log('GEO disconnected');
	});

	socket.on('chat message', function(msg){
		io.emit('chat message', msg);
		//my.led.toggle();
	});
});


http.listen(3000, function(){
	console.log('listening on *:3000');
});
