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
function loadAndStoreTransform(nodes) {
    for(let j in nodes) {
        let b = nodes[j];
            
        let registerMapping = {};
        for(let i in b.predecessors) {
            let n = b.predecessors[i];
            registerMapping = {...registerMapping, ...n.registerMapping};
        }

        // rename each variable in instruction in SSA form
        let ilcode = [];
        for(let i in b.ilcode) {
            let ins = b.ilcode[i];

            let load1, load2;
            if(isRegistrable(ins.r1) && ins.op != 'ptrOf') {
                let r1;
                if(registerMapping[ins.r1.ssa]) {
                    r1 = registerMapping[ins.r1.ssa];
                } else {
                    r1 = getRegister();
                    load1 = {op: 'load', w: r1, r1: ins.r1 };
                    registerMapping[ins.r1.ssa] = r1;
                }
                ins.r1 = r1;
            }
            if(isRegistrable(ins.r2) && ins.op != 'ptrOf') {
                let r2;
                if(registerMapping[ins.r2.ssa]) {
                    r2 = registerMapping[ins.r2.ssa];
                } else {
                    r2 = getRegister();
                    load2 = {op: 'load', w: r2, r1: ins.r2 };
                    registerMapping[ins.r2.ssa] = r2;
                }
                ins.r2 = r2;
            }
            if(isRegistrable(ins.w)) {
                let w;
                if(registerMapping[ins.w.ssa]) {
                    w = registerMapping[ins.w.ssa];
                } else {
                    w = getRegister();
                    registerMapping[ins.w.ssa] = w;
                }
                ins.w = w;
            }

            if(load1)
                ilcode.push(load1);
            if(load2)
                ilcode.push(load2);
            ilcode.push(ins);
        }
        b.ilcode = ilcode;

        b.registerMapping = registerMapping;
    }
}

let types = {
    INT32: {size: 4},
    INT64: {size: 8},
};

function isRegistrable(v) {
    return v !== undefined && v.t == 'VAR' && types[v.type].size == 4;
}

module.exports = loadAndStoreTransform;