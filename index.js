
var parse = require('domain-name-parser');
var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');
var bencode = require('bencode');
var bitauth = require('bitauth');
var hashjs = require('hash.js');

var isValidDns = function(dns){
  var parsedDomain = parse(dns);
  return !parsedDomain.tokenized.length < 2;
};

var DHTNodeAnnouncer = function(dhTable, opts){
  var debug = require('debug')('dns-via-dht');
  this.announcedDns = {};

  // announce and record a specific dns on the network
  this.announce = function(newDns, privateKey){
    var announcedDns = this.announcedDns;

    if (!privateKey) {
      privateKey = (new hashjs.sha256())
        .update(bitauth.generateSin().priv /*!!!*\ it is your duty to avoid rainbow table and SALT it */)
        .digest('hex');
    } else {
      // privateKey = privateKey /*!!!*\ it is your duty to avoid rainbow table and SALT it */;
    }

    if (isValidDns(newDns) && !this.isAnnounced(newDns)) {
      announcedDns[newDns] = {
        ip: '127.0.0.1', // this is for internal resolution
        dns: newDns,
        privateKey:privateKey
      };
      createTorrent(new Buffer(newDns), {name: newDns},
        function (err, torrent) {
          if (err) {
            debug('err %s', err);
          }
          torrent = parseTorrent(torrent);

          debug('');
          debug('announced DNS %s', newDns);
          debug('announced infoHash %s', torrent.infoHash);
          debug('announced privateKey %s', privateKey);

          var publicKey = bitauth.getPublicKeyFromPrivateKey(privateKey);
          var sin = bitauth.getSinFromPublicKey(publicKey);
          debug('announced pubkey %s', publicKey);
          debug('announced sin %s', sin);

          dhTable.announce(torrent.infoHash, opts.port);
        });
      return true;
    }
    return false;
  };

  //
  this.isAnnounced = function(newDns){
    return !!this.announcedDns[newDns];
  };

  // list all announced DNS and their public keys
  this.listAnnouncements = function(){
    var ret = {};
    var announcedDns = this.announcedDns;
    Object.keys(announcedDns).forEach(function(dns){
      ret[dns] = bitauth.getPublicKeyFromPrivateKey(announcedDns[dns].privateKey);
    });
    return ret;
  };

  // announce all recorded dns
  this.announceAll = function(){
    var announcedDns = this.announcedDns;
    Object.keys(announcedDns).forEach(function(dns){
      debug('announcing %s', dns);
      createTorrent(new Buffer(dns), {name: dns}, function (err, torrent) {
        if (err) {
          debug('err %s', err);
        }
        torrent = parseTorrent(torrent);
        dhTable.announce(torrent.infoHash, opts.port);
      });
    });
  };

  // check if a message query is 'auth', it is send by the resolver
  this.isAuthRequest = function (addr, message) {
    var type = message.y && message.y.toString();
    if (type === 'q') {
      var question = message.q && message.q.toString();
      var nounce = message.a && message.a.n && message.a.n.toString() || null;
      var dnsQ = message.a && message.a.q && message.a.q.toString() || null;
      return question === 'auth' && nounce !== null && dnsQ !== null;
    }
    return false;
  };

  // answer the 'auth' query
  this.replyAuthRequest = function(addr, message){
    var announcedDns = this.announcedDns;

    var question = message.a
      && message.a.q
      && message.a.q.toString();
    var nounce = message.a
      && message.a.n
      && message.a.n.toString();

    if (announcedDns[question]) {

      var privateKey = announcedDns[question].privateKey;

      var publicKey = bitauth.getPublicKeyFromPrivateKey(privateKey);
      var sin = bitauth.getSinFromPublicKey(publicKey);
      var signedData = bitauth.sign(question+nounce, privateKey);
      debug('');
      debug('got \'auth\' request from %s', addr);
      debug(message);
      debug('privateKey %s', privateKey);
      debug('publicKey / identity %s', publicKey);
      debug('announced sin %s', sin);
      debug('question %s', question);
      debug('nounce %s', nounce);
      debug('signedData %s', signedData);

      // then send reply
      var response = {
        "y":"r",
        "r":{
          "i": publicKey,
          "s": signedData,
          "n": nounce
        }
      };
      dhTable._send(addr, response);
    } else {
      debug('not question %s', question)
    }
  };


};

var DHTNodeResolver = function(dhTable){
  var debug = require('debug')('dns-via-dht');

  this.knownDns = {};
  this.pendingDns = {};
  this.pendingLookup = {};
  this.pendingChallenges = {};

  // starts the question resolution
  this.resolve = function(dnsToSolve, publicKey, then){

    var that = this;
    var knownDns = this.knownDns;
    var pendingDns = this.pendingDns;
    var pendingLookup = this.pendingLookup;

    if (isValidDns(dnsToSolve) ) {
      if (pendingDns[dnsToSolve]) {
        debug('already pending');
        pendingDns[dnsToSolve].then.push(then);
      } else if (knownDns[dnsToSolve]) {
        debug('known dns');
        then(null, knownDns[dnsToSolve]);
      } else {
        pendingDns[dnsToSolve] = {
          question: dnsToSolve,
          then: [then],
          publicKey:publicKey
        };
        createTorrent(new Buffer(dnsToSolve), {name: dnsToSolve},
          function (err, torrent) {
            if (err) {
              debug('err %s', err);
            }
            torrent = parseTorrent(torrent);
            pendingLookup[torrent.infoHash] = {
              question: dnsToSolve
            };
            debug('');
            debug('lookup %s %s', dnsToSolve, torrent.infoHash);
            dhTable.lookup(torrent.infoHash, function(err, closest){
              debug('err %s', err);
              debug('closest %s', closest);
              if(!err){
                closest.forEach(function(message){
                  var name = that.getPendingDNSQuestion(torrent.infoHash);
                  if ( name !== false ){
                    that.challengePeerAnnouncer(message.addr, torrent.infoHash, name);
                  } else {
                    debug('skip peer %s %s', message.addr, torrent.infoHash);
                  }
                })
              }
            });
          });
      }
    } else {
      then('invalid dns', false);
    }
  };

  // get relative dns question to an infoHash announced by a remote peer
  this.getPendingDNSQuestion = function (infoHash){

    var pendingLookup = this.pendingLookup;
    var pendingDns = this.pendingDns;

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

  // check if a peer announcer can resolve identification
  this.challengePeerAnnouncer = function (addr, infoHash, question){

    var pendingChallenges = this.pendingChallenges;

    var nounce = bitauth.generateSin().sin; // just a random string
    var transactionId = dhTable._getTransactionId(addr, function(){});
    var message = {
      "t":transactionIdToBuffer(transactionId),
      "y":"q",
      "q":"auth",
      "a":{
        "q":question,
        "n":nounce
      }
    };

    debug('');
    debug('sent \'auth\' request to %s', addr);
    debug(message);
    debug('transaction id= %s', message.t);
    debug('transaction question= %s', question);
    debug('transaction nounce= %s', nounce);

    dhTable._send(addr, message);
    pendingChallenges[nounce] = {};
    pendingChallenges[nounce].nounce = nounce;
    pendingChallenges[nounce].question = question;
    pendingChallenges[nounce].infoHash = infoHash;

  };

  // check if a response message is an 'auth' request reply
  this.isAuthRequestReply = function(addr, message){

    var pendingChallenges = this.pendingChallenges;

    var type = message.y && message.y.toString();
    if (type === 'r') {
      var identity = message.r
        && message.r.i
        && message.r.i.toString();
      var signature = message.r
        && message.r.s
        && message.r.s.toString();
      var nounce = message.r
        && message.r.n
        && message.r.n.toString();
      return identity !== undefined
        && signature !== undefined
        && nounce !== undefined
        && pendingChallenges[nounce];
    }
    return false;
  };

  // validate that announcer correctly answered the challenge
  this.validateAuthRequestReply = function(addr, message, then){

    var pendingChallenges = this.pendingChallenges;
    var pendingDns = this.pendingDns;

    var identity = message.r
      && message.r.i
      && message.r.i.toString();
    var signature = message.r
      && message.r.s
      && message.r.s.toString();
    var nounce = message.r
      && message.r.n
      && message.r.n.toString();

    if(pendingChallenges[nounce]) {
      var question = pendingChallenges[nounce].question;

      var publicKey = pendingDns[question].publicKey;

      // do something to cipher/un cipher the challenge here

      debug('');
      debug('got \'auth\' request reply from %s', addr);
      debug(message);
      debug('question %s', question);
      debug('nounce %s', nounce);
      debug('identity %s', identity);
      debug('publicKey %s', publicKey);
      debug('identity===publicKey %s', (identity===publicKey));
      debug('signature %s', signature);

      bitauth.verifySignature((question+nounce), publicKey, signature, function(err, result) {
        if(!err && result) {
          var sin = bitauth.getSinFromPublicKey(identity);
          if(sin) {
            debug('pending Dns publickey %s', pendingDns[question].publicKey);
            debug('sin %s', sin);
            debug('successful identification %s', addr);
            return then(null, nounce);
          }
        }
        then(err, false);
      });

    }
  };

  // resolve pending resolve question and invoke relative callback
  this.resolveDNSQuestion = function(addr, nounce){

    var pendingChallenges = this.pendingChallenges;
    var pendingDns = this.pendingDns;
    var pendingLookup = this.pendingLookup;
    var knownDns = this.knownDns;

    var name = pendingChallenges[nounce].question;
    var infoHash = pendingChallenges[nounce].infoHash;
    var then = pendingDns[name].then;

    delete pendingChallenges[nounce];
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
};


var DHTSolver = function(opts){
  var debug = require('debug')('dns-via-dht');

  if (!opts.port) {
    opts.port = 9090;
  }
  if (!opts.hostname) {
    opts.hostname = '127.0.0.1';
  }

  var DHTY = require('bootstrap-dht-yourself');

  this.dhTable = null;
  this.announcer = null;
  this.resolver = null;

  this.announce = function(newDns, privateKey){
    if(!this.announcer) throw 'Announcer not ready !'; // cannot consume an announcer if DHTSolver is not yet started
    return this.announcer.announce(newDns, privateKey);
  };

  this.announceAll = function(){
    if(!this.announcer) throw 'Announcer not ready !'; // cannot consume an announcer if DHTSolver is not yet started
    return this.announcer.announceAll();
  };

  this.listAnnouncements = function(){
    if(!this.announcer) throw 'Announcer not ready !'; // cannot consume an announcer if DHTSolver is not yet started
    return this.announcer.listAnnouncements();
  };

  this.resolve = function(dnsToSolve, publicKey, then){
    if(!this.resolver) throw 'Resolver not ready !'; // cannot consume a resolver if DHTSolver is not yet started
    if( !this.announcer.isAnnounced(dnsToSolve) ) {
      return this.resolver.resolve(dnsToSolve, publicKey, function(err, closest){
        debug('err %s', err);
        debug('closest %s', closest);
        if (then) then(err, closest);
      });
    }
    then(null, this.announcer.announcedDns[dnsToSolve]);
    return false;
  };


  // start the DHT and invoke the callback(announcer, resolver)
  this.start = function(then){

    debug('bootstrap=%s', opts.bootstrap);
    debug('K=%s', opts.K);
    var that = this;
    this.dhTable = DHTY(opts, function(dhTable) {
      debug('DHT is ready');

      that.announcer = new DHTNodeAnnouncer(dhTable, opts);
      that.resolver = new DHTNodeResolver(dhTable, opts);

      // peer announce a dns that matches a pending question, challenge him with 'auth' request
      dhTable.on('peer', function (addr, infoHash){
        var name = that.resolver.getPendingDNSQuestion(infoHash);
        if ( name !== false ){
          that.resolver.challengePeerAnnouncer(addr, infoHash, name);
        } else {
          debug('skip peer %s %s', addr, infoHash);
        }
      });

      // detect and realize the negotiation for 'auth' request - reply sequence
      dhTable.socket.on('message', function (data, rinfo){
        var message = decodeMessage(data);
        if (message !== false) {
          var addr = rinfo.address + ':' + rinfo.port;
          if (that.announcer.isAuthRequest(addr, message) ){
            that.announcer.replyAuthRequest(addr, message);
          } else if (that.resolver.isAuthRequestReply(addr, message) ){
            that.resolver.validateAuthRequestReply(addr, message,
              function(err, nounce){
              if ( nounce === false ){
                debug('wrong id, pass %s', nounce)
              } else {
                that.resolver.resolveDNSQuestion(addr, nounce);
              }
            });
          }
        }
      });

      process.nextTick(function(){
        then();
      });

    });
    this.dhTable.listen(opts.port, opts.hostname);
  };

  this.stop = function(then){
    var that = this;
    that.dhTable.destroy(function(){
      that.dhTable = null;
      that.resolver = null;
      that.announcer = null;
      if(then) then();
    });
  };

  this.getDhtAddress = function(){
    return opts.hostname + ':' + opts.port;
  };

  this.getDhtStatus = function(){
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

function decodeMessage(data){
  var debug = require('debug')('dns-via-dht');
  var message;
  try {
    message = bencode.decode(data);
    if (!message) {
      throw 'invalid message';
    }
  } catch (err) {
    debug('err %s', err);
    return false;
  }

  return message;
};

// took from feross/bittorrent-dht
function transactionIdToBuffer (transactionId) {
  if (Buffer.isBuffer(transactionId)) {
    return transactionId
  } else {
    var buf = new Buffer(2)
    buf.writeUInt16BE(transactionId, 0)
    return buf
  }
};

// expose a constructor
module.exports = DHTSolver;
