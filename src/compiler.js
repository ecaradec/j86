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
        if(ins.op == 'ptrOf' || ins.op =='phi') {
            ilcode.push(ins);
            continue;
        }

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

    for(let is in b.successors) {
        let n = b.successors[is];
        const phis = n.getPHIs();
        for(let v in phis) {
            let phi = phis[v];
            phi.w = getRegister();
        }
    }

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

        if(ins.op == 'phi') {
            memoryMapping[ins.id] = ins.w;
        }

        if(ins.op == 'load') {
            // if we don't know what's in the memory, at leat it contains
            // the same as the register we just read
            if(!memoryMapping[ins.r1.v])
                memoryMapping[ins.r1.v] = ins.w;

            // load in the register the content of the memory
            registerMapping[ins.w.v] = memoryMapping[ins.r1.v];
        }
        if(ins.op == 'store') {
            // the memory is equal to the content of the register
            if(registerMapping[ins.r2.v])
                memoryMapping[ins.r1.v] = registerMapping[ins.r2.v];
            else
                memoryMapping[ins.r1.v] = ins.r2;
        }
        if(ins.op == '=' && ins.r1 && ins.w && !ins.r2 && registerMapping[ins.r1.v]) {
            // as no register is read before been initialize we should always know what it contains
            registerMapping[ins.w.v] = registerMapping[ins.r1.v];
        }
        if(ins.r1 && registerMapping[ins.r1.v]) {
            // replace a register by its known value if any
            ins.r1 = registerMapping[ins.r1.v];
        }
        if(ins.r2 && registerMapping[ins.r2.v]) {
            // replace a register by its known value if any
            ins.r2 = registerMapping[ins.r2.v];
        }
        ilcode.push(ins);
    }
    b.ilcode = ilcode;
    // console.log(JSON.stringify(registerMapping));
    // console.log(JSON.stringify(memoryMapping));

    for(let is in b.successors) {
        let n = b.successors[is];
        const phis = n.getPHIs();
        for(let v in phis) {
            let phi = phis[v];

            // find the index of the current block in the current block predecessor
            const ipred = n.predecessors.indexOf(b);
            if(memoryMapping[v])
                phi.r[ipred] = memoryMapping[v];
            if(registerMapping[v])
                phi.r[ipred] = registerMapping[v];
        }
    }
    
    // recurse through dominated nodes giving a copy of the current index of variables
    for(let ic in b.children) {
        valuePropagationTransform(b.children[ic]);
    }
}

// drop instructions that produce registers that are never read
// As we dont do value propagation accross block, except in phi instructions
// a register cant be propagated to another block. So we don't need to seek for register
// usage in all blocks, only in successors phi functions.
function dropUnusedTransform(b) {
    let ilcode = [];

    // TODO: should initialize from predecessors functions
    let usedRegister = {};
    
    for(let is in b.successors) {
        let n = b.successors[is];
        const phis = n.getPHIs();
        for(let v in phis) {
            let phi = phis[v];
            phi.r.forEach(x=>usedRegister[x.ssa]=true);
        }
    }

    for(let i = b.ilcode.length-1; i>=0; i--) {
        let ins = b.ilcode[i];

        // if the destination register of a register never used, drop the instruction
        if( (ins.op =='=' || ins.op =='load' || ins.op == 'phi' ) && ins.w && !usedRegister[ins.w.v])
            continue;

        // TODO : should probably be done more cleanly: 
        // if variable doesn't exists on all path remove the phi
        if(ins.op == 'phi' && ( ins.r[0] == undefined || ins.r[1] == undefined)) {
            continue;
        }
        // local variable don't need to be stored (unless we take a pointer to them )
        if( ins.op == 'store' && ins.r1.t == 'VAR')
            continue;

        if(ins.r1)
            usedRegister[ins.r1.v] = true;
        if(ins.r2)
            usedRegister[ins.r2.v] = true;
        
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
    printIR(parser.getBlockList());
    console.log('');

    console.log('* DOMINANCE & PHI INSERTION *');
    let nodes = buildDominance(parser.getAST());
    printIR(parser.getBlockList());
    console.log('');

    console.log('* SSA TRANSFORM *');
    clearVisited(nodes[0]);
    frontierSSATransform(nodes);
    printIR(parser.getBlockList());
    console.log('');

    console.log('* LOAD AND STORE TRANSFORM *');
    clearVisited(nodes[0]);
    addLoadAndStore(parser.getAST());
    printIR(parser.getBlockList());
    console.log('');
    
    console.log('* VALUE PROPAGATION TRANSFORM *');
    clearVisited(nodes[0]);
    valuePropagationTransform(nodes[0]);
    printIR(parser.getBlockList());
    console.log('');

    console.log('* DROP UNUSED TRANSFORM *');
    clearVisited(nodes[0]);
    dropUnusedTransform(nodes[0]);
    printIR(parser.getBlockList());
    console.log('');

    console.log('* PHI RESOLUTION TRANSFORM *');
    phiToIRTransform(parser.getAST());
    printIR(parser.getBlockList());
    console.log('');

    console.log('* REGISTER ALLOCATION TRANSFORM *');
    clearVisited(nodes[0]);
    registersTransform(parser.getAST());
    printIR(parser.getBlockList());
    console.log('');

    printAssembly(parser.getBlockList(), parser.getStrings());    
});