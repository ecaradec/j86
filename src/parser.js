'use strict';

let {
    tokenize,
    getToken,
    eatToken
} = require('./tokenizer');

const types = require('./types.js');

function Block(predecessors = []) {
    blockList.push(this);

    this.ilcode = [];
    this.successors = [];
    this.predecessors = [];
    this.variables = {};
    this.phis = {};
    this.name = `block_${blockId}`;
    
    // this will be used later in dominance
    this.frontier = {};
    this.parents = [];
    this.children = [];

    if (predecessors.length > 0) {
        this.func = predecessors[0].func;
    }
    blockId++;

    for (const p of predecessors) {
        p.successors.push(this);
        this.predecessors.push(p);
    }

    this.addPredecessor = (p) => {
        p.successors.push(this);
        this.predecessors.push(p);
        this.func = p.func;
    };

    this.emit = (data) => {
        // console.log(data);
        if (data == undefined) data = {};
        this.ilcode.push(data);
        return this.ilcode.length - 1;
    };

    this.addPHI = (v) => {
        let phiList = this.getPHIs();
        if(phiList[v.v])
            return;
        this.ilcode.unshift({op: 'phi', id: v.v, w: v, r:[] });
    };

    this.getPHIs = function() {
        let phiList = {};
        for(let i in this.ilcode) {
            const ins = this.ilcode[i];
            if(ins.op != 'phi')
                break;
            phiList[ins.id] = ins;
        }
        return phiList;
    };
}

function popLHS() {
    return vstack.pop();
}
function popRHS() {
    return vstack.pop();
}

function pushVStack(v) {
    vstack.push(v);
}

function parseTerm(b) {
    if (getToken().t == 'DIGIT') {
        const v = eatToken('DIGIT');
        vstack.push({...v, type: 'INT32'});
    } else if (getToken().t == 'DIGIT64') {
        const v = eatToken('DIGIT64');
        vstack.push({...v, type: 'INT64'});
    } else if (getToken().t == '&') {
        eatToken('&');
        b = parseTerm(b);
        let v = vstack.pop();
        if(v.t != 'VAR') {
            throw 'Cant take a reference of '+v.t;
        }
        // indicate that we want the address of the variable
        const w = getTempVar(v.type);
        b.emit({op: 'ptrOf', w: w, r: [v] });
        vstack.push(w);
    } else if (getToken().t == 'IDENTIFIER') {
        const name = eatToken('IDENTIFIER');
        if(getToken().t == '(') {
            b = parseFunctionCall(name, b);
        } else {
            if(b.func.variables[name.v])
                vstack.push(b.func.variables[name.v]);
            else if(b.func.args[name.v])
                vstack.push(b.func.args[name.v]);
            else
                throw `Variable ${name.v} is not declared`;
        }
    }

    return b;
}

function parseSum(b) {
    b = parseProduct(b);
    if (getToken().t == 'SUM') {
        const s = eatToken('SUM');
        b = parseSum(b);

        const op2 = popRHS(b);
        const op1 = popRHS(b);
        const dst = getTempVar(op1.type);

        if (s.v == '+') {
            b.emit({
                op: '+',
                w: dst,
                r: [op1, op2]
            });
        } else {
            b.emit({
                op: '-',
                w: dst,
                r: [op1, op2]
            });
        }

        pushVStack(dst);
    }

    return b;
}

function parseValue(b) {
    if (getToken().t == 'STRING') {
        var tk = eatToken('STRING');
        stringIndex++;
        strings[`str${stringIndex}`] = tk.v.replace(/(^"|"$)/g,'');
        let v = {
            t: 'LABEL',
            v: `str${stringIndex}`,
            address: `str${stringIndex}`
        };
        blockList[0].variables[`str${stringIndex}`] = v;
        pushVStack(v);
        return b;
    }
    return parseSum(b);
}

let tmpIndex = 0;
function getTempVar(type) {
    return {t: 'VAR', v: 'tmp'+tmpIndex++, type: type};
}

function parseProduct(b) {
    b = parseTerm(b);
    if (getToken().t == 'PRODUCT') {
        eatToken('PRODUCT');
        b = parseProduct(b);
        const op2 = popRHS(b);
        const op1 = popRHS(b);
        const dst = getTempVar(op1.type);

        b.emit({
            op: '*',
            w: dst,
            r: [op1, op2]
        });
        pushVStack(dst);
    }
    return b;
}

function declareLocalVariable(b, v) {
    if(b.func.variables[v.v])
        return b.func.variables[v.v];
    b.func.variables[v.v] = v;
    return b.func.variables[v.v];
}

function checkAssignTypes(dst, src) {
    if(dst.type == src.type) {
        return;
    }
    if(dst.type == 'INT32' && src.type == 'INT32') {
        return;
    }
    throw `Incompatible type assignment ${dst.v}:${dst.type} = ${src.v}:${src.type}`;
}

function parseAssignment(dst, b) {
    eatToken('EQUAL');
    b = parseValue(b);       // should be a rvalue
    const src = popLHS();

    checkAssignTypes(dst, src);

    b.emit({
        op: '=',
        w: dst,
        r: [src]
    });
    
    return b;
}

function parseCondStatement(b) {
    b = parseSum(b);
    let op;
    if (getToken().t == '==') {
        eatToken('==');
        op = '==';
    } else if (getToken().t == '!=') {
        eatToken('!=');
        op = '!=';
    } else {
        throw 'Expected token to be == or !=';
    }
    b = parseSum(b);
    const v2 = popRHS(b);
    const v1 = popRHS(b);
    const tmp = {
        t: 'INTRINSIC',
        v: '$cond'
    };
    b.emit({
        op,
        w: tmp,
        r: [v1, v2]
    });
    return b;
}

function parseIfStatement(b) {
    const prev = b;

    let trueBlock = new Block([b]);
    let falseBlock = new Block([b]);

    eatToken('IF');
    eatToken('(');
    b = parseCondStatement(b);
    const tmp = {
        t: 'INTRINSIC',
        v: '$cond'
    };
    prev.emit({
        op: 'ifFalse',
        r: [tmp],
        label: falseBlock.name
    });

    eatToken(')');
    eatToken('{');
    trueBlock = parseStatementList(trueBlock);
    eatToken('}');

    if (getToken().t == 'ELSE') {
        eatToken('ELSE');
        eatToken('{');
        falseBlock = parseStatementList(falseBlock);
        eatToken('}');
    }

    let predecessors = [];
    if(!falseBlock.hasReturn)
        predecessors.push(falseBlock);
    if(!trueBlock.hasReturn)
        predecessors.push(trueBlock);
        
    // if all path returns then it's as if this block also returns
    // this also means that we have dead code, and that we could drop extra code in the statement
    const endBlock = new Block(predecessors);
    endBlock.func = b.func;
    if(predecessors.length == 0) {
        endBlock.hasReturn = true;
    }
    trueBlock.emit({
        op: 'jmp',
        label: endBlock.name
    });

    return endBlock;
}

function parseWhileStatement(b) {
    const startBlock = b;
    let whileBlock = new Block([startBlock]);
    whileBlock.addPredecessor(whileBlock);
    const endBlock = new Block([whileBlock]);

    eatToken('WHILE');
    eatToken('(');
    b = parseCondStatement(whileBlock);
    const tmp = {
        t: 'INTRINSIC',
        v: '$cond'
    };
    whileBlock.emit({
        op: 'ifFalse',
        r: [tmp],
        label: endBlock.name
    }); // exit if condition is false
    eatToken(')');
    eatToken('{');
    whileBlock = parseStatementList(whileBlock);
    eatToken('}');
    whileBlock.emit({
        op: 'jmp',
        label: whileBlock.name
    });

    return endBlock;
}

function parseStatement(b) {
    if (getToken().t == 'IF') {
        return parseIfStatement(b);
    } else if (getToken().t == 'WHILE') {
        return parseWhileStatement(b);
    } else if (getToken().t == 'LET') {
        eatToken('LET');
        let name = eatToken('IDENTIFIER');
        eatToken(':');
        let type = eatToken('TYPE');

        let v = {t: 'VAR', v: name.v, type: type.v};
        if (getToken().t == 'EQUAL') {
            b = parseAssignment(v, b);
        }
        eatToken(';');

        if(b.func.variables[name.v])
            throw `Variable ${name.v} already defined`;
        if(b.func.args[name.v])
            throw `Variable ${name.v} cant mask argument`;

        declareLocalVariable(b, v);
        return b;
    } else if (getToken().t == 'IDENTIFIER' || getToken().t == 'PRODUCT') {
        // name or pointer
        b = parseValue(b);
        let dst = vstack.pop();
        if (getToken().t == 'EQUAL') {
            b = parseAssignment(dst, b);
        }
        eatToken(';');
        return b;
    } else if (getToken().t == 'RETURN') {
        return parseReturn(b);
    } else {
        throw `Expected IF/WHILE/NAME/PRODUCT/RETURN or CALL but got ${getToken().t}`;
    }
}

let functionsList = [];
function parseFunction(b) {
    eatToken('FUNCTION');
    const name = eatToken('IDENTIFIER');

    const functionStartLabel = name.v;
    const f = {
        op: 'functionStart',
        name: functionStartLabel,
        usedRegisters: {},
        args: {},
        variables: {},
        blocks: []
    };
    b.func = f;
    let startBlock = blockList.length-1;

    functionsList.push(f);

    b.emit(f);

    eatToken('(');
    if (getToken().t == 'IDENTIFIER') {
        const n = eatToken('IDENTIFIER');
        eatToken(':');
        const type = eatToken('TYPE');
        f.args[n.v] = {
            t: 'VAR',
            v: n.v,
            type: type.v
        };

        while (getToken().t == ',') {
            eatToken(',');
            const n = eatToken('IDENTIFIER');
            eatToken(':');
            const type = eatToken('TYPE');
            f.args[n.v] = {
                t: 'VAR',
                v: n.v,
                type: type.v
            };
        }
    }

    eatToken(')');

    let returnType = 'VOID';
    if(getToken().t == ':') {
        eatToken(':');
        returnType = eatToken('TYPE').v;
    } 
    f.returnType = returnType;
    
    if(types[f.returnType].size > 4) {
        f.args['_retptr'] = {t: 'VAR', v: '_retptr'};
    }

    functionDeclarations[name.v] = f;

    eatToken('{');
    b = parseStatementList(b);
    eatToken('}');

    // all values should be consumed at this point
    if (vstack.length != 0) throw 'Expected vstack to be empty';

    b.emit({
        op: 'functionEnd',
        name: functionStartLabel
    });

    f.blocks = blockList.slice(startBlock, blockList.length);

    return b;
}

function parseReturn(b) {
    eatToken('RETURN');
    b = parseSum(b);
    const r1 = popRHS(b);
    //const w = getTempVar();
    // b.emit({op: '=', w: w, r1: b.func.args['_retptr']});
    // b.emit({op: 'store', r1: w, r2: r1});
    eatToken(';');
    b.emit({
        op: 'return',
        r: [r1]
    });
    b.hasReturn = true;
    return b;
}

let retIndex = 0;
function parseFunctionCall(name, b) {
    eatToken('(');
    if (functionDeclarations[name.v] === undefined) {
        throw `Function ${name.v} doesnt exists`;
    }
    let func = functionDeclarations[name.v];

    let args = [];
    if (getToken().t != ')') {
        b = parseValue(b);
        var r1 = popRHS(b);
        args.push(r1);
        while (getToken().t == ',') {
            eatToken(',');
            b = parseValue(b);
            const r1 = popRHS(b);
            args.push(r1);
        }
    }
    eatToken(')');

    let ret = declareLocalVariable(b, {t:'VAR', v: '_ret'+retIndex++, type: func.returnType});
    //const tmp = getTempVar();
    //b.emit({op: 'ptrOf', w: tmp, r1: ret});
    //args.push(tmp);

    if (Object.keys(functionDeclarations[name.v].args).length !== args.length) {
        throw `Function call "${name.v}" doesnt match declared arguments`;
    }

    b.emit({op: 'call', name: name.v, w: ret, r: args, func: functionDeclarations[name.v]});

    if(ret)
        vstack.push(ret);

    return b;
}

function parseStatementList(b) {
    while (getToken().t != '}') {
        b = parseStatement(b);
    }

    return b;
}

function parseProgram() {
    const start = new Block([]);

    while (getToken().t == 'FUNCTION') {
        const fBlock = new Block([start]);
        parseFunction(fBlock);
    }

    return start;
}

const functionDeclarations = {
    printf: {args: ['str'], returnType: 'INT32'},
};

let blockId = 0;
let blockList = [];

let stringIndex = 0;
let strings = [];

const vstack = [];

let ast;
module.exports = {
    build: (p) => {
        blockId = 0;
        blockList = [];
        stringIndex = 0;
        strings = [];
        tokenize(p);
        eatToken('START');
        ast = parseProgram();
    },
    getStrings: () => strings,
    getStartBlock: () => ast,
    getBlockList: () => blockList,
    getFunctions: () => functionsList,
};
