var express	= require('express'); 
var app 	= express();
var http 	= require('http').Server(app);
var io 		= require('socket.io')(http);
var cylon 	= require('cylon');
var request = require('request');	
var config	= require('./config');
var moment 	= require('moment-timezone');

app.use(express.static('public'));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});


http.listen(3000, function(){
	console.log('Geographic Environment Observer online at http://localhost:3000');
});

var wunderground_api_key = config.wundergroundKey;
var pinoccio_api_key = config.pinoccioKey;
var timezone = null;

var lightSun = 'https://api.pinocc.io/v1/4/1/command/pixels.sun?token=' + pinoccio_api_key;
var lightMoon = 'https://api.pinocc.io/v1/4/1/command/pixels.moon?token=' + pinoccio_api_key;
var lightning = 'https://api.pinocc.io/v1/4/1/command/pixels.lightning?token=' + pinoccio_api_key;



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

		socket.on('rain', function (msg) {
			calculateRain(msg);
		});
	
		socket.on('sunrise', function (msg) {
			calculateSunrise(msg);
		});
	
		socket.on('sunset', function (msg) {
			calculateSunset(msg);
		});
	
		socket.on('clouds', function (msg) {
			calculateClouds(msg);
		});
	
		function calculateRain(data) {
			console.log('Rain data is ', data);
			socket.emit('rain', data);
		
			if(data === true) {
				//start rain
				console.log('Start ☂');
				my.rainPin.digitalWrite(1);
		
				setTimeout(function(){
					//stop rain
					my.rainPin.digitalWrite(0);
					console.log('Stop ☂');
				}, 3000);
			} else {
				my.rainPin.digitalWrite(0);
				console.log('No ☂');
			}
		}
	
		function calculateSunrise(data) {
			socket.emit('sunrise', data);
			console.log('☀');
		
			request(lightSun, function(error, response, body) {
			   if (!error && response.statusCode == 200) {
				   console.log(body);
				}
			});
		}
	
		function calculateSunset(data) {
			socket.emit('sunset', data);
			console.log('☾');
			request(lightMoon, function(error, response, body) {
			   if (!error && response.statusCode == 200) {
				   console.log(body);
				}
			});
		}

		function calculateClouds(data) {
			socket.emit('clouds', data);
				
			if(data === true) {
				console.log('☁');
				my.cloudPin.digitalWrite(1);
			} else {
				console.log('No ☁');
				my.cloudPin.digitalWrite(0);
			}
		}
	
		socket.on('daytime', function (msg) {
			calculateDaytime(msg);
		});
	
		function calculateDaytime(data){
			if(data == true) {
				socket.emit('daytime', true);
				console.log('☀');
				
				request(lightSun, function(error, response, body) {
	 			   if (!error && response.statusCode == 200) {
					   console.log(body);
					}
				});
			} else {
				socket.emit('daytime', false);
				console.log('☾');
				request(lightMoon, function(error, response, body) {
	 			   if (!error && response.statusCode == 200) {
					   console.log(body);
					}
				});
			}
		}

		socket.on('city event', function (result) {
			console.log('Getting data for', result.cityName);

			var lat = result.lat;
			var lon = result.lon;

			timezone = result.tz;

			get_weather(lat, lon);
			get_astronomy(lat, lon);
		
			setInterval(function () {
				console.log('An hour has passed. Reobserving the weather...');
				get_weather(lat, lon);
				get_astronomy(lat, lon);
			}, 1000 * 60 * 60);
		});

		function get_weather(lat, lon) {
		
			var req_url = 'http://api.wunderground.com/api/' + wunderground_api_key + '/conditions/q/' + lat + ',' + lon + '.json';

			console.log(req_url);

			request(req_url, function(error, response, body) {
			   if (!error && response.statusCode == 200) {
			        var JSON_body = JSON.parse(body);
				
					if(JSON_body.response.hasOwnProperty('error')) {
						if(JSON_body.response.error.type === 'querynotfound')
						{
							console.log('Could not find this city');
						}
					} else {
			        	process_weather(JSON_body.current_observation);
					}
			    } else {
			    	console.log('Error occured');
			    }
			});
		}

		function process_weather(observation) {
			var clouds = [ 'Mostly Cloudy', 'Partly Cloudy', 'Overcast', 'Shallow Fog', 'Partial Fog', 'Scattered Clouds' ];
			var rain = [ 'Drizzle', 'Light Drizzle', 'Heavy Drizzle', 'Rain', 'Light Rain', 'Heavy Rain', 'Mist', 'Light Mist', 'Heavy Mist', 'Rain Mist', 'Light Rain Mist', 'Heavy Rain Mist', 'Rain Showers', 'Light Rain Showers', 'Heavy Rain Showers'];
	
			if (clouds.indexOf(observation.weather) != -1) {
				calculateClouds(true);
			} else {
				calculateClouds(false);
			}

			if (rain.indexOf(observation.weather) != -1 ) {
				calculateRain(true);
				calculateClouds(true);
			} else {
				calculateRain(false);
			}
		}

		function get_astronomy(lat, lon) {
			var req_url = 'http://api.wunderground.com/api/' + wunderground_api_key + '/astronomy/q/' + lat + ',' + lon + '.json';

			request(req_url, function(error, response, body) {
			   if (!error && response.statusCode == 200) {
			        var JSON_body = JSON.parse(body);
					if(JSON_body.response.hasOwnProperty('error')) {
						console.log('Could not find this city');
					} else {
						 process_astronomy(JSON_body);
					}
		       
			    }
			});
		}

		function process_astronomy(observation) {
			var hour = new Date().getHours();
		
			var sunrise = observation.sun_phase.sunrise.hour;
			var sunset = observation.sun_phase.sunset.hour;
			console.log('Locating the sun in the sky...');
		
			//console.log(moment.tz.zone(timezone).offset(moment().unix()) / 60);

			if(hour >= sunrise && hour <= sunset) {
				calculateDaytime(true);
			} else {
				calculateDaytime(false);
			}

			if (hour === sunrise) {
				calculateDaytime(true);
				calculateSunrise(true);
			}

			if (hour === sunset) {			
				calculateSunset(true);
				calculateDaytime(false);
			}
		}
	});

});

cylon.start();
