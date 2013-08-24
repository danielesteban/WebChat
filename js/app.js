SOCKJS = {
	reconnectTimeout : 1,
	server : 'http://hellacoders.com:9080/chat',
	connect : function() {
		var sock = new SockJS(SOCKJS.server);
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

			/* Join the room */
			var params = {
					nick : SOCKJS.nick
				};

			SOCKJS.room && (params.room = SOCKJS.room.id);
			SOCKJS.req('join', params, function(room) {
				SOCKJS.room = room;
				window.location.hash !== '#' + room.id && (window.location.hash = '#' + room.id);
				$('menu#buddies').empty();
				for(var id in room.clients) {
					var li = Handlebars.partials.buddie({
							id : id,
							nick : room.clients[id].nick
						});

					$('menu#buddies').append(li);
					li.fadeIn('fast');
				}
				room.clients[room.client_id] = {
					nick : SOCKJS.nick
				};
				$('section').empty().append(Handlebars.partials.roomLink({
					id : room.id,
					link : 'http://' + window.location.host + '/#' + room.id
				}));
			});
		};
		sock.onmessage = function(e) {
			try {
				e = JSON.parse(e.data);
			} catch(e) {
				return;
			}
			var clients = SOCKJS.room && SOCKJS.room.clients ? SOCKJS.room.clients : {};
			switch(e.func) {
				case 'connect':
					var id = e.id,
						li = Handlebars.partials.buddie({
							id : id,
							nick : e.nick
						});

					delete e.func;
					delete e.id;
					clients[id] = e;
					$('menu#buddies li#client' + id).remove();
					$('menu#buddies').append(li);
					li.fadeIn('fast');
				break;
				case 'disconnect':
					delete clients[e.id];
					$('menu#buddies li#client' + e.id).fadeOut('fast', function() {
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
						pad = last.attr('rel') === e.id ? (parseInt(last.css('paddingLeft'), 10) ? parseInt(last.css('paddingLeft'), 10) : $('strong', last).width()) : false,
						scroll = $('section:animated').length || ($('section').scrollTop() === $('section')[0].scrollHeight - $('section').height()),
						message = {
							id : e.id,
							nick : clients[e.id].nick
						};

					e.message && e.message.text && (message.text = e.message.text);
					pad && (message.pad = pad);
					var div = $(Handlebars.partials.message(message));
					$('p', div).html($('p', div).text().replace(/\n/g, '<br>'));
					$('section').append(div);
					scroll && $('section').stop().animate({scrollTop: $('section')[0].scrollHeight - $('section').height()});
				break;
				case 'frame':
					if(!clients[e.id]) return;
					if(clients[e.id].frames && clients[e.id].frames.length) {
						clients[e.id].frames.length >= (60 / SKIP_FRAMES / 4) && clients[e.id].frames.shift();
						return clients[e.id].frames.push(e.frame);
					}
					clients[e.id].frames = [e.frame];
					clients[e.id].frameC = 0;
					var draw = function() {
							if(!clients[e.id] || !clients[e.id].frames.length) return;
							clients[e.id].frameC++;
							if(clients[e.id].frameC < SKIP_FRAMES) return requestAnimationFrame(draw);
							clients[e.id].frameC = 0;
							$('menu#buddies li#client' + e.id + ' img.webcam').attr('src', clients[e.id].frames.shift());
							requestAnimationFrame(draw);
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

VIDEOEFFECTS = {
	/* color map for sepia */
	r : [0, 0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 12, 12, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 17, 18, 19, 19, 20, 21, 22, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39, 40, 41, 42, 44, 45, 47, 48, 49, 52, 54, 55, 57, 59, 60, 62, 65, 67, 69, 70, 72, 74, 77, 79, 81, 83, 86, 88, 90, 92, 94, 97, 99, 101, 103, 107, 109, 111, 112, 116, 118, 120, 124, 126, 127, 129, 133, 135, 136, 140, 142, 143, 145, 149, 150, 152, 155, 157, 159, 162, 163, 165, 167, 170, 171, 173, 176, 177, 178, 180, 183, 184, 185, 188, 189, 190, 192, 194, 195, 196, 198, 200, 201, 202, 203, 204, 206, 207, 208, 209, 211, 212, 213, 214, 215, 216, 218, 219, 219, 220, 221, 222, 223, 224, 225, 226, 227, 227, 228, 229, 229, 230, 231, 232, 232, 233, 234, 234, 235, 236, 236, 237, 238, 238, 239, 239, 240, 241, 241, 242, 242, 243, 244, 244, 245, 245, 245, 246, 247, 247, 248, 248, 249, 249, 249, 250, 251, 251, 252, 252, 252, 253, 254, 254, 254, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
	g : [0, 0, 1, 2, 2, 3, 5, 5, 6, 7, 8, 8, 10, 11, 11, 12, 13, 15, 15, 16, 17, 18, 18, 19, 21, 22, 22, 23, 24, 26, 26, 27, 28, 29, 31, 31, 32, 33, 34, 35, 35, 37, 38, 39, 40, 41, 43, 44, 44, 45, 46, 47, 48, 50, 51, 52, 53, 54, 56, 57, 58, 59, 60, 61, 63, 64, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76, 77, 79, 80, 81, 83, 84, 85, 86, 88, 89, 90, 92, 93, 94, 95, 96, 97, 100, 101, 102, 103, 105, 106, 107, 108, 109, 111, 113, 114, 115, 117, 118, 119, 120, 122, 123, 124, 126, 127, 128, 129, 131, 132, 133, 135, 136, 137, 138, 140, 141, 142, 144, 145, 146, 148, 149, 150, 151, 153, 154, 155, 157, 158, 159, 160, 162, 163, 164, 166, 167, 168, 169, 171, 172, 173, 174, 175, 176, 177, 178, 179, 181, 182, 183, 184, 186, 186, 187, 188, 189, 190, 192, 193, 194, 195, 195, 196, 197, 199, 200, 201, 202, 202, 203, 204, 205, 206, 207, 208, 208, 209, 210, 211, 212, 213, 214, 214, 215, 216, 217, 218, 219, 219, 220, 221, 222, 223, 223, 224, 225, 226, 226, 227, 228, 228, 229, 230, 231, 232, 232, 232, 233, 234, 235, 235, 236, 236, 237, 238, 238, 239, 239, 240, 240, 241, 242, 242, 242, 243, 244, 245, 245, 246, 246, 247, 247, 248, 249, 249, 249, 250, 251, 251, 252, 252, 252, 253, 254, 255],
	b : [53, 53, 53, 54, 54, 54, 55, 55, 55, 56, 57, 57, 57, 58, 58, 58, 59, 59, 59, 60, 61, 61, 61, 62, 62, 63, 63, 63, 64, 65, 65, 65, 66, 66, 67, 67, 67, 68, 69, 69, 69, 70, 70, 71, 71, 72, 73, 73, 73, 74, 74, 75, 75, 76, 77, 77, 78, 78, 79, 79, 80, 81, 81, 82, 82, 83, 83, 84, 85, 85, 86, 86, 87, 87, 88, 89, 89, 90, 90, 91, 91, 93, 93, 94, 94, 95, 95, 96, 97, 98, 98, 99, 99, 100, 101, 102, 102, 103, 104, 105, 105, 106, 106, 107, 108, 109, 109, 110, 111, 111, 112, 113, 114, 114, 115, 116, 117, 117, 118, 119, 119, 121, 121, 122, 122, 123, 124, 125, 126, 126, 127, 128, 129, 129, 130, 131, 132, 132, 133, 134, 134, 135, 136, 137, 137, 138, 139, 140, 140, 141, 142, 142, 143, 144, 145, 145, 146, 146, 148, 148, 149, 149, 150, 151, 152, 152, 153, 153, 154, 155, 156, 156, 157, 157, 158, 159, 160, 160, 161, 161, 162, 162, 163, 164, 164, 165, 165, 166, 166, 167, 168, 168, 169, 169, 170, 170, 171, 172, 172, 173, 173, 174, 174, 175, 176, 176, 177, 177, 177, 178, 178, 179, 180, 180, 181, 181, 181, 182, 182, 183, 184, 184, 184, 185, 185, 186, 186, 186, 187, 188, 188, 188, 189, 189, 189, 190, 190, 191, 191, 192, 192, 193, 193, 193, 194, 194, 194, 195, 196, 196, 196, 197, 197, 197, 198, 199],
	grayscale : false,
	sepia : false,
	noise : 0,
	init : function(onResize) {
		$('div#aside div#user a.videoeffects').click(function() {
			$('div#aside div#user form#videoeffects').toggle();
			onResize();
		});

		/* Get saved data */
		if(window.localStorage) {
			localStorage.getItem('grayscale') !== null && (VIDEOEFFECTS.grayscale = true);
			localStorage.getItem('sepia') !== null && (VIDEOEFFECTS.sepia = true);
			localStorage.getItem('noise') !== null && (VIDEOEFFECTS.noise = localStorage.getItem('noise'));
		}

		/* Init UI */
		var form = $('div#aside div#user form#videoeffects')[0],
			checkF = function(id) {
				return function() {
					VIDEOEFFECTS[id] = this.checked;
					if(!window.localStorage) return;
					if(this.checked) localStorage.setItem(id, true);
					else localStorage.removeItem(id);
				};
			};

		form.grayscale.checked = VIDEOEFFECTS.grayscale;
		form.sepia.checked = VIDEOEFFECTS.sepia;
		form.noise.value = VIDEOEFFECTS.noise;
		$(form.grayscale).click(checkF('grayscale'));
		$(form.sepia).click(checkF('sepia'));
		$(form.noise).change(function() {
			VIDEOEFFECTS.noise = parseInt($(this).val(), 10);
			if(!window.localStorage) return;
			if(VIDEOEFFECTS.noise !== 0) localStorage.setItem('noise', VIDEOEFFECTS.noise);
			else localStorage.removeItem('noise');
		});
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
	/* Handlebars helpers */
	Handlebars.registerHelper('defaultSrc', function(id) {
		return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==';
	});

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
			$('div#aside menu#buddies').css('height', $(window).height() - $('header').height() - 20 - $('div#aside div#user').height() - 21);
			$('form#messageBox').css('width', $(window).width() - $('div#aside').width());
		};

	onResize();
	$(window).resize(onResize);

	VIDEOEFFECTS.init(onResize);

	/* Get saved data */
	var server = SOCKJS.server, nick;
	if(window.localStorage) {
		localStorage.getItem('server') !== null && (server = localStorage.getItem('server'));
		localStorage.getItem('nick') !== null && (nick = localStorage.getItem('nick'));
	}
	
	/* Show modal */
	var backdrop = $('div.modal-backdrop'),
		modal = $('div.modal'),
		form = $('form', modal),
		roomId = window.location.hash.substr(1);

	$('input[name="server"]', modal).val(server);
	nick && $('input[name="nick"]', modal).val(nick);
	roomId !== '' && $('input[name="room"]', modal).val(roomId);
	backdrop.fadeTo('fast', 0.8);
	modal.animate({
	    top : '20%',
	    opacity : 1
	}, 'fast');
	form.submit(function(e) {
		e.stopPropagation();
		e.preventDefault();

		var server = $('input[name="server"]', form).val(),
			nick = $('input[name="nick"]', form).val(),
			room = $('input[name="room"]', form).val();

		if(server === '' || nick === '') return;
		SOCKJS.server = server;
		window.localStorage && localStorage.setItem('server', server);
		SOCKJS.nick = nick;
		$('div#aside div#user span').text(nick);
		window.localStorage && localStorage.setItem('nick', nick);
		room !== '' && (SOCKJS.room = {id : room});

		/* Init Sockjs */
		SOCKJS.connect();

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
			var video = $('<video>')[0],
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
						try {
							ctx.drawImage(video, 0, 0, 640, 480, 0, 0, canvas.width, canvas.height);
						} catch (e) {
							if(!e.name || e.name !== 'NS_ERROR_NOT_AVAILABLE') return;
						}
						var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
							data = pixels.data;

						/* GrayScale */
						if(VIDEOEFFECTS.grayscale) {
							for(var i=0; i<data.length; i+=4) {
								var alpha = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
								data[i] = data[i + 1] = data[i + 2] = alpha;
							}
						}
						/* Sepia */
						if(VIDEOEFFECTS.sepia) {
							for(var i=0; i<data.length; i+=4) {
								data[i] = VIDEOEFFECTS.r[data[i]];
								data[i+1] = VIDEOEFFECTS.g[data[i+1]];
								data[i+2] = VIDEOEFFECTS.b[data[i+2]];
							}
						}
						/* Noise */
						if(VIDEOEFFECTS.noise && VIDEOEFFECTS.noise > 0) {
							for(var i=0; i<data.length; i+=4) {
								var noise = Math.round(VIDEOEFFECTS.noise - Math.random() * VIDEOEFFECTS.noise);
								for(var j=0; j<3; j++) {
									var iPN = noise + data[i+j];
									data[i+j] = (iPN > 255) ? 255 : iPN;
								}
							}
						}
						ctx.putImageData(pixels, 0, 0);
						var frame = canvas.toDataURL('image/jpeg', 0.5);
						$('div#aside div#user img.webcam').attr('src', frame);
						SOCKJS.req('frame', {
							frame : frame
						});
						requestAnimationFrame(draw);
					};

				if(typeof navigator.mozGetUserMedia === 'function') video.mozSrcObject = localMediaStream;
				else video.src = window.URL.createObjectURL(localMediaStream);
				video.play();
				if(window.chrome) return requestAnimationFrame(draw);
				video.addEventListener('canplay', function() {
					requestAnimationFrame(draw);
				});
			}, function(e) {
				console.log(e);
			});
        });
	});
	$((!nick ? 'input[name="nick"]' : 'button'), modal).last().focus();
});
