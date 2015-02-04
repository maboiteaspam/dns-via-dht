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

We ll announce a domain on a DHT without any friendly node.

```
node cli.js announce 'mydomain.com' -b '' -p 9090 -h '127.0.0.1' -K 1
```

We ll now resolve the domain, this time we set the announcer as our bootstrap node.

```
node cli.js resolve 'mydomain.com' -b '127.0.0.1:9090' -h '127.0.0.1' -p 9091 -K 1
```

In both case we reduce K nodes for fasten the testing.

The process can be repeated as many times as you want to grow the DHT.


# Usage

```
  Usage: cli [options] [command]


  Commands:

    announce <dns>  Announce an hostname on the network
    resolve <dns>   Resolve an hostname on the network

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