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
    return {...n, ssa:n.v + '_' + getSSAIndex(n, varIndex)};
}
function isVar(v) {
    return v !== undefined && (v.t == 'VAR' || v.t == 'VREG');
}

// Traverse the dominance tree, increasing variables index progressively
function renameBlock(b, varIndex) {
    if(varIndex === undefined) varIndex = {};

    // rename each variable in instruction in SSA form
    let ilcode = [];
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];

        if(isVar(ins.w)) {
            varIndex[ins.w.v] = getSSAIndex(ins.w, varIndex) + 1;
            ins.w = getSSAForm(ins.w, varIndex);
        }
        if(isVar(ins.r1)) {
            ins.r1 = getSSAForm(ins.r1, varIndex);
        }
        if(isVar(ins.r2)) {
            ins.r2 = getSSAForm(ins.r2, varIndex);
        }
        ilcode.push(ins);
    }
    b.ilcode = ilcode;

    // initialize the current value for the variable in phi for all successors of the node
    for(let is in b.successors) {
        let n = b.successors[is];
        for(let v in n.phis) {
            let phi = n.phis[v];

            let index = varIndex[v];
            varIndex[v] = index !== undefined ? index : 0;

            // find the index of the current block in the current block predecessor
            let ipred = n.predecessors.indexOf(b);
            phi.r[ipred] = getSSAForm(phi.w, varIndex);

            // increment the index of phi if this wasn't already done
            if(!phi.wUpdated) {
                varIndex[v]++;
                phi.w = getSSAForm(phi.w, varIndex);
                
                if(b.func.variables[phi.w.v])
                    phi.w.address = b.func.variables[phi.w.v].address;
                if(b.func.args[phi.w.v])
                    phi.w.address = b.func.args[phi.w.v].address;

                phi.wUpdated = true;
            }
        }
    }

    // recurse through dominated nodes giving a copy of the current index of variables
    for(let ic in b.children) {
        renameBlock(b.children[ic], {...varIndex});
    }
}

let nodes;
module.exports = function(nodes_) {
    nodes = nodes_;

    renameBlock(nodes[0]);
};