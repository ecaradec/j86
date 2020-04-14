'use strict';

const parser = require('./parser');
const ssaTransform = require('./ssaTransform');
const frontierSSATransform = require('./frontierSSATransform');
const phiToIRTransform = require('./phiToIRTransform');
const registersTransform = require('./registerTransform');
const { printIR } = require('./printIR');
const printAssembly = require('./printAssembly');

var fs = require('fs');

fs.readFile(process.argv[2], 'utf8', function(err, program) {
    parser.build(program);
    printIR(parser.getAST());

    console.log('');
    printIR(parser.getAST());

    //ssaTransform(parser.getAST());
    frontierSSATransform(parser.getAST());

    printIR(parser.getAST());
    console.log('');

    phiToIRTransform(parser.getAST());
    registersTransform(parser.getAST());
    printAssembly(parser.getAST(), parser.getStrings());    
});