'use strict';

function getToken() {
    return currentToken;
}

function eatToken(t) {
    if (currentToken.t != t) throw `Expected ${t} but got ${currentToken.t} at ${program}`;

    let ret = currentToken;

    program = program.substring(currentToken.l);
    program = program.replace(/^[ \n\t]*/, '');
    // console.log(program);


    let re = [
        {rx: /^([+-])/, tk: 'SUM'},
        {rx: /^\*/, tk: 'PRODUCT'},
        {rx: /^&/, tk: '&'},
        {rx: /^(==)/, tk: '=='},
        {rx: /^(!=)/, tk: '!='},
        {rx: /^(=)/, tk: 'EQUAL'},
        {rx: /^WHILE/, tk: 'WHILE'},
        {rx: /^FUNCTION/, tk: 'FUNCTION'},
        {rx: /^RETURN/, tk: 'RETURN'},
        {rx: /^IF/, tk: 'IF'},
        {rx: /^ELSE/, tk: 'ELSE'},
        {rx: /^LET/, tk: 'LET'},
        {rx: /^(INT64|INT32)/, tk: 'TYPE'},
        {rx: /^\{/, tk: '{'},
        {rx: /^\}/, tk: '}'},
        {rx: /^\(/, tk: '('},
        {rx: /^\)/, tk: ')'},
        {rx: /^;/, tk: ';'},
        {rx: /^,/, tk: ','},
        {rx: /^:/, tk: ':'},
        {rx: /^([a-z]+)/, tk: 'IDENTIFIER'},
        {rx: /^([0-9]+L)/, tk: 'DIGIT64'},
        {rx: /^([0-9]+)/, tk: 'DIGIT'},
        {rx: /^(".*")/, tk: 'STRING'},
        {rx: /^$/, tk: 'END'}
    ];

    currentToken = undefined;
    for(let i in re) {
        let m = program.match(re[i].rx);
        if(!m) continue;
        const v = m[1]?m[1]:m[0];
        currentToken = {t: re[i].tk, v, l: v.length};
        break;
    }

    if(!currentToken)
        throw `Unexpected character at ${program}`;

    return ret;
}

let program;
let currentToken;

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
