'use strict';

let index = 0;
module.exports = function() {
    index++;
    return 'r'+index;
};