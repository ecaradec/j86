-   TODO

*   [x] support of return values
*   [x] support of parameters in calls
*   [x] support of function call (push on stack)
*   [x] spill variable handling (variable not replaced by registers are spill variable possibly ) ?
*   [x] recycle spill variable
*   [x] allows referencing a parameter
*   [x] save and restore registers in callee
*   [x] allocate space on stack for local variables
*   [x] support of string
*   [x] support of printing
*   [x] support of global variables ?
*   [x] output to NASM format ?
*   [x] replace load and store by marking variables on SSA on first use (and only use store explicitly)
*   [/] support of types (int and int*)
*   [ ] use a keyword for declaring value instead of just initializing it ?
*   [ ] let functions returns values by pointer or in eax depending of size
*   [ ] support of structures
*   [x] replace store->load by replacement of the register
*   [x] replace load->load by replacement of the register
*   [ ] Handle larger types like int64 by adding a way to address partial variable in IR ?
    // convert larger types to registers logic ?
    r1 = 1
    r3 = add r2, 1
    a[0] = r3 // syntax for variable offset in bytes
    r1 = 1
    r3 = adc r2, 1
    a[4] = r3 // done
    OR
    r1 = 1
    r3 = add r2, 1

