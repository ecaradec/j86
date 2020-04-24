'use strict';

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

module.exports = valuePropagationTransform;