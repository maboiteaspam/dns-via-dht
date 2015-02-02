
var parse = require('domain-name-parser');
var createTorrent = require('create-torrent');
var parseTorrent = require('parse-torrent');

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
        then('already announced', false);
      } else if (knownDns[dnsToSolve]) {
        then(null, knownDns[dnsToSolve]);
      } else if (announcedDns[dnsToSolve]) {
        then(null, announcedDns[dnsToSolve]);
      } else {
        pendingDns[dnsToSolve] = {
          question: dnsToSolve,
          then: then
        };
        createTorrent(new Buffer(dnsToSolve), {name: dnsToSolve},
          function (err, torrent) {
            if (err) {
              console.log(err);
            }
            torrent = parseTorrent(torrent);
            pendingLookup[torrent.infoHash] = {
              infoHash: torrent.infoHash,
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
    var knownDns = this.knownDns;
    var pendingDns = this.pendingDns;
    var pendingLookup = this.pendingLookup;

    var dhtAddress = this.getDhtAddress();
    this.dhTable = DHTY(opts, function(dhTable) {
      dhTable.listen(opts.port, opts.hostname, function () {
        console.log(dhtAddress + ' listening ');
      });
      dhTable.on('ready', function () {
        console.log(dhtAddress + ' ready ');
      });
      dhTable.on('peer', function (addr, hash, from) {
        console.log(dhtAddress + ' peer ');
        console.log(addr, from);
      });
      dhTable.on('error', function (err) {
        console.log(dhtAddress + ' error ');
        console.log(err);
      });
      dhTable.on('warning', function () {
        console.log(dhtAddress + ' warning ');
      });
      dhTable.on('announce', function (addr, hash, from) {
        console.log(dhtAddress + ' announce ');
        console.log(addr, hash, from);
      });
      dhTable.on('peer', function (addr, infoHash, from) {
        var transaction = pendingLookup[infoHash];
        if (transaction) {
          var name = transaction.question;
          if (pendingDns[name]) {
            knownDns[name] = {
              ip: from.split(':')[0],
              dns: name
            };
            pendingDns[name].then(null, knownDns[name]);
            delete pendingDns[infoHash];
            delete pendingLookup[infoHash];
          }
        }
      });
      if (then) {
        then();
      }
    });
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

module.exports = DHTSolver;
