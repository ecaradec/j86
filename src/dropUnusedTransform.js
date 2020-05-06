'use strict';

function dropUnusedTransform(nodes) {
    nodes = [...nodes].reverse();
    for(let ib in nodes) {
        let b = nodes[ib];

        // we start by the deepest node in dominance
        let usedVariables = {};
        for(let ic in b.successors) {
            usedVariables = {...usedVariables, ...b.successors[ic].usedVariables};
        }
        
        // drop inaccessible code
        let ilcode = [];
        for(let i = 0; i<b.ilcode.length; i++) {
            let ins = b.ilcode[i];
            ilcode.push(ins);
            if(ins.op == 'return') {
                break;
            }
        }

        b.ilcode = ilcode;
        ilcode = [];
        for(let i = b.ilcode.length-1; i>=0; i--) {
            let ins = b.ilcode[i];

            // if the destination register of a register never used, drop the instruction
            if( (ins.op =='=' || ins.op == 'phi' ) && ins.w && !usedVariables[ins.w.ssa])
                continue;

            // TODO : should prob                              ably be done more cleanly: 
            // if variable doesn't exists on all path remove the phi
            if(ins.op == 'phi' && ( ins.r[0] == undefined || ins.r[1] == undefined)) {
                continue;
            }

            for(let ir in ins.r) {
                let r = ins.r[ir];
                usedVariables[r.ssa] = true;
            }
            
            ilcode.unshift(ins);
        }
        b.ilcode = ilcode;

        b.usedVariables = usedVariables;
    }
}

module.exports = (f) => dropUnusedTransform(f.dominanceOrderList);