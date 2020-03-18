function getToken() {
    return currentToken;
}

currentToken = {'t': 'START', l:0};
function eatToken(t) {
    if(currentToken.t != t)
        throw 'Expected '+t+' but got '+currentToken.t;

    var ret = currentToken;
    
    program = program.substring(currentToken.l);
    program = program.replace(/^ */,'');
    program = program.replace(/^\n/,'');
    // console.log(program);
    
    var m;
    if(m=program.match(/^([0-9]+)/))
        currentToken = {'t': 'DIGIT', v: m[1], l: m[1].length};
    else if(m=program.match(/^([+-])/))
        currentToken = {'t': 'SUM', l: 1, v:m[1]};
    else if(m=program.match(/^\*/))
        currentToken = {'t': 'PRODUCT', l: 1};
    else if(m=program.match(/^(=) +/))
        currentToken = {'t': 'EQUAL', l: 1};
    else if(m=program.match(/^(WHILE)/))
        currentToken = {'t': 'WHILE', l: 5};
    else if(m=program.match(/^(FUNCTION)/))
        currentToken = {'t': 'FUNCTION', l: 8};
    else if(m=program.match(/^(CALL)/))
        currentToken = {'t': 'CALL', l: 4};
    else if(m=program.match(/^(IF)/))
        currentToken = {'t': 'IF', l: 2};
    else if(m=program.match(/^(\{)/))
        currentToken = {'t': '{', l: 1};
    else if(m=program.match(/^(\})/))
        currentToken = {'t': '}', l: 1};
    else if(m=program.match(/^(\()/))
        currentToken = {'t': '(', l: 1};
    else if(m=program.match(/^(\))/))
        currentToken = {'t': ')', l: 1};
    else if(m=program.match(/^(\;)/))
        currentToken = {'t': ';', l: 1};
    
    else if(m=program.match(/^([a-z]+)/))
        currentToken = {'t': 'NAME', v: m[1], l: m[1].length};

    else if(program == '')
        currentToken = {'t': 'END', l: 0};
    else
        throw 'Unexpected token at '+program;
    
    // console.log(ret,'<',currentToken);

    return ret;
}

var blockId = 0;
var indent = 0;
var blockList = [];
function Block(parents) {
    blockList.push(this);

    this.assembly = [];
    this.children = [];
    this.parents = [];
    this.psi = [];
    this.name = 'block_'+blockId;
    blockId++;

    for(var i in parents) {
        parents[i].children.push(this);
        this.parents.push(i);
    }

    this.addParent = (p) => {
        this.parents.push(p);
        p.children.push(this);
    }

    this.emit = (data) => {
        if(data==undefined) data={};
        this.assembly.push(data);
        return this.assembly.length - 1;
    }

    this.print = () => {
        console.log("# "+this.name, this.children.map( (x) => x.name ) );
        for(var i=0;i<this.assembly.length;i++) {
            var ins = {...this.assembly[i]};

            console.log(' '+JSON.stringify(ins));
        }
    }

    this.toStringIR = () => {
        var text = [];
        for(var i=0;i<this.assembly.length;i++) {
            var ins = this.assembly[i];
            if(ins.op == '*') {
                text.push( ins.w.v+' := '+ins.r1.v+' * '+ins.r2.v );
            } else if(ins.op == '+') {
                text.push( ins.w.v+' := '+ins.r1.v+' + '+ins.r2.v );
            } else if(ins.op == '-') {
                text.push( ins.w.v+' := '+ins.r1.v+' - '+ins.r2.v );
            } else if(ins.op == '=') {
                text.push( ins.w.v+' := '+ins.r1.v );
            } else if(ins.op == 'PUSH') {
                text.push( 'push '+ins.r1.v );
            } else if(ins.op == 'POP') {
                text.push( 'pop '+ins.w.v );
            } else if(ins.op == 'JMP') {
                text.push( 'jmp '+ins.label );
            } else if(ins.op == 'ifTrue') {
                text.push( 'ifTrue '+ins.r1.v+', '+ins.label );
            } else if(ins.op == 'ifFalse') {
                text.push( 'ifFalse '+ins.r1.v+', '+ins.label );
            } else if(ins.op == 'functionstart') {
                text.push( 'function '+ins.name );
                // console.log('SUB ESP, 12');
            } else if(ins.op == 'functionend') {
                text.push( 'functionend' );
            } else {
                text.push( JSON.stringify(ins) );
            }
        }
        return text;
    }

    this.printAssembly = () => {        
        //console.log("# "+this.name, this.children.map( (x) => x.name ) );

        for(var i=0;i<this.assembly.length;i++) {
            var ins = this.assembly[i];
            if(ins.op == '*') {
                console.log('MOV EAX, '+ins.r1.v);
                console.log('MUL EAX, '+ins.r2.v);
                console.log('MOV '+ins.w.v+', EAX');
            } else if(ins.op == '+') {
                console.log('MOV EAX, '+ins.r1.v);
                console.log('ADD EAX, '+ins.r2.v);
                console.log('MOV '+ins.w.v+', EAX');
            } else if(ins.op == '-') {
                console.log('MOV EAX, '+ins.r1.v);
                console.log('SUB EAX, '+ins.r2.v);
                console.log('MOV '+ins.w.v+', EAX');                
            } else if(ins.op == '=') {
                if(ins.w.v != ins.r1.v)
                    console.log('MOV '+ins.w.v+', '+ins.r1.v);
            } else if(ins.op == 'PUSH') {
                console.log('PUSH '+ins.r1.v);
            } else if(ins.op == 'POP') {
                console.log('POP '+ins.w.v);
            } else if(ins.op == 'JMP') {
                console.log('JMP '+ins.label);
            } else if(ins.op == 'ifTrue') {
                console.log('JNZ '+ins.label);
            } else if(ins.op == 'ifFalse') {
                console.log('JZ '+ins.label);                
            } else if(ins.op == 'functionstart') {
                console.log(ins.name+':');
                // console.log('SUB ESP, 12');
            } else if(ins.op == 'functionend') {
                console.log('RET');
            } else {
                console.log(ins);
            }
        }
    }

}

var block = new Block([]);

function comment(code) {
    if(commentStr == '')
        commentStr = code;
}

var vstack = [];
function popVStack() {
    return vstack.pop();
}

function pushVStack(v) {
    delete v.l;
    vstack.push(v);
}

function logStack(n) {
    var leftPad = '';
    for(var i=0;i<indent;i++)
        leftPad+=' ';
    // console.log(leftPad, n);
}

function parseTerm(b) {
    logStack("parseTerm"); indent++;

    if(getToken().t == 'DIGIT') {
        var v = eatToken('DIGIT');
        pushVStack(v);
    } else if(getToken().t == 'NAME') {
        var varname = eatToken('NAME');
        vstack.push({t: 'VAR', v: varname.v});
    }

    indent--;
    return b;
}

var tmp=0;
function getTmpVar() {
    return "tmp"+(tmp++);
}


function parseSum(b) {
    logStack("parseSum"); indent++;

    parseProduct(b);
    if( getToken().t == 'SUM' ) {
        var s = eatToken('SUM');
        b = parseSum(b);

        var op2 = popVStack();
        var op1 = popVStack();
        var dst = {t:'VAR', v:getTmpVar()};

        if(s.v=='+') {
            b.emit({op:'+', w:dst, r1:op1, r2:op2});
        } else {
            b.emit({op:'-', w:dst, r1:op1, r2:op2});
        }

        pushVStack(dst);
    }

    indent--;
    return b;
}

function parseProduct(b) {
    logStack("parseProduct"); indent++;

    b = parseTerm(b);
    if( getToken().t == 'PRODUCT' ) {
        eatToken('PRODUCT');
        b = parseProduct(b);
        var op2 = popVStack();
        var op1 = popVStack();
        var dst = {t:'VAR', v:getTmpVar()};

        b.emit({op:'*', w:dst, r1:op1, r2:op2});
        pushVStack(dst);
    }
    indent--;
    return b;
}

variables = [];
function parseAssignment(b) {
    logStack("parseAssigment"); indent++;

    var dst = eatToken('NAME');
    variables[dst.v] = true;
    eatToken('EQUAL');
    b = parseSum(b);
    var src = popVStack();
    
    b.emit({op: '=', w:{t:'VAR', v:dst.v}, r1:src});
    eatToken(';');

    indent--;

    return b;
}

var ifStmt=0;
function parseIfStatement(b) {
    logStack("parseIfStatement"); indent++;
    var prev = b;

    var trueBlock = new Block([b]);

    ifStmt++;
    comment(program.split(/\n/)[0]);
    eatToken('IF');
    eatToken('(');
    b = parseSum(b);
    var v = popVStack(); // consider the value as used
    //b.emit({op:'=', w: getTmpVar(), r1: v});
    eatToken(')');
    eatToken('{');
    trueBlock = parseStatementList(trueBlock);
    eatToken('}');
    
    indent--;

    var endBlock = new Block([trueBlock, prev], 'endIf');
    prev.emit({op:'ifFalse', r1: v, label:endBlock.name});

    return endBlock;
}

whileStmt=0;
function parseWhileStatement(b) {
    logStack("parseWhileStatement"); indent++;

    whileStmt++;        
    var startBlock = b;
    var condBlock = new Block([startBlock]);
    var whileBlock = new Block([condBlock]);
    condBlock.addParent(whileBlock);
    var endBlock = new Block([condBlock]);

    eatToken('WHILE');
    eatToken('(');
    startBlock = parseSum(startBlock);
    var v = popVStack(); // consider the value is used
    condBlock.emit({op:'ifFalse', r1: v, label:endBlock.name})
    eatToken(')');
    eatToken('{');
    whileBlock = parseStatementList(whileBlock);
    eatToken('}');
    whileBlock.emit({op:'JMP', label:condBlock.name});

    indent--;

    return endBlock;
}

function parseStatement(b) {
    logStack("parseStatement"); indent++;

    if(getToken().t == 'IF') {
        return parseIfStatement(b);
    } else if(getToken().t == 'WHILE') {
        return parseWhileStatement(b);
    } else if(getToken().t == 'NAME') {
        return parseAssignment(b);
    } else if(getToken().t == 'FUNCTION') {
        return parseFunction(b);
    } else if(getToken().t == 'CALL') {
        return parseFunctionCall(b);
    } else
        throw 'Expected IF/WHILE/NAME/FUNCTION or CALL but got ' + getToken().t;

    indent--;
}

function parseFunction(b) {
    logStack("parseFunction"); indent++;

    //b = new Block([b]);
    
    eatToken('FUNCTION');
    var name = eatToken('NAME');    

    var functionStartLabel = name.v;
    b.emit({op:'functionstart', name:functionStartLabel});
    
    eatToken('(');
    eatToken(')')
    eatToken('{');
    b = parseStatementList(b);
    eatToken('}');

    // all values should be consumed at this point
    if(vstack.length != 0) throw "Expected vstack to be empty";

    //emit({op:'RET'});
    b.emit({op:'functionend', name:functionStartLabel});

    indent--;

    return new Block([b]);
}

function parseFunctionCall(b) {
    logStack("parseFunctionCall"); indent++;

    eatToken('CALL');
    var name = eatToken('NAME');
    eatToken(';');
    b.emit({op:'CALL ', name: name.v});

    indent--;
    return b;
}

function parseStatementList(b) {
    logStack("parseStatementList"); indent++;

    while(getToken().t == 'NAME' || getToken().t == 'IF' || getToken().t == 'WHILE' || getToken().t == 'CALL') {
        b = parseStatement(b);
    }

    indent--;
    return b;
}

function parseProgram(b) {
    logStack("parseProgram"); indent++;

    while(getToken().t == 'FUNCTION') {
        b = parseFunction(b);
    }

    indent--;

    return b;
}

/*var program = [
"FUNCTION test() { a = a + 1; }",
"FUNCTION main() {",
"a = 1*2-3*4;",
"b = a;",
"IF(1) { a = 2; }",
"c = a+b;",
"a = 0;",
"WHILE(a) { a = a + 1; }",
"CALL test;",
"}",
""
].join("\n");*/

var program = [
"FUNCTION main() {",
/*"a = 1*2+3*4+5*6;",
"IF(1*1) { a = 1; }",
"IF(1*1) { a = 2; }",*/
// "a = 10;",
"a = 1;",
"WHILE( a ) { a = a + 1; }",
//"WHILE(c) { c = c - 1; }",
"}",
""
].join("\n");

function printIR() {
    for(var i in blockList) {
        console.log( blockList[i].name+':' );
        // console.log(JSON.stringify(blockList[i].psi.length)
        for(var j in blockList[i].psi) {
            var psi = blockList[i].psi[j];
            if(psi.length>0) {
                console.log( psi[0].v, '=', 'psi(', psi.slice(1).map(x=>x.v+':'+x.src.name).join(', '), ')' );
            }
        }
        console.log( blockList[i].toStringIR().join("\n") );
    }
}

// Naive SSA Transform
function ssatransform(n, parent, liveVars) {    
    function ssa(i) {
        return { t:'VAR', v: i+'_'+liveVars[i] };
    }    

    // add psi
    if(n.parents.length > 1) {
        for(var i in liveVars) {
            var r = ssa(i);
            liveVars[i]++;
            if(n.psi[i] == undefined) {
                var w = ssa(i);
                n.psi[i] = [w];
            }
            r.src = parent;
            n.psi[i].push(r);
        }
    }

    if(n.visited == 'ssa')
        return;
    n.visited = 'ssa';

    // apply SSA to instructions
    for(var i in n.assembly) {
        var ins = n.assembly[i];
        if(ins.w) {
            if( liveVars[ins.w.v] == undefined )
                liveVars[ins.w.v] = 0;
        }

        if( ins.r1 && ins.r1.t == 'VAR' ) {
            ins.r1 = ssa(ins.r1.v);
        }
        if( ins.r2 && ins.r2.t == 'VAR' ) {
            ins.r2 = ssa(ins.r2.v);
        }
        if( ins.w ) {
            liveVars[ins.w.v]++;
            ins.w = ssa(ins.w.v);            
        }
    }

    for(var i in n.children) {
        ssatransform(n.children[i], n, liveVars); 
    }
}

//
//
// REGISTER ALLOCATION
//
//
let Graph = (function() {
    var nodes={};
    var registers={};
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
        //var availReg = {'eax':true,'ebx':true, 'ecx':true, 'edx':true};
        var availReg = {'EBX':true,'ECX':true};
        for(var i in dropped.connections) {
            var n = dropped.connections[i];
            delete availReg[nodes[n].reg];
            this.addEdge(dropped.id, n);
        }

        // assign register if one left, or spill variable
        nodes[dropped.id].reg = Object.keys(availReg)[0] || 'spill';

        var registers={};
        for(var i in nodes) {
            if(nodes[i].reg == 'spill')
                registers[i] = {t: 'SPILL', v: 'spill'+(this.spill++)};
            else
                registers[i] = {t: 'REG', v: nodes[i].reg};
        }
        return registers;
    }
    this.print = () => {
        console.log(nodes);
        console.log(registers);
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
    var assembly = n.assembly;
    for(var i=assembly.length-1; i>=0; i--) {
        if(assembly[i] == undefined) continue;

        //
        // after instruction
        //
        // A new variable is written
        if(assembly[i].w != undefined)
            activeNodes[assembly[i].w.v] = true;
        
        g.addFullyLinkedNodes(Object.keys(activeNodes));

        // 
        // before instruction
        //
        // Remove write (precedent value is ignored)
        // Add read (variables are required)
        if(assembly[i].w != undefined)    
            delete activeNodes[assembly[i].w.v];

        if(assembly[i].r1 != undefined)
            activeNodes[assembly[i].r1.v] = true;

        if(assembly[i].r2 != undefined)
            activeNodes[assembly[i].r2.v] = true;

        g.addFullyLinkedNodes(Object.keys(activeNodes));
    }

    for(var i in n.children) {
        buildGraph(n.children[i]);
    }
}

function assignRegisters(n) {
    if(n.visited == 'assignRegisters')
        return;
    n.visited = 'assignRegisters';

    var assembly = [];
    for(var ii=0;ii<n.assembly.length;ii++) {
        var ins = n.assembly[ii];
        
        if(ins.r1 && ins.r1.t == 'VAR' && registers[ins.r1.v].t == 'REG') {
            ins.r1 = registers[ins.r1.v];
        }

        if(ins.r2 && ins.r2.t == 'VAR' && registers[ins.r2.v].t == 'REG') {
            ins.r2 = registers[ins.r2.v];
        }

        if(ins.w && ins.w.t == 'VAR' && registers[ins.w.v].t == 'REG') {
            ins.w = registers[ins.w.v];
        }

        // drop instruction that move register to iself
        if(ins.w != undefined && ins.w.v == ins.r1.v && ins.r2 == undefined) {
            continue;
        }
        assembly.push(ins);
    }
    n.assembly = assembly;
    
    for(var i in n.children) {
        assignRegisters(n.children[i]);
    }    
}

//
// Graph
//
/*console.log("\n* IR after register assignement");
console.log("digraph g {");
for(var b = 0; b < blockList.length;b++) {
    console.log(blockList[b].toStringIR());
}
console.log("}");*/

//
// Print IR
//
console.log("\n* IR");
eatToken('START');
parseProgram(block);
printIR();

//
// Print SSA-IR
//
console.log("* SSA-IR");
ssatransform(block, undefined, {});
printIR();

//
// Transform Psi function to IR
//
function psiToIRTransform(n) {
    if(n.visited == 'psi2ir')
        return;
    n.visited = 'psi2ir';
    for(var p in n.psi) {
        var psi = n.psi[p];
        var inputs = psi.slice(1);
        for(var i in inputs) {
            var ass = inputs[i].src.assembly;
            if(ass[ass.length-1].op == 'JMP')
                var lastInst = ass.pop();
            inputs[i].src.emit({ op: '=', w: psi[0], r1: inputs[i] });
            if(lastInst)
                ass.push(lastInst);
            delete lastInst;
        }
    }
    delete n.psi;
    for(var i in n.children) {
        psiToIRTransform(n.children[i]);
    }
}

console.log("* PSIRESOLVED-SSA-IR");
psiToIRTransform(block);
printIR();

//
// IR WITH REGISTERS
//
console.log("* IR WITH REGISTERS")
buildGraph(block);
var registers = g.assignReg();
assignRegisters(block);
printIR();

//
// Print assembly
//
/*console.log("\n* Assembly");
for(var i in blockList) {
    console.log(blockList[i].name+':')
    blockList[i].printAssembly();
}*/

