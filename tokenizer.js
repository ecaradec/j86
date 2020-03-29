let program = '';
let currentToken = {
    t: 'START',
    l: 0
};

function getToken() {
    return currentToken;
}

function eatToken(t) {
    if (currentToken.t != t) throw `Expected ${t} but got ${currentToken.t}`;

    const ret = currentToken;

    program = program.substring(currentToken.l);
    program = program.replace(/^ */, '');
    program = program.replace(/^\n/, '');
    // console.log(program);

    let m;
    if ((m = program.match(/^([0-9]+)/)))
        return {
            t: 'DIGIT',
            v: m[1],
            l: m[1].length
        };
    else if ((m = program.match(/^([+-])/)))
        return {
            t: 'SUM',
            l: 1,
            v: m[1]
        };
    else if ((m = program.match(/^\*/))) return {
        t: 'PRODUCT',
        l: 1
    };
    else if ((m = program.match(/^(=) +/))) return {
        t: 'EQUAL',
        l: 1
    };
    else if ((m = program.match(/^(==) +/))) return {
        t: '==',
        l: 2
    };
    else if ((m = program.match(/^(!=) +/))) return {
        t: '!=',
        l: 2
    };
    else if ((m = program.match(/^(WHILE)/)))
        return {
            t: 'WHILE',
            l: 5
        };
    else if ((m = program.match(/^(FUNCTION)/)))
        return {
            t: 'FUNCTION',
            l: 8
        };
    else if ((m = program.match(/^(CALL)/))) return {
        t: 'CALL',
        l: 4
    };
    else if ((m = program.match(/^(RETURN)/)))
        return {
            t: 'RETURN',
            l: 6
        };
    else if ((m = program.match(/^(IF)/))) return {
        t: 'IF',
        l: 2
    };
    else if ((m = program.match(/^(ELSE)/))) return {
        t: 'ELSE',
        l: 4
    };
    else if ((m = program.match(/^(\{)/))) return {
        t: '{',
        l: 1
    };
    else if ((m = program.match(/^(\})/))) return {
        t: '}',
        l: 1
    };
    else if ((m = program.match(/^(\()/))) return {
        t: '(',
        l: 1
    };
    else if ((m = program.match(/^(\))/))) return {
        t: ')',
        l: 1
    };
    else if ((m = program.match(/^(;)/))) return {
        t: ';',
        l: 1
    };
    else if ((m = program.match(/^(,)/))) return {
        t: ',',
        l: 1
    };
    else if ((m = program.match(/^([a-z]+)/)))
        return {
            t: 'NAME',
            v: m[1],
            l: m[1].length
        };
    else if (program == '') return {
        t: 'END',
        l: 0
    };
    else throw `Unexpected token at ${program}`;

    // console.log(ret,'<',currentToken);

    return ret;
}

function tokenize(p) {
    program = p;
}

module.exports = {
    tokenize,
    getToken,
    eatToken,
};
