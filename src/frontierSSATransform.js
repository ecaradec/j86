// Renaming of variables
//
// - build dominance tree
// - increase index of each variable on write
// - use current index of variable on read
// - propagate variable index to successor in phi read correct branch
// - recurse into children in dominance tree
function getSSAIndex(n, varIndex) {
    return varIndex[n.v] = varIndex[n.v] !== undefined ? varIndex[n.v] : 0;
}
function getSSAForm(n, varIndex) {
    const index = getSSAIndex(n, varIndex);
    return {...n, ssa:n.v + '_' + index, ssaIndex: index};
}
function isVar(v) {
    return v !== undefined && (v.t == 'VAR' || v.t == 'VREG');
}

// Traverse the dominance tree, increasing variables index progressively
function renameBlock(b, writeIndex) {
    if(writeIndex === undefined) writeIndex = {};

    b.readIndex = {};
    for(let i in b.predecessors) {
        let p = b.predecessors[i];
        b.readIndex = {...b.readIndex, ...p.readIndex};
    }

    // rename each variable in instruction in SSA form
    let ilcode = [];
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];
        // phi are already processed in previous node
        if(ins.op == 'phi') {
            b.readIndex[ins.w.v] = ins.w.ssaIndex;
            ilcode.push(ins);
            continue;
        }

        if(isVar(ins.w)) {
            if(!writeIndex[ins.w.v]) writeIndex[ins.w.v] = 0;
            b.readIndex[ins.w.v] = writeIndex[ins.w.v] = writeIndex[ins.w.v] + 1;
            ins.w = getSSAForm(ins.w, b.readIndex);
        }
        if(isVar(ins.r1)) {
            ins.r1 = getSSAForm(ins.r1, b.readIndex);
        }
        if(isVar(ins.r2)) {
            ins.r2 = getSSAForm(ins.r2, b.readIndex);
        }
        ilcode.push(ins);
    }
    b.ilcode = ilcode;

    // initialize the current value for the variable in phi for all successors of the node
    for(let is in b.successors) {
        let n = b.successors[is];
        const phis = n.getPHIs();
        for(let v in phis) {
            let phi = phis[v];

            let index = b.readIndex[v];
            // if the variable is unknow on that path, skip it
            if(index === undefined)
                continue;

            // find the index of the current block in the current block predecessor
            let ipred = n.predecessors.indexOf(b);
            phi.r[ipred] = getSSAForm(phi.w, b.readIndex);

            // increment the index of phi, but only do it if it wasn't in ssa form already
            if(!phi.w.ssa) {
                b.readIndex[v] = writeIndex[v] = writeIndex[v] + 1;
                phi.w = getSSAForm(phi.w, b.readIndex);

                if(b.func.variables[phi.w.v])
                    phi.w.address = b.func.variables[phi.w.v].address;
                if(b.func.args[phi.w.v])
                    phi.w.address = b.func.args[phi.w.v].address;
            }
        }
    }

    // recurse through dominated nodes giving a copy of the current index of variables
    for(let ic in b.children) {
        renameBlock(b.children[ic], writeIndex);
    }
}

module.exports = function(startNode) {
    renameBlock(startNode);
};