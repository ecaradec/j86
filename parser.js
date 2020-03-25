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
    else if(m=program.match(/^(==) +/))
        currentToken = {'t': '==', l: 2};
    else if(m=program.match(/^(WHILE)/))
        currentToken = {'t': 'WHILE', l: 5};
    else if(m=program.match(/^(FUNCTION)/))
        currentToken = {'t': 'FUNCTION', l: 8};
    else if(m=program.match(/^(CALL)/))
        currentToken = {'t': 'CALL', l: 4};
    else if(m=program.match(/^(RETURN)/))
        currentToken = {'t': 'RETURN', l: 6};
    else if(m=program.match(/^(IF)/))
        currentToken = {'t': 'IF', l: 2};
    else if(m=program.match(/^(ELSE)/))
        currentToken = {'t': 'ELSE', l: 4};
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
    else if(m=program.match(/^(,)/))
        currentToken = {'t': ',', l: 1}; 
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
    this.variables = {};
    this.phis = {};
    this.name = 'block_'+blockId;
    blockId++;

    for(var i in parents) {
        parents[i].children.push(this);
        this.parents.push(parents[i]);
    }

    this.addParent = (p) => {
        this.parents.push(p);
        p.children.push(this);
    }

    this.emit = (data) => {
        // console.log(data);
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
            //text.push(JSON.stringify(ins));
            if(ins.op == '*') {
                text.push( ins.w.v+' := '+ins.r1.v+' * '+ins.r2.v );
            } else if(ins.op == '+') {
                text.push( ins.w.v+' := '+ins.r1.v+' + '+ins.r2.v );
            } else if(ins.op == '-') {
                text.push( ins.w.v+' := '+ins.r1.v+' - '+ins.r2.v );
            } else if(ins.op == '=') {
                text.push( ins.w.v+' := '+ins.r1.v );
            } else if(ins.op == '==') {
                text.push( ins.w.v+' := '+ins.r1.v+' == '+ins.r2.v );
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
            } else if(ins.op == 'return') {
                text.push( 'return '+ins.r1.v );
            } else if(ins.op == 'CALL') {
                text.push( 'call '+ins.name );
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

        function getLastIns(n) {
            if(n.assembly.length > 0)
                return n.assembly[n.assembly.length-1];
            return getLastIns(n.parents[0]);
        }
        function getPrevIns(n) {
            if(n.assembly.length > 1)
                return n.assembly[i-1];
            return getLastIns(n.parents[0]); // should really check on all path, but it's enough for now
        }
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
                if(ins.w.v != ins.r1.v) {
                    // should really be done on IR
                    if(ins.w.t == 'VAR' && ins.r1.t == 'VAR') {
                        console.log('MOV EAX, '+ins.r1.v);
                        console.log('MOV '+ins.w.v+', EAX');
                    } else {
                        console.log('MOV '+ins.w.v+', '+ins.r1.v);
                    }                    
                }                
            } else if(ins.op == '==') {
                console.log('CMP '+ins.r1.v+', '+ins.r2.v);
                trueCond = 'EQ';
                falseCond = 'NE';
            } else if(ins.op == 'ifTrue') {
                console.log('J'+trueCond+' '+ins.label);
            } else if(ins.op == 'ifFalse') {
                console.log('J'+falseCond+' '+ins.label);                
            } else if(ins.op == 'PUSH') {
                console.log('PUSH '+ins.r1.v);
            } else if(ins.op == 'POP') {
                console.log('POP '+ins.w.v);
            } else if(ins.op == 'JMP') {
                console.log('JMP '+ins.label);
            } else if(ins.op == 'return') {
                console.log('MOV EAX, '+ins.r1.v);
                console.log('RET');
            } else if(ins.op == 'CALL') {
                console.log('CALL '+ins.name);
            } else if(ins.op == 'functionstart') {
                console.log(ins.name+':');
                // console.log('SUB ESP, 12');
            } else if(ins.op == 'functionend') {
                if(getPrevIns(this).op != 'return') // don't add ret if previous ins was return
                    console.log('RET');
            } else {
                console.log(JSON.stringify(ins));
                console.log(ins.op == 'CALL');
            }
        }
    }

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
    logStack("parseSum");indent++;

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
function parseCondStatement(b) {
    parseSum(b);
    eatToken('==');
    parseSum(b);
}

var ifStmt=0;
function parseIfStatement(b) {
    logStack("parseIfStatement"); indent++;
    var prev = b;

    var trueBlock = new Block([b]);
    var falseBlock = new Block([b]);

    ifStmt++;
    eatToken('IF');
    eatToken('(');
    b = parseCondStatement(b);

    var v2 = popVStack();
    var v1 = popVStack();


    eatToken(')');
    eatToken('{');
    trueBlock = parseStatementList(trueBlock);
    eatToken('}');

    if(getToken().t == 'ELSE') {
        eatToken('ELSE');
        eatToken('{');
        falseBlock = parseStatementList(falseBlock);
        eatToken('}');
    }
    
    indent--;

    var endBlock = new Block([trueBlock, falseBlock], 'endIf');
    var tmp = {t:'INTRINSIC', v: '$cond'};
    prev.emit({op: '==', w: tmp, r1: v1, r2:v2})
    prev.emit({op:'ifFalse', r1: tmp, label:endBlock.name});

    trueBlock.emit({op: 'JMP', label: endBlock.name});
    
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
    b = parseCondStatement(b);

    var v2 = popVStack();
    var v1 = popVStack();

    var tmp = {t:'INTRINSIC', v: '$cond'};
    condBlock.emit({op: '==', w: tmp, r1: v1, r2:v2})
    condBlock.emit({op:'ifTrue', r1: tmp, label:endBlock.name})
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
    } else if(getToken().t == 'RETURN') {
        var rBlock = new Block([b]);
        parseReturn(b);
        return rBlock;
    } else
        throw 'Expected IF/WHILE/NAME/FUNCTION or CALL but got ' + getToken().t;

    indent--;
}

var functionDeclarations = {};
function parseFunction(b) {
    logStack("parseFunction"); indent++;

    //b = new Block([b]);
    
    eatToken('FUNCTION');
    var name = eatToken('NAME');    

    var functionStartLabel = name.v;
    b.emit({op:'functionstart', name:functionStartLabel});
    
    eatToken('(');
    b.variables=[];
    var i = 1;
    if(getToken().t == 'NAME') {
        var n = eatToken('NAME');
        b.variables[n.v] = {t: 'STACKVAR', v: '[ESP-'+(2*i)+']'};
        i++;
        while(getToken().t == ',') {
            eatToken(',');
            var n = eatToken('NAME');
            b.variables[n.v] = {t: 'STACKVAR', v: '[ESP-'+(2*i)+']'};
            i++;
        }
    }
    functionDeclarations[name.v] = (i-1);
    eatToken(')')
    eatToken('{');
    b = parseStatementList(b);
    eatToken('}');

    // all values should be consumed at this point
    if(vstack.length != 0) throw "Expected vstack to be empty";

    //emit({op:'RET'});
    b.emit({op:'functionend', name:functionStartLabel, arguments});

    indent--;

    return b;
}

function parseReturn(b) {
    eatToken('RETURN');
    var n = eatToken('NAME');
    eatToken(';');
    b.emit({op: 'return', r1:{t: 'VAR', v: n.v}});
    return b;
}

function parseFunctionCall(b) {
    logStack("parseFunctionCall"); indent++;

    eatToken('CALL');
    var name = eatToken('NAME');
    eatToken('(');
    if(functionDeclarations[name.v] === undefined) {
        throw 'Function '+name.v+' doesnt exists';
    }
    var argumentsCount = 0;
    if(getToken().t != ')') {
        parseSum();
        var r1 = popVStack();
        b.emit({op: 'PUSH', r1});
        argumentsCount++;
        while(getToken().t == ',') {
            eatToken(',');
            parseSum();
            var r1 = popVStack();
            b.emit({op: 'PUSH', r1});
            argumentsCount++;
        }
    }
    if(functionDeclarations[name.v] !== argumentsCount) {
        throw 'Function call "'+name.v+'" doesnt match declared arguments';
    }
    eatToken(')');
    eatToken(';');
    b.emit({op:'CALL', name: name.v});

    indent--;
    return b;
}

function parseStatementList(b) {
    logStack("parseStatementList"); indent++;

    while(getToken().t == 'NAME' ||
          getToken().t == 'IF' ||
          getToken().t == 'WHILE' ||
          getToken().t == 'CALL' ||
          getToken().t == 'RETURN') {
        b = parseStatement(b);
    }

    indent--;
    return b;
}

function parseProgram() {
    logStack("parseProgram"); indent++;
    var start = new Block([]);

    while(getToken().t == 'FUNCTION') {
        var fBlock = new Block([start]);
        parseFunction(fBlock);
    }

    indent--;

    return start;
}

var program = '';
function Parser() {
    this.build = (p) => {
        program = p;
        eatToken('START');
        parseProgram();
        return blockList;
    }
    this.printIR = () => {
        for(var i in blockList) {
            console.log( blockList[i].name+':' );
            for(var j in blockList[i].phis) {
                var phi = blockList[i].phis[j];
                console.log( phi.w, ':=', 'psi(', phi.r.join(', '), ')' );
            }
            if(blockList[i].assembly.length>0)
                console.log( blockList[i].toStringIR().join("\n") );
        }
        console.log("");
    }
}

var parser = new Parser;

module.exports = parser;