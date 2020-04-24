'use strict';
//
// This transformation assign a reduced number of registers and memory space
// to variables.
//
// Decompose the graph of variable relations on node at a time
// then build it back and add registers if possible and spill variable on stack
// when no register is available.
// It also has for effect that spill variables space are reused if they
// are not used anywhere else to reduce stack space reservation.
const vertices = {};

function addVertex(n) {
    if (vertices[n] != undefined) return;
    vertices[n] = {
        connections: []
    };
}

function addEdge(a, b) {
    if (vertices[a].connections.indexOf(b) == -1) vertices[a].connections.push(b);
    if (vertices[b].connections.indexOf(a) == -1) vertices[b].connections.push(a);
}

function findLowestConnectedVertex() {
    let lowestConnectionNb = 1000000;
    let lowestConnectedNode;

    for (const i in vertices) {
        if (vertices[i].connections.length < lowestConnectionNb) {
            lowestConnectionNb = vertices[i].connections.length;
            lowestConnectedNode = i;
        }
    }
    return lowestConnectedNode;
}

function dropVertex(n) {
    const cloned = {
        id: n,
        connections: [...vertices[n].connections]
    };

    for (const i in vertices[n].connections) {
        const nn = vertices[n].connections[i];

        const pos = vertices[nn].connections.indexOf(n);
        if (pos != -1) vertices[nn].connections.splice(pos, 1);
    }
    delete vertices[n];

    return cloned;
}

// Return a variable to register or variable to spill variable using graph coloring
function findVariableMapping() {
    const d = findLowestConnectedVertex();
    if (d == undefined) return;

    const dropped = dropVertex(d);

    findVariableMapping();

    // build back graph and delete used registers
    addVertex(dropped.id);
    // EAX is always used as a temporary
    const availableRegisters = {
        eax: {
            t: 'REG',
            k: 'eax',
            v: 'eax',
            index: 0
        },
        ebx: {
            t: 'REG',
            k: 'ebx',
            v: 'ebx',
            index: 0
        },
        ecx: {
            t: 'REG',
            k: 'ecx',
            v: 'ecx',
            index: 1
        },
        edx: {
            t: 'REG',
            k: 'edx',
            v: 'edx',
            index: 3
        },
    };

    // creates as many registers as there is variables, we'll try to use as few as possible
    // stack variables can be reused just the same as register
    // var availReg = {};
    let k = 1;
    for (let i in vertices) {
        i;
        if (k < 3);
        else {
            availableRegisters[`s${k}`] = {
                t: 'VAR',
                k: `s${k}`,
                v: `s${k}`,
                address: `ebp-${4 * k + 4}`,
                index: k,
                spill: true
            };
        }
        k++;
    }
    // var availReg = {'EBX':true, 'ECX':true, 'S0': true, 'S1': true};
    for (let i in dropped.connections) {
        const n = dropped.connections[i];
        delete availableRegisters[vertices[n].reg.k];
        addEdge(dropped.id, n);
    }

    // assign register if one left, or spill variable
    vertices[dropped.id].reg = availableRegisters[Object.keys(availableRegisters)[0]];

    const registers = {};
    for (let i in vertices) {
        registers[i] = vertices[i].reg;
    }
    return registers;
}

function addFullyLinkedVertices(keys) {
    for (let ii = 0; ii < keys.length; ii++) {
        addVertex(keys[ii]);
    }
    for (let ii = 0; ii < keys.length; ii++) {
        for (let jj = 0; jj < keys.length; jj++) {
            if (ii != jj) addEdge(keys[ii], keys[jj]);
        }
    }
}

function isRegister(v) {
    return v && (/*v.t == 'VAR' ||*/ v.t == 'VREG');
}
// Build a graph representing variable used at the same time
// 
// Parse the code backward, add vertex for each variable when the variable is read,
// remove the vertex when the variable is written. This allows to build the range
// where the variable is live
function buildLiveVariableGraph(n) {
    if (n.visited == buildLiveVariableGraph) return;
    n.visited = buildLiveVariableGraph;

    let liveVariables = {};
    for (let s of n.successors) {
        liveVariables = {
            ...buildLiveVariableGraph(s)
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

        //
        // During and after instruction
        //
        // Ensure a variable is available to write
        if (isRegister(ins.w)) {
            liveVariables[ins.w.ssa] = true;
        }

        if (isRegister(ins.r1)) {
            liveVariables[ins.r1.ssa] = true;
        }

        if (isRegister(ins.r2)) {
            liveVariables[ins.r2.ssa] = true;
        }

        addFullyLinkedVertices(Object.keys(liveVariables));

        //
        // before instruction
        //
        // Propagate read variables backwards / Delete written variable
        if (isRegister(ins.w)) {
            delete liveVariables[ins.w.ssa];
        }

        addFullyLinkedVertices(Object.keys(liveVariables));
    }

    return liveVariables;
}

function max(a, b) {
    return a > b ? a : b;
}

function replaceVariables(n, registers) {
    if (n.visited == 'replaceVars') return;
    n.visited = 'replaceVars';

    if (n.func) {
        for (var i in registers) {
            // always reserve some space for variable in case we need to have a pointer
            n.func.varCount = max(n.func.varCount, registers[i].index + 1);
            if (registers[i].t == 'REG')
                n.func.usedRegisters[registers[i].v] = true;
            else {
                registers[i].spill = true;
                registers[i].t = 'VAR';
            }
        }
    }

    let ilcode = [];
    for (let ii = 0; ii < n.ilcode.length; ii++) {
        const ins = n.ilcode[ii];

        if (isRegister(ins.r1)) {
            ins.r1.t = registers[ins.r1.ssa].t;
            ins.r1.reg = registers[ins.r1.ssa].v;
            ins.r1.address = registers[ins.r1.ssa].address;
        }

        if (isRegister(ins.r2)) {
            ins.r2.t = registers[ins.r2.ssa].t;
            ins.r2.reg = registers[ins.r2.ssa].v;
            ins.r2.address = registers[ins.r2.ssa].address;
        }

        if (isRegister(ins.w)) {
            ins.w.t = registers[ins.w.ssa].t;
            ins.w.reg = registers[ins.w.ssa].v;
            ins.w.address = registers[ins.w.ssa].address;
        }

        // drop instructions that move register to iself
        // if (ins.op == '=' && ins.w != undefined && ins.w.reg == ins.r1.reg && ins.r2 == undefined) {
        //     continue;
        //}
        ilcode.push(ins);
    }
    n.ilcode = ilcode;

    for (let s of n.successors) {
        replaceVariables(s, registers);
    }
}

module.exports = function (block) {
    buildLiveVariableGraph(block);
    const mapping = findVariableMapping();
    replaceVariables(block, mapping);
};
