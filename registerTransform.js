
//
// REGISTER ALLOCATION
//
//
let Graph = (function() {
    var nodes={};
    this.spill = 0;

    this.addNode = (n) => {
        if(nodes[n] != undefined) return;
        nodes[n] = { connections:[] };
    }
    this.addEdge = (a,b) => {
        if(nodes[a].connections.indexOf(b) == -1) nodes[a].connections.push(b);
        if(nodes[b].connections.indexOf(a) == -1) nodes[b].connections.push(a);
    }
    this.findLowestConnectedNode = () => {
        var lowestConnectionNb = 1000000;
        var lowestConnectedNode = undefined;

        for(var i in nodes) {
            if(nodes[i].connections.length<lowestConnectionNb) {            
                lowestConnectionNb = nodes[i].connections.length;
                lowestConnectedNode = i;
            }
        }
        return lowestConnectedNode;
    }
    this.dropNode = (n) => {
        var cloned = {id: n, connections:[...nodes[n].connections]};

        for(var i in nodes[n].connections) {
            var nn = nodes[n].connections[i];

            var pos = nodes[nn].connections.indexOf(n);
            if(pos != -1)
                nodes[nn].connections.splice(pos,1);
        }
        delete nodes[n];

        return cloned;
    }
    this.assignReg = () => {
        var d = this.findLowestConnectedNode();
        if(d == undefined)
            return;        

        var dropped = this.dropNode(d);

        this.assignReg();

        // build back graph and delete used registers
        this.addNode(dropped.id);
        // EAX is always used as a temporary
        // var availReg = {'ebx':true, 'ecx':true, 'edx':true};
        
        // creates as many registers as there is variables, we'll try to use as few as possible
        // stack variables can be reused just the same as register
        var availReg = {};
        var k = 1;
        for(var i in nodes) {
            if(k<3)
                availReg['r'+k] = {t: 'REG', k: 'r'+k, v: 'r'+k};
            else
                availReg['s'+k] = {t: 'VAR', k: 's'+k, v: '[EBP-'+(4*(k-3)+4)+']', index: (k-3)};
            k++;
        }
        //var availReg = {'EBX':true, 'ECX':true, 'S0': true, 'S1': true};
        for(var i in dropped.connections) {
            var n = dropped.connections[i];
            delete availReg[nodes[n].reg.k];
            this.addEdge(dropped.id, n);
        }

        // assign register if one left, or spill variable
        nodes[dropped.id].reg = availReg[Object.keys(availReg)[0]];

        var registers={};
        for(var i in nodes) {
            registers[i] = nodes[i].reg;
        }
        return registers;
    }
    this.print = () => {
        //for(var i in nodes) {
        //    var n = nodes[i];
        //    console.log(i,'->', n.connections.join(', '));
        //}

        // console.log(nodes);
        // console.log(registers);
    }
    this.addFullyLinkedNodes = (keys) => {
        for(var ii=0;ii<keys.length;ii++) {
            this.addNode(keys[ii]);
        }
        for(var ii=0;ii<keys.length;ii++) {            
            for(var jj=0;jj<keys.length;jj++) {
                if(ii != jj) this.addEdge(keys[ii], keys[jj]);
            }
        }
    }
});

let g = new Graph;
var activeNodes = {};

// should parse code as a graph too
function buildGraph(n) {
    if(n.visited == 'graph')
        return;
    n.visited = 'graph';        

    var activeNodes = {};
    for(var i in n.children) {
        activeNodes = {...buildGraph(n.children[i])};
    }

    // Propagate read variables for backward
    // When a variable is read, it's added to the list of active variables
    // When a variable is written, it is removed from the list of active variable
    var assembly = n.assembly;
    for(var i=assembly.length-1; i>=0; i--) {
        var ins = assembly[i];
        if(ins == undefined) continue;

        //
        // after instruction
        //
        // Ensure a variable is available to write
        if(ins.w && ins.w.t == 'VAR')
            activeNodes[ins.w.v] = true;
        
        g.addFullyLinkedNodes(Object.keys(activeNodes));

        // 
        // before instruction
        //
        // Propagate read variables backwards / Delete written variable
        if(ins.w && ins.w.t == 'VAR')
            delete activeNodes[ins.w.v];

        if(ins.r1 && ins.r1.t == 'VAR')
            activeNodes[ins.r1.v] = true;

        if(ins.r2 && ins.r2.t == 'VAR')
            activeNodes[ins.r2.v] = true;        

        g.addFullyLinkedNodes(Object.keys(activeNodes));
    }

    return activeNodes;
}

function max(a,b) {
    return a>b ? a : b;
}

function replaceVars(n, registers) {
    if(n.visited == 'replaceVars')
        return;
    n.visited = 'replaceVars';

    if(n.func) {
        for(var i in registers) {
            if(registers[i].t == 'VAR')
                n.func.varCount = max(n.func.varCount, registers[i].index+1)
            if(registers[i].t == 'REG')
                n.func.usedRegisters[registers[i].v] = true;
        }
    }

    var assembly = [];
    for(var ii=0;ii<n.assembly.length;ii++) {
        var ins = n.assembly[ii];
        
        if(ins.r1 && ins.r1.t == 'VAR') {
            ins.r1 = registers[ins.r1.v];
        }

        if(ins.r2 && ins.r2.t == 'VAR') {
            ins.r2 = registers[ins.r2.v];
        }

        if(ins.w && ins.w.t == 'VAR') {
            ins.w = registers[ins.w.v];
        }

        // instruction arguments where replaced by registers
        // if no replacement was done, then this is a spill variable
        // translate by pushing eax on stack and using it as temporary
        /*if(ins.r1 && ins.r1.t == 'VAR') {
            var eax = {t: 'REG', v: 'EAX'};
            assembly.push({op: 'PUSH', r1:eax});
            assembly.push({op: '=', w:eax, r1: ins.r1});
            if(ins.r2 && ins.r2.t == 'VAR')
                assembly.push({op: ins.op, w:eax, r1: ins.r2});
            assembly.push({op: '=', w: ins.w, r1:eax});
            assembly.push({op: 'POP', w:eax});
            continue;
        }*/

        // drop instruction that move register to iself
        if(ins.w != undefined && ins.w.v == ins.r1.v && ins.r2 == undefined) {
            continue;
        }
        assembly.push(ins);
    }
    n.assembly = assembly;
    
    for(var i in n.children) {
        replaceVars(n.children[i], registers);
    }    
}



module.exports = function(block) {
    buildGraph(block);
    g.print();
    var registers = g.assignReg();    
    replaceVars(block, registers);
}