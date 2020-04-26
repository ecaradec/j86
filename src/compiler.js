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
const addressesTransform = require('./addressesTransform');

var fs = require('fs');

fs.readFile(process.argv[2], 'utf8', function(err, program) {
    if(process.argv[3] === undefined) {
        parser.build(program);
        let dominance = buildDominance(parser.getStartBlock());
        let dominanceOrderList = dominance.getDominanceOrderNodeList(parser.getStartBlock());
        frontierSSATransform(dominanceOrderList);
        valuePropagationTransform(dominanceOrderList);
        dropUnusedTransform(dominanceOrderList);
        phiToIRTransform(dominanceOrderList);
        loadAndStoreTransform(dominanceOrderList);
        registerAllocationTransform(dominanceOrderList);
        addressesTransform(dominanceOrderList);
        printAssembly(parser.getBlockList(), parser.getStrings());
        return;
    }

    if(process.argv[3] === '--debug') {
        console.log('* PARSING *');
        parser.build(program);
        printIR(parser.getBlockList());
        console.log('');

        console.log('* DOMINANCE & PHI INSERTION *');
        let dominance = buildDominance(parser.getStartBlock());
        let dominanceOrderList = dominance.getDominanceOrderNodeList(parser.getStartBlock());
        printIR(parser.getBlockList());
        console.log('');

        console.log('* SSA TRANSFORM *');
        frontierSSATransform(dominanceOrderList);
        printIR(parser.getBlockList());
        console.log('');
        
        console.log('* VALUE PROPAGATION TRANSFORM *');
        valuePropagationTransform(dominanceOrderList);
        printIR(parser.getBlockList());
        console.log('');

        console.log('* DROP UNUSED TRANSFORM *');
        dropUnusedTransform(dominanceOrderList);
        printIR(parser.getBlockList());
        console.log('');

        console.log('* PHI RESOLUTION TRANSFORM *');
        phiToIRTransform(dominanceOrderList);
        printIR(parser.getBlockList());
        console.log('');

        console.log('* LOAD AND STORE TRANSFORM *');
        loadAndStoreTransform(dominanceOrderList);
        printIR(parser.getBlockList());
        console.log('');

        console.log('* x86 REGISTER ALLOCATION TRANSFORM *');
        registerAllocationTransform(dominanceOrderList);
        printIR(parser.getBlockList());
        console.log('');

        console.log('* x86 ADDRESSES TRANSFORM *');
        addressesTransform(dominanceOrderList);
        printIR(parser.getBlockList());
        console.log('');

        console.log('* x86 ASSEMBLY TRANSFORM *');
        printAssembly(parser.getBlockList(), parser.getStrings());    
    }
});