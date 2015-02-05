#!/usr/bin/env node

//process.env['DEBUG'] = '*';

var program = require('commander');

var pkg = require('./package.json');

// Configure CLI

program
  .version(pkg.version);

program
  .option('-v, --verbose',
  'enable verbosity');

program
  .option('-p, --port <port>',
  'port on which the DHT listens');

program
  .option('-h, --hostname <hostname>',
  'hostname on which DHT listens');

program
  .option('-K, --knodes <K>',
  'K nodes to find before he DHT is ready');

program
  .option('-b, --bootstrap <nodes>',
  'ip:port address of the bootstrap nodes, or, \'diy\' to scan the network for the BT DHT');

program
  .command('announce <dns>')
  .description('Announce a DNS on the network')
  .action(function(dns){
    var opts = {
      port: parseInt(program.port) || 9090,
      hostname: program.hostname || '0.0.0.0'
    };

    if (program.verbose) {
      process.env['DEBUG'] = '*';
      process.env['DEBUG'] = 'dht-dns-solver';
    }

    if (program.knodes) {
      opts.K = program.knodes;
    }

    if (program.bootstrap === '') {
      opts.bootstrap = false;
    } else if (program.bootstrap) {
      opts.bootstrap = program.bootstrap;
    }

    var DHTSolver = require('./index');
    var solver = new DHTSolver(opts);
    console.log('Starting DHT on ' + solver.getDhtAddress() );
    solver.start(function(){
      console.log('DHT ready');
      if (solver.announce(dns) ){
        console.log('Announcing ' + dns);
      } else {
        console.log('Did not announce ' + dns);
      }
    });
  });

program.command('resolve <dns>')
  .description('Resolve a DNS on the network')
  .action(function(dns){
    var opts = {
      port: parseInt(program.port) || 9091,
      hostname: program.hostname || '0.0.0.0'
    };

    if (program.verbose) {
      process.env['DEBUG'] = '*';
      process.env['DEBUG'] = 'dht-dns-solver';
    }

    if (program.knodes) {
      opts.K = program.knodes;
    }

    if (program.bootstrap === '') {
      opts.bootstrap = false;
    } else if (program.bootstrap) {
      opts.bootstrap = program.bootstrap;
    }

    var DHTSolver = require('./index');
    var solver = new DHTSolver(opts);
    console.log('Starting DHT on ' + solver.getDhtAddress() );
    solver.start(function(){
      console.log('DHT ready');
      console.log('resolving');
      solver.resolve(dns, function(err, response){
        console.log(err);
        console.log(response);
        console.log('Resolve succeed !');
        console.log(response.dns + ' = > ' + response.ip);
      });
    });
  });

program.command('dhtstart')
  .description('Start empty DHT')
  .action(function(dns){
    var opts = {
      port: parseInt(program.port) || 9092,
      hostname: program.hostname || '0.0.0.0'
    };

    if (program.verbose) {
      process.env['DEBUG'] = '*';
      process.env['DEBUG'] = 'dht-dns-solver';
    }

    if (program.knodes) {
      opts.K = program.knodes;
    }

    if (program.bootstrap === '') {
      opts.bootstrap = false;
    } else if (program.bootstrap) {
      opts.bootstrap = program.bootstrap;
    }

    var DHTSolver = require('./index');
    var solver = new DHTSolver(opts);
    console.log('Starting DHT on ' + solver.getDhtAddress() );
    solver.start(function(){
      console.log('DHT ready');
    });
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
