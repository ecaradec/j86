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
}

function popVStack() {
    return vstack.pop();
}

function pushVStack(v) {
    // delete v.l;
    vstack.push(v);
}

function parseTerm(b) {
    if (getToken().t == 'DIGIT') {
        const v = eatToken('DIGIT');
        vstack.push(v);
    } else if (getToken().t == '&') {
        eatToken('&');
        const name = eatToken('NAME');
        // indicate that we want the address of the variable
        vstack.push({
            t: 'VAR',
            v: name.v,
            mod: '&'
        });
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
            const tmp = {t: 'VAR', v: getTmpVar()};
            vstack.push(tmp);
            b = parseFunctionCall(name, b, tmp);
        } else {
            vstack.push({
                t: 'VAR',
                v: name.v
            });
        }
    }

    return b;
}

let tmp = 0;

function getTmpVar() {
    return `tmp${tmp++}`;
}

function parseSum(b) {
    parseProduct(b);
    if (getToken().t == 'SUM') {
        const s = eatToken('SUM');
        b = parseSum(b);

        const op2 = popVStack();
        const op1 = popVStack();
        const dst = {
            t: 'VAR',
            v: getTmpVar()
        };

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
        strings[`str${stringIndex}`] = tk.v;
        let v = {
            t: 'GLOBALVAR',
            v: `str${stringIndex}`
        };
        blockList[0].variables[`str${stringIndex}`] = v;
        pushVStack(v);
        return b;
    }
    return parseSum(b);
}

function parseProduct(b) {
    b = parseTerm(b);
    if (getToken().t == 'PRODUCT') {
        eatToken('PRODUCT');
        b = parseProduct(b);
        const op2 = popVStack();
        const op1 = popVStack();
        const dst = {
            t: 'VAR',
            v: getTmpVar()
        };

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

function parseAssignment(dst, b) {
    eatToken('EQUAL');
    b = parseValue(b);       // should be a rvalue
    const src = popVStack();
    b.emit({
        op: '=',
        w: {
            t: 'VAR',
            v: (dst.mod?dst.mod:'')+dst.v
        },
        r1: src
    });
    eatToken(';');

    return b;
}

function parseCondStatement(b) {
    parseSum(b);
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
    parseSum(b);
    const v2 = popVStack();
    const v1 = popVStack();
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
}

function parseIfStatement(b) {
    const prev = b;

    let trueBlock = b;
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

    const endBlock = new Block([trueBlock, falseBlock], 'endIf');
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
    }
    if (getToken().t == 'WHILE') {
        return parseWhileStatement(b);
    }
    if (getToken().t == 'NAME' || getToken().t == 'PRODUCT') {
        //const name = eatToken('NAME');
        b = parseValue(b);
        let dst = vstack.pop();
        if (getToken().t == 'EQUAL') {
            return parseAssignment(dst, b);
        }
        if (getToken().t == '(') {
            b = parseFunctionCall(name, b);
            eatToken(';');
            return b;
        }
        throw `Expected = or ( but got ${getToken().t}`;
    } else if (getToken().t == 'FUNCTION') {
        return parseFunction(b);
    } else if (getToken().t == 'RETURN') {
        const rBlock = new Block([b]);
        parseReturn(b);
        return rBlock;
    } else throw `Expected IF/WHILE/NAME/FUNCTION or CALL but got ${getToken().t}`;
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
        args: []
    };
    b.func = f;
    b.emit(f);

    eatToken('(');
    b.variables = [];
    let i = 0;
    if (getToken().t == 'NAME') {
        var n = eatToken('NAME');
        b.variables[n.v] = {
            t: 'STACKVAR',
            v: `[EBP+${4 * i + 8}]`,
            index: i,
        };
        i++;
        while (getToken().t == ',') {
            eatToken(',');
            const n = eatToken('NAME');
            b.variables[n.v] = {
                t: 'STACKVAR',
                v: `[EBP+${4 * i + 8}]`,
                index: i,
            };
            i++;
        }
    }
    f.args = b.variables;
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
    const r1 = popVStack();
    eatToken(';');
    b.emit({
        op: 'return',
        r1
    });
    return b;
}

function parseFunctionCall(name, b) {
    eatToken('(');
    if (functionDeclarations[name.v] === undefined) {
        throw `Function ${name.v} doesnt exists`;
    }
    let argumentsCount = 0;
    if (getToken().t != ')') {
        b = parseValue(b);
        var r1 = popVStack();
        b.emit({
            op: 'push',
            r1
        });
        argumentsCount++;
        while (getToken().t == ',') {
            eatToken(',');
            b = parseValue(b);
            const r1 = popVStack();
            b.emit({
                op: 'push',
                r1
            });
            argumentsCount++;
        }
    }
    if (functionDeclarations[name.v] !== argumentsCount) {
        throw `Function call "${name.v}" doesnt match declared arguments`;
    }
    eatToken(')');

    const tmp = getTmpVar();
    b.emit({t: 'VAR', v:tmp});
    b.emit({
        op: 'push',
        r1: {t: 'VAR', mod: '&', v: tmp}
    });

    b.emit({
        op: 'call',
        name: name.v
    });

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
    print: 1,
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
        tmp = 0;
        tokenize(p);
        eatToken('START');
        ast = parseProgram();
    },
    getStrings: () => strings,
    getAST: () => ast
};
