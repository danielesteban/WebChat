var http = require('http'),
	sockjs = require('sockjs'),
	server = http.createServer(),
	chat = sockjs.createServer(),
	clients = [],
	nicksC = 0;

function arraySearch(haystack, needle, index, returnIndex) {
	for(var x=0; x<haystack.length; x++) {
		var item = haystack[x];
		if(item[index] === needle) {
			if(returnIndex) return x;
			else return item;
		}
	}
	return false;
}

function broadcast(data) {
	clients.forEach(function(c) {
		c.conn.write(JSON.stringify(data));
	});
}

chat.on('connection', function(conn) {
	var data = {
			id : conn.id,
			conn : conn,
			nick : 'user' + (++nicksC)
		};

	/* send client list */
	clients.forEach(function(c) {
		conn.write(JSON.stringify({
			func : 'connect',
			id : c.id,
			nick : c.nick
		}));
	});
	clients.push(data);
	/* Announce new client */
	broadcast({
		func : 'connect',
		id : conn.id,
		nick : data.nick
	});
	conn.on('data', function(req) {
		try {
			req = JSON.parse(req);
		} catch (e) {
			return;
		}
		switch(req.func) {
			case 'nick':
				data.nick = req.nick;
				broadcast({
					func : 'nick',
					id : conn.id,
					nick : data.nick
				});
			break;
			case 'message':
				//TODO: private messages ??

				/* broadcast to all clients */
				broadcast({
					func : 'message',
					id : conn.id,
					message : req.message
				});
			break;
			case 'frame':
				broadcast({
					func : 'frame',
					id : conn.id,
					frame : req.frame
				});
		}
	});
	conn.on('close', function() {
		var index = arraySearch(clients, conn.id, 'id', true);
		index !== false && clients.splice(index, 1);
		broadcast({
			func : 'disconnect',
			id : conn.id
		});
	});
});

chat.installHandlers(server, {prefix: '/chat'});

server.listen(8081, '0.0.0.0');
