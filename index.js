
var parse = require('domain-name-parser');
var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');
var bencode = require('bencode');
var debug = require('debug')('dht-dns-solver');

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
        debug('already pending');
        pendingDns[dnsToSolve].push(then);
      } else if (knownDns[dnsToSolve]) {
        debug('known dns');
        then(null, knownDns[dnsToSolve]);
      } else if (announcedDns[dnsToSolve]) {
        debug('local dns');
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

    debug('bootstrap=%s', opts.bootstrap);
    debug('K=%s', opts.K);
    this.dhTable = DHTY(opts, function(dhTable) {
      debug('DHT is ready');

      var getPendingDnsQuery = function(addr, infoHash, from){
        debug('peer found %s', infoHash);
        debug('peer addr %s', addr);
        debug('peer from %s', from);
        var transaction = pendingLookup[infoHash];
        if (transaction) {
          debug('found peer for transaction %s', infoHash);
          var name = transaction.question;
          if (pendingDns[name]) {
            return name;
          }
        }
        return false;
      };

      var challengePeer = function(addr, infoHash, name){
        var transactionId = dhTable._getTransactionId(addr, function(){});
        var message = {
          "t":transactionIdToBuffer(transactionId),
          "y":"q",
          "q":"auth",
          "a":{"c":"g"}
        };
        pendingChallenges[addr] = message;

        debug('sent auth to %s', addr);

        dhTable._send(addr, message);
        pendingChallenges[addr].question = name;
        pendingChallenges[addr].infoHash = infoHash;
      };

      dhTable.on('peer', function(addr, infoHash, from){
        var name = getPendingDnsQuery(addr, infoHash, from);
        if ( name !== false ){
          challengePeer(addr, infoHash, name);
        }
      });

      var decodeMessage = function(data){
        var message;
        try {
          message = bencode.decode(data);
          if (!message) {
            throw 'invalid message';
          }
        } catch (err) {
          console.log(err);
          return false;
        }

        return message;
      };

      var isAuthRequest = function (addr, message){
        var type = message.y && message.y.toString();
        if (type === 'q') {
          var question = message.q && message.q.toString();
          debug('got message %s:%s from %s', type, question, addr);
          return question === 'auth';
        }
        return false;
      };

      var isAuthRequestReply = function (addr, message){
        var type = message.y && message.y.toString();
        if (type === 'r') {
          debug('got message %s from %s', type, addr);
          if (pendingChallenges[addr]) {
            var challenge = message.r
              && message.r.c
              && message.r.c.toString();
            return challenge !== undefined;
          }
        }
        return false;
      };

      var replyAuthRequest = function(message, addr){
        var challenge = message.a
          && message.a.c
          && message.a.c.toString();
        // do something to cipher/un cipher the challenge here

        // then send reply
        var response = {
          "y":"r",
          "r":{"c":challenge/*to improve*/}
        };
        dhTable._send(addr, response);
      };

      var validateAuthRequestReply = function(message, addr){
        var challenge = message.a
          && message.a.c
          && message.a.c.toString();
        // do something to cipher/un cipher the challenge here

        debug('got response %s from %s', challenge, addr);

        // check it matches
        return challenge === 'g';
      };

      var resolveDNSQuestion = function(addr){
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
      };

      dhTable.socket.on('message', function (data, rinfo){
        var message = decodeMessage(data);
        if (message !== false) {
          var addr = rinfo.address + ':' + rinfo.port;
          if (isAuthRequest(addr, message) ){
            replyAuthRequest(addr, message);
          } else if (isAuthRequestReply(addr, message) ){
            if (validateAuthRequestReply(addr, message) ){
              resolveDNSQuestion(addr);
            }
          }
        }
      });

      process.nextTick(then);

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
