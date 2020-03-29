const writeIndex = {};

function getVariable(n, v) {
    // was the variable found in the block
    if (n.variables[v.v]) {
        return n.variables[v.v];
    }
    // was the variable found in phis
    if (n.phis[v.v]) {
        return { t: 'VAR', v: n.phis[v.v].w };
    }

    // we don't know variable and there is no other node => fail
    if (n.predecessors.length == 0) {
        // return v;
        throw `Cant find variable ${v.v}`;
    }

    // we have only one parent, don't add phi, ask parent
    if (n.predecessors.length == 1) return getVariable(n.predecessors[0], v);

    // more than one predecessor, add a phi function if none was defined yet => this is our new variable
    // we'll fix the list of source variable latter
    if (n.phis[v.v] == undefined) {
        var x = addVariable(n, v);
        n.phis[v.v] = { w: x.v, r: [] };
    }

    // If previous block is solved, query result
    // This ensure, we are not creating phi locally without propagating it
    for (const i in n.predecessors) {
        let x = null;
        if (n.predecessors[i].done) {
            x = getVariable(n.predecessors[i], v).v;
        }
        n.phis[v.v].r[i] = x;
    }

    // return the variable of the phi function
    return { t: 'VAR', v: n.phis[v.v].w };
}

function addVariable(n, v) {
    writeIndex[v.v] = writeIndex[v.v] + 1 || 0;
    n.variables[v.v] = { t: 'VAR', v: `${v.v}_${writeIndex[v.v]}` };
    return n.variables[v.v];
}

function transform(n) {
    for (const ins of n.ilcode) {
        if (ins.r1 && ins.r1.t == 'VAR') ins.r1 = getVariable(n, ins.r1);
        if (ins.r2 && ins.r2.t == 'VAR') ins.r2 = getVariable(n, ins.r2);
        if (ins.w && ins.w.t == 'VAR') ins.w = addVariable(n, ins.w);
    }
    n.done = true;
}

// process blocks
function bfs(n, f) {
    const stack = [];
    stack.push(n);
    let c;
    while ((c = stack.shift())) {
        if (c.visited == f) continue;
        c.visited = f;
        f(c);
        for (const i in c.successors) {
            stack.push(c.successors[i]);
        }
    }
}

module.exports = function (n) {
    bfs(n, transform);

    // Fix incomplete phis (happens with loops )
    bfs(n, n => {
        for (const j in n.phis) {
            const phi = n.phis[j];
            for (const k in n.predecessors) {
                if (phi.r[k] == null) {
                    phi.r[k] = getVariable(n.predecessors[k], {
                        t: 'VAR',
                        v: j,
                    }).v;
                }
            }
        }
    });

    /* bfs(n0, function(n) {
        console.log(n.name+'.phis', JSON.stringify(n.phis));
        console.log(n.name+'.ass', JSON.stringify(n.assembly));
    }); */
};
