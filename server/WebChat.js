if(process.env.SSL) {
	var fs = require('fs'),
		ssl_options = {
			key : fs.readFileSync('ssl.key'),
			cert : fs.readFileSync('ssl.crt')
		};
}

var http = require('http' + (process.env.SSL ? 's' : '')),
	sockjs = require('sockjs'),
	uuid = require('node-uuid'),
	server = http.createServer(process.env.SSL ? ssl_options : null),
	chat = sockjs.createServer({
		log : function(severity, message) {
			severity === 'error' && console.log(message);
		}
	}),
	clients = {};

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

function broadcast(room, data, exclude) {
	if(!room || !clients[room]) return;
	clients[room].forEach(function(c) {
		if(exclude && exclude.indexOf(c.id) !== -1) return;
		c.conn.write(JSON.stringify(data));
	});
}

chat.on('connection', function(conn) {
	var room,
		leaveCurrentRoom = function() {
			if(!room || !clients[room]) return;
			var index = arraySearch(clients[room], conn.id, 'id', true);
			index !== false && clients[room].splice(index, 1);
			if(clients[room].length === 0) delete clients[room];
			broadcast(room, {
				func : 'disconnect',
				id : conn.id
			});
		};

	conn.on('data', function(req) {
		try {
			req = JSON.parse(req);
		} catch (e) {
			return;
		}
		switch(req.func) {
			case 'join':
				if(!req.nick || req.nick === '' || !req.callback) return;
				leaveCurrentRoom();
				(!req.room || !(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i).test(req.room)) && (req.room = uuid.v4());
				!clients[req.room] && (clients[req.room] = []);
				room = req.room;
				/* send current client list */
				var clist = {};
				clients[room].forEach(function(c) {
					clist[c.id] = {
						nick : c.nick
					};
				});
				conn.write(JSON.stringify({
					callback : req.callback,
					data : {
						id : room,
						client_id : conn.id,
						clients : clist
					}
				}));
				clients[room].push({
					id : conn.id,
					conn : conn,
					nick : req.nick
				});
				/* Announce new client */
				broadcast(room, {
					func : 'connect',
					id : conn.id,
					nick : req.nick
				}, conn.id);
			break;
			case 'nick':
				if(!room || !clients[room]) return;
				var client = arraySearch(clients[room], conn.id, 'id');
				if(client === false) return;
				client.nick = req.nick;
				broadcast(room, {
					func : 'nick',
					id : conn.id,
					nick : client.nick
				}, conn.id);
			break;
			case 'message':
				/* broadcast to all clients in room */
				broadcast(room, {
					func : 'message',
					id : conn.id,
					message : req.message
				});
			break;
			case 'frame':
				/* broadcast to all clients in room */
				broadcast(room, {
					func : 'frame',
					id : conn.id,
					frame : req.frame
				}, conn.id);
		}
	});
	conn.on('close', leaveCurrentRoom);
});

chat.installHandlers(server, {prefix: '/chat'});

server.listen(process.env.SSL ? 9090 : 9080, '0.0.0.0');
