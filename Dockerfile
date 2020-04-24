# nasm -f elf file.asm -o file.o && gcc -m32 -static -Os -nostartfiles -fno-asynchronous-unwind-tables -o file file.o
FROM node
RUN apt-get update && apt-get install -y build-essential nasm libc6-dev-i386
#RUN apt-get install -y nodejs

