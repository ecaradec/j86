'use strict';

const parser = require('./parser');
const ssaTransform = require('./ssaTransform');
const frontierSSATransform = require('./frontierSSATransform');
const phiToIRTransform = require('./phiToIRTransform');
const registersTransform = require('./registerTransform');
const { printIR } = require('./printIR');
const printAssembly = require('./printAssembly');

var fs = require('fs');

// add load before initializing from memory ??? reading from stackvar ?
// a_1 = load a.ptr (add before each new ssa value )
// c_1 = a_1
// b_1 = load b.ptr // insert before b_1
// d_1 = a_1 + b_1
// b_2 = 3
// 
// r1_1 = load a.addr
// r2_1 = r1_1
// store r2_1, c.addr
//
// r1_1 = load a.addr
// r2_1 = load b.addr
// r3_1 = r1_1 + r2_1
// store r3_1, d.addr
//
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
    printIR(parser.getAST());
    console.log('');

    registersTransform(parser.getAST());
    printIR(parser.getAST());
    console.log('');

    printAssembly(parser.getAST(), parser.getStrings());    
});