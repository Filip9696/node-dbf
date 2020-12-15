/// <reference types="node" />
import { EventEmitter } from 'events';
declare class Header {
    filename: string;
    type: undefined | string;
    dateUpdated: undefined | Date;
    numberOfRecords: undefined | number;
    start: undefined | number;
    recordLength: undefined | number;
    columns: any;
    constructor(filename: string);
    parse: (callback: (err: Error) => any) => void;
    private parseDate;
    private parseFieldSubRecord;
    private binToInt;
}
export declare class Parser extends EventEmitter {
    filename: string;
    header: Header;
    constructor(filename: string);
    parse: () => Parser;
    private parseRecord;
    private parseField;
}
export {};
