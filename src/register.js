'use strict';

let index = 0;
module.exports = function() {
    index++;
    return {
        t: 'VREG',
        v: 'r'+index,
        ssa: 'r'+index
    };
};