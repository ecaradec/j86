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
        
        let load1, load2, store;
        if(isVar(ins.r1)) {
            const r1 = getRegister();
            load1 = {op: 'load', w: r1, r1: ins.r1 };
            ins.r1 = r1;
        }
        if(isVar(ins.r2)) {
            const r2 = getRegister();
            load2 = {op: 'load', w: r2, r1: ins.r2 };
            ins.r2 = r2;
        }
        if(isVar(ins.w)) {
            const w = getRegister();
            store = {op: 'store', r1: ins.w, r2: w };
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


function valuePropagationTransform(b) {
    // rename each variable in instruction in SSA form
    let ilcode = [];
    // the content of registers
    let registerMapping = {};
    // the content of the memory
    let memoryMapping = {};
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];

        if(ins.op == 'load') {
            if(memoryMapping[ins.r1.v]) {
                // if we know what is in memory load it into register
                registerMapping[ins.w.ssa] = memoryMapping[ins.r1.v];
            } else {
                // the memory state is equal to the register we just read
                // this is only possible because we never rewrite in a register
                memoryMapping[ins.r1.v] = ins.w;
            }
        }
        if(ins.op == 'store') {
            // the memory is equal to the content of the register
            memoryMapping[ins.r1.v] = registerMapping[ins.r2.ssa];
        }
        if(ins.op == '=' && ins.r1 && ins.w && !ins.r2) {
            // the register is equal to the register we just set into
            registerMapping[ins.w.ssa] = ins.r1;
        }
        if(ins.r1 && registerMapping[ins.r1.ssa]) {
            // replace a register by its known value if any
            ins.r1 = registerMapping[ins.r1.ssa];
        }
        if(ins.r2 && registerMapping[ins.r2.ssa]) {
            // replace a register by its known value if any
            ins.r2 = registerMapping[ins.r2.ssa];
        }
        ilcode.push(ins);
    }
    b.ilcode = ilcode;
    // console.log(JSON.stringify(registerMapping));
    //console.log(JSON.stringify(memoryMapping));

    // TODO: should fix phi function with correct variable ?
    for(let is in b.successors) {
        let n = b.successors[is];
        for(let v in n.phis) {
            let phi = n.phis[v];

            // find the index of the current block in the current block predecessor
            let ipred = n.predecessors.indexOf(b);
            phi.r[ipred] = memoryMapping[v];
            // phi.w = registerMapping[v];
        }
    }

    // recurse through dominated nodes giving a copy of the current index of variables
    for(let ic in b.children) {
        valuePropagationTransform(b.children[ic]);
    }
}

// drop instructions that produce registers that are never read
function dropUnusedTransform(b) {
    // rename each variable in instruction in SSA form
    let ilcode = [];
    let usedRegister = {}; // TODO: should initialize from successor phi functions
    for(let i = b.ilcode.length-1; i>=0; i--) {
        let ins = b.ilcode[i];
        if(ins.r1)
            usedRegister[ins.r1.v] = true;
        if(ins.r2)
            usedRegister[ins.r2.v] = true;

        if( (ins.op =='=' || ins.op =='load' || ins.op =='store' ) && ins.w && !usedRegister[ins.w.v])
            continue;
        
        ilcode.unshift(ins);
    }
    b.ilcode = ilcode;
    // console.log(JSON.stringify(usedRegister));

    // recurse through dominated nodes giving a copy of the current index of variables
    for(let ic in b.children) {
        dropUnusedTransform(b.children[ic]);
    }
}

function isVar(v) {
    return v !== undefined && (v.t == 'VAR'/*||v.t=='VREG'*/);
}


function clearVisited(b) {
    if (b.visited === undefined) return;
    delete b.visited;
    for (const child of b.successors) {
        clearVisited(child);
    }
}

fs.readFile(process.argv[2], 'utf8', function(err, program) {
    console.log('* PARSING *');
    parser.build(program);
    printIR(parser.getAST());
    console.log('');

    console.log('* DOMINANCE & PHI INSERTION *');
    let nodes = buildDominance(parser.getAST());
    printIR(parser.getAST());
    console.log('');

    console.log('* SSA TRANSFORM *');
    clearVisited(nodes[0]);
    frontierSSATransform(nodes);
    printIR(parser.getAST());
    console.log('');

    console.log('* LOAD AND STORE TRANSFORM *');
    clearVisited(nodes[0]);
    addLoadAndStore(parser.getAST());
    printIR(parser.getAST());
    console.log('');
    
    console.log('* VALUE PROPAGATION TRANSFORM *');
    clearVisited(nodes[0]);
    valuePropagationTransform(nodes[0]);
    printIR(parser.getAST());
    console.log('');

    console.log('* DROP UNUSED TRANSFORM *');
    clearVisited(nodes[0]);
    dropUnusedTransform(nodes[0]);
    printIR(parser.getAST());
    console.log('');

    console.log('* PHI RESOLUTION TRANSFORM *');
    phiToIRTransform(parser.getAST());
    printIR(parser.getAST());
    console.log('');

    console.log('* REGISTER ALLOCATION TRANSFORM *');
    clearVisited(nodes[0]);
    registersTransform(parser.getAST());
    printIR(parser.getAST());
    console.log('');

    printAssembly(parser.getAST(), parser.getStrings());    
});