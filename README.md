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