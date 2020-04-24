'use strict';


// drop instructions that produce registers that are never read
// As we dont do value propagation accross block, except in phi instructions
// a register cant be propagated to another block. So we don't need to seek for register
// usage in all blocks, only in successors phi functions.
function dropUnusedTransform(b) {
    let usedRegister = {};
    
    for(let is in b.successors) {
        let n = b.successors[is];
        const phis = n.getPHIs();
        for(let v in phis) {
            let phi = phis[v];
            phi.r.forEach(x=>usedRegister[x.ssa]=true);
        }
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

module.exports = dropUnusedTransform;