'use strict';

const getRegister = require('./register.js');

// This transform code using variable (stored in memory) 
// into separate load, store and operations using registers.
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
function loadAndStoreTransform(b) {
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
        loadAndStoreTransform(b.children[ic]);
    }
}

function loadAndStoreTransform2(b) {
    // rename each variable in instruction in SSA form
    let loadedVar = {};
    let ilcode = [];
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];
        if(ins.op == 'ptrOf') {
            ilcode.push(ins);
            continue;
        }

        let load1, load2;
        if(isVar(ins.r1)) {
            let r1 = loadedVar[ins.r1.ssa];
            if(!r1) {
                r1 = getRegister();
                load2 = {op: 'load', w: r1, r1: ins.r1 };
            }
            ins.r1 = r1;
        }
        if(isVar(ins.r2)) {
            let r2 = loadedVar[ins.r2.ssa];
            if(!r2) {
                r2 = getRegister();
                load2 = {op: 'load', w: r2, r1: ins.r2 };
            }
            ins.r2 = r2;
        }
        if(isVar(ins.w)) {
            const w = getRegister();
            loadedVar[ins.w.ssa] = w;
            ins.w = w;
        }
    
        if(load1)
            ilcode.push(load1);
        if(load2)
            ilcode.push(load2);
        ilcode.push(ins);
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
        loadAndStoreTransform2(b.children[ic]);
    }
}


function isVar(v) {
    return v !== undefined && (v.t == 'VAR'/*||v.t=='VREG'*/);
}

module.exports = loadAndStoreTransform;