'use strict';

let {
    tokenize,
    getToken,
    eatToken
} = require('./tokenizer');

function Block(predecessors) {
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
        this.successors.push(p);
        p.predecessors.push(this);
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
        if(phiList[v])
            return;
        this.ilcode.unshift({op: 'phi', id: v, w: {t:'VAR', v:v}, r:[] });
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
function popRHS(b) {
    return vstack.pop();
}

function pushVStack(v) {
    // delete v.l;
    vstack.push(v);
}

function getAddress(b, r) {
    if(b.func.variables[r.v])
        return b.func.variables[r.v];
    if(b.func.args[r.v])
        return b.func.args[r.v];
    throw `Variable ${r.v} doesnt exists`;
}

function parseTerm(b) {
    if (getToken().t == 'DIGIT') {
        const v = eatToken('DIGIT');
        vstack.push(v);
    } else if (getToken().t == '&') {
        eatToken('&');
        b = parseTerm(b);
        let v = vstack.pop();
        if(v.t != 'VAR') {
            throw 'Cant take a reference of '+v.t;
        }
        // const name = eatToken('NAME');
        // indicate that we want the address of the variable
        const w = getTempVar();
        b.emit({op: 'ptrOf', w: w, r1: getAddress(b, v) });
        vstack.push(w);
    } else if (getToken().t == 'PRODUCT') {
        eatToken('PRODUCT');
        const name = eatToken('NAME');
        // indicate we want the data at the address
        vstack.push({
            t: 'VAR',
            v: name.v,
            mod: '*'
        });
    } else if (getToken().t == 'NAME') {
        const name = eatToken('NAME');
        if(getToken().t == '(') {
            b = parseFunctionCall(name, b);
        } else {
            let v = {t: 'VAR', v: name.v};
            if(!b.func.args[name.v] && !b.func.variables[name.v])
                declareLocalVariable(b, {t: 'VAR', v: name.v});

            vstack.push(getAddress(b, v));
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
        const dst = getTempVar();

        if (s.v == '+') {
            b.emit({
                op: '+',
                w: dst,
                r1: op1,
                r2: op2,
            });
        } else {
            b.emit({
                op: '-',
                w: dst,
                r1: op1,
                r2: op2,
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
function getTempVar() {
    return {t: 'VAR', v: 'tmp'+tmpIndex++};
}

function parseProduct(b) {
    b = parseTerm(b);
    if (getToken().t == 'PRODUCT') {
        eatToken('PRODUCT');
        b = parseProduct(b);
        const op2 = popRHS(b);
        const op1 = popRHS(b);
        const dst = getTempVar();

        b.emit({
            op: '*',
            w: dst,
            r1: op1,
            r2: op2,
        });
        pushVStack(dst);
    }
    return b;
}

function declareLocalVariable(b, v) {
    if(b.func.variables[v.v])
        return b.func.variables[v.v];
    b.func.varCount++;
    b.func.variables[v.v] = {...v, address: `ebp-${4*b.func.varCount}`};
    return b.func.variables[v.v];
}

function parseAssignment(dst, b) {
    eatToken('EQUAL');
    b = parseValue(b);       // should be a rvalue
    const src = popLHS();
    if(dst.mod == '*') {
        b.emit({op: 'store', r1: dst, r2: src});
    } else {
        dst = declareLocalVariable(b, dst);
        b.emit({
            op: '=',
            w: dst,
            r1: src
        });
    }
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
        r1: v1,
        r2: v2,
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
        r1: tmp,
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
        r1: tmp,
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
    } else if (getToken().t == 'NAME' || getToken().t == 'PRODUCT') {
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
        throw `Expected IF/WHILE/NAME/FUNCTION or CALL but got ${getToken().t}`;
    }
}

function parseFunction(b) {
    eatToken('FUNCTION');
    const name = eatToken('NAME');

    const functionStartLabel = name.v;
    const f = {
        op: 'functionStart',
        name: functionStartLabel,
        varCount: 0,
        usedRegisters: {},
        args: {},
        variables: {}
    };
    b.func = f;
    b.emit(f);

    eatToken('(');
    //b.args = {};
    let i = 0;
    if (getToken().t == 'NAME') {
        var n = eatToken('NAME');
        f.args[n.v] = {
            t: 'VAR',
            v: n.v,
            address: `ebp+${4 * i + 8}`,
            index: i,
        };
        i++;
        while (getToken().t == ',') {
            eatToken(',');
            const n = eatToken('NAME');
            f.args[n.v] = {
                t: 'VAR',
                v: n.v,
                address: `ebp+${4 * i + 8}`,
                index: i,
            };
            i++;
        }
    }
    //f.args = b.variables;
    f.args['_retptr'] = {t: 'VAR', v: '_retptr', address: `ebp+${4 * i + 8}`};
    i++;
    b.func.argCount = i;
    functionDeclarations[name.v] = i;
    eatToken(')');
    eatToken('{');
    b = parseStatementList(b);
    eatToken('}');

    // all values should be consumed at this point
    if (vstack.length != 0) throw 'Expected vstack to be empty';

    // emit({op:'RET'});
    b.emit({
        op: 'functionEnd',
        name: functionStartLabel
    });

    return b;
}

function parseReturn(b) {
    eatToken('RETURN');
    b = parseSum(b);
    const r1 = popRHS(b);
    const w = getTempVar();
    b.emit({op: '=', w: w, r1: b.func.args['_retptr']});
    b.emit({op: 'store', r1: w, r2: r1});
    eatToken(';');
    b.emit({
        op: 'return'
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

    const ret = declareLocalVariable(b, {t:'VAR', v: '_ret'+retIndex++});
    const tmp = getTempVar();
    b.emit({op: 'ptrOf', w: tmp, r1: ret});
    
    args.push(tmp);

    if (functionDeclarations[name.v] !== args.length) {
        throw `Function call "${name.v}" doesnt match declared arguments`;
    }

    args.reverse().forEach((v)=>b.emit({op: 'push', r1:v}));
    b.emit({op: 'call', name: name.v, ret: ret});

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
    ok: 0,
    nok: 0,
    print: 2,
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
    getBlockList: () => blockList
};
