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
function renameBlock(b, readIndex, writeIndex) {
    if(readIndex === undefined) readIndex = {};
    if(writeIndex === undefined) writeIndex = {};

    // rename each variable in instruction in SSA form
    let ilcode = [];
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];

        if(isVar(ins.w)) {
            if(!writeIndex[ins.w.v]) writeIndex[ins.w.v] = 0;
            readIndex[ins.w.v] = writeIndex[ins.w.v] = writeIndex[ins.w.v] + 1;
            ins.w = getSSAForm(ins.w, readIndex);
        }
        if(isVar(ins.r1)) {
            ins.r1 = getSSAForm(ins.r1, readIndex);
        }
        if(isVar(ins.r2)) {
            ins.r2 = getSSAForm(ins.r2, readIndex);
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

            let index = readIndex[v];
            // if the variable is unknow on that path, skip it
            if(index === undefined)
                continue;

            // find the index of the current block in the current block predecessor
            let ipred = n.predecessors.indexOf(b);
            phi.r[ipred] = getSSAForm(phi.w, readIndex);

            // increment the index of phi, but only do it if it wasn't in ssa form already
            if(!phi.w.ssa) {
                readIndex[v] = writeIndex[v] = writeIndex[v] + 1;
                phi.w = getSSAForm(phi.w, readIndex);

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
        renameBlock(b.children[ic], {...readIndex}, writeIndex);
    }
}

let nodes;
module.exports = function(nodes_) {
    nodes = nodes_;

    renameBlock(nodes[0]);
};