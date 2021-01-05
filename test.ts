import { Parser } from './index';

const parser = new Parser('test.dbf');

parser.on('start', (p) => {
    console.log('Started parsing file');
    console.log(p);
});

parser.on('header', (h) => {
    console.log('Parsed header');
    console.log(h);
});

parser.on('record', (r) => {
    console.log(r);
});

parser.on('end', () => {
    console.log('Finished parsing file');
});

parser.parseHeader();
setTimeout(async () => console.log(await parser.parseLine(1)), 5e3);
setTimeout(() => parser.parse(), 10e3);