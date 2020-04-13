'use strict';

const parser = require('./parser');
const ssaTransform = require('./ssaTransform');
const phiToIRTransform = require('./phiToIRTransform');
const registersTransform = require('./registerTransform');
const { printIR } = require('./printIR');
const printAssembly = require('./printAssembly');

var fs = require('fs');
 
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
// for each n in node
//  if there is more than one predecessor
//    for each p in predecessors
//      intialize runner to precessor
//      mov up from dominant to dominant until I reach the dominant of n
//      add n to the frontier of runner
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

let doms;

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
function getVar(n, varIndex) {
    return {t:'VAR', v:n + '_' + varIndex[n]};
}
function isVar(v) {
    return v !== undefined && v.t == 'VAR';
}
// Traverse the dominance tree, increasing variables index progressively
function renameBlock(b, varIndex) {
    if(varIndex === undefined) varIndex = {};

    // rename each variable in instruction in SSA form
    for(let i in b.ilcode) {
        let ins = b.ilcode[i];
        if(isVar(ins.w)) {
            let index = varIndex[ins.w.v];
            varIndex[ins.w.v] = index !== undefined ? index + 1 : 0; 
            ins.w = getVar(ins.w.v, varIndex);
        }
        if(isVar(ins.r1)) ins.r1 = getVar(ins.r1.v, varIndex);
        if(isVar(ins.r2)) ins.r2 = getVar(ins.r2.v, varIndex);
    }

    // initialize the current value for the variable in phi for all successors of the node
    for(let is in b.successors) {
        let n = b.successors[is];
        for(let v in n.phis) {
            let phi = n.phis[v];

            let index = varIndex[v];
            varIndex[v] = index !== undefined ? index : 0;

            // find the index of the current block in the current block predecessor
            let ipred = n.predecessors.indexOf(b);
            phi.r[ipred] = getVar(v, varIndex).v;

            // increment the index of phi if this wasn't already done
            if(!phi.wUpdated) {
                varIndex[v]++;
                phi.w = getVar(v, varIndex).v;
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
// // https://www.cs.colostate.edu/~mstrout/CS553/slides/lecture03.pdf
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

/*
for(let i in nodes) {
    let name = nodes[i].name;
    console.log(name, doms[name].name, JSON.stringify(nodes[i].frontier.map(x=>x.name)));
}
*/

//return;
// compute dominance
// compute dominance frontier
// compute phi functions

let nodes;

fs.readFile(process.argv[2], 'utf8', function(err, program) {
    parser.build(program);
    printIR(parser.getAST());
    //return;

    nodes = backOrderTraverse(parser.getAST()).reverse();

    for(let i in nodes) {
        // nodes[i].id = i;
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

    console.log(nodes.map(x=>x.name));

    for(let i in nodes) {
        let name = nodes[i].name;
        console.log(name, doms[name].name, JSON.stringify(nodes[i].frontier.map(x=>x.name)));
    }

    buildLiveVariable(nodes[0]);

    placePhiFunctions(nodes);

    renameBlock(nodes[0]);

    console.log('');
    printIR(parser.getAST());
    

    //return;
    //ssaTransform(parser.getAST());

    printIR(parser.getAST());
    console.log('');

    //console.log(backOrderTraverse(parser.getAST()).map(n=>n.name).join('\n'));
    //return;

    phiToIRTransform(parser.getAST());
    registersTransform(parser.getAST());
    printAssembly(parser.getAST(), parser.getStrings());    
});