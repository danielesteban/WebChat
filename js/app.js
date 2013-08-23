SOCKJS = {
	reconnectTimeout : 1,
	server : 'hellacoders.com:9080',
	connect : function() {
		var sock = new SockJS('http://' + SOCKJS.server + '/chat');
		SOCKJS.sock = sock;
		sock.onopen = function() {
			SOCKJS.connected = true;
			if(SOCKJS.connectCallbacks) {
				SOCKJS.connectCallbacks.forEach(function(p) {
					SOCKJS.req(p[0], p[1], p[2]);
				});
				delete SOCKJS.connectCallbacks;
			}
			SOCKJS.reconnectTimeout = 1;
		};
		sock.onmessage = function(e) {
			try {
				e = JSON.parse(e.data);
			} catch(e) {
				return;
			}
			!SOCKJS.clients && (SOCKJS.clients = {});
			var clients = SOCKJS.clients;
			switch(e.func) {
				case 'connect':
					delete e.func;
					var id = e.id;
					delete e.id;
					clients[id] = e;
					var li = $('<li id="client' + id + '"><img class="webcam" /><br><i class="icon-user"></i> <span></span></li>');
					$('span', li).text(e.nick);
					$('menu#buddies').append(li);
				break;
				case 'disconnect':
					delete clients[e.id];
					$('menu#buddies li#client' + e.id).fadeOut(function() {
						$(this).remove();
					});
				break;
				case 'nick':
					clients[e.id].nick = e.nick;
					$('menu#buddies li#client' + e.id + ' span').text(e.nick);
				break;
				case 'message':
					if(!clients[e.id]) return;
					var last = $('section div.message').last(),
						pad = last.attr('rel') === e.id ? (parseInt(last.css('paddingLeft'), 10) ? last.css('paddingLeft') : $('strong', last).width()) : false,
						scroll = $('section:animated').length || ($('section').scrollTop() === $('section')[0].scrollHeight - $('section').height());

					$('section').append('<div rel="' + e.id + '" class="message"' + (pad ? ' style="padding-left: ' + pad + (typeof pad === 'string' ? '' : 'px') + '"' : '') + '>' + (pad ? '' : '<strong>' + clients[e.id].nick + ':&nbsp;</strong>') + '<p>' + e.message.text.replace(/\n/g, '<br>') + '</p></div>');
					scroll && $('section').stop().animate({scrollTop: $('section')[0].scrollHeight - $('section').height()});
				break;
				case 'frame':
					if(!clients[e.id]) return;
					if(clients[e.id].frames) return clients[e.id].frames.push(e.frame);
					clients[e.id].frames = [e.frame];
					clients[e.id].frameC = 0;
					var draw = function() {
							if(!clients[e.id] || !clients[e.id].frames.length) return;
							clients[e.id].frameC++;
							if(clients[e.id].frameC < SKIP_FRAMES) return requestAnimationFrame(draw);
							clients[e.id].frameC = 0;
							$('menu#buddies li#client' + e.id + ' img.webcam').attr('src', clients[e.id].frames.unshift());
						};

					requestAnimationFrame(draw);
				break;
			}
			if(e.callback && SOCKJS.callbacks[e.callback]) {
				var cid = e.callback;
				SOCKJS.callbacks[cid](e.data);
				delete SOCKJS.callbacks[cid];
			}
		};
		sock.onclose = function() {
			delete SOCKJS.connected;
			setTimeout(SOCKJS.connect, SOCKJS.reconnectTimeout * 1000);
			SOCKJS.reconnectTimeout += 5;
		};
	},
	req : function(func, params, callback) {
		if(!SOCKJS.connected) {
			!SOCKJS.connectCallbacks && (SOCKJS.connectCallbacks = []);
			SOCKJS.connectCallbacks.push([func, params, callback]);
			return;
		}
		if(callback) {
			if(!SOCKJS.callbacks) {
				SOCKJS.callbacks = [];
				SOCKJS.callbackID = 1;
			}
			params.callback = SOCKJS.callbackID++;
			SOCKJS.callbacks[params.callback] = callback;
		}
		params.func = func;
		SOCKJS.sock.send(JSON.stringify(params));
	}
};

/* AppCache handler */
window.applicationCache && window.applicationCache.addEventListener('updateready', function(e) {
	if(window.applicationCache.status !== window.applicationCache.UPDATEREADY) return;
	try {
		window.applicationCache.swapCache();
	} catch(e) {}
	window.location.reload();
}, false);

window.URL = window.URL || window.webkitURL;
window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

SKIP_FRAMES = 3; //Num frames before firing the webcam capture/send (must be the same on all clients/broadcasters)

$(window).load(function() {
	/* Render the skin */
	$('body').hide().empty().append(Handlebars.templates.skin()).fadeIn('fast');
	
	$('form#messageBox').keydown(function(e) {
		if(e.keyCode === 13 && !e.shiftKey) {
			e.stopPropagation();
			e.preventDefault();
			$(e.target).submit();
		}
	});

	$('form#messageBox').submit(function(e) {
		e.stopPropagation();
		e.preventDefault();

		var message = $('form#messageBox textarea[name="message"]').val();
		if(message === '') return;
		$('form#messageBox')[0].reset();
		SOCKJS.req('message', {message: {text : message}});
	});

	/* onResize handler */
	var onResize = function() {
			var sectionHeight = $(window).height() - $('header').height() - $('form#messageBox').height();
			$('section').css('height', sectionHeight);
			$('div#aside').css('height', sectionHeight - 20);
			$('div#aside menu#buddies').css('height', sectionHeight - 20 - $('div#aside div#user').height() - 21);
		};

	onResize();
	$(window).resize(onResize);

	/* Get saved data */
	var server = SOCKJS.server, nick;
	if(window.localStorage) {
		localStorage.getItem('server') !== null && (server = localStorage.getItem('server'));
		localStorage.getItem('nick') !== null && (nick = localStorage.getItem('nick'));
	}
	
	/* Show modal */
	var backdrop = $('div.modal-backdrop'),
		modal = $('div.modal'),
		form = $('form', modal);

	$('input[name="server"]', modal).val(server);
	nick && $('input[name="nick"]', modal).val(nick);
	backdrop.fadeTo('fast', 0.8);
	modal.animate({
	    top : '20%',
	    opacity : 1
	}, 'fast');
	form.submit(function(e) {
		e.stopPropagation();
		e.preventDefault();

		var server = $('input[name="server"]', form).val(),
			nick = $('input[name="nick"]', form).val();

		if(server === '') return;
		SOCKJS.server = server;
		window.localStorage && localStorage.setItem('server', server);

		/* Init Sockjs */
		SOCKJS.connect();
		if(nick !== '') {
			SOCKJS.req('nick', {
				nick : nick
			});
			window.localStorage && localStorage.setItem('nick', nick);
		}

		/* Close modal */
		backdrop.fadeOut('fast', function() {
			this.remove();
		});
		modal.animate({
           top : '-25%',
           opacity : 0
        }, 'fast', function() {
        	$(this).remove();
        	$('form#messageBox textarea').first().focus();
        
        	/* Init Video */
			if(!navigator.getUserMedia) return;
			var video = $('<video autoplay>')[0],
				canvas = $('<canvas>')[0],
				ctx = canvas.getContext('2d'),
				frameC = 0;

			navigator.getUserMedia({video: true}, function(localMediaStream) {
				var draw = function() {
						frameC++;
						if(frameC < SKIP_FRAMES) return requestAnimationFrame(draw);
						frameC = 0;
						canvas.width = 150;
	         			canvas.height = 113;
						ctx.drawImage(video, 0, 0, 640, 480, 0, 0, canvas.width, canvas.height);
						var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
							data = pixels.data;

						for(var i=0; i<data.length; i+=4) {
							var alpha = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
							data[i] = data[i + 1] = data[i + 2] = alpha;
						}
						ctx.putImageData(pixels, 0, 0);
						var frame = canvas.toDataURL('image/jpeg', 0.6);
						$('div#aside img.webcam').attr('src', frame);
						SOCKJS.req('frame', {
							frame : frame
						});
						requestAnimationFrame(draw);
					};

				video.src = window.URL.createObjectURL(localMediaStream);
				requestAnimationFrame(draw);
			}, function(e) {
				console.log(e);
			});
        });
	});
	$((!nick ? 'input[name="nick"]' : 'button'), modal).last().focus();
});
