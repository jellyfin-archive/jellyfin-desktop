const net   = require('net');
const dgram = require('dgram');

var createMagicPacket = exports.createMagicPacket = function(mac){
    const MAC_LENGTH    = 0x06;
    const MAC_REPEAT    = 0x16;
    const PACKET_HEADER = 0x06;
    var parts  = mac.match(/[0-9a-fA-F]{2}/g);
    if(!parts || parts.length != MAC_LENGTH)
        throw new Error("malformed MAC address '" + mac + "'");
    var buffer = new Buffer(PACKET_HEADER);
    var bufMac = new Buffer(parts.map(function(p){
        return parseInt(p, 16);
    }));
    buffer.fill(0xff);
    for(var i = 0; i < MAC_REPEAT; i++){
        buffer = Buffer.concat([ buffer, bufMac ]);
    }
    return buffer;
};

exports.wake = function wake(mac, options, callback){
    options = options || {};
    if(typeof options == 'function'){
        callback = options;
    }
    var defaults = {
        address : '255.255.255.255',
        port    : 9
    };
    for(var k in options){
        defaults[ k ] = options[ k ];
    }
    options = defaults;
    // create magic packet
    try {
        var magicPacket = createMagicPacket(mac);
    } catch (err) {
        callback(err);
        return;
    }
    var socket = dgram.createSocket(
        net.isIPv6(options.address) ? 'udp6' : 'udp4'
    ).on('error', function(err){
        socket.close();
        callback && callback(err);
    }).once('listening', function(){
        socket.setBroadcast(true);
    });
    socket.send(
        magicPacket, 0, magicPacket.length,
        options.port, options.address, function(err, res){
            callback && callback(err, res == magicPacket.length);
            socket.close();
    });
};
