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
  'ip:port address of the bootstrap nodes');

program
  .command('announce <dns>')
  .description('Announces an hostname on the network')
  .action(function(hostname, program){
    var opts = {
      port: 9090,
      hostname:'0.0.0.0'
    };

    if (program.parent.verbose) {
      opts.debug = '*';
    }

    if (program.parent.bootstrap) {
      opts.bootstrap = program.parent.bootstrap;
    }

    var solver = new DHTSolver(opts);
    console.log('Starting DHT on ' + solver.getDhtAddress());
    solver.start(function(){
      console.log('DHT ready');
      if( solver.announce(hostname) ){
        console.log('Announcing ' + hostname)
      } else {
        console.log('Did not announce ' + hostname);
      }
    });
  });

program.command('resolve <dns>')
  .description('Resolves an hostname on the network')
  .action(function(hostname, program){
    var opts = {
      port: 9091,
      hostname:'0.0.0.0'
    };

    if (program.parent.verbose) {
      opts.debug = '*';
    }

    if (program.parent.bootstrap) {
      opts.bootstrap = program.parent.bootstrap;
    }

    var solver = new DHTSolver(opts);
    console.log('Starting DHT on ' + solver.getDhtAddress());
    solver.start(function(){
      console.log('DHT ready');
      console.log('resolving');
      solver.resolve(hostname, function(err, response){
        console.log(err);
        console.log(response);
      });
    });
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
