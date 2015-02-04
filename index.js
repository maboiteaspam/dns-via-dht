
var parse = require('domain-name-parser');
var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');
var bencode = require('bencode');

var isValidDns = function(dns){
  var parsedDomain = parse(dns);
  return !parsedDomain.tokenized.length < 2;
};


var DHTSolver = function(opts){

  if (!opts.port) {
    opts.port = 9090;
  }
  if (!opts.hostname) {
    opts.hostname = '127.0.0.1';
  }

  var DHTY = require('bootstrap-dht-yourself');

  this.announcedDns = {};
  this.knownDns = {};
  this.pendingDns = {};
  this.pendingLookup = {};
  this.pendingChallenges = {};
  this.dhTable = null;

  this.announce = function(newDns){
    var announcedDns = this.announcedDns;
    var dhTable = this.dhTable;
    if (isValidDns(newDns) && !announcedDns[newDns]) {
      announcedDns[newDns] = {
        ip: '127.0.0.1',
        dns: newDns
      };
      createTorrent(new Buffer(newDns), {name: newDns},
        function (err, torrent) {
          if (err) {
            console.log(err);
          }
          torrent = parseTorrent(torrent);
          dhTable.announce(torrent.infoHash, opts.port);
        });
      return true;
    }
    return false;
  };

  this.announceAll = function(){
    var announcedDns = this.announcedDns;
    var dhTable = this.dhTable;
    Object.keys(announcedDns).forEach(function(dns){
      // console.log('announcing ' + dns);
      createTorrent(new Buffer(dns), {name: dns}, function (err, torrent) {
        if (err) {
          console.log(err);
        }
        torrent = parseTorrent(torrent);
        dhTable.announce(torrent.infoHash, opts.port);
      });
    });
  };

  this.resolve = function(dnsToSolve, then){
    var dhTable = this.dhTable;
    var knownDns = this.knownDns;
    var pendingDns = this.pendingDns;
    var pendingLookup = this.pendingLookup;
    var announcedDns = this.announcedDns;
    if (isValidDns(dnsToSolve) ) {
      if (pendingDns[dnsToSolve]) {
        pendingDns[dnsToSolve].push(then);
      } else if (knownDns[dnsToSolve]) {
        then(null, knownDns[dnsToSolve]);
      } else if (announcedDns[dnsToSolve]) {
        then(null, announcedDns[dnsToSolve]);
      } else {
        pendingDns[dnsToSolve] = {
          question: dnsToSolve,
          then: [then]
        };
        createTorrent(new Buffer(dnsToSolve), {name: dnsToSolve},
          function (err, torrent) {
            if (err) {
              console.log(err);
            }
            torrent = parseTorrent(torrent);
            pendingLookup[torrent.infoHash] = {
              question: dnsToSolve
            };
            dhTable.lookup(torrent.infoHash);
          });
      }
    } else {
      then('invalid dns', false);
    }
  };

  this.start = function(then){
    var pendingDns = this.pendingDns;
    var pendingLookup = this.pendingLookup;
    var pendingChallenges = this.pendingChallenges;
    var knownDns = this.knownDns;

    this.dhTable = DHTY(opts, function(dhTable) {
      dhTable.on('peer', function (addr, infoHash, from) {
        var transaction = pendingLookup[infoHash];
        if (transaction) {
          var name = transaction.question;
          if (pendingDns[name]) {
            var transactionId = dhTable._getTransactionId(addr, function(){});
            var message = {
              "t":transactionIdToBuffer(transactionId),
              "y":"q",
              "q":"auth",
              "a":{"c":"g"}
            };
            pendingChallenges[addr] = message;

            dhTable._send(addr, message);
            pendingChallenges[addr].question = name;
            pendingChallenges[addr].infoHash = infoHash;
            console.log('auth ' + addr)
          }
        }
      });
      dhTable.socket.on('message', function (data, rinfo){
        var addr = rinfo.address + ':' + rinfo.port;
        var message;
        try {
          message = bencode.decode(data);
          if (message) {
            var type = message.y && message.y.toString();
            if (type === 'q') {
              var question = message.q && message.q.toString();
              console.log(type + ':' + question)
              if (question === 'auth') {
                var challenge = message.a
                  && message.a.c
                  && message.a.c.toString();
                // do something to cipher/un cipher the challenge here

                console.log('message ' + type + ' '+question);
                console.log('challenge ' + challenge);
                // then send reply
                var transactionId = dhTable._getTransactionId(addr);
                var response = {
                  "t":transactionIdToBuffer(transactionId),
                  "y":"r",
                  "q":"auth",
                  "r":{"c":challenge/*to improve*/}
                };
                dhTable._send(addr, response);
              }

            } else if (type === 'r' && pendingChallenges[addr]) {
              var challenge = message.r
                && message.r.c
                && message.r.c.toString();
              // do something to cipher/un cipher the challenge here

              console.log('message ' + type );
              console.log('challenge ' + challenge);

              // check it matches
              if (challenge === 'g' ) {
                var name = pendingChallenges[addr].question;
                var infoHash = pendingChallenges[addr].infoHash;
                var then = pendingDns[name].then;

                delete pendingChallenges[addr];
                delete pendingDns[name];
                delete pendingLookup[infoHash];

                knownDns[name] = {
                  ip: addr.split(':')[0],
                  dns: name
                };
                then.forEach(function(cb){
                  cb(null, knownDns[name]);
                });
              }
            }
          }
        } catch (err) {
          console.log(err);
        }

      });
      process.nextTick(function(){
        if (then) {
          then();
        }
      })
    });
    this.dhTable.listen(opts.port, opts.hostname);
  };

  this.stop = function(then){
    this.dhTable.destroy(then);
  };

  this.getDhtAddress = function(){
    return opts.hostname + ':' + opts.port;
  };
  this.getDhStatus = function(){
    var dhTable = this.dhTable;
    var nodes = [];
    dhTable.nodes.toArray().forEach(function(node) {
      nodes.push({
        addr: node.addr,
        distance: node.distance === undefined ? -1 : node.distance
      });
    });

    return {
      dhtAddress: this.getDhtAddress(),
      isReady: dhTable.ready,
      nodes: nodes,
      nodesCount: nodes.length,
      peersCount: Object.keys(dhTable.peers).length,
      announcesCount: Object.keys(dhTable.tables).length
    };
  };

};

function transactionIdToBuffer (transactionId) {
  if (Buffer.isBuffer(transactionId)) {
    return transactionId
  } else {
    var buf = new Buffer(2)
    buf.writeUInt16BE(transactionId, 0)
    return buf
  }
}
module.exports = DHTSolver;
