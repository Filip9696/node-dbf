var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
System.register("index", ["fs", "events"], function (exports_1, context_1) {
    "use strict";
    var fs_1, events_1, Header, Parser;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (fs_1_1) {
                fs_1 = fs_1_1;
            },
            function (events_1_1) {
                events_1 = events_1_1;
            }
        ],
        execute: function () {
            Header = /** @class */ (function () {
                function Header(filename) {
                    var _this = this;
                    this.parse = function (callback) {
                        return fs_1.readFile(_this.filename, function (err, buffer) {
                            if (err)
                                throw err;
                            var i;
                            _this.type = (buffer.slice(0, 1)).toString('utf-8');
                            _this.dateUpdated = _this.parseDate(buffer.slice(1, 4));
                            _this.numberOfRecords = buffer.readUInt32LE(4);
                            _this.start = buffer.readUInt16LE(8);
                            _this.recordLength = buffer.readUInt16LE(10);
                            _this.columns = ((function () {
                                var _i, _ref, _results;
                                _results = [];
                                for (i = _i = 32, _ref = this.start - 32; _i <= _ref; i = _i += 32) {
                                    _results.push(buffer.slice(i, i + 32));
                                }
                                return _results;
                            }).call(_this)).map(_this.parseFieldSubRecord);
                            return callback(_this);
                        });
                    };
                    this.parseDate = function (buffer) {
                        var day, month, year;
                        year = 2000 + buffer.readUIntLE(0, 1);
                        month = buffer.readUIntLE(1, 1) - 1;
                        day = buffer.readUIntLE(2, 1);
                        return new Date(year, month, day);
                    };
                    this.parseFieldSubRecord = function (buffer) {
                        return {
                            name: ((buffer.slice(0, 11)).toString('utf-8')).replace(/[\u0000]+$/, ''),
                            type: (buffer.slice(11, 12)).toString('utf-8'),
                            displacement: _this.binToInt(buffer.slice(12, 16)),
                            length: _this.binToInt(buffer.slice(16, 17)),
                            decimalPlaces: _this.binToInt(buffer.slice(17, 18))
                        };
                    };
                    this.binToInt = function (buffer) {
                        return buffer.readUIntBE(0, buffer.length);
                    };
                    this.filename = filename;
                    this.parseFieldSubRecord = this.parseFieldSubRecord.bind(this);
                    this.parseDate = this.parseDate.bind(this);
                }
                return Header;
            }());
            Parser = /** @class */ (function (_super) {
                __extends(Parser, _super);
                function Parser(filename) {
                    var _this = _super.call(this) || this;
                    _this.parse = function () {
                        _this.emit('start', _this);
                        _this.header = new Header(_this.filename);
                        _this.header.parse(function (err) {
                            if (err)
                                throw err;
                            var sequenceNumber;
                            _this.emit('header', _this.header);
                            sequenceNumber = 0;
                            return fs_1.readFile(_this.filename, function (err, buffer) {
                                if (err)
                                    throw err;
                                var loc;
                                loc = _this.header.start;
                                while (loc < (_this.header.start + _this.header.numberOfRecords * _this.header.recordLength) && loc < buffer.length) {
                                    _this.emit('record', _this.parseRecord(++sequenceNumber, buffer.slice(loc, loc += _this.header.recordLength)));
                                }
                                _this.emit('end', self);
                                return _this;
                            });
                        });
                        return _this;
                    };
                    _this.parseRecord = function (sequenceNumber, buffer) {
                        var record = {
                            '@sequenceNumber': sequenceNumber,
                            '@deleted': (buffer.slice(0, 1))[0] !== 32
                        };
                        var loc = 1;
                        for (var i = 0; i < _this.header.columns.length; i++) {
                            record[_this.header.columns[i].name] = _this.parseField(_this.header.columns[i], buffer.slice(loc, loc += _this.header.columns[i].length));
                        }
                        return record;
                    };
                    _this.parseField = function (type, buffer) {
                        var value = buffer.toString('utf-8').replace(/^\x20+|\x20+$/g, '');
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
                    _this.filename = filename;
                    return _this;
                }
                return Parser;
            }(events_1.EventEmitter));
            exports_1("Parser", Parser);
        }
    };
});
