'use strict';

const getRegister = require('./register.js');
const types = require('./types.js');

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

            let load = [];
            for(let ir in ins.r) {
                if(isRegistrable(ins.r[ir]) && ins.op != 'ptrOf') {
                    let r;
                    if(registerMapping[ins.r[ir].ssa]) {
                        r = registerMapping[ins.r[ir].ssa];
                    } else {
                        r = getRegister();
                        load.push({op: 'load', w: r, r: [ins.r[ir]] });
                        registerMapping[ins.r[ir].ssa] = r;
                    }
                    ins.r[ir] = r;
                }
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

            for(let i in load) {
                ilcode.push(load[i]);
            }
            ilcode.push(ins);
        }
        b.ilcode = ilcode;

        b.registerMapping = registerMapping;
    }
}

function isRegistrable(v) {
    return v !== undefined && v.t == 'VAR' && types[v.type].s == 4;
}

module.exports = (f)=> loadAndStoreTransform(f.dominanceOrderList);