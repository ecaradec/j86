'use strict';

const parser = require('./parser');
const buildDominance = require('./dominance');
const frontierSSATransform = require('./frontierSSATransform');
const phiToIRTransform = require('./phiToIRTransform');
const registerAllocationTransform = require('./registerAllocationTransform');
const { printIR } = require('./printIR');
const printAssembly = require('./printAssembly');
const loadAndStoreTransform = require('./loadAndStoreTransform');
const valuePropagationTransform = require('./valuePropagationTransform');
const dropUnusedTransform = require('./dropUnusedTransform');

var fs = require('fs');

fs.readFile(process.argv[2], 'utf8', function(err, program) {
    parser.build(program);
    buildDominance(parser.getStartBlock());
    frontierSSATransform(parser.getStartBlock());
    loadAndStoreTransform(parser.getStartBlock());
    valuePropagationTransform(parser.getStartBlock());
    dropUnusedTransform(parser.getStartBlock());
    phiToIRTransform(parser.getStartBlock());
    registerAllocationTransform(parser.getStartBlock());
    printAssembly(parser.getBlockList(), parser.getStrings());  

    return;

    console.log('* PARSING *');
    parser.build(program);
    printIR(parser.getBlockList());
    console.log('');

    console.log('* DOMINANCE & PHI INSERTION *');
    buildDominance(parser.getStartBlock());
    printIR(parser.getBlockList());
    console.log('');

    console.log('* SSA TRANSFORM *');
    frontierSSATransform(parser.getStartBlock());
    printIR(parser.getBlockList());
    console.log('');

    console.log('* LOAD AND STORE TRANSFORM *');
    loadAndStoreTransform(parser.getStartBlock());
    printIR(parser.getBlockList());
    console.log('');
    
    //return;
/*
    console.log('* VALUE PROPAGATION TRANSFORM *');
    valuePropagationTransform(parser.getStartBlock());
    printIR(parser.getBlockList());
    console.log('');

    console.log('* DROP UNUSED TRANSFORM *');
    dropUnusedTransform(parser.getStartBlock());
    printIR(parser.getBlockList());
    console.log('');
*/
    console.log('* PHI RESOLUTION TRANSFORM *');
    phiToIRTransform(parser.getStartBlock());
    printIR(parser.getBlockList());
    console.log('');

    console.log('* REGISTER ALLOCATION TRANSFORM *');
    registerAllocationTransform(parser.getStartBlock());
    printIR(parser.getBlockList());
    console.log('');

    console.log('* x86 ASSEMBLY TRANSFORM *');
    printAssembly(parser.getBlockList(), parser.getStrings());    
});