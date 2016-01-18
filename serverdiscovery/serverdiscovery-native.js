function findServers(timeoutMs, callback) {
    var dgram = require('dgram');
    var PORT = 7359;
    var MULTICAST_ADDR = "255.255.255.255";

    var servers = [];
    var client;

    try {
        client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    } catch (err) {
        callback(JSON.stringify(servers));
        return;
    }

    function onReceive(message, info) {
        console.log('Message from: ' + info.address + ':' + info.port);
        console.log('ServerDiscovery message received');
        try {
            if (info != null) {
                // Expected server properties
                // Name, Id, Address, EndpointAddress (optional)
                console.log('Server discovery json: ' + message.toString());
                var server = JSON.parse(message.toString());
                server.EndpointAddress = info.address;
                servers.push(server);
            }

        } catch (err) {
            console.log('Error receiving server info: ' + err);
        }
    }

    function onTimerExpired() {
        console.log('timer expired', servers.length, 'servers received');
        console.log(servers);
        callback(JSON.stringify(servers));

        try {
            client.close();
        }
        catch (err) {

        }
    }

    client.on('message', onReceive);

    client.on('listening', function () {

        try {
            var address = client.address();
            client.setBroadcast(true);
            var message = new Buffer("who is EmbyServer?");
            client.send(message, 0, message.length, PORT, MULTICAST_ADDR, function (err) {
                if (err) console.error(err);
            });
            console.log('UDP Client listening on ' + address.address + ":" + address.port);
            console.log('starting udp receive timer with timeout ms: ' + timeoutMs);
            timeoutMs = setTimeout(onTimerExpired, timeoutMs);
        }
        catch (err) {
            onTimerExpired();
        }
    });

    try {
        client.bind();
    }
    catch (err) {
        onTimerExpired();
    }

}

exports.findServers = findServers;