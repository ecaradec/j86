'use strict';

const parser = require('./parser');
const dominanceTransform = require('./dominance');
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
    parser.build(program);

    if(process.argv[3] === '--debug') {
        console.log('* PARSING *');
        printIR(parser.getBlockList());
    }

    let transforms = [
        {name: '* DOMINANCE & PHI INSERTION *', f: dominanceTransform},
        {name: '* SSA TRANSFORM *', f: frontierSSATransform},
        {name: '* VALUE PROPAGATION TRANSFORM *', f: valuePropagationTransform},
        {name: '* DROP UNUSED TRANSFORM *', f: dropUnusedTransform},
        {name: '* PHI RESOLUTION TRANSFORM *', f: phiToIRTransform},
        {name: '* LOAD AND STORE TRANSFORM *', f: loadAndStoreTransform},
        {name: '* x86 REGISTER ALLOCATION TRANSFORM *', f: registerAllocationTransform},
        {name: '* x86 ADDRESSES TRANSFORM *', f: addressesTransform},
    ];
    
    let functions = parser.getFunctions();
    for(let it in transforms) {
        for(let f of functions) {
            transforms[it].f(f);
        }
        if(process.argv[3] === '--debug') {
            console.log(transforms[it].name);
            printIR(parser.getBlockList());
        }
    }

    if(process.argv[3] === '--debug') {
        console.log('* x86 ASSEMBLY TRANSFORM *');
    }

    printAssembly(parser.getBlockList(), parser.getStrings());
});