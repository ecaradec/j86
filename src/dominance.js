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
    return nodes;
};