"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const fs_1 = require("fs");
const events_1 = require("events");
class Header {
    constructor(filename) {
        this.parse = (callback) => {
            return fs_1.readFile(this.filename, (err, buffer) => {
                if (err)
                    return callback(err);
                let i;
                this.type = (buffer.slice(0, 1)).toString('utf-8');
                this.dateUpdated = this.parseDate(buffer.slice(1, 4));
                this.numberOfRecords = buffer.readUInt32LE(4);
                this.start = buffer.readUInt16LE(8);
                this.recordLength = buffer.readUInt16LE(10);
                this.columns = ((function () {
                    var _i, _ref, _results;
                    _results = [];
                    for (i = _i = 32, _ref = this.start - 32; _i <= _ref; i = _i += 32) {
                        _results.push(buffer.slice(i, i + 32));
                    }
                    return _results;
                }).call(this)).map(this.parseFieldSubRecord);
                return callback(err);
            });
        };
        this.parseDate = (buffer) => {
            var day, month, year;
            year = 2000 + buffer.readUIntLE(0, 1);
            month = buffer.readUIntLE(1, 1) - 1;
            day = buffer.readUIntLE(2, 1);
            return new Date(year, month, day);
        };
        this.parseFieldSubRecord = (buffer) => {
            return {
                name: ((buffer.slice(0, 11)).toString('utf-8')).replace(/[\u0000]+$/, ''),
                type: (buffer.slice(11, 12)).toString('utf-8'),
                displacement: this.binToInt(buffer.slice(12, 16)),
                length: this.binToInt(buffer.slice(16, 17)),
                decimalPlaces: this.binToInt(buffer.slice(17, 18))
            };
        };
        this.binToInt = (buffer) => {
            return buffer.readUIntBE(0, buffer.length);
        };
        this.filename = filename;
        this.parseFieldSubRecord = this.parseFieldSubRecord.bind(this);
        this.parseDate = this.parseDate.bind(this);
    }
}
class Parser extends events_1.EventEmitter {
    constructor(filename) {
        super();
        this.parse = () => {
            this.emit('start', this);
            this.header = new Header(this.filename);
            this.header.parse((err) => {
                if (err)
                    throw err;
                let sequenceNumber;
                this.emit('header', this.header);
                sequenceNumber = 0;
                return fs_1.readFile(this.filename, (err, buffer) => {
                    if (err)
                        throw err;
                    let loc;
                    loc = this.header.start;
                    while (loc < (this.header.start + this.header.numberOfRecords * this.header.recordLength) && loc < buffer.length) {
                        this.emit('record', this.parseRecord(++sequenceNumber, buffer.slice(loc, loc += this.header.recordLength)));
                    }
                    this.emit('end');
                    return this;
                });
            });
            return this;
        };
        this.parseRecord = (sequenceNumber, buffer) => {
            let record = {
                '@sequenceNumber': sequenceNumber,
                '@deleted': (buffer.slice(0, 1))[0] !== 32,
            };
            let loc = 1;
            for (let i = 0; i < this.header.columns.length; i++) {
                record[this.header.columns[i].name] = this.parseField(this.header.columns[i], buffer.slice(loc, loc += this.header.columns[i].length));
            }
            return record;
        };
        this.parseField = (type, buffer) => {
            let value = buffer.toString('utf-8').replace(/^\x20+|\x20+$/g, '');
            if (type === 'I') {
                value = buffer.readUIntLE(0, buffer.byteLength);
            }
            if (type === 'N') {
                value = Number(value);
            }
            return {
                type: type,
                value: value
            };
        };
        this.filename = filename;
    }
}
exports.Parser = Parser;
