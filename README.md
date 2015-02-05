# DHT DNS solver

Provides an API to announce and resolve a domain name via DHT table.

Still a work in progress : )

# Install

```
npm i maboiteaspam/dht-dns-solver
```

# Run

#### Terminal 1
```
node cli.js announce 'mydomain.com'
```

#### Terminal 2
```
node cli.js resolve 'mydomain.com'
```

#### Unavailable bootstrap nodes

Something that happens to me, i workaround this by doing a dirty network scan

```
node cli.js resolve 'mydomain.com' -b diy
```

#### Test locally

Let's start by creating an empty DHT to serve as a bootstrap nodes to our network.

```
node cli.js dhtstart -b '' -p 9090 -h '127.0.0.1' -K 1
```

Let s connect that empty DHT and announce our domain name.

```
node cli.js announce 'mydomain.com' -b '' -p 9091 -h '127.0.0.1' -K 1
```

Let s now resolve the domain name on the previous DHT.

```
node cli.js resolve 'mydomain.com' -b '127.0.0.1:9090' -h '127.0.0.1' -p 9092 -K 1
```

In all cases we reduce K nodes for fasten the testing.

The process can be repeated as many times as you want to grow the DHT.


# Usage

```

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

# TODO

- implement challenge
- make test IRL
- add continuous testing
- proper implementation via method binding on bittorrent-dht