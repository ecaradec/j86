'use strict';

function dropUnusedTransform(nodes) {
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

            if(ins.r1)
                usedVariables[ins.r1.ssa] = true;
            if(ins.r2)
                usedVariables[ins.r2.ssa] = true;
            
            ilcode.unshift(ins);
        }
        b.ilcode = ilcode;

        b.usedVariables = usedVariables;
    }
}

module.exports = dropUnusedTransform;