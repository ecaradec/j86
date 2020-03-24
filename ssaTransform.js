
var writeIndex = {};
// -> n05
var n0 = {
    name: 'n0',
    phis: {},
    variables: {},
    assembly: [
        {w: {t:'VAR', v:'a'}, r1:{t:'DIGIT', v:1}},
    ],
    parents: [],
    children: []
};

// n05 -> n1
// n05 -> n2
var n05 = {
    name: 'n05',
    phis: {},
    variables: {},
    assembly: [
        {w: {t:'VAR', v:'b'}, r1:{t:'VAR', v:'a'}, r2:{t:'VAR', v:'a'}},
    ],
    parents: [],
    children: []
};

// n1 -> n
var n1 = {
    name: 'n1',
    phis: {},
    variables: {},
    assembly: [
        {w: {t:'VAR', v:'a'}, r1:{t:'DIGIT', v:1}},
    ],
    parents: [],
    children: []
};

// n2 -> n
var n2 = {
    name: 'n2',
    phis: {},
    variables: {},
    assembly: [
        {w: {t:'VAR', v:'a'}, r1:{t:'DIGIT', v:2}},
    ],
    parents: [],
    children: []
};

var n = {
    name: 'n',
    phis: {},
    variables: {},
    assembly: [
        {w: {t:'VAR', v:'b'}, r1:{t:'VAR', v:'a'}},
        {w: {t:'VAR', v:'a'}, r1:{t:'DIGIT', v:'1'}},
    ],
    parents: [],
    children: []
};

function addChild(p, c) {
    p.children.push(c);
    c.parents.push(p);
}

addChild(n0, n05); // root
    addChild(n05, n1); // if
    addChild(n05, n2);
    addChild(n1, n);
    addChild(n2, n);
addChild(n, n05); // loop

function getVariable(n, v) {
    // was the variable found in the block
    if(n.variables[v.v]) {
        return {t: 'VAR', v: n.variables[v.v]};
    }
    // was the variable found in phis
    if(n.phis[v.v]) {
        return {t: 'VAR', v:n.phis[v.v].w};
    }

    // we don't know variable and there is no other node => fail
    if(n.parents.length == 0)
        return v; //throw 'Cant find variable '+v.v;
    
    // we have only one parent, don't add phi, ask parent
    if(n.parents.length == 1)
        return getVariable(n.parents[0], v);

    // more than one predecessor, add a phi function if none was defined yet => this is our new variable
    // we'll fix the list of source variable latter
    if(n.phis[v.v] == undefined) {
        var x = addVariable(n, v);
        n.phis[v.v] = {w: x.v, r:[]};
    }

    // return the variable of the phi function
    return {t: 'VAR', v: n.phis[v.v].w};
}

function addVariable(n, v) {
    writeIndex[v.v] = (writeIndex[v.v]+1 || 0)
    n.variables[v.v] = v.v+'_'+writeIndex[v.v];
    return {t: 'VAR', v:n.variables[v.v]};
}

function transform(n) {
    for(var i in n.assembly) {
        var ins = n.assembly[i];

        if(ins.r1 && ins.r1.t == 'VAR')
            ins.r1 = getVariable(n, ins.r1);
        if(ins.r2 && ins.r2.t == 'VAR')
            ins.r2 = getVariable(n, ins.r2);
        if(ins.w && ins.w.t == 'VAR')
            ins.w = addVariable(n, ins.w);
    }
    n.done = true;
}

// process blocks
function bfs(n,f) {
    var stack = [];
    stack.push(n);
    var c;
    while(c = stack.shift()) {
        if(c.visited == f)
            continue;
        c.visited = f;
        f(c);
        for(var i in c.children) {
            stack.push(c.children[i]);
        }
    }
}

module.exports = function(n) {
    
    bfs(n, transform);

    // Fix incomplete phis (happens with loops )
    bfs(n, function(n) {
        for(var j in n.phis) {
            for(var k in n.parents) {
                n.phis[j].r[k] = getVariable(n.parents[k], {t: 'VAR', v:j}).v;
            }
        }
    });

    /*bfs(n0, function(n) {
        console.log(n.name+'.phis', JSON.stringify(n.phis));
        console.log(n.name+'.ass', JSON.stringify(n.assembly));
    });*/
}
