var city_query = '';
var socket = io();

function auto_complete(query) {
	var wunderground_api = 'http://autocomplete.wunderground.com/aq?query=' + query;
	var req_url = 'https://jsonp.nodejitsu.com/?url=' + escape(wunderground_api);

	$.ajax({
		cache: false,
		type: 'GET',
		url: req_url,
		dataType: 'jsonp',
		
		error: function (xhr, status, error) {
			console.log(error);
		},
		success: function (result) {
			$('#suggest').empty();
			var cities = result.RESULTS;
			$(cities).each( function (i) {
				$('#suggest').append('<li><a href="javascript:get_conditions(\'' + cities[i].name + '\', ' + cities[i].lat + ', ' + cities[i].lon + ');">' + cities[i].name + '</a></li>');
			});
		}
	});
}

function get_conditions(city, lat, lon) {
	$('#city').val(city);
	$('#suggest').empty();
	
	var jsonCity = { 
		"cityName" : city,
		"lat" : lat,
		"lon" : lon
 	};

	console.log(city, lat, lon);
	
	socket.emit('city event', jsonCity);
	
};