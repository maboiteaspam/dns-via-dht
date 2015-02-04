#!/usr/bin/env node

//process.env['DEBUG'] = '*';

var program = require('commander');

var pkg = require('./package.json');
var DHTSolver = require('./index');

// Configure CLI

program
  .version(pkg.version);

program
  .option('-v, --verbose',
  'enable verbosity');

program
  .option('-b, --bootstrap <nodes>',
  'ip:port address of the bootstrap nodes, or, \'diy\' to scan the network for the BT dht');

program
  .command('announce <dns>')
  .description('Announces a DNS on the network')
  .action(function(hostname){
    var opts = {
      port: 9090,
      hostname: '0.0.0.0'
    };

    if (program.verbose) {
      opts.debug = '*';
    }

    if (program.bootstrap) {
      opts.bootstrap = program.bootstrap;
    }

    var solver = new DHTSolver(opts);
    console.log('Starting DHT on ' + solver.getDhtAddress() );
    solver.start(function(){
      console.log('DHT ready');
      if (solver.announce(hostname) ){
        console.log('Announcing ' + hostname);
      } else {
        console.log('Did not announce ' + hostname);
      }
    });
  });

program.command('resolve <dns>')
  .description('Resolves a DNS on the network')
  .action(function(hostname){
    var opts = {
      port: 9091,
      hostname: '0.0.0.0'
    };

    if (program.verbose) {
      opts.debug = '*';
    }

    if (program.bootstrap) {
      opts.bootstrap = program.bootstrap;
    }

    var solver = new DHTSolver(opts);
    console.log('Starting DHT on ' + solver.getDhtAddress() );
    solver.start(function(){
      console.log('DHT ready');
      console.log('resolving');
      solver.resolve(hostname, function(err, response){
        console.log(err);
        console.log(response);
        console.log('Resolve succeed !');
        console.log(response.dns + ' = > ' + response.ip);
      });
    });
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
