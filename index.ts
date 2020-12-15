import { readFile } from 'fs';
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
    [key: string]: Field | number | boolean
}

interface Field {
    type: string
    value: string | number
}

class Header {
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

    public parse = (callback: (self: Header) => any) => {
        return readFile(this.filename, (err, buffer) => {
            if (err) throw err;
            let i;

            this.type = (buffer.slice(0, 1)).toString('utf-8');
            this.dateUpdated = this.parseDate(buffer.slice(1, 4));
            this.numberOfRecords = buffer.readUInt32LE(4);
            this.start = buffer.readUInt16LE(8);
            this.recordLength = buffer.readUInt16LE(10);

            this.columns = ((function() {
                var _i, _ref, _results;
                _results = [];
                for (i = _i = 32, _ref = this.start - 32; _i <= _ref; i = _i += 32) {
                    _results.push(buffer.slice(i, i + 32));
                }
                return _results;
            }).call(this)).map(this.parseFieldSubRecord);

            return callback(this);
        });
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

    public parse = (): Parser => {
        this.emit('start', this);
        this.header = new Header(this.filename);
        this.header.parse((err) => {
            if (err) throw err;

            let sequenceNumber: number;
            this.emit('header', this.header);
            sequenceNumber = 0;
            return readFile(this.filename, (err, buffer) => {
                if (err) throw err;

                let loc;
                loc = this.header.start;
                while (loc < (this.header.start + this.header.numberOfRecords * this.header.recordLength) && loc < buffer.length) {
                    this.emit('record', this.parseRecord(++sequenceNumber, buffer.slice(loc, loc += this.header.recordLength)));
                }
                this.emit('end', self)
                return this;
            });
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
            record[this.header.columns[i].name] = this.parseField(this.header.columns[i], buffer.slice(loc, loc += this.header.columns[i].length));
        }

        return record;
    };

    private parseField = (type: string, buffer: Buffer): Field => {
        let value: string | number = buffer.toString('utf-8').replace(/^\x20+|\x20+$/g, '');
    
        if (type === 'I') {
            value = buffer.readUIntLE(0, buffer.byteLength)
        }
    
        if (type === 'N') {
            value = Number(value);
        }

        return {
            type: type,
            value: value
        };
    };
}