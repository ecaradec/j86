function getToken() {
    return currentToken;
}

let currentToken = {
    t: 'START',
    l: 0
};

function eatToken(t) {
    if (currentToken.t != t) throw `Expected ${t} but got ${currentToken.t}`;

    const ret = currentToken;

    program = program.substring(currentToken.l);
    program = program.replace(/^ */, '');
    program = program.replace(/^\n/, '');
    // console.log(program);

    let m;
    if ((m = program.match(/^([0-9]+)/))) currentToken = {
        t: 'DIGIT',
        v: m[1],
        l: m[1].length
    };
    else if ((m = program.match(/^([+-])/))) currentToken = {
        t: 'SUM',
        l: 1,
        v: m[1]
    };
    else if ((m = program.match(/^\*/))) currentToken = {
        t: 'PRODUCT',
        l: 1
    };
    else if ((m = program.match(/^(=) +/))) currentToken = {
        t: 'EQUAL',
        l: 1
    };
    else if ((m = program.match(/^(==) +/))) currentToken = {
        t: '==',
        l: 2
    };
    else if ((m = program.match(/^(!=) +/))) currentToken = {
        t: '!=',
        l: 2
    };
    else if ((m = program.match(/^(WHILE)/))) currentToken = {
        t: 'WHILE',
        l: 5
    };
    else if ((m = program.match(/^(FUNCTION)/))) currentToken = {
        t: 'FUNCTION',
        l: 8
    };
    else if ((m = program.match(/^(CALL)/))) currentToken = {
        t: 'CALL',
        l: 4
    };
    else if ((m = program.match(/^(RETURN)/))) currentToken = {
        t: 'RETURN',
        l: 6
    };
    else if ((m = program.match(/^(IF)/))) currentToken = {
        t: 'IF',
        l: 2
    };
    else if ((m = program.match(/^(ELSE)/))) currentToken = {
        t: 'ELSE',
        l: 4
    };
    else if ((m = program.match(/^(\{)/))) currentToken = {
        t: '{',
        l: 1
    };
    else if ((m = program.match(/^(\})/))) currentToken = {
        t: '}',
        l: 1
    };
    else if ((m = program.match(/^(\()/))) currentToken = {
        t: '(',
        l: 1
    };
    else if ((m = program.match(/^(\))/))) currentToken = {
        t: ')',
        l: 1
    };
    else if ((m = program.match(/^(;)/))) currentToken = {
        t: ';',
        l: 1
    };
    else if ((m = program.match(/^(,)/))) currentToken = {
        t: ',',
        l: 1
    };
    else if ((m = program.match(/^([a-z]+)/))) currentToken = {
        t: 'NAME',
        v: m[1],
        l: m[1].length
    };
    else if (program == '') currentToken = {
        t: 'END',
        l: 0
    };
    else throw `Unexpected token at ${program}`;

    // console.log(ret,'<',currentToken);

    return ret;
}

let blockId = 0;
const blockList = [];

function Block(parents) {
    blockList.push(this);

    this.assembly = [];
    this.children = [];
    this.parents = [];
    this.variables = {};
    this.phis = {};
    this.name = `block_${blockId}`;

    if (parents.length > 0) {
        this.func = parents[0].func;
    }
    blockId++;

    for (const i in parents) {
        parents[i].children.push(this);
        this.parents.push(parents[i]);
    }

    this.addParent = (p) => {
        this.parents.push(p);
        p.children.push(this);
        this.func = p.func;
    };

    this.emit = (data) => {
        // console.log(data);
        if (data == undefined) data = {};
        this.assembly.push(data);
        return this.assembly.length - 1;
    };

    this.print = () => {
        console.log(
            `# ${this.name}`,
            this.children.map((x) => x.name),
        );
        for (let i = 0; i < this.assembly.length; i++) {
            const ins = {
                ...this.assembly[i]
            };

            console.log(` ${JSON.stringify(ins)}`);
        }
    };
}

const vstack = [];

function popVStack() {
    return vstack.pop();
}

function pushVStack(v) {
    delete v.l;
    vstack.push(v);
}

function parseTerm(b) {
    if (getToken().t == 'DIGIT') {
        const v = eatToken('DIGIT');
        pushVStack(v);
    } else if (getToken().t == 'NAME') {
        const varname = eatToken('NAME');
        vstack.push({
            t: 'VAR',
            v: varname.v
        });
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

let variables = [];

function parseAssignment(dst, b) {
    variables[dst.v] = true;
    eatToken('EQUAL');
    b = parseSum(b);
    const src = popVStack();

    b.emit({
        op: '=',
        w: {
            t: 'VAR',
            v: dst.v
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
    let condBlock = new Block([startBlock]);
    condBlock.addParent(condBlock);
    const endBlock = new Block([condBlock]);

    eatToken('WHILE');
    eatToken('(');
    b = parseCondStatement(condBlock);
    const tmp = {
        t: 'INTRINSIC',
        v: '$cond'
    };
    condBlock.emit({
        op: 'ifFalse',
        r1: tmp,
        label: endBlock.name
    }); // exit if condition is false
    eatToken(')');
    eatToken('{');
    condBlock = parseStatementList(condBlock);
    eatToken('}');
    condBlock.emit({
        op: 'jmp',
        label: condBlock.name
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
    if (getToken().t == 'NAME') {
        const name = eatToken('NAME');
        if (getToken().t == 'EQUAL') return parseAssignment(name, b);
        if (getToken().t == '(') return parseFunctionCall(name, b);
        throw `Expected = or ( but got ${getToken().t}`;
    } else if (getToken().t == 'FUNCTION') {
        return parseFunction(b);
    } else if (getToken().t == 'RETURN') {
        const rBlock = new Block([b]);
        parseReturn(b);
        return rBlock;
    } else throw `Expected IF/WHILE/NAME/FUNCTION or CALL but got ${getToken().t}`;
}

const functionDeclarations = {
    ok: 0,
    nok: 0,
};

function parseFunction(b) {
    eatToken('FUNCTION');
    const name = eatToken('NAME');

    const functionStartLabel = name.v;
    const f = {
        op: 'functionStart',
        name: functionStartLabel,
        varCount: 0,
        usedRegisters: {},
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
        name: functionStartLabel,
        arguments
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
        parseSum();
        var r1 = popVStack();
        b.emit({
            op: 'PUSH',
            r1
        });
        argumentsCount++;
        while (getToken().t == ',') {
            eatToken(',');
            parseSum();
            const r1 = popVStack();
            b.emit({
                op: 'PUSH',
                r1
            });
            argumentsCount++;
        }
    }
    if (functionDeclarations[name.v] !== argumentsCount) {
        throw `Function call "${name.v}" doesnt match declared arguments`;
    }
    eatToken(')');
    eatToken(';');
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

var program = '';

function Parser() {
    this.build = (p) => {
        program = p;
        eatToken('START');
        return parseProgram();
    };
}

const parser = new Parser();

module.exports = parser;
