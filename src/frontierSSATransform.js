
// Get the list of all variables used in a block
function getVariables(n) {
    let variables = {};
    for(let ii in n.ilcode) {
        let ins = n.ilcode[ii];
        if(ins.w && ins.w.t == 'VAR') variables[ins.w.v] = true;
        if(ins.r1 && ins.r1.t == 'VAR') variables[ins.r1.v] = true;
        if(ins.r2 && ins.r2.t == 'VAR') variables[ins.r2.v] = true;
    }
    return Object.keys(variables);
}

// get the list of all variables in all blocks
function getAllVariables(nodes) {
    let allVariables = {};
    for(let i in nodes) {
        let variables = getVariables(nodes[i]);
        for(let v in variables) {
            allVariables[variables[v]] = true;
        }
    }
    return Object.keys(allVariables);
}

// get the list of blocks where a variable is used
function getDefSites(nodes) {
    let defSites={};
    for(let i in nodes) {
        let n = nodes[i];
        let variables = getVariables(nodes[i]);
        for(let v in variables) {
            if(defSites[variables[v]] == undefined) defSites[variables[v]] = [];
            defSites[variables[v]].push(n);
        }
    }
    return defSites;
}

// add phi function to the dominant 
function placePhiFunctions(nodes) {
    let defSites = getDefSites(nodes);
    let allVariables = getAllVariables(nodes);
    // process variables one at a time
    for(let iv in allVariables) {
        let v = allVariables[iv];
        let w = defSites[v];
        // as long as there is block with that variable we didn't process
        // (new block can show up when we add phi functions )
        while(w.length > 0) {
            let n = w.pop();
            for(let i in n.frontier) {
                let f = n.frontier[i];
                // check if variable is live on all predecessors
                let isLive = true;
                for(let ip in f.predecessors) {
                    let p = f.predecessors[ip];
                    isLive &= p.liveVariables[v];
                }
                // if there is no phi and the variable is live, add it
                if( f.phis[v] == undefined && isLive) {
                    f.phis[v] = {w: v, r:[]};
                    w.push(f);
                }
            }
        }
    }
}

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
    return {t:'REG', v:n.v, ssa:n.v + '_' + getSSAIndex(n, varIndex), mod: n.mod, preSSA: n.v};
}
function isRegister(v) {
    return v !== undefined && v.t == 'REG';
}
function getAddress(b, r) {
    if(b.func.variables[r.v])
        return b.func.variables[r.v];
    if(b.func.args[r.v])
        return b.func.args[r.v];
    throw `Variable ${r.v} doesnt exists`;
}
// Traverse the dominance tree, increasing variables index progressively
function renameBlock(b, varIndex) {
    if(varIndex === undefined) varIndex = {};

    // rename each variable in instruction in SSA form
    let ilcode = [];
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];

        if(isRegister(ins.w)) {
            varIndex[ins.w.v] = getSSAIndex(ins.w, varIndex) + 1;
            ins.w = getSSAForm(ins.w, varIndex);
        }
        if(isRegister(ins.r1)) {
            ins.r1 = getSSAForm(ins.r1, varIndex);
        }
        if(isRegister(ins.r2)) {
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
            phi.r[ipred] = getSSAForm({t:'VAR', v:v}, varIndex).v;

            // increment the index of phi if this wasn't already done
            if(!phi.wUpdated) {
                varIndex[v]++;
                phi.w = getSSAForm({t:'VAR', v:v}, varIndex).v;
                phi.wUpdated = true;
            }
        }
    }

    // recurse through dominated nodes giving a copy of the current index of variables
    for(let ic in b.children) {
        renameBlock(b.children[ic], {...varIndex});
    }
}

// Live range and live interval
// https://web.stanford.edu/class/archive/cs/cs143/cs143.1128/lectures/17/Slides17.pdf
//
// A better algorithm
// https://www.cs.colostate.edu/~mstrout/CS553/slides/lecture03.pdf
function buildLiveVariable(n) {
    if (n.visited == buildLiveVariable) return;
    n.visited = buildLiveVariable;

    let liveVariables = {};
    for (let s of n.successors) {
        liveVariables = {
            ...buildLiveVariable(s)
        };
    }

    // Propagate read variables for backward
    // When a variable is read, it's added to the list of active variables
    // When a variable is written, it is removed from the list of active variable
    for (let i = n.ilcode.length - 1; i >= 0; i--) {
        const ins = n.ilcode[i];
        if (ins == undefined) {
            continue;
        }

        // Propagate read variables backwards / Delete written variable
        // As the language doesn't have variable definition, writing the variable is considered the definition
        if (ins.w && ins.w.t == 'VAR') {
            delete liveVariables[ins.w.v];
        }

        if (ins.r1 && ins.r1.t == 'VAR') {
            liveVariables[ins.r1.v] = true;
        }

        if (ins.r2 && ins.r2.t == 'VAR') {
            liveVariables[ins.r2.v] = true;
        }
    }

    for(let i in n.predecessors) {
        let p = n.predecessors[i];
        p.liveVariables = {...p.liveVariables, ...liveVariables};
    }

    return liveVariables;
}

let nodes;
module.exports = function(nodes_) {
    nodes = nodes_;

    buildLiveVariable(nodes[0]);

    placePhiFunctions(nodes);

    renameBlock(nodes[0]);
};