'use strict';

// recurse first, then push node on backtracking 
function backOrderTraverse(n) {
    let results = [];
    let visited = {};
    let f = function(n) {
        if(visited[n.name]) return;
        visited[n.name] = true;
        for(let i in n.successors) {
            f(n.successors[i]);
        }
        n.id = results.length;
        results.push(n);
        return results;
    };
    return f(n);
}

// Compute graph of immediate dominance
// Immediate dominance is the nearest node which is required to pass through to reach the dominated node
//
// repeat until there is no changes
//   for each n in reverse back order (but the first)
//   ; reverse backorder ensure we are traversing dominant first except in the case of loop
//     for each p in predecessors of n
//       intersect the dominance list of all predecessors
function dominance() {
    let doms = {};
    let changed = true;
    let reverseBackOrderNodes = [...nodes];
    let root = reverseBackOrderNodes.shift();
    doms[root.name] = root;

    let intersect = function(b1, b2) {
        let f1 = b1;
        let f2 = b2;
        while(f1 != f2) {
            while(f1.id < f2.id)
                f1 = doms[f1.name];
            while(f2.id < f1.id)
                f2 = doms[f2.name];
        }
        return f1;
    };

    while(changed) {
        changed = false;
        for(let i in reverseBackOrderNodes) {
            let n = reverseBackOrderNodes[i];
            let newIDOM = n.predecessors[0];
            for(let ii=1; ii<n.predecessors.length; ii++) {
                let p = n.predecessors[ii];
                if( doms[ p.name ] != undefined ) {
                    newIDOM = intersect(p, newIDOM);
                }
            }
            if(doms[n.name] != newIDOM) {
                doms[n.name] = newIDOM;
                changed = true;
            }
        }
    }
    return doms;
}

// when there is more than one path to reach a node, the dominance
// frontier is the ensemble of all node on paths that allow to reach the node
// starting from it's dominant node
//
// For each node, find the common dominant of all predecessor and mark all of 
// them as dominance frontier
function dominanceFrontier() {
    for(let i in nodes) {
        let b = nodes[i];
        if(b.predecessors && b.predecessors.length > 1) {
            // traverse all path that allows to go from dominated node to dominant node
            // each of the traversed node belongs to the dominance frontier of b
            for(let ii in b.predecessors) {
                let p = b.predecessors[ii];
                let runner = p;
                while(runner != doms[b.name]) {
                    runner.frontier[b.name] = b;
                    runner = doms[runner.name];
                }
            }
        }
    }

    for(let i in nodes) {
        nodes[i].frontier = Object.values(nodes[i].frontier);
    }
}


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
                if(isLive)
                    f.addPHI(v);
            }
        }
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

let doms;

let nodes;
module.exports = function(ast) {
    nodes = backOrderTraverse(ast).reverse();

    for(let i in nodes) {
        nodes[i].frontier = {};
        nodes[i].parents = [];
        nodes[i].children = [];
    }

    doms = dominance();
    dominanceFrontier();

    // build dominance tree
    for(let i=1; i<nodes.length; i++) {
        let n = nodes[i];
        let d = doms[n.name];
        n.parents.push(d);
        d.children.push(n);
    }

    buildLiveVariable(nodes[0]);

    placePhiFunctions(nodes);
    return nodes;
};