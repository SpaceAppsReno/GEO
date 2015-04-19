var express	= require('express'); 
var app 	= express();
var http 	= require('http').Server(app);
var io 		= require('socket.io')(http);
var cylon 	= require('cylon');
var request = require('request');	
var config	= require('config');

app.use(express.static('public'));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});


http.listen(3000, function(){
	console.log('listening on *:3000');
});

var wunderground_api_key = config.wundergroundKey;
var pinoccio_api_key = config.pinoccioKey;

var lightSun = 'https://api.pinocc.io/v1/3/1/command/pixels.sun?token=' + pinoccio_api_key;
var lightMoon = 'https://api.pinocc.io/v1/3/1/command/pixels.moon?token=' + pinoccio_api_key;
var lightning = 'https://api.pinocc.io/v1/3/1/command/pixels.lightning?token=' + pinoccio_api_key;

cylon.robot({
  connections: {
    edison: { adaptor: 'intel-iot' }
  },
  devices: {
	 rainPin: { driver: 'direct-pin', pin: 8 },
	 cloudPin: { driver: 'direct-pin', pin: 9 }
   }
}).on('ready', function(my) {
	console.log('cylon ready');
	
	io.on('connection', function(socket){
		console.log('connected');

		socket.on('rain', function (msg) {
			socket.emit('rain', msg);
			
			if(msg === true) {
				//start rain
				my.rainPin.digitalWrite(1);
			
				setTimeout(function(){
					//stop rain
					my.rainPin.digitalWrite(0);
				}, 3000);
			} else {
				my.rainPin.digitalWrite(0);
			}

		});
	
		socket.on('sunrise', function (msg) {
			socket.emit('sunrise', msg);
			console.log('Turn on the sun');
			request(lightSun, function(error, response, body) {
 			   if (!error && response.statusCode == 200) {
				   console.log(body);
				}
			});
		});
	
		socket.on('sunset', function (msg) {
			socket.emit('sunset', msg);
			console.log('turn on the moon');
			request(lightMoon, function(error, response, body) {
 			   if (!error && response.statusCode == 200) {
				   console.log(body);
				}
			});
		});
	
		socket.on('clouds', function (msg) {
			socket.emit('clouds', msg);
			
			console.log('Clouds is ', msg);
			
			if(msg === true) {
				console.log('Start making clouds');
				//start rain
				my.cloudPin.digitalWrite(1);
			} else {
				my.cloudPin.digitalWrite(0);
			}
		});
		
		socket.on('daytime', function (msg) {
			if(msg === true) {
				console.log('Turn on the sun');
				request(lightSun, function(error, response, body) {
	 			   if (!error && response.statusCode == 200) {
					   console.log(body);
					}
				});
			} else {
				console.log('Turn on the moon');
				request(lightMoon, function(error, response, body) {
	 			   if (!error && response.statusCode == 200) {
					   console.log(body);
					}
				});
			}
		});

		socket.on('city event', function (result) {
			console.log(result.current_observation.display_location.full);

			var lat = result.current_observation.display_location.latitude;
			var lon = result.current_observation.display_location.longitude;

			get_weather(lat, lon);
			get_astronomy(lat, lon);

			setInterval(function () {
				get_weather(lat, lon);
				get_astronomy(lat, lon);
			}, 1000 * 60 * 60);
		});

		function get_weather(lat, lon) {
			var req_url = 'http://api.wunderground.com/api/' + wunderground_api_key + '/conditions/q/' + lat + ',' + lon + '.json';

			request(req_url, function(error, response, body) {
			   if (!error && response.statusCode == 200) {
			        console.log(body);
			        var JSON_body = JSON.parse(body);
			        process_weather(JSON_body.current_observation);
			    } else {
			    	console.log('Error occured');
			    }
			});
		}

		function process_weather(observation) {
			console.log(observation);
			var clouds = [ 'Mostly Cloudy', 'Partly Cloudy', 'Overcast', 'Shallow Fog', 'Partial Fog', 'Scattered Clouds' ];
			var rain = [ 'Drizzle', 'Light Drizzle', 'Heavy Drizzle', 'Rain', 'Light Rain', 'Heavy Rain', 'Mist', 'Light Mist', 'Heavy Mist', 'Rain Mist', 'Light Rain Mist', 'Heavy Rain Mist', 'Rain Showers', 'Light Rain Showers', 'Heavy Rain Showers'];
		
			console.log(observation.weather);
		
			if (clouds.indexOf(observation.weather) != -1) {
				console.log('its cloudy');
				socket.emit('clouds', true);
			} else {
				console.log('clouds', false);
			}

			if (rain.indexOf(observation.weather) != -1 ) {
				socket.emit('rain', true);
				socket.emit('clouds', true);
				console.log('its rainy and cloudy');
			} else {
				socket.emit('rain', false);
			}
		}

		function get_astronomy(lat, lon) {
			var req_url = 'http://api.wunderground.com/api/' + wunderground_api_key + '/astronomy/q/' + lat + ',' + lon + '.json';

			request(req_url, function(error, response, body) {
			   if (!error && response.statusCode == 200) {
			        console.log(body);
			        var JSON_body = JSON.parse(body);
			        process_astronomy(JSON_body);
			    }
			});
		}

		function process_astronomy(observation) {
			var hour = new Date().getHours();
			var sunrise = observation.sun_phase.sunrise.hour;
			var sunset = observation.sun_phase.sunset.hour;

			if(hour >= sunrise && hour <= sunset) {
				socket.emit('daytime', true);
			} else {
				socket.emit('daytime', false);
			}

			if (hour === sunrise) {
				socket.emit('sunrise', true);
			}

			if (hour === sunset) {
				socket.emit('sunset', true);
			}
		}
	});

});

cylon.start()