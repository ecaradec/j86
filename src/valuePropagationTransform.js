'use strict';

function valuePropagationTransform(b) {
    // rename each variable in instruction in SSA form
    let ilcode = [];
    // the content of the memory
    for(let i in b.predecessors)
        b.memoryMapping = {...b.memoryMapping, ...b.predecessors[i].memoryMapping};
    
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];

        if(ins.op == 'phi') {
            b.memoryMapping[ins.id] = ins.w;
        }
        if(ins.op == '=' && ins.w && !ins.r2) {
            // as no register is read before been initialize we should always know what it contains
            if(b.memoryMapping[ins.r1.v]) {
                b.memoryMapping[ins.w.v] = b.memoryMapping[ins.r1.v];
            } else {
                b.memoryMapping[ins.w.v] = ins.r1;
            }
            ins.r1 = b.memoryMapping[ins.w.v];
        }
        if(ins.r1 && b.memoryMapping[ins.r1.v]) {
            // replace a register by its known value if any
            ins.r1 = b.memoryMapping[ins.r1.v];
        }
        if(ins.r2 && b.memoryMapping[ins.r2.v]) {
            // replace a register by its known value if any
            ins.r2 = b.memoryMapping[ins.r2.v];
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
            if(b.memoryMapping[v])
                phi.r[ipred] = b.memoryMapping[v];
        }
    }
    
    // recurse through dominated nodes giving a copy of the current index of variables
    for(let ic in b.children) {
        valuePropagationTransform(b.children[ic]);
    }
}


module.exports = valuePropagationTransform;