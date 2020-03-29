//
// REGISTER ALLOCATION
//
const nodes = {};

function addNode(n) {
    if (nodes[n] != undefined) return;
    nodes[n] = {
        connections: []
    };
}

function addEdge(a, b) {
    if (nodes[a].connections.indexOf(b) == -1) nodes[a].connections.push(b);
    if (nodes[b].connections.indexOf(a) == -1) nodes[b].connections.push(a);
}

function findLowestConnectedNode() {
    let lowestConnectionNb = 1000000;
    let lowestConnectedNode;

    for (const i in nodes) {
        if (nodes[i].connections.length < lowestConnectionNb) {
            lowestConnectionNb = nodes[i].connections.length;
            lowestConnectedNode = i;
        }
    }
    return lowestConnectedNode;
}

function dropNode(n) {
    const cloned = {
        id: n,
        connections: [...nodes[n].connections]
    };

    for (const i in nodes[n].connections) {
        const nn = nodes[n].connections[i];

        const pos = nodes[nn].connections.indexOf(n);
        if (pos != -1) nodes[nn].connections.splice(pos, 1);
    }
    delete nodes[n];

    return cloned;
}

function assignReg() {
    const d = findLowestConnectedNode();
    if (d == undefined) return;

    const dropped = dropNode(d);

    assignReg();

    // build back graph and delete used registers
    addNode(dropped.id);
    // EAX is always used as a temporary
    const availReg = {
        ebx: {
            t: 'REG',
            k: 'ebx',
            v: 'ebx'
        },
        ecx: {
            t: 'REG',
            k: 'ecx',
            v: 'ecx'
        },
        edx: {
            t: 'REG',
            k: 'edx',
            v: 'edx'
        },
    };

    // creates as many registers as there is variables, we'll try to use as few as possible
    // stack variables can be reused just the same as register
    let k = 1;
    for (let i in nodes) {
        if (
            k < 3 // x86 has 3 available registers
        );
        else {
            availReg[`s${k}`] = {
                t: 'VAR',
                k: `s${k}`,
                v: `DWORD [EBP-${4 * (k - 3) + 4}]`,
                index: k - 3,
            };
        }
        k++;
    }

    for (let i in dropped.connections) {
        const n = dropped.connections[i];
        delete availReg[nodes[n].reg.k];
        addEdge(dropped.id, n);
    }

    // assign register if one left, or spill variable
    nodes[dropped.id].reg = availReg[Object.keys(availReg)[0]];

    const registers = {};
    for (let i in nodes) {
        registers[i] = nodes[i].reg;
    }
    return registers;
}

function addFullyLinkedNodes(keys) {
    for (const k of keys) {
        addNode(k);
    }
    for (let ii = 0; ii < keys.length; ii++) {
        for (let jj = 0; jj < keys.length; jj++) {
            if (ii != jj) addEdge(keys[ii], keys[jj]);
        }
    }
}

// should parse code as a graph too
function buildGraph(n) {
    if (n.visited == 'graph') return;
    n.visited = 'graph';

    let activeNodes = {};
    for (var i in n.successors) {
        activeNodes = {
            ...buildGraph(n.successors[i])
        };
    }

    // Propagate read variables for backward
    // When a variable is read, it's added to the list of active variables
    // When a variable is written, it is removed from the list of active variable
    const {
        assembly
    } = n;
    for (let i = assembly.length - 1; i >= 0; i--) {
        const ins = assembly[i];
        if (ins == undefined) continue;

        //
        // after instruction
        //
        // Ensure a variable is available to write
        if (ins.w && ins.w.t == 'VAR') activeNodes[ins.w.v] = true;

        addFullyLinkedNodes(Object.keys(activeNodes));

        //
        // before instruction
        //
        // Propagate read variables backwards / Delete written variable
        if (ins.w && ins.w.t == 'VAR') delete activeNodes[ins.w.v];

        if (ins.r1 && ins.r1.t == 'VAR') activeNodes[ins.r1.v] = true;

        if (ins.r2 && ins.r2.t == 'VAR') activeNodes[ins.r2.v] = true;

        addFullyLinkedNodes(Object.keys(activeNodes));
    }

    return activeNodes;
}

function max(a, b) {
    return a > b ? a : b;
}

function replaceVars(n, registers) {
    if (n.visited == 'replaceVars') return;
    n.visited = 'replaceVars';

    if (n.func) {
        for (let reg of Object.values(registers)) {
            if (reg.t == 'VAR')
                n.func.varCount = max(n.func.varCount, reg.index + 1);
            if (reg.t == 'REG')
                n.func.usedRegisters[reg.v] = true;
        }
    }

    const assembly = [];
    for (const ins of n.assembly) {
        if (ins.r1 && ins.r1.t == 'VAR') {
            ins.r1 = registers[ins.r1.v];
        }

        if (ins.r2 && ins.r2.t == 'VAR') {
            ins.r2 = registers[ins.r2.v];
        }

        if (ins.w && ins.w.t == 'VAR') {
            ins.w = registers[ins.w.v];
        }

        // drop instruction that move register to iself
        if (ins.w != undefined && ins.w.v == ins.r1.v && ins.r2 == undefined) {
            continue;
        }
        assembly.push(ins);
    }
    n.assembly = assembly;

    for (const s of n.successors) {
        replaceVars(s, registers);
    }
}

module.exports = function (block) {
    buildGraph(block);
    const registers = assignReg();
    replaceVars(block, registers);
};
