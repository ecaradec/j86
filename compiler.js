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
    //var codeStr = code; // + (commentStr!='' ? '          ; '+commentStr:'');
    //if(codeStr.indexOf(':') == -1)
    //    codeStr = "    "+codeStr;

    if(data==undefined) data={};
    assembly[assembly.length] = data;
    commentStr = '';
    return assembly.length - 1;
}
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

function parseTerm() {
    if(getToken().t == 'DIGIT') {
        var v = eatToken('DIGIT');
        pushVStack(v);
    } else if(getToken().t == 'NAME') {
        var varname = eatToken('NAME');
        vstack.push({t: 'VAR', v: varname.v});
    }
}

function parseSum() {
    parseProduct();
    if( getToken().t == 'SUM' ) {
        var s = eatToken('SUM');
        parseSum();

        var op2 = popVStack();
        var op1 = popVStack();
        var dst = {t:'VAR', v:getTmpVar()};

        if(s.v=='+') {
            emit({op:'+', write:[dst], read:[op1, op2]});
        } else {
            emit({op:'-', write:[dst], read:[op1, op2]});
        }

        pushVStack(dst);
    }
}

var tmp=0;
function getTmpVar() {
    return "tmp"+(tmp++);
}

function parseProduct() {
    parseTerm();
    if( getToken().t == 'PRODUCT' ) {
        eatToken('PRODUCT');
        parseProduct();
        var op2 = popVStack();
        var op1 = popVStack();
        var dst = {t:'VAR', v:getTmpVar()};

        emit({op:'*', write:[dst], read:[op1, op2]});
        pushVStack(dst);
    }
}

variables = [];
function parseAssignment() {
    comment(program.split(/\n/)[0]);
    var dst = eatToken('NAME');
    variables[dst.v] = true;
    eatToken('EQUAL');
    parseSum();
    var src = popVStack();
    
    emit({op: '=', write:[{t:'VAR', v:dst.v}], read:[src]});
    eatToken(';');
}

var ifStmt=0;
function parseIfStatement() {
    ifStmt++;
    var ifEndLabel = 'if_end_'+ifStmt;
    comment(program.split(/\n/)[0]);
    eatToken('IF');
    eatToken('(');
    parseSum();
    popVStack(); // consider the value as used
    var jnz = emit({op:'JNZ ', label:ifEndLabel});
    eatToken(')');
    eatToken('{');
    parseStatementList();
    eatToken('}');
    emit({op: 'label', name: ifEndLabel});
}

whileStmt=0;
function parseWhileStatement() {
    whileStmt++;
    comment(program.split(/\n/)[0]);
    
    var whileLabel = 'while_start_'+whileStmt;
    var whileEndLabel = 'while_end_'+whileStmt;
    emit(whileLabel+':');
    eatToken('WHILE');
    eatToken('(');
    parseSum();
    popVStack(); // consider the value is used
    var jnz = emit({op:'JNZ ', label:whileEndLabel})
    eatToken(')');
    eatToken('{');
    parseStatementList();
    eatToken('}');
    emit({op:'JMP ', label:whileLabel});
    emit({op:'label', name:whileEndLabel});
}

function parseStatement() {
    if(getToken().t == 'IF')
        parseIfStatement();
    if(getToken().t == 'WHILE')
        parseWhileStatement();
    else if(getToken().t == 'NAME')
        parseAssignment();
    else if(getToken().t == 'FUNCTION')
        parseFunction();
    else if(getToken().t == 'CALL')
        parseFunctionCall();
    else
        throw 'Expected IF or VAR but got ' + getToken().t;
}

function parseFunction() {
    var functionAddress = assembly.length        
    eatToken('FUNCTION');
    var name = eatToken('NAME');    

    var functionStartLabel = name.v;
    emit({op:'label', name:functionStartLabel});
    
    eatToken('(');
    eatToken(')')
    eatToken('{');
    parseStatementList();
    eatToken('}');

    // all values should be consumed at this point
    if(vstack.length != 0) throw "Expected vstack to be empty";

    comment('End of '+name.v);
    emit({op:'RET'});
}

function parseFunctionCall() {
    eatToken('CALL');
    var name = eatToken('NAME');
    eatToken(';');
    emit({op:'CALL ', name: name.v});
}

function parseStatementList() {
    while(getToken().t == 'NAME' || getToken().t == 'IF' || getToken().t == 'WHILE' || getToken().t == 'CALL')
        parseStatement();
}

function parseProgram() {
    while(getToken().t == 'FUNCTION') {
        parseFunction();
    }
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
"b = a;",
//"IF(1) { a = 2; }",
"}",
""
].join("\n");

eatToken('START');
parseProgram();


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
    for(var w in assembly[i].write) {
        if(assembly[i].write[w].t!='VAR') continue;
        activeNodes[assembly[i].write[w].v] = true;
    }
    
    g.addFullyLinkedNodes(Object.keys(activeNodes));

    // 
    // before instruction
    //
    // Remove write (precedent value is ignored)
    // Add read (variables are required)
    for(var w in assembly[i].write) {
        if(assembly[i].write[w].t!='VAR') continue;
        delete activeNodes[assembly[i].write[w].v];
    }    
    for(var r in assembly[i].read) {
        if(assembly[i].read[w].t!='VAR') continue;
        activeNodes[assembly[i].read[r].v] = true;
    }

    g.addFullyLinkedNodes(Object.keys(activeNodes));
}

//
// Assign registers to variables
//
var registers = g.assignReg();

console.log("* REGISTERS");
console.log(registers);

function rr(v) {
    if(registers[v])
        return registers[v].reg;
    return v;
}

//
// Replace all variable with registers
//
console.log("* IR before register assignement");
for(var i=0;i<assembly.length;i++) {
    console.log(assembly[i]);
}

for(var ii=0;ii<assembly.length;ii++) {
    for(var r in assembly[ii].read) {
        if(assembly[ii].read[r].t == 'VAR' && registers[assembly[ii].read[r].v].t == 'REG') {
            assembly[ii].read[r] = registers[assembly[ii].read[r].v];
        }
    }
    for(var w in assembly[ii].write) {
        if(assembly[ii].write[w].t == 'VAR' && registers[assembly[ii].write[w].v].t == 'REG') {
            assembly[ii].write[w] = registers[assembly[ii].write[w].v];
        }
    }
}


//
// Print IR
//
console.log("* IR");
for(var i=0;i<assembly.length;i++) {
    console.log(assembly[i]);
}

//
// Translate IR to assembly
//
for(var i=0;i<assembly.length;i++) {
    var ins = assembly[i];
    if(ins.op == '*') {
        console.log('MOV EAX, '+ins.read[0].v);
        console.log('MUL EAX, '+ins.read[1].v);
        console.log('MOV '+ins.write[0].v+', EAX');
    } else if(ins.op == '+') {
        console.log('MOV EAX, '+ins.read[0].v);
        console.log('ADD EAX, '+ins.read[1].v);
        console.log('MOV '+ins.write[0].v+', EAX');
    } else if(ins.op == '=') {
        if(ins.write[0].v != ins.read[0].v)
            console.log('MOV '+ins.write[0].v+', '+ins.read[0].v);
    } else if(ins.op == 'PUSH') {
        console.log('PUSH '+ins.read[0].v);
    } else if(ins.op == 'POP') {
        console.log('POP '+ins.write[0].v);
    } else if(ins.op == 'RET') {
        console.log('RET');
    } else {
        console.log(ins);
    }
}




