/// <reference types="node" />
declare module "index" {
    import { EventEmitter } from 'events';
    class Header {
        filename: string;
        type: undefined | string;
        dateUpdated: undefined | Date;
        numberOfRecords: undefined | number;
        start: undefined | number;
        recordLength: undefined | number;
        columns: any;
        constructor(filename: string);
        parse: (callback: (self: Header) => any) => void;
        private parseDate;
        private parseFieldSubRecord;
        private binToInt;
    }
    export class Parser extends EventEmitter {
        filename: string;
        header: Header;
        constructor(filename: string);
        parse: () => Parser;
        private parseRecord;
        private parseField;
    }
}
