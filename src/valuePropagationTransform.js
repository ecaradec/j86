'use strict';

function valuePropagationTransform(nodes) {
    for(let ib in nodes) {
        let b = nodes[ib];
        
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
            if(ins.op == '=' && ins.w && ins.r.length == 1) {
                // as no register is read before been initialize we should always know what it contains
                if(b.memoryMapping[ins.r[0]]) {
                    b.memoryMapping[ins.w.v] = b.memoryMapping[ins.r[0]];
                } else {
                    b.memoryMapping[ins.w.v] = ins.r[0];
                }
            }
            for(let ir in ins.r) {
                if(ins.r[ir] && b.memoryMapping[ins.r[ir].v]) {
                    // replace a register by its known value if any
                    ins.r[ir] = b.memoryMapping[ins.r[ir].v];
                }
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
    }
}

module.exports = (f)=> valuePropagationTransform(f.dominanceOrderList);