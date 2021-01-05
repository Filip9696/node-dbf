import { readFile, openSync, readSync, closeSync } from 'fs';
import { EventEmitter } from 'events';

interface Column {
    name: string
    type: string
    displacement: number
    length: number
    decimalPlaces: number
}

interface Record {
    '@sequenceNumber': number
    '@deleted': boolean
    [key: string]: string | number | boolean | Date
}

const partialFSReadSync = (path: string, start: number, end: number): Buffer => {
    if (start < 0 || end < 0 || end < start || end - start > 0x3fffffff)
        throw new Error('bad start, end');
    if (end - start === 0)
        return Buffer.alloc(0);

    var buf = Buffer.alloc(end - start);
    var fd = openSync(path, 'r');
    readSync(fd, buf, 0, end - start, start);
    closeSync(fd);
    return buf;
}

export class Header {
    public filename: string;
    public type: undefined | string;
    public dateUpdated: undefined | Date;
    public numberOfRecords: undefined | number;
    public start: undefined | number;
    public recordLength: undefined | number;
    public columns: any;

    constructor(filename: string) {
        this.filename = filename;
        this.parseFieldSubRecord = this.parseFieldSubRecord.bind(this);
        this.parseDate = this.parseDate.bind(this);
    }

    public parse = (callback: (err: Error | boolean) => any) => {
        try {
            let buffer = partialFSReadSync(this.filename, 0, 32);
            let i;

            this.type = (buffer.slice(0, 1)).toString('utf-8');
            this.dateUpdated = this.parseDate(buffer.slice(1, 4));
            this.numberOfRecords = buffer.readUInt32LE(4);
            this.start = buffer.readUInt16LE(8);
            this.recordLength = buffer.readUInt16LE(10);

            buffer = partialFSReadSync(this.filename, 0, this.start);
            this.columns = ((function () {
                let _i, _ref, _results;
                _results = [];
                for (i = _i = 32, _ref = this.start - 32; _i <= _ref; i = _i += 32) {
                    _results.push(buffer.slice(i, i + 32));
                }
                return _results;
            }).call(this)).map(this.parseFieldSubRecord);

            return callback(false);
        } catch (err) {
            return callback(err);
        }
    };

    private parseDate = (buffer: Buffer): Date => {
        var day, month, year;
        year = 2000 + buffer.readUIntLE(0, 1)
        month = buffer.readUIntLE(1, 1) - 1;
        day = buffer.readUIntLE(2, 1);
        return new Date(year, month, day);
    };

    private parseFieldSubRecord = (buffer: Buffer): Column => {
        return {
            name: ((buffer.slice(0, 11)).toString('utf-8')).replace(/[\u0000]+$/, ''),
            type: (buffer.slice(11, 12)).toString('utf-8'),
            displacement: this.binToInt(buffer.slice(12, 16)),
            length: this.binToInt(buffer.slice(16, 17)),
            decimalPlaces: this.binToInt(buffer.slice(17, 18))
        };
    };

    private binToInt = (buffer: Buffer): number => {
        return buffer.readUIntBE(0, buffer.length);
    };
}

export class Parser extends EventEmitter {
    public filename: string;
    public header: Header;

    constructor(filename: string) {
        super();
        this.filename = filename;
    }

    public parseLine = async (lineNum: number): Promise<Record> => {
        let loc = this.header.start + (this.header.recordLength * (lineNum-1));
        let buffer = await partialFSReadSync(this.filename, loc, loc + this.header.recordLength);
        return this.parseRecord(lineNum, buffer);
    }

    public parseHeader = (): Promise<Header> => {
        return new Promise((resolve, reject) => {
            this.emit('start', this);
            this.header = new Header(this.filename);
            this.header.parse((err) => {
                if (err) return reject(err);
                this.emit('header', this.header);
                resolve(this.header);
            });
        });
    }

    public parse = async (): Promise<Parser> => {
        if (!this.header) await this.parseHeader();
        let sequenceNumber: number;
        sequenceNumber = 0;
        readFile(this.filename, (err, buffer) => {
            if (err) throw err;

            let loc;
            loc = this.header.start;
            while (loc < (this.header.start + this.header.numberOfRecords * this.header.recordLength) && loc < buffer.length) {
                this.emit('record', this.parseRecord(++sequenceNumber, buffer.slice(loc, loc += this.header.recordLength)));
            }
            this.emit('end');
            return this;
        });
        return this;
    };

    private parseRecord = (sequenceNumber: number, buffer: Buffer): Record => {
        let record: Record = {
            '@sequenceNumber': sequenceNumber,
            '@deleted': (buffer.slice(0, 1))[0] !== 32,
        }

        let loc = 1;

        for (let i = 0; i < this.header.columns.length; i++) {
            record[this.header.columns[i].name] = this.parseField(this.header.columns[i].type, buffer.slice(loc, loc += this.header.columns[i].length));
        }

        return record;
    };

    private parseField = (type: string, buffer: Buffer): string | number | boolean | Date => {
        switch (type) {
            case 'I':
                return buffer.readUIntLE(0, buffer.byteLength);
            case 'N':
                return Number(buffer.toString('utf-8').replace(/^\x20+|\x20+$/g, ''));
            case 'M':
                return buffer.toString('hex');
            case 'D':
                let string = buffer.toString('utf-8').replace(/^\x20+|\x20+$/g, '');
                string = string.substr(0, 4) + '-' + string.substr(4, 2) + '-' + string.substr(6);
                return new Date(string);
            case 'T':
                return new Date(buffer.toString('utf-8').replace(/^\x20+|\x20+$/g, ''));
            default:
                return buffer.toString('utf-8').replace(/^\x20+|\x20+$/g, '');
        }
    };
}