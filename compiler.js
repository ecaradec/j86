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

var assembly = [];
var assemblydata = [];
commentStr = '';
function emit(data) {
    if(data==undefined) data={};
    assembly[assembly.length] = data;
    commentStr = '';
    return assembly.length - 1;
}


var blockId = 0;
var indent = 0;
var blockList = [];
function Block(parents) {
    blockList.push(this);

    var assembly = [];
    this.children = [];
    this.name = 'block#'+blockId;
    blockId++;

    for(var p = 0; p < parents.length; p++) {
        parents[p].children.push(this);
    }

    this.emit = (data) => {
        if(data==undefined) data={};
        assembly[assembly.length] = data;
        return assembly.length - 1;
    }

    this.print = () => {
        console.log("# "+this.name, this.children.map( (x) => x.name ) );
        for(var i=0;i<assembly.length;i++) {
            var ins = {...assembly[i]};

            console.log(' '+JSON.stringify(ins));
        }
    }

    this.dumpToAssembly = () => {
        console.log("# "+this.name, this.children.map( (x) => x.name ) );

        for(var i=0;i<assembly.length;i++) {
            var ins = assembly[i];
            if(ins.op == '*') {
                console.log('MOV EAX, '+ins.r1.v);
                console.log('MUL EAX, '+ins.r2.v);
                console.log('MOV '+ins.w.v+', EAX');
            } else if(ins.op == '+') {
                console.log('MOV EAX, '+ins.r1.v);
                console.log('ADD EAX, '+ins.r2.v);
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
            } else if(ins.op == 'JNZ') {
                console.log('JNZ '+ins.label);
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

var dump = () => {
    for(var b = 0; b < blockList.length;b++) {
        blockList[b].print();
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
    console.log(leftPad, n);
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
        parseSum(b);

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

    var trueBlock = new Block([b]);
    var falseBlock = new Block([b]);

    ifStmt++;
    comment(program.split(/\n/)[0]);
    eatToken('IF');
    eatToken('(');
    b = parseSum(b);
    var v = popVStack(); // consider the value as used
    //b.emit({op:'=', w: getTmpVar(), r1: v});
    b.emit({op:'JNZ', r1: v, label:trueBlock.name});
    eatToken(')');
    eatToken('{');
    b = parseStatementList(trueBlock);
    eatToken('}');
    
    indent--;

    var b = new Block([b, falseBlock], 'endIf');

    return b;
}

whileStmt=0;
function parseWhileStatement(b) {
    logStack("parseWhileStatement"); indent++;

    whileStmt++;
    comment(program.split(/\n/)[0]);
    
    var whileBlock = new Block([b]);
    var endBlock= new Block([whileBlock]);

    eatToken('WHILE');
    eatToken('(');
    b = parseSum(b);
    popVStack(); // consider the value is used
    b.emit({op:'JNZ', label:endBlock.name})
    eatToken(')');
    eatToken('{');
    b = parseStatementList(b);
    eatToken('}');
    b.emit({op:'JMP', label:whileBlock.name});

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

    b = new Block([b]);

    var functionAddress = assembly.length        
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

    return b;
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
"a = 1*2+3*4+5*6;",
"IF(1*1) { a = 1; }",
"IF(1*1) { a = 2; }",
"WHILE(0) { c = 1; }",
"}",
""
].join("\n");

eatToken('START');
parseProgram(block);


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

//
// Assign registers to variables
//
var registers = g.assignReg();

/*console.log("* REGISTERS");
console.log(registers);
*/
function rr(v) {
    if(registers[v])
        return registers[v].reg;
    return v;
}

//
// Replace all variable with registers
//
console.log("\n* IR before register assignement");
dump();


/*
for(var ii=0;ii<assembly.length;ii++) {

    if(assembly[ii].r1 && assembly[ii].r1.t == 'VAR' && registers[assembly[ii].r1.v].t == 'REG') {
        assembly[ii].r1 = registers[assembly[ii].r1.v];
    }

    if(assembly[ii].r2 && assembly[ii].r2.t == 'VAR' && registers[assembly[ii].r2.v].t == 'REG') {
        assembly[ii].r2 = registers[assembly[ii].r2.v];
    }

    if(assembly[ii].w && assembly[ii].w.t == 'VAR' && registers[assembly[ii].w.v].t == 'REG') {
        assembly[ii].w = registers[assembly[ii].w.v];
    }

}


//
// Print IR
//
console.log("* IR");
for(var i=0;i<assembly.length;i++) {
    console.log(assembly[i]);
}
*/


//
// Print assembly
//
console.log("\n* Assembly");
block.dumpToAssembly();

