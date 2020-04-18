'use strict';

const parser = require('./parser');
const ssaTransform = require('./ssaTransform');
const buildDominance = require('./dominance');
const frontierSSATransform = require('./frontierSSATransform');
const phiToIRTransform = require('./phiToIRTransform');
const registersTransform = require('./registerTransform');
const { printIR } = require('./printIR');
const printAssembly = require('./printAssembly');
const getRegister = require('./register.js');

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


function addLoadAndStore(b) {
    // rename each variable in instruction in SSA form
    let ilcode = [];
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];

        const r1 = {t: 'REG', v:'r1'};
        const r2 = {t: 'REG', v:'r2'};
        const w = {t: 'REG', v:'r3'};
        
        let load1, load2, store;
        if(isVar(ins.r1)) {
            load1 = {op: 'load', w: r1, r1: ins.r1 };
            ins.r1 = r1;
        }
        if(isVar(ins.r2)) {
            load2 = {op: 'load', w: r2, r1: ins.r2 };
            ins.r2 = r2;
        }
        if(isVar(ins.w)) {
            store = {op: 'store', r1: w, r2: ins.w };
            ins.w = w;
        }
    
        if(load1)
            ilcode.push(load1);
        if(load2)
            ilcode.push(load2);
        ilcode.push(ins);
        if(store)
            ilcode.push(store);
    
    }
    b.ilcode = ilcode;

    // recurse through dominated nodes giving a copy of the current index of variables
    for(let ic in b.children) {
        addLoadAndStore(b.children[ic]);
    }
}

function isVar(v) {
    return v !== undefined && v.t == 'VAR';
}

fs.readFile(process.argv[2], 'utf8', function(err, program) {
    parser.build(program);
    printIR(parser.getAST());
    console.log('');

    let nodes = buildDominance(parser.getAST());
    addLoadAndStore(parser.getAST());
    printIR(parser.getAST());
    console.log('');

    //ssaTransform(parser.getAST());
    frontierSSATransform(nodes);
    printIR(parser.getAST());
    console.log('');

    phiToIRTransform(parser.getAST());
    printIR(parser.getAST());
    console.log('');

    registersTransform(parser.getAST());
    printIR(parser.getAST());
    console.log('');

    //printAssembly(parser.getAST(), parser.getStrings());    
});