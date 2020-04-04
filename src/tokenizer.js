'use strict';

function getToken() {
    return currentToken;
}

function eatToken(t) {
    if (currentToken.t != t) throw `Expected ${t} but got ${currentToken.t}`;

    let ret = currentToken;

    program = program.substring(currentToken.l);
    program = program.replace(/^ */, '');
    program = program.replace(/^\n/, '');
    // console.log(program);

    let m;
    if ((m = program.match(/^([0-9]+)/)))
        currentToken = {
            t: 'DIGIT',
            v: m[1],
            l: m[1].length
        };
    else if ((m = program.match(/^([+-])/)))
        currentToken = {
            t: 'SUM',
            l: 1,
            v: m[1]
        };
    else if ((m = program.match(/^\*/)))
        currentToken = {
            t: 'PRODUCT',
            l: 1
        };
    else if ((m = program.match(/^(=) +/)))
        currentToken = {
            t: 'EQUAL',
            l: 1
        };
    else if ((m = program.match(/^(==) +/)))
        currentToken = {
            t: '==',
            l: 2
        };
    else if ((m = program.match(/^(!=) +/)))
        currentToken = {
            t: '!=',
            l: 2
        };
    else if ((m = program.match(/^(WHILE)/)))
        currentToken = {
            t: 'WHILE',
            l: 5
        };
    else if ((m = program.match(/^(FUNCTION)/)))
        currentToken = {
            t: 'FUNCTION',
            l: 8
        };
    else if ((m = program.match(/^(CALL)/)))
        currentToken = {
            t: 'CALL',
            l: 4
        };
    else if ((m = program.match(/^(RETURN)/)))
        currentToken = {
            t: 'RETURN',
            l: 6
        };
    else if ((m = program.match(/^(IF)/)))
        currentToken = {
            t: 'IF',
            l: 2
        };
    else if ((m = program.match(/^(ELSE)/)))
        currentToken = {
            t: 'ELSE',
            l: 4
        };
    else if ((m = program.match(/^(\{)/)))
        currentToken = {
            t: '{',
            l: 1
        };
    else if ((m = program.match(/^(\})/)))
        currentToken = {
            t: '}',
            l: 1
        };
    else if ((m = program.match(/^(\()/)))
        currentToken = {
            t: '(',
            l: 1
        };
    else if ((m = program.match(/^(\))/)))
        currentToken = {
            t: ')',
            l: 1
        };
    else if ((m = program.match(/^(;)/)))
        currentToken = {
            t: ';',
            l: 1
        };
    else if ((m = program.match(/^(,)/)))
        currentToken = {
            t: ',',
            l: 1
        };
    else if ((m = program.match(/^([a-z]+)/)))
        currentToken = {
            t: 'NAME',
            v: m[1],
            l: m[1].length
        };
    else if ((m = program.match(/^("(.*)")/)))
        currentToken = {
            t: 'STRING',
            v: m[2],
            l: m[1].length
        };
    else if (program == '')
        currentToken = {
            t: 'END',
            l: 0
        };
    else
        throw `Unexpected character at ${program}`;

    return ret;
}

let program = '';
let currentToken = {
    t: 'START',
    l: 0
};

function tokenize(p) {
    program = p;
    currentToken = {
        t: 'START',
        l: 0
    };
}

module.exports = {
    tokenize,
    getToken,
    eatToken,
};
