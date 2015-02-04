# DHT DNS solver

Provides an API to resolve a domain name via DHT table.

Still a work in progress : )

# Install

npm i maboiteaspam/dht-dns-solver

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

We ll now resolve the domain, this time we set announcer as our bootstrap nodes.

```
node cli.js resolve 'mydomain.com' -b '127.0.0.1:9090' -h '127.0.0.1' -p 9091 -K 1
```

In both case we reduce K nodes for faster testing.

The process can repeated as many times as you want to grow the DHT.


# Usage

```
  Usage: cli [options] [command]


  Commands:

    announce <dns>  Announces an hostname on the network
    resolve <dns>   Resolves an hostname on the network

  Options:

    -h, --help               output usage information
    -V, --version            output the version number
    -v, --verbose            enable verbosity
    -b, --bootstrap <nodes>  ip:port address of the bootstrap nodes, or, 'diy' to scan the network for the BT dht
```

# TODO

- implement challenge
- make test IRL
- add continuous testing
- proper implementation via method binding on bittorrent-dht