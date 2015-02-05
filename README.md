# DHT DNS solver

Provides an API to announce and resolve a domain name via DHT.

Still a work in progress : )

# Install

```zsh
npm i maboiteaspam/dht-dns-solver
```

# Run

#### Terminal 1
```zsh
node cli.js announce 'mydomain.com'
```

#### Terminal 2
```zsh
node cli.js resolve 'mydomain.com'
```

#### Unavailable bootstrap nodes

Something that happens to me, i workaround this by doing a dirty network scan

```zsh
node cli.js resolve 'mydomain.com' -b 'diy'
```

#### Test locally

Let's start by creating an empty DHT to serve as a bootstrap nodes to our network.

```zsh
node cli.js dhtstart -b '' -p 9090 -h '127.0.0.1' -K 1
```

Let s connect that empty DHT and announce our domain name.

```zsh
node cli.js announce 'mydomain.com' -b '' -p 9091 -h '127.0.0.1' -K 1
```

Let s now resolve the domain name on the previous DHT.

```zsh
node cli.js resolve 'mydomain.com' -b '127.0.0.1:9090' -h '127.0.0.1' -p 9092 -K 1
```

In all cases we reduce K nodes for fasten the testing.

The process can be repeated as many times as you want to grow the DHT.


# Usage

```zsh
  Usage: cli [options] [command]


  Commands:

    announce <dns>  Announce a DNS on the network
    resolve <dns>   Resolve a DNS on the network
    dhtstart        Start empty DHT

  Options:

    -h, --help                 output usage information
    -V, --version              output the version number
    -v, --verbose              enable verbosity
    -p, --port <port>          port on which the DHT listens
    -h, --hostname <hostname>  hostname on which DHT listens
    -K, --knodes <K>           K nodes to find before he DHT is ready
    -b, --bootstrap <nodes>    ip:port address of the bootstrap nodes, or, 'diy' to scan the network for the BT DHT
```

# API

dns-dht-solver is a module that exposes a DHTSolver constructor.

```js
    var DHTSolver = require('dns-dht-solver');
    var solver = new DHTSolver(opts || {
      port: 9090, // DHT port number
      hostname: '0.0.0.0', // DHT hostname
      K: 20, // K nodes before DHT gets ready
      bootstrap: false // bootstrap method : 'diy', false, [ip/hostname,...]
    });
```

It provides you methods such start(then), resolve(dns,then), announce(dns).

###### start(then)

```js
    solver.start(function(){
      console.log('DHT ready');
    });
```

###### resolve(dns, then)

```js
    solver.start(function(){
      solver.resolve(dns, function(err, response){
        console.log(err);
        console.log(response.dns + ' = > ' + response.ip);
      });
    });
```

###### announce(dns)

```js
    solver.start(function(){
      if (solver.announce(dns) ){
        console.log('Announcing ' + dns);
      } else {
        console.log('Did not announce ' + dns);
      }
    });
```



# TODO

##### really missing stuff
- implement challenge
- make test IRL
- add continuous testing
- provide a dns server implementation for quick setup


##### to make it better
- proper implementation via method binding on bittorrent-dht
- improve verbose option to enhance debug reading



# Projects i have dig before i came up with that

https://github.com/feross/bittorrent-dht
https://github.com/feross/create-torrent
https://github.com/torrentkino/torrentkino
https://github.com/maxogden/torrent
https://github.com/mwarning/masala
https://github.com/mwarning/KadNode
https://github.com/tjfontaine/node-dns
https://github.com/Mononofu/P2P-DNS
https://github.com/okTurtles/dnschain
https://github.com/mafintosh/read-torrent
https://github.com/fanatid/node-libtorrent
https://github.com/WizKid/node-bittorrent-tracker
