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
					$('menu#buddies li#client' + e.id + ' img.webcam').attr('src', e.frame);
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
			$('menu').css('height', sectionHeight - 20);
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
			window.URL = window.URL || window.webkitURL;
			navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
			if(!navigator.getUserMedia) return;
			var video = $('<video autoplay>')[0],
				canvas = $('<canvas>')[0],
				ctx = canvas.getContext('2d'),
				videoInterval = 0;

			navigator.getUserMedia({video: true}, function(localMediaStream) {
				var frameRate = (1000 / 20), //in ms
					draw = function() {
						canvas.width = 150;
	         			canvas.height = 113;
						ctx.drawImage(video, 0, 0, 640, 480, 0, 0, canvas.width, canvas.height);
						var frame = canvas.toDataURL('image/webp');
						SOCKJS.req('frame', {
							frame : frame
						});
						clearTimeout(videoInterval);
						videoInterval = setTimeout(draw, frameRate);
					};

				video.src = window.URL.createObjectURL(localMediaStream);
				clearTimeout(videoInterval);
				videoInterval = setTimeout(draw, frameRate);
			}, function(e) {
				console.log(e);
			});
        });
	});
	$((!nick ? 'input[name="nick"]' : 'button'), modal).last().focus();
});
