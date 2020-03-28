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
    else if(m=program.match(/^(!=) +/))
        currentToken = {'t': '!=', l: 2};
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

    if(parents.length>0)
        this.func = parents[0].func;

    for(var i in parents) {
        parents[i].children.push(this);
        this.parents.push(parents[i]);
    }

    this.addParent = (p) => {
        this.parents.push(p);
        p.children.push(this);
        this.func = p.func;
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
            } else if(ins.op == 'jmp') {
                text.push( 'jmp '+ins.label );
            } else if(ins.op == 'ifTrue') {
                text.push( 'ifTrue '+ins.r1.v+', '+ins.label );
            } else if(ins.op == 'ifFalse') {
                text.push( 'ifFalse '+ins.r1.v+', '+ins.label );
            } else if(ins.op == 'return') {
                text.push( 'return '+ins.r1.v );
            } else if(ins.op == 'call') {
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
        function printIns() {
            arguments[0] = '    '+arguments[0]
            console.log.apply(this, arguments);
        }
        for(var i=0;i<this.assembly.length;i++) {
            var ins = this.assembly[i];

            if(ins.op == '*') {
                printIns('mov eax, '+ins.r1.v);
                printIns('mul eax, '+ins.r2.v);
                printIns('mov '+ins.w.v+', eax');
            } else if(ins.op == '+') {
                printIns('mov eax, '+ins.r1.v);
                printIns('add eax, '+ins.r2.v);
                printIns('mov '+ins.w.v+', eax');
            } else if(ins.op == '-') {
                printIns('mov eax, '+ins.r1.v);
                printIns('sub eax, '+ins.r2.v);
                printIns('mov '+ins.w.v+', eax');
            } else if(ins.op == '=') {
                if(ins.w.v != ins.r1.v) {
                    // should really be done on IR
                    if((ins.w.t == 'VAR' || ins.w.t == 'STACKVAR') && 
                       (ins.r1.t == 'VAR' || ins.r1.t == 'STACKVAR') ) {
                        printIns('mov eax, '+ins.r1.v);
                        printIns('mov '+ins.w.v+', eax');
                    } else {
                        printIns('mov '+ins.w.v+', '+ins.r1.v);
                    }                    
                }                
            } else if(ins.op == '==') {
                printIns('cmp '+ins.r1.v+', '+ins.r2.v);
                trueCond = 'e';
                falseCond = 'ne';
            } else if(ins.op == '!=') {
                printIns('cmp '+ins.r1.v+', '+ins.r2.v);
                trueCond = 'ne';
                falseCond = 'e';
            } else if(ins.op == 'ifTrue') {
                printIns('j'+trueCond+' '+ins.label);
            } else if(ins.op == 'ifFalse') {
                printIns('j'+falseCond+' '+ins.label);                
            } else if(ins.op == 'push') {
                printIns('push '+ins.r1.v);
            } else if(ins.op == 'pop') {
                printIns('pop '+ins.w.v);
            } else if(ins.op == 'jmp') {
                printIns('jmp '+ins.label);
            } else if(ins.op == 'call') {
                printIns('call '+ins.name);
            } else if(ins.op == 'functionstart') {
                console.log(ins.name+':');
                printIns('push ebp');
                printIns('mov ebp, esp');
                printIns('sub esp, '+(4*ins.varCount));
                var registers = Object.keys(ins.usedRegisters);    
                for(var j in registers ) {
                    printIns('push', registers[j])
                }
            } else if(ins.op == 'functionend') {
                if(getPrevIns(this).op != 'return') { // don't add ret if previous ins was return
                    var registers = Object.keys(this.func.usedRegisters).reverse();    
                    for(var r in registers ) {
                        printIns('pop', registers[r])
                    }
                    printIns('leave');
                    printIns('ret', this.func.argCount*4);
                }
            } else if(ins.op == 'return') {
                printIns('mov eax, '+ins.r1.v);
                var registers = Object.keys(this.func.usedRegisters).reverse();    
                for(var r in registers ) {
                    printIns('pop', registers[r])
                }
                printIns('leave');
                printIns('ret', this.func.argCount*4);
            } else {
                printIns(JSON.stringify(ins));
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
    if(getToken().t == '==') {
        eatToken('==');
        var op = '==';
    } else if(getToken().t == '!=') {
        eatToken('!=');
        var op = '!=';
    } else {
        throw 'Expected token to be == or !=';
    }
    parseSum(b);
    var v2 = popVStack();
    var v1 = popVStack();
    var tmp = {t:'INTRINSIC', v: '$cond'};
    b.emit({op, w: tmp, r1: v1, r2:v2})
}

var ifStmt=0;
function parseIfStatement(b) {
    logStack("parseIfStatement"); indent++;
    var prev = b;

    var trueBlock = b; //new Block([b]);
    var falseBlock = new Block([b]);

    ifStmt++;
    eatToken('IF');
    eatToken('(');
    b = parseCondStatement(b);
    var tmp = {t:'INTRINSIC', v: '$cond'};
    prev.emit({op:'ifFalse', r1: tmp, label:falseBlock.name});

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
    trueBlock.emit({op: 'jmp', label: endBlock.name});
    
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
    b = parseCondStatement(condBlock);
    var tmp = {t:'INTRINSIC', v: '$cond'};
    condBlock.emit({op:'ifFalse', r1: tmp, label:endBlock.name}); // exit if condition is false
    eatToken(')');
    eatToken('{');
    whileBlock = parseStatementList(whileBlock);
    eatToken('}');
    whileBlock.emit({op:'jmp', label:condBlock.name});

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

var functionDeclarations = {
    'ok': 0,
    'nok': 0,
};
function parseFunction(b) {
    logStack("parseFunction"); indent++;

    //b = new Block([b]);
    
    eatToken('FUNCTION');
    var name = eatToken('NAME');    

    var functionStartLabel = name.v;
    var f = {op:'functionstart', name:functionStartLabel, varCount:0, usedRegisters:{}};
    b.func = f;
    b.emit(f);
    
    eatToken('(');
    b.variables=[];
    var i = 0;
    if(getToken().t == 'NAME') {
        var n = eatToken('NAME');
        b.variables[n.v] = {t: 'STACKVAR', v: '[EBP+'+(4*i+8)+']', index: i};
        i++;
        while(getToken().t == ',') {
            eatToken(',');
            var n = eatToken('NAME');
            b.variables[n.v] = {t: 'STACKVAR', v: '[EBP+'+(4*i+8)+']', index: i};
            i++;
        }
    }
    b.func.argCount = i;
    functionDeclarations[name.v] = i;
    eatToken(')');
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
    b = parseSum(b);
    var r1 = popVStack();
    eatToken(';');
    b.emit({op: 'return', r1});
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
    b.emit({op:'call', name: name.v});

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