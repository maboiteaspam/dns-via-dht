# DNS via DHT

Provides an API to announce and resolve a domain name via DHT.

It is using bitauth api to identify the right domain owner among many conflicting responses.

# Beware

Still a work in progress : )

# Install

```zsh
npm i maboiteaspam/dns-via-dht -g
```

if you don t have sudo, but you need it, fyi, you may do :

```zsh
mkdir some
cd some
npm i maboiteaspam/dns-via-dht
# node node_modules/.bin/dns-via-dht # you d start it that way
```

# Run

To run a complete setup with both server and client, please follow those steps.

#### Terminal 1

Start a server that announces a domain.

```zsh
> dns-via-dht announce 'mydomain.com' 'passphrase'
Starting DHT on 127.0.0.1:9091
DHT ready
Announcing mydomain.com
Public key 02413xxxxxxxxxx7364c8
```

#### Terminal 2

Start a client to resolve the domain announced in the first terminal.

```zsh
> dns-via-dht resolve 'mydomain.com' '[public-key]'
```

#### Unavailable bootstrap nodes

Something that happens to me, i workaround this by doing a dirty network scan, [https://github.com/maboiteaspam/bootstrap-dht-yourself](find out more)

```zsh
> dns-via-dht resolve 'mydomain.com' 'pubKey' -b 'diy'
```


# Usage

```zsh
  Usage: cli [options] [command]


  Commands:

    announce <dns> [passphrase]  Announce a DNS on the network
    resolve <dns> <publickey>    Resolve a DNS on the network
    dhtstart                     Start empty DHT

  Options:

    -h, --help                 output usage information
    -V, --version              output the version number
    -v, --verbose              enable verbosity
    -p, --port <port>          port on which the DHT listens
    -h, --hostname <hostname>  hostname on which DHT listens
    -K, --knodes <K>           K nodes to find before he DHT is ready
    -b, --bootstrap <nodes>    ip:port address of the bootstrap nodes, 
                                or, 'diy' to scan the network for the BT DHT
```

#### Test locally

Let's start by creating an origin DHT to serve as a bootstrap node to our network.

```zsh
dns-via-dht dhtstart -b '' -p 9090 -h '127.0.0.1' -K 1
```

Let s connect that origin DHT and announce our domain name.

```zsh
dns-via-dht announce 'mydomain.com' 'whatever-passphrase'  \
-b '127.0.0.1:9090' -p 9091 -h '127.0.0.1' -K 1
```

Let s now resolve the domain name via the origin DHT.

```zsh
dns-via-dht resolve 'mydomain.com' 'xxxx-public-key' \
-b '127.0.0.1:9090' -h '127.0.0.1' -p 9092 -K 1
```

In all cases we reduce K nodes to fasten the testing.

The process can be repeated as many times as you want to grow the DHT.

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

It provides methods such start(then), resolve(dns, publicKey, then), announce(dns, passphrase).

###### start(then)

```js
    solver.start(function(){
      console.log('DHT ready');
    });
```

###### resolve(dns, publicKey, then)

```js
    solver.start(function(){
      solver.resolve(dns, publicKey, function(err, response){
        console.log(err);
        console.log(response.dns + ' = > ' + response.ip);
      });
    });
```

###### announce(dns, passphrase)

```js
    solver.start(function(){
      if (solver.announce(dns, passphrase) ){
        console.log('Announcing ' + dns);
      } else {
        console.log('Did not announce ' + dns);
      }
    });
```

### Identification sequence

1. peer A announce on the DHT as a simple torrent(of url) of the domain a-domain.com.
    Each announced domains is provided with a private key.
    In returns it provides a public key that proves it s identity.
2. peer B realize a lookup(of the torrent.infoHash) on the DHT.
3. For each peer announcer, peer B will challenge it.
    Challenge consist of a DNS question and a random string nounce.
    Challenge sequence is done over UDP without encryption.
4. peer A, the announcer, receive the challenge, it will sign it using its private key, signedData=sign(question+nounce).
5. peer B check each response signature provided using it s public key of the DNS question.
    On first peer correctly checked, peer B resolves the query.
    If the request can not be resolved within of 5s timeout, it resolves empty


# TODO

##### really missing stuff
- make test IRL
- add continuous testing
- provide a dns server implementation for quick setup
- adjust timeout on dns lookup, and known dns
- check how to responds a sort of 404 DNS not found.


##### to make it better
- proper implementation via method binding on bittorrent-dht
- improve verbose option to enhance debug reading



### Projects i digged before i came up with that

- https://github.com/feross/bittorrent-dht
- https://github.com/feross/create-torrent
- https://github.com/torrentkino/torrentkino
- https://github.com/maxogden/torrent
- https://github.com/mwarning/masala
- https://github.com/mwarning/KadNode
- https://github.com/tjfontaine/node-dns
- https://github.com/Mononofu/P2P-DNS
- https://github.com/okTurtles/dnschain
- https://github.com/mafintosh/read-torrent
- https://github.com/fanatid/node-libtorrent
- https://github.com/WizKid/node-bittorrent-tracker
- https://github.com/bitpay/bitauth

