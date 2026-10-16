import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../genex-local-models/node_modules/pend/index.js
var require_pend = __commonJS({
  "../genex-local-models/node_modules/pend/index.js"(exports, module) {
    module.exports = Pend;
    function Pend() {
      this.pending = 0;
      this.max = Infinity;
      this.listeners = [];
      this.waiting = [];
      this.error = null;
    }
    Pend.prototype.go = function(fn) {
      if (this.pending < this.max) {
        pendGo(this, fn);
      } else {
        this.waiting.push(fn);
      }
    };
    Pend.prototype.wait = function(cb) {
      if (this.pending === 0) {
        cb(this.error);
      } else {
        this.listeners.push(cb);
      }
    };
    Pend.prototype.hold = function() {
      return pendHold(this);
    };
    function pendHold(self) {
      self.pending += 1;
      var called = false;
      return onCb;
      function onCb(err) {
        if (called) throw new Error("callback called twice");
        called = true;
        self.error = self.error || err;
        self.pending -= 1;
        if (self.waiting.length > 0 && self.pending < self.max) {
          pendGo(self, self.waiting.shift());
        } else if (self.pending === 0) {
          var listeners = self.listeners;
          self.listeners = [];
          listeners.forEach(cbListener);
        }
      }
      function cbListener(listener) {
        listener(self.error);
      }
    }
    function pendGo(self, fn) {
      fn(pendHold(self));
    }
  }
});

// ../genex-local-models/node_modules/yauzl/fd-slicer.js
var require_fd_slicer = __commonJS({
  "../genex-local-models/node_modules/yauzl/fd-slicer.js"(exports) {
    var fs = __require("fs");
    var util = __require("util");
    var stream = __require("stream");
    var Readable = stream.Readable;
    var PassThrough = stream.PassThrough;
    var Pend = require_pend();
    var EventEmitter = __require("events").EventEmitter;
    exports.BufferSlicer = BufferSlicer;
    exports.FdSlicer = FdSlicer;
    util.inherits(FdSlicer, EventEmitter);
    function FdSlicer(fd) {
      EventEmitter.call(this);
      this.fd = fd;
      this.pend = new Pend();
      this.pend.max = 1;
      this.refCount = 0;
    }
    FdSlicer.prototype.read = function(buffer, offset, length, position, callback) {
      var self = this;
      self.pend.go(function(cb) {
        fs.read(self.fd, buffer, offset, length, position, function(err, bytesRead, buffer2) {
          cb();
          callback(err, bytesRead, buffer2);
        });
      });
    };
    FdSlicer.prototype.createReadStream = function(options2) {
      return new ReadStream(this, options2);
    };
    FdSlicer.prototype.ref = function() {
      this.refCount += 1;
    };
    FdSlicer.prototype.unref = function() {
      var self = this;
      self.refCount -= 1;
      if (self.refCount < 0) throw new Error("invalid unref");
      if (self.refCount > 0) return;
      fs.close(self.fd, onCloseDone);
      function onCloseDone(err) {
        if (err) {
          self.emit("error", err);
        } else {
          self.emit("close");
        }
      }
    };
    util.inherits(ReadStream, Readable);
    function ReadStream(context, options2) {
      options2 = options2 || {};
      Readable.call(this, options2);
      this.context = context;
      this.context.ref();
      this.start = options2.start || 0;
      this.endOffset = options2.end;
      this.pos = this.start;
    }
    ReadStream.prototype._read = function(n) {
      var self = this;
      var toRead = Math.min(self._readableState.highWaterMark, n);
      if (self.endOffset != null) {
        toRead = Math.min(toRead, self.endOffset - self.pos);
      }
      if (toRead <= 0) {
        self.push(null);
        this._cleanup();
        return;
      }
      self.context.pend.go(function(cb) {
        var buffer = Buffer.allocUnsafe(toRead);
        fs.read(self.context.fd, buffer, 0, toRead, self.pos, function(err, bytesRead) {
          if (err) {
            self.destroy(err);
          } else if (bytesRead === 0) {
            self.push(null);
            self._cleanup();
          } else {
            self.pos += bytesRead;
            self.push(buffer.slice(0, bytesRead));
          }
          cb();
        });
      });
    };
    ReadStream.prototype._destroy = function(err, cb) {
      this._cleanup();
      cb(err);
    };
    ReadStream.prototype._cleanup = function() {
      if (this.context != null) {
        this.context.unref();
        this.context = null;
      }
    };
    util.inherits(BufferSlicer, EventEmitter);
    function BufferSlicer(buffer) {
      EventEmitter.call(this);
      this.refCount = 0;
      this.buffer = buffer;
    }
    BufferSlicer.prototype.read = function(buffer, offset, length, position, callback) {
      if (!(0 <= offset && offset <= buffer.length)) throw new RangeError("offset outside buffer: 0 <= " + offset + " <= " + buffer.length);
      if (position < 0) throw new RangeError("position is negative: " + position);
      if (offset + length > buffer.length) {
        length = buffer.length - offset;
      }
      if (position + length > this.buffer.length) {
        length = this.buffer.length - position;
      }
      if (length <= 0) {
        setImmediate(function() {
          callback(null, 0);
        });
        return;
      }
      this.buffer.copy(buffer, offset, position, position + length);
      setImmediate(function() {
        callback(null, length);
      });
    };
    BufferSlicer.prototype.createReadStream = function(options2) {
      options2 = options2 || {};
      var readStream = new PassThrough(options2);
      readStream.start = options2.start || 0;
      readStream.endOffset = options2.end;
      readStream.pos = readStream.endOffset || this.buffer.length;
      var entireSlice = this.buffer.slice(readStream.start, readStream.pos);
      var maxChunkSize = 65536;
      var offset = 0;
      while (true) {
        var nextOffset = offset + maxChunkSize;
        if (nextOffset >= entireSlice.length) {
          if (offset < entireSlice.length) {
            readStream.write(entireSlice.slice(offset, entireSlice.length));
          }
          break;
        }
        readStream.write(entireSlice.slice(offset, nextOffset));
        offset = nextOffset;
      }
      readStream.end();
      return readStream;
    };
    BufferSlicer.prototype.ref = function() {
      this.refCount += 1;
    };
    BufferSlicer.prototype.unref = function() {
      this.refCount -= 1;
      if (this.refCount < 0) {
        throw new Error("invalid unref");
      }
    };
  }
});

// ../genex-local-models/node_modules/yauzl/crc32.js
var require_crc32 = __commonJS({
  "../genex-local-models/node_modules/yauzl/crc32.js"(exports, module) {
    var CRC_TABLE = new Int32Array([
      0,
      1996959894,
      3993919788,
      2567524794,
      124634137,
      1886057615,
      3915621685,
      2657392035,
      249268274,
      2044508324,
      3772115230,
      2547177864,
      162941995,
      2125561021,
      3887607047,
      2428444049,
      498536548,
      1789927666,
      4089016648,
      2227061214,
      450548861,
      1843258603,
      4107580753,
      2211677639,
      325883990,
      1684777152,
      4251122042,
      2321926636,
      335633487,
      1661365465,
      4195302755,
      2366115317,
      997073096,
      1281953886,
      3579855332,
      2724688242,
      1006888145,
      1258607687,
      3524101629,
      2768942443,
      901097722,
      1119000684,
      3686517206,
      2898065728,
      853044451,
      1172266101,
      3705015759,
      2882616665,
      651767980,
      1373503546,
      3369554304,
      3218104598,
      565507253,
      1454621731,
      3485111705,
      3099436303,
      671266974,
      1594198024,
      3322730930,
      2970347812,
      795835527,
      1483230225,
      3244367275,
      3060149565,
      1994146192,
      31158534,
      2563907772,
      4023717930,
      1907459465,
      112637215,
      2680153253,
      3904427059,
      2013776290,
      251722036,
      2517215374,
      3775830040,
      2137656763,
      141376813,
      2439277719,
      3865271297,
      1802195444,
      476864866,
      2238001368,
      4066508878,
      1812370925,
      453092731,
      2181625025,
      4111451223,
      1706088902,
      314042704,
      2344532202,
      4240017532,
      1658658271,
      366619977,
      2362670323,
      4224994405,
      1303535960,
      984961486,
      2747007092,
      3569037538,
      1256170817,
      1037604311,
      2765210733,
      3554079995,
      1131014506,
      879679996,
      2909243462,
      3663771856,
      1141124467,
      855842277,
      2852801631,
      3708648649,
      1342533948,
      654459306,
      3188396048,
      3373015174,
      1466479909,
      544179635,
      3110523913,
      3462522015,
      1591671054,
      702138776,
      2966460450,
      3352799412,
      1504918807,
      783551873,
      3082640443,
      3233442989,
      3988292384,
      2596254646,
      62317068,
      1957810842,
      3939845945,
      2647816111,
      81470997,
      1943803523,
      3814918930,
      2489596804,
      225274430,
      2053790376,
      3826175755,
      2466906013,
      167816743,
      2097651377,
      4027552580,
      2265490386,
      503444072,
      1762050814,
      4150417245,
      2154129355,
      426522225,
      1852507879,
      4275313526,
      2312317920,
      282753626,
      1742555852,
      4189708143,
      2394877945,
      397917763,
      1622183637,
      3604390888,
      2714866558,
      953729732,
      1340076626,
      3518719985,
      2797360999,
      1068828381,
      1219638859,
      3624741850,
      2936675148,
      906185462,
      1090812512,
      3747672003,
      2825379669,
      829329135,
      1181335161,
      3412177804,
      3160834842,
      628085408,
      1382605366,
      3423369109,
      3138078467,
      570562233,
      1426400815,
      3317316542,
      2998733608,
      733239954,
      1555261956,
      3268935591,
      3050360625,
      752459403,
      1541320221,
      2607071920,
      3965973030,
      1969922972,
      40735498,
      2617837225,
      3943577151,
      1913087877,
      83908371,
      2512341634,
      3803740692,
      2075208622,
      213261112,
      2463272603,
      3855990285,
      2094854071,
      198958881,
      2262029012,
      4057260610,
      1759359992,
      534414190,
      2176718541,
      4139329115,
      1873836001,
      414664567,
      2282248934,
      4279200368,
      1711684554,
      285281116,
      2405801727,
      4167216745,
      1634467795,
      376229701,
      2685067896,
      3608007406,
      1308918612,
      956543938,
      2808555105,
      3495958263,
      1231636301,
      1047427035,
      2932959818,
      3654703836,
      1088359270,
      936918e3,
      2847714899,
      3736837829,
      1202900863,
      817233897,
      3183342108,
      3401237130,
      1404277552,
      615818150,
      3134207493,
      3453421203,
      1423857449,
      601450431,
      3009837614,
      3294710456,
      1567103746,
      711928724,
      3020668471,
      3272380065,
      1510334235,
      755167117
    ]);
    function crc32(buf) {
      let crc = -1;
      for (let x of buf) {
        crc = CRC_TABLE[(crc ^ x) & 255] ^ crc >>> 8;
      }
      return (crc ^ -1) >>> 0;
    }
    module.exports = crc32;
  }
});

// ../genex-local-models/node_modules/yauzl/index.js
var require_yauzl = __commonJS({
  "../genex-local-models/node_modules/yauzl/index.js"(exports) {
    var fs = __require("fs");
    var zlib = __require("zlib");
    var fd_slicer = require_fd_slicer();
    var util = __require("util");
    var EventEmitter = __require("events").EventEmitter;
    var Transform = __require("stream").Transform;
    var PassThrough = __require("stream").PassThrough;
    var Writable = __require("stream").Writable;
    var crc32 = typeof zlib.crc32 === "function" ? zlib.crc32 : require_crc32();
    exports.open = open3;
    exports.fromFd = fromFd;
    exports.fromBuffer = fromBuffer;
    exports.fromRandomAccessReader = fromRandomAccessReader;
    exports.openPromise = openPromise;
    exports.fromFdPromise = fromFdPromise;
    exports.fromBufferPromise = fromBufferPromise;
    exports.fromRandomAccessReaderPromise = fromRandomAccessReaderPromise;
    exports.dosDateTimeToDate = dosDateTimeToDate;
    exports.getFileNameLowLevel = getFileNameLowLevel;
    exports.validateFileName = validateFileName;
    exports.parseExtraFields = parseExtraFields;
    exports.ZipFile = ZipFile;
    exports.Entry = Entry;
    exports.LocalFileHeader = LocalFileHeader;
    exports.RandomAccessReader = RandomAccessReader;
    function openPromise(path4, options2) {
      return new Promise((resolve, reject) => {
        open3(path4, { ...options2, lazyEntries: true }, function(err, zipfile) {
          if (err) return reject(err);
          resolve(zipfile);
        });
      });
    }
    function fromFdPromise(fd, options2) {
      return new Promise((resolve, reject) => {
        fromFd(fd, { ...options2, lazyEntries: true }, function(err, zipfile) {
          if (err) return reject(err);
          resolve(zipfile);
        });
      });
    }
    function fromBufferPromise(buffer, options2) {
      return new Promise((resolve, reject) => {
        fromBuffer(buffer, { ...options2, lazyEntries: true }, function(err, zipfile) {
          if (err) return reject(err);
          resolve(zipfile);
        });
      });
    }
    function fromRandomAccessReaderPromise(reader, totalSize, options2) {
      return new Promise((resolve, reject) => {
        fromRandomAccessReader(reader, totalSize, { ...options2, lazyEntries: true }, function(err, zipfile) {
          if (err) return reject(err);
          resolve(zipfile);
        });
      });
    }
    function open3(path4, options2, callback) {
      if (typeof options2 === "function") {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      if (options2.autoClose == null) options2.autoClose = true;
      if (options2.lazyEntries == null) options2.lazyEntries = false;
      if (options2.decodeStrings == null) options2.decodeStrings = true;
      if (options2.validateEntrySizes == null) options2.validateEntrySizes = true;
      if (options2.strictFileNames == null) options2.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      fs.open(path4, "r", function(err, fd) {
        if (err) return callback(err);
        fromFd(fd, options2, function(err2, zipfile) {
          if (err2) fs.close(fd, defaultCallback);
          callback(err2, zipfile);
        });
      });
    }
    function fromFd(fd, options2, callback) {
      if (typeof options2 === "function") {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      if (options2.autoClose == null) options2.autoClose = false;
      if (options2.lazyEntries == null) options2.lazyEntries = false;
      if (options2.decodeStrings == null) options2.decodeStrings = true;
      if (options2.validateEntrySizes == null) options2.validateEntrySizes = true;
      if (options2.strictFileNames == null) options2.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      fs.fstat(fd, function(err, stats) {
        if (err) return callback(err);
        var reader = new fd_slicer.FdSlicer(fd);
        fromRandomAccessReader(reader, stats.size, options2, callback);
      });
    }
    function fromBuffer(buffer, options2, callback) {
      if (typeof options2 === "function") {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      options2.autoClose = false;
      if (options2.lazyEntries == null) options2.lazyEntries = false;
      if (options2.decodeStrings == null) options2.decodeStrings = true;
      if (options2.validateEntrySizes == null) options2.validateEntrySizes = true;
      if (options2.strictFileNames == null) options2.strictFileNames = false;
      var reader = new fd_slicer.BufferSlicer(buffer);
      fromRandomAccessReader(reader, buffer.length, options2, callback);
    }
    function fromRandomAccessReader(reader, totalSize, options2, callback) {
      if (typeof options2 === "function") {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      if (options2.autoClose == null) options2.autoClose = true;
      if (options2.lazyEntries == null) options2.lazyEntries = false;
      if (options2.decodeStrings == null) options2.decodeStrings = true;
      var decodeStrings = !!options2.decodeStrings;
      if (options2.validateEntrySizes == null) options2.validateEntrySizes = true;
      if (options2.strictFileNames == null) options2.strictFileNames = false;
      if (callback == null) callback = defaultCallback;
      if (typeof totalSize !== "number") throw new Error("expected totalSize parameter to be a number");
      if (totalSize > Number.MAX_SAFE_INTEGER) {
        throw new Error("zip file too large. only file sizes up to 2^52 are supported due to JavaScript's Number type being an IEEE 754 double.");
      }
      reader.ref();
      var eocdrWithoutCommentSize = 22;
      var zip64EocdlSize = 20;
      var maxCommentSize = 65535;
      var bufferSize = Math.min(zip64EocdlSize + eocdrWithoutCommentSize + maxCommentSize, totalSize);
      var buffer = newBuffer(bufferSize);
      var bufferReadStart = totalSize - buffer.length;
      readAndAssertNoEof(reader, buffer, 0, bufferSize, bufferReadStart, function(err) {
        if (err) return callback(err);
        for (var i = bufferSize - eocdrWithoutCommentSize; i >= 0; i -= 1) {
          if (buffer.readUInt32LE(i) !== 101010256) continue;
          var eocdrBuffer = buffer.subarray(i);
          var diskNumber = eocdrBuffer.readUInt16LE(4);
          var entryCount = eocdrBuffer.readUInt16LE(10);
          var centralDirectoryOffset = eocdrBuffer.readUInt32LE(16);
          var commentLength = eocdrBuffer.readUInt16LE(20);
          var expectedCommentLength = eocdrBuffer.length - eocdrWithoutCommentSize;
          if (commentLength !== expectedCommentLength) {
            return callback(new Error("Invalid comment length. Expected: " + expectedCommentLength + ". Found: " + commentLength + ". Are there extra bytes at the end of the file? Or is the end of central dir signature `PK\u263A\u263B` in the comment?"));
          }
          var comment = decodeStrings ? decodeBuffer(eocdrBuffer.subarray(22), false) : eocdrBuffer.subarray(22);
          if (i - zip64EocdlSize >= 0 && buffer.readUInt32LE(i - zip64EocdlSize) === 117853008) {
            var zip64EocdlBuffer = buffer.subarray(i - zip64EocdlSize, i - zip64EocdlSize + zip64EocdlSize);
            var zip64EocdrOffset = readUInt64LE(zip64EocdlBuffer, 8);
            var zip64EocdrBuffer = newBuffer(56);
            return readAndAssertNoEof(reader, zip64EocdrBuffer, 0, zip64EocdrBuffer.length, zip64EocdrOffset, function(err2) {
              if (err2) return callback(err2);
              if (zip64EocdrBuffer.readUInt32LE(0) !== 101075792) {
                return callback(new Error("invalid zip64 end of central directory record signature"));
              }
              diskNumber = zip64EocdrBuffer.readUInt32LE(16);
              if (diskNumber !== 0) {
                return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
              }
              entryCount = readUInt64LE(zip64EocdrBuffer, 32);
              centralDirectoryOffset = readUInt64LE(zip64EocdrBuffer, 48);
              return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options2.autoClose, options2.lazyEntries, decodeStrings, options2.validateEntrySizes, options2.strictFileNames));
            });
          }
          if (diskNumber !== 0) {
            return callback(new Error("multi-disk zip files are not supported: found disk number: " + diskNumber));
          }
          return callback(null, new ZipFile(reader, centralDirectoryOffset, totalSize, entryCount, comment, options2.autoClose, options2.lazyEntries, decodeStrings, options2.validateEntrySizes, options2.strictFileNames));
        }
        callback(new Error("End of central directory record signature not found. Either not a zip file, or file is truncated."));
      });
    }
    util.inherits(ZipFile, EventEmitter);
    function ZipFile(reader, centralDirectoryOffset, fileSize, entryCount, comment, autoClose, lazyEntries, decodeStrings, validateEntrySizes, strictFileNames) {
      var self = this;
      EventEmitter.call(self);
      self.reader = reader;
      self.reader.on("error", function(err) {
        emitError(self, err);
      });
      self.reader.once("close", function() {
        self.emit("close");
      });
      self.readEntryCursor = centralDirectoryOffset;
      self.fileSize = fileSize;
      self.entryCount = entryCount;
      self.comment = comment;
      self.entriesRead = 0;
      self.autoClose = !!autoClose;
      self.lazyEntries = !!lazyEntries;
      self.decodeStrings = !!decodeStrings;
      self.validateEntrySizes = !!validateEntrySizes;
      self.strictFileNames = !!strictFileNames;
      self.isOpen = true;
      self.emittedError = false;
      self.hasEachEntryBeenCalled = false;
      if (!self.lazyEntries) self._readEntry();
    }
    ZipFile.prototype.close = function() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this.reader.unref();
    };
    function emitErrorAndAutoClose(self, err) {
      if (self.autoClose) self.close();
      emitError(self, err);
    }
    function emitError(self, err) {
      if (self.emittedError) return;
      self.emittedError = true;
      self.emit("error", err);
    }
    ZipFile.prototype.readEntry = function() {
      if (!this.lazyEntries) throw new Error("readEntry() called without lazyEntries:true");
      this._readEntry();
    };
    ZipFile.prototype._readEntry = function() {
      var self = this;
      if (self.entryCount === self.entriesRead) {
        setImmediate(function() {
          if (self.autoClose) self.close();
          if (self.emittedError) return;
          self.emit("end");
        });
        return;
      }
      if (self.emittedError) return;
      var buffer = newBuffer(46);
      readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err) {
        if (err) return emitErrorAndAutoClose(self, err);
        if (self.emittedError) return;
        var entry = new Entry();
        var signature = buffer.readUInt32LE(0);
        if (signature !== 33639248) return emitErrorAndAutoClose(self, new Error("invalid central directory file header signature: 0x" + signature.toString(16)));
        entry.versionMadeBy = buffer.readUInt16LE(4);
        entry.versionNeededToExtract = buffer.readUInt16LE(6);
        entry.generalPurposeBitFlag = buffer.readUInt16LE(8);
        entry.compressionMethod = buffer.readUInt16LE(10);
        entry.lastModFileTime = buffer.readUInt16LE(12);
        entry.lastModFileDate = buffer.readUInt16LE(14);
        entry.crc32 = buffer.readUInt32LE(16);
        entry.compressedSize = buffer.readUInt32LE(20);
        entry.uncompressedSize = buffer.readUInt32LE(24);
        entry.fileNameLength = buffer.readUInt16LE(28);
        entry.extraFieldLength = buffer.readUInt16LE(30);
        entry.fileCommentLength = buffer.readUInt16LE(32);
        entry.internalFileAttributes = buffer.readUInt16LE(36);
        entry.externalFileAttributes = buffer.readUInt32LE(38);
        entry.relativeOffsetOfLocalHeader = buffer.readUInt32LE(42);
        if (entry.generalPurposeBitFlag & 64) return emitErrorAndAutoClose(self, new Error("strong encryption is not supported"));
        self.readEntryCursor += 46;
        buffer = newBuffer(entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength);
        readAndAssertNoEof(self.reader, buffer, 0, buffer.length, self.readEntryCursor, function(err2) {
          if (err2) return emitErrorAndAutoClose(self, err2);
          if (self.emittedError) return;
          entry.fileNameRaw = buffer.subarray(0, entry.fileNameLength);
          var fileCommentStart = entry.fileNameLength + entry.extraFieldLength;
          entry.extraFieldRaw = buffer.subarray(entry.fileNameLength, fileCommentStart);
          entry.fileCommentRaw = buffer.subarray(fileCommentStart, fileCommentStart + entry.fileCommentLength);
          try {
            entry.extraFields = parseExtraFields(entry.extraFieldRaw);
          } catch (err3) {
            return emitErrorAndAutoClose(self, err3);
          }
          if (self.decodeStrings) {
            var isUtf8 = (entry.generalPurposeBitFlag & 2048) !== 0;
            entry.fileComment = decodeBuffer(entry.fileCommentRaw, isUtf8);
            entry.fileName = getFileNameLowLevel(entry.generalPurposeBitFlag, entry.fileNameRaw, entry.extraFields, self.strictFileNames);
            var errorMessage = validateFileName(entry.fileName);
            if (errorMessage != null) return emitErrorAndAutoClose(self, new Error(errorMessage));
          } else {
            entry.fileComment = entry.fileCommentRaw;
            entry.fileName = entry.fileNameRaw;
          }
          entry.comment = entry.fileComment;
          self.readEntryCursor += buffer.length;
          self.entriesRead += 1;
          for (var i = 0; i < entry.extraFields.length; i++) {
            var extraField = entry.extraFields[i];
            if (extraField.id !== 1) continue;
            var zip64EiefBuffer = extraField.data;
            var index = 0;
            if (entry.uncompressedSize === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include uncompressed size"));
              }
              entry.uncompressedSize = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
            if (entry.compressedSize === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include compressed size"));
              }
              entry.compressedSize = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
            if (entry.relativeOffsetOfLocalHeader === 4294967295) {
              if (index + 8 > zip64EiefBuffer.length) {
                return emitErrorAndAutoClose(self, new Error("zip64 extended information extra field does not include relative header offset"));
              }
              entry.relativeOffsetOfLocalHeader = readUInt64LE(zip64EiefBuffer, index);
              index += 8;
            }
            break;
          }
          if (self.validateEntrySizes && entry.compressionMethod === 0) {
            var expectedCompressedSize = entry.uncompressedSize;
            if (entry.isEncrypted()) {
              expectedCompressedSize += 12;
            }
            if (entry.compressedSize !== expectedCompressedSize) {
              var msg = "compressed/uncompressed size mismatch for stored file: " + entry.compressedSize + " != " + entry.uncompressedSize;
              return emitErrorAndAutoClose(self, new Error(msg));
            }
          }
          self.emit("entry", entry);
          if (!self.lazyEntries) self._readEntry();
        });
      });
    };
    ZipFile.prototype.eachEntry = function() {
      const self = this;
      if (!self.lazyEntries) throw new Error("eachEntry() requires lazyEntries: true");
      if (self.hasEachEntryBeenCalled) throw new Error("eachEntry() must only be called once per ZipFile");
      self.hasEachEntryBeenCalled = true;
      let pendingResolveReject = null;
      self.on("entry", onEntry);
      self.on("end", onEnd);
      self.on("error", onError);
      function cleanup() {
        self.removeListener("entry", onEntry);
        self.removeListener("end", onEnd);
        self.removeListener("error", onError);
        if (self.autoClose) self.close();
      }
      function onEntry(entry) {
        let { resolve } = pendingResolveReject;
        pendingResolveReject = null;
        resolve({ value: entry });
      }
      function onEnd() {
        let { resolve } = pendingResolveReject;
        pendingResolveReject = null;
        cleanup();
        resolve({ done: true });
      }
      function onError(err) {
        let { reject } = pendingResolveReject;
        pendingResolveReject = null;
        cleanup();
        reject(err);
      }
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        next() {
          const promise = new Promise((resolve, reject) => {
            if (pendingResolveReject != null) throw new Error("next() called before previous Promise was resolved.");
            pendingResolveReject = { resolve, reject };
          });
          self.readEntry();
          return promise;
        },
        return(value) {
          cleanup();
          return Promise.resolve({ done: true, value });
        },
        throw(value) {
          cleanup();
          return Promise.reject(value);
        }
      };
    };
    ZipFile.prototype.openReadStream = function(entry, options2, callback) {
      var self = this;
      var relativeStart = 0;
      var relativeEnd = entry.compressedSize;
      if (callback == null) {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) {
        options2 = {};
      } else {
        if (options2.decodeFileData === false) {
          if (options2.decrypt != null) {
            throw new Error("cannot use options.decrypt when options.decodeFileData === false");
          }
          if (options2.decompress != null) {
            throw new Error("cannot use options.decompress when options.decodeFileData === false");
          }
        } else {
          if (options2.decrypt != null) {
            if (!entry.isEncrypted()) {
              throw new Error("options.decrypt can only be specified for encrypted entries. See also option decodeFileData.");
            }
            if (options2.decrypt !== false) throw new Error("invalid options.decrypt value: " + options2.decrypt);
            if (entry.isCompressed()) {
              if (options2.decompress !== false) throw new Error("entry is encrypted and compressed, and options.decompress !== false. See also option decodeFileData.");
            }
          }
          if (options2.decompress != null) {
            if (!entry.isCompressed()) {
              throw new Error("options.decompress can only be specified for compressed entries. See also option decodeFileData.");
            }
            if (!(options2.decompress === false || options2.decompress === true)) {
              throw new Error("invalid options.decompress value: " + options2.decompress);
            }
            decompress = options2.decompress;
          }
        }
        if (options2.start != null) {
          relativeStart = options2.start;
          if (relativeStart < 0) throw new Error("options.start < 0");
          if (relativeStart > entry.compressedSize) throw new Error("options.start > entry.compressedSize");
        }
        if (options2.end != null) {
          relativeEnd = options2.end;
          if (relativeEnd < 0) throw new Error("options.end < 0");
          if (relativeEnd > entry.compressedSize) throw new Error("options.end > entry.compressedSize");
          if (relativeEnd < relativeStart) throw new Error("options.end < options.start");
        }
      }
      var rawMode = options2.decodeFileData === false || // Explicitly requested raw.
      (entry.compressionMethod === 0 || // Naturally without compression.
      entry.compressionMethod === 8 && options2.decompress === false) && (!entry.isEncrypted() || // Naturally without encryption.
      options2.decrypt === false);
      if (options2.start != null || options2.end != null) {
        if (!rawMode) throw new Error("start/end range require options.decodeFileData === false for non-trivial encoded entries.");
      }
      if (!self.isOpen) return callback(new Error("closed"));
      if (entry.isEncrypted() && !rawMode) {
        if (options2.decrypt !== false) return callback(new Error("entry is encrypted, and options.decodeFileData !== false"));
      }
      var decompress;
      if (rawMode) {
        decompress = false;
      } else if (entry.compressionMethod === 8) {
        decompress = options2.decodeFileData !== true;
      } else {
        return callback(new Error("unsupported compression method: " + entry.compressionMethod));
      }
      self.readLocalFileHeader(entry, { minimal: true }, function(err, localFileHeader) {
        if (err) return callback(err);
        self.openReadStreamLowLevel(
          localFileHeader.fileDataStart,
          entry.compressedSize,
          relativeStart,
          relativeEnd,
          decompress,
          entry.uncompressedSize,
          callback
        );
      });
    };
    ZipFile.prototype.openReadStreamLowLevel = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, callback) {
      var self = this;
      var fileDataEnd = fileDataStart + compressedSize;
      var readStream = self.reader.createReadStream({
        start: fileDataStart + relativeStart,
        end: fileDataStart + relativeEnd
      });
      var endpointStream = readStream;
      if (decompress) {
        var destroyed = false;
        var inflateFilter = zlib.createInflateRaw();
        readStream.on("error", function(err) {
          setImmediate(function() {
            if (!destroyed) inflateFilter.emit("error", err);
          });
        });
        readStream.pipe(inflateFilter);
        if (self.validateEntrySizes) {
          endpointStream = new AssertByteCountStream(uncompressedSize);
          inflateFilter.on("error", function(err) {
            setImmediate(function() {
              if (!destroyed) endpointStream.emit("error", err);
            });
          });
          inflateFilter.pipe(endpointStream);
        } else {
          endpointStream = inflateFilter;
        }
        installDestroyFn(endpointStream, function() {
          destroyed = true;
          if (inflateFilter !== endpointStream) inflateFilter.unpipe(endpointStream);
          readStream.unpipe(inflateFilter);
          readStream.destroy();
        });
      }
      callback(null, endpointStream);
    };
    ZipFile.prototype.readLocalFileHeader = function(entry, options2, callback) {
      var self = this;
      if (callback == null) {
        callback = options2;
        options2 = null;
      }
      if (options2 == null) options2 = {};
      self.reader.ref();
      var buffer = newBuffer(30);
      readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader, function(err) {
        try {
          if (err) return callback(err);
          var signature = buffer.readUInt32LE(0);
          if (signature !== 67324752) {
            return callback(new Error("invalid local file header signature: 0x" + signature.toString(16)));
          }
          var fileNameLength = buffer.readUInt16LE(26);
          var extraFieldLength = buffer.readUInt16LE(28);
          var fileDataStart = entry.relativeOffsetOfLocalHeader + 30 + fileNameLength + extraFieldLength;
          if (fileDataStart + entry.compressedSize > self.fileSize) {
            return callback(new Error("file data overflows file bounds: " + fileDataStart + " + " + entry.compressedSize + " > " + self.fileSize));
          }
          if (options2.minimal) {
            return callback(null, { fileDataStart });
          }
          var localFileHeader = new LocalFileHeader();
          localFileHeader.fileDataStart = fileDataStart;
          localFileHeader.versionNeededToExtract = buffer.readUInt16LE(4);
          localFileHeader.generalPurposeBitFlag = buffer.readUInt16LE(6);
          localFileHeader.compressionMethod = buffer.readUInt16LE(8);
          localFileHeader.lastModFileTime = buffer.readUInt16LE(10);
          localFileHeader.lastModFileDate = buffer.readUInt16LE(12);
          localFileHeader.crc32 = buffer.readUInt32LE(14);
          localFileHeader.compressedSize = buffer.readUInt32LE(18);
          localFileHeader.uncompressedSize = buffer.readUInt32LE(22);
          localFileHeader.fileNameLength = fileNameLength;
          localFileHeader.extraFieldLength = extraFieldLength;
          buffer = newBuffer(fileNameLength + extraFieldLength);
          self.reader.ref();
          readAndAssertNoEof(self.reader, buffer, 0, buffer.length, entry.relativeOffsetOfLocalHeader + 30, function(err2) {
            try {
              if (err2) return callback(err2);
              localFileHeader.fileName = buffer.subarray(0, fileNameLength);
              localFileHeader.extraField = buffer.subarray(fileNameLength);
              return callback(null, localFileHeader);
            } finally {
              self.reader.unref();
            }
          });
        } finally {
          self.reader.unref();
        }
      });
    };
    ZipFile.prototype.openReadStreamPromise = function(entry, options2) {
      return new Promise((resolve, reject) => {
        this.openReadStream(entry, options2, function(err, readStream) {
          if (err) return reject(err);
          resolve(readStream);
        });
      });
    };
    ZipFile.prototype.openReadStreamLowLevelPromise = function(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize) {
      return new Promise((resolve, reject) => {
        this.openReadStream(fileDataStart, compressedSize, relativeStart, relativeEnd, decompress, uncompressedSize, function(err, readStream) {
          if (err) return reject(err);
          resolve(readStream);
        });
      });
    };
    ZipFile.prototype.readLocalFileHeaderPromise = function(entry, options2) {
      return new Promise((resolve, reject) => {
        this.readLocalFileHeader(entry, options2, function(err, localFileHeader) {
          if (err) return reject(err);
          resolve(localFileHeader);
        });
      });
    };
    function Entry() {
    }
    Entry.prototype.getLastModDate = function(options2) {
      if (options2 == null) options2 = {};
      if (!options2.forceDosFormat) {
        for (var i = 0; i < this.extraFields.length; i++) {
          var extraField = this.extraFields[i];
          if (extraField.id === 21589) {
            var data = extraField.data;
            if (data.length < 5) continue;
            var flags = data[0];
            var HAS_MTIME = 1;
            if (!(flags & HAS_MTIME)) continue;
            var posixTimestamp = data.readInt32LE(1);
            return new Date(posixTimestamp * 1e3);
          } else if (extraField.id === 10) {
            var data = extraField.data;
            if (data.length !== 32) continue;
            if (data.readUInt16LE(4) !== 1) continue;
            if (data.readUInt16LE(6) !== 24) continue;
            var hundredNanoSecondsSince1601 = data.readUInt32LE(8) + 4294967296 * data.readInt32LE(12);
            var millisecondsSince1970 = hundredNanoSecondsSince1601 / 1e4 - 116444736e5;
            return new Date(millisecondsSince1970);
          }
        }
      }
      return dosDateTimeToDate(this.lastModFileDate, this.lastModFileTime, options2.timezone);
    };
    Entry.prototype.canDecodeFileData = function() {
      return !this.isEncrypted() && (this.compressionMethod === 0 || this.compressionMethod === 8);
    };
    Entry.prototype.isEncrypted = function() {
      return (this.generalPurposeBitFlag & 1) !== 0;
    };
    Entry.prototype.isCompressed = function() {
      return this.compressionMethod === 8;
    };
    function LocalFileHeader() {
    }
    function dosDateTimeToDate(date, time, timezone) {
      var day = date & 31;
      var month = (date >> 5 & 15) - 1;
      var year = (date >> 9 & 127) + 1980;
      var millisecond = 0;
      var second = (time & 31) * 2;
      var minute = time >> 5 & 63;
      var hour = time >> 11 & 31;
      if (timezone == null || timezone === "local") {
        return new Date(year, month, day, hour, minute, second, millisecond);
      } else if (timezone === "UTC") {
        return new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
      } else {
        throw new Error("unrecognized options.timezone: " + options.timezone);
      }
    }
    function getFileNameLowLevel(generalPurposeBitFlag, fileNameBuffer, extraFields, strictFileNames) {
      var fileName = null;
      for (var i = 0; i < extraFields.length; i++) {
        var extraField = extraFields[i];
        if (extraField.id === 28789) {
          if (extraField.data.length < 6) {
            continue;
          }
          if (extraField.data.readUInt8(0) !== 1) {
            continue;
          }
          var oldNameCrc32 = extraField.data.readUInt32LE(1);
          if (crc32(fileNameBuffer) !== oldNameCrc32) {
            continue;
          }
          fileName = decodeBuffer(extraField.data.subarray(5), true);
          break;
        }
      }
      if (fileName == null) {
        var isUtf8 = (generalPurposeBitFlag & 2048) !== 0;
        fileName = decodeBuffer(fileNameBuffer, isUtf8);
      }
      if (!strictFileNames) {
        fileName = fileName.replace(/\\/g, "/");
      }
      return fileName;
    }
    function validateFileName(fileName) {
      if (fileName.indexOf("\\") !== -1) {
        return "invalid characters in fileName: " + fileName;
      }
      if (/^[a-zA-Z]:/.test(fileName) || /^\//.test(fileName)) {
        return "absolute path: " + fileName;
      }
      if (fileName.split("/").indexOf("..") !== -1) {
        return "invalid relative path: " + fileName;
      }
      return null;
    }
    function parseExtraFields(extraFieldBuffer) {
      var extraFields = [];
      var i = 0;
      while (i < extraFieldBuffer.length - 3) {
        var headerId = extraFieldBuffer.readUInt16LE(i + 0);
        var dataSize = extraFieldBuffer.readUInt16LE(i + 2);
        var dataStart = i + 4;
        var dataEnd = dataStart + dataSize;
        if (dataEnd > extraFieldBuffer.length) throw new Error("extra field length exceeds extra field buffer size");
        var dataBuffer = extraFieldBuffer.subarray(dataStart, dataEnd);
        extraFields.push({
          id: headerId,
          data: dataBuffer
        });
        i = dataEnd;
      }
      return extraFields;
    }
    function readAndAssertNoEof(reader, buffer, offset, length, position, callback) {
      if (length === 0) {
        return setImmediate(function() {
          callback(null, newBuffer(0));
        });
      }
      reader.read(buffer, offset, length, position, function(err, bytesRead) {
        if (err) return callback(err);
        if (bytesRead < length) {
          return callback(new Error("unexpected EOF"));
        }
        callback();
      });
    }
    util.inherits(AssertByteCountStream, Transform);
    function AssertByteCountStream(byteCount) {
      Transform.call(this);
      this.actualByteCount = 0;
      this.expectedByteCount = byteCount;
    }
    AssertByteCountStream.prototype._transform = function(chunk, encoding, cb) {
      this.actualByteCount += chunk.length;
      if (this.actualByteCount > this.expectedByteCount) {
        var msg = "too many bytes in the stream. expected " + this.expectedByteCount + ". got at least " + this.actualByteCount;
        return cb(new Error(msg));
      }
      cb(null, chunk);
    };
    AssertByteCountStream.prototype._flush = function(cb) {
      if (this.actualByteCount < this.expectedByteCount) {
        var msg = "not enough bytes in the stream. expected " + this.expectedByteCount + ". got only " + this.actualByteCount;
        return cb(new Error(msg));
      }
      cb();
    };
    util.inherits(RandomAccessReader, EventEmitter);
    function RandomAccessReader() {
      EventEmitter.call(this);
      this.refCount = 0;
    }
    RandomAccessReader.prototype.ref = function() {
      this.refCount += 1;
    };
    RandomAccessReader.prototype.unref = function() {
      var self = this;
      self.refCount -= 1;
      if (self.refCount > 0) return;
      if (self.refCount < 0) throw new Error("invalid unref");
      self.close(onCloseDone);
      function onCloseDone(err) {
        if (err) return self.emit("error", err);
        self.emit("close");
      }
    };
    RandomAccessReader.prototype.createReadStream = function(options2) {
      if (options2 == null) options2 = {};
      var start = options2.start;
      var end = options2.end;
      if (start === end) {
        var emptyStream = new PassThrough();
        setImmediate(function() {
          emptyStream.end();
        });
        return emptyStream;
      }
      var stream = this._readStreamForRange(start, end);
      var destroyed = false;
      var refUnrefFilter = new RefUnrefFilter(this);
      stream.on("error", function(err) {
        setImmediate(function() {
          if (!destroyed) refUnrefFilter.emit("error", err);
        });
      });
      installDestroyFn(refUnrefFilter, function() {
        stream.unpipe(refUnrefFilter);
        refUnrefFilter.unref();
        stream.destroy();
      });
      var byteCounter = new AssertByteCountStream(end - start);
      refUnrefFilter.on("error", function(err) {
        setImmediate(function() {
          if (!destroyed) byteCounter.emit("error", err);
        });
      });
      installDestroyFn(byteCounter, function() {
        destroyed = true;
        refUnrefFilter.unpipe(byteCounter);
        refUnrefFilter.destroy();
      });
      return stream.pipe(refUnrefFilter).pipe(byteCounter);
    };
    RandomAccessReader.prototype._readStreamForRange = function(start, end) {
      throw new Error("not implemented");
    };
    RandomAccessReader.prototype.read = function(buffer, offset, length, position, callback) {
      var readStream = this.createReadStream({ start: position, end: position + length });
      var writeStream = new Writable();
      var written = 0;
      writeStream._write = function(chunk, encoding, cb) {
        chunk.copy(buffer, offset + written, 0, chunk.length);
        written += chunk.length;
        cb();
      };
      writeStream.on("finish", callback);
      readStream.on("error", function(error) {
        callback(error);
      });
      readStream.pipe(writeStream);
    };
    RandomAccessReader.prototype.close = function(callback) {
      setImmediate(callback);
    };
    util.inherits(RefUnrefFilter, PassThrough);
    function RefUnrefFilter(context) {
      PassThrough.call(this);
      this.context = context;
      this.context.ref();
      this.unreffedYet = false;
    }
    RefUnrefFilter.prototype._flush = function(cb) {
      this.unref();
      cb();
    };
    RefUnrefFilter.prototype.unref = function(cb) {
      if (this.unreffedYet) return;
      this.unreffedYet = true;
      this.context.unref();
    };
    var cp437 = "\0\u263A\u263B\u2665\u2666\u2663\u2660\u2022\u25D8\u25CB\u25D9\u2642\u2640\u266A\u266B\u263C\u25BA\u25C4\u2195\u203C\xB6\xA7\u25AC\u21A8\u2191\u2193\u2192\u2190\u221F\u2194\u25B2\u25BC !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u2302\xC7\xFC\xE9\xE2\xE4\xE0\xE5\xE7\xEA\xEB\xE8\xEF\xEE\xEC\xC4\xC5\xC9\xE6\xC6\xF4\xF6\xF2\xFB\xF9\xFF\xD6\xDC\xA2\xA3\xA5\u20A7\u0192\xE1\xED\xF3\xFA\xF1\xD1\xAA\xBA\xBF\u2310\xAC\xBD\xBC\xA1\xAB\xBB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\xDF\u0393\u03C0\u03A3\u03C3\xB5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\xB1\u2265\u2264\u2320\u2321\xF7\u2248\xB0\u2219\xB7\u221A\u207F\xB2\u25A0\xA0";
    function decodeBuffer(buffer, isUtf8) {
      if (isUtf8) {
        return buffer.toString("utf8");
      } else {
        var result = "";
        for (var i = 0; i < buffer.length; i++) {
          result += cp437[buffer[i]];
        }
        return result;
      }
    }
    function readUInt64LE(buffer, offset) {
      var lower32 = buffer.readUInt32LE(offset);
      var upper32 = buffer.readUInt32LE(offset + 4);
      return upper32 * 4294967296 + lower32;
    }
    var newBuffer;
    if (typeof Buffer.allocUnsafe === "function") {
      newBuffer = function(len) {
        return Buffer.allocUnsafe(len);
      };
    } else {
      newBuffer = function(len) {
        return new Buffer(len);
      };
    }
    function installDestroyFn(stream, fn) {
      if (typeof stream.destroy === "function") {
        stream._destroy = function(err, cb) {
          fn();
          if (cb != null) cb(err);
        };
      } else {
        stream.destroy = fn;
      }
    }
    function defaultCallback(err) {
      if (err) throw err;
    }
  }
});

// src/backend.ts
import { mkdir as mkdir3, readFile as readFile2, writeFile as writeFile2, rename as rename2, lstat as lstat2, readdir as readdir2, realpath } from "node:fs/promises";
import os2 from "node:os";
import path3 from "node:path";
import { randomUUID as randomUUID3 } from "node:crypto";

// src/catalog.ts
var routes = ["image", "texture", "sfx", "music", "model"];
var catalog = [
  {
    id: "qwen-image-2.1-turbo",
    name: "Qwen Image 2.1 Turbo",
    detail: "Q4_K_M \xB7 8 steps \xB7 512\u2013768 px",
    routes: ["image", "texture"],
    bytes: 9902859608,
    license: "Qwen Research",
    url: "https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo",
    experimental: false,
    files: ["models/qwen-image-2.1-turbo/diffusion.gguf", "models/qwen-image-2.1-turbo/text-encoder.gguf", "models/qwen-image-2.1-turbo/vae.safetensors"],
    gate: false
  },
  {
    id: "stable-audio-3-small-sfx",
    name: "Stable Audio 3 Small SFX",
    detail: "Q8 \xB7 audio.cpp CUDA \xB7 up to 120 seconds",
    routes: ["sfx"],
    bytes: 1683570688,
    license: "Stability AI Community + Gemma terms",
    url: "https://huggingface.co/audio-cpp/audio.cpp-gguf",
    experimental: false,
    files: ["bin/audiocpp_cli.exe", "models/stable-audio-3-small-sfx/model.gguf", "stable-audio-3-small-sfx.ready.json"],
    gate: false
  },
  {
    id: "stable-audio-3-small-music",
    name: "Stable Audio 3 Small Music",
    detail: "Q8 \xB7 audio.cpp CUDA \xB7 up to 120 seconds",
    routes: ["music"],
    bytes: 1683570752,
    license: "Stability AI Community + Gemma terms",
    url: "https://huggingface.co/audio-cpp/audio.cpp-gguf",
    experimental: false,
    files: ["bin/audiocpp_cli.exe", "models/stable-audio-3-small-music/model.gguf", "stable-audio-3-small-music.ready.json"],
    gate: false
  },
  {
    id: "hunyuan3d-2-turbo",
    name: "Hunyuan3D 2.0 Turbo",
    detail: "Balanced default \xB7 experimental high-density 200k / 2K profile \xB7 sequential shape and paint",
    routes: ["model"],
    bytes: 19531944814,
    license: "Tencent Hunyuan3D Community + component terms",
    url: "https://github.com/YanWenKun/Hunyuan3D-2-WinPortable",
    experimental: true,
    files: ["Hunyuan3D-2/hy3dgen/shapegen/pipelines.py", "models/tencent/Hunyuan3D-2/hunyuan3d-dit-v2-0-turbo/model.fp16.safetensors", "models/tencent/Hunyuan3D-2/hunyuan3d-paint-v2-0-turbo/unet/genex-original-fp16.safetensors", "hunyuan3d-2-turbo.ready.json"],
    gate: false
  }
];
var defaults = { image: "qwen-image-2.1-turbo", texture: "qwen-image-2.1-turbo", sfx: null, music: null, model: null };
function validateAssignments(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected task assignments.");
  const source = value;
  if (Object.keys(source).some((key) => !routes.includes(key))) throw Error("Unknown task.");
  const result = { ...defaults };
  for (const route of routes) {
    const id = route === "model" && source[route] === "trellis-2-low-vram" ? "hunyuan3d-2-turbo" : source[route];
    if (id === null) {
      result[route] = null;
      continue;
    }
    const model = catalog.find((model2) => model2.id === id);
    if (!model || !model.routes.includes(route)) throw Error(`Choose a compatible model for ${route}.`);
    result[route] = model.id;
  }
  return result;
}

// src/queue.ts
import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
var ModelQueue = class {
  pending = 0;
  active = false;
  async run(root, signal, work) {
    signal.throwIfAborted();
    if (this.pending >= 4) throw Error("The local model queue is full. Retrieve the current job before retrying.");
    this.pending++;
    const lock = path.join(root, "generation.lock");
    const deadline = Date.now() + 15e3;
    let lease;
    try {
      await mkdir(root, { recursive: true });
      while (!lease) {
        signal.throwIfAborted();
        try {
          lease = await open(lock, "wx", 384);
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
          if (Date.now() >= deadline) throw Error("A local model is still running. No second model was loaded. Wait for its result, then retry. If Genex crashed, inspect the generation.lock record before recovery.");
          await delay(75, void 0, { signal });
        }
      }
      await lease.writeFile(JSON.stringify({ pid: process.pid, startedAt: (/* @__PURE__ */ new Date()).toISOString() }));
      signal.throwIfAborted();
      this.active = true;
      return await work();
    } finally {
      this.pending--;
      if (lease) {
        this.active = false;
        await lease.close();
        await unlink(lock);
      }
    }
  }
};

// src/installer.ts
var import_yauzl = __toESM(require_yauzl(), 1);
import { mkdir as mkdir2, writeFile, rename, open as open2, unlink as unlink2, lstat, statfs, cp, access, readdir, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import path2 from "node:path";
import os from "node:os";

// scripts/audio-assets.json
var audio_assets_default = [
  {
    name: "model.gguf",
    folder: "audio/models/stable-audio-3-small-music",
    size: 1683570752,
    sha256: "89bb22db5fa68ab8f1d90af0a9f88121977c945bdb99a57c96b1e88fa34bf1c8",
    url: "https://huggingface.co/audio-cpp/audio.cpp-gguf/resolve/f861648c0c1f4da9f18e9a0ce5e217b0679bb2f5/Stable-Audio-3-Small-Music-GGUF/stable-audio-3-small-music-q8_0.gguf"
  },
  {
    name: "model.gguf",
    folder: "audio/models/stable-audio-3-small-sfx",
    size: 1683570688,
    sha256: "5bb1ec653134e63dac46264e336ae198a2590195fc996fcd0605021215e9b26f",
    url: "https://huggingface.co/audio-cpp/audio.cpp-gguf/resolve/f861648c0c1f4da9f18e9a0ce5e217b0679bb2f5/Stable-Audio-3-Small-SFX-GGUF/stable-audio-3-small-sfx-q8_0.gguf"
  },
  {
    name: "audio-v0.9.1-bin-windows-x64-cuda12.4.zip",
    folder: "downloads",
    size: 462376707,
    sha256: "f32a40f8fb14ac4772c9c25525f97715db228979178e51654da73aa65005c0ef",
    url: "https://github.com/0xShug0/audio.cpp/releases/download/v0.9.1/audio-v0.9.1-bin-windows-x64-cuda12.4.zip"
  },
  {
    name: "audio-v0.9.1-cudart-windows-x64-cuda12.4.zip",
    folder: "downloads",
    size: 607273675,
    sha256: "8bfdce7cb00b5a51560b5ab0d444344d86a2f0d7e2727bb7f18c15ef4734451b",
    url: "https://github.com/0xShug0/audio.cpp/releases/download/v0.9.1/audio-v0.9.1-cudart-windows-x64-cuda12.4.zip"
  }
];

// scripts/qwen-assets.json
var qwen_assets_default = [
  {
    name: "sd-cuda.zip",
    folder: "downloads",
    size: 338016915,
    sha256: "2f08572e143f0b15a764197ea937d219dd70f0cc7eefb30eb84c9dae6a7cba6d",
    url: "https://github.com/leejet/stable-diffusion.cpp/releases/download/master-964-1d0a58a/sd-master-1d0a58a-bin-win-cuda12-x64.zip"
  },
  {
    name: "sd-cudart.zip",
    folder: "downloads",
    size: 563452046,
    sha256: "fe20366827d357c00797eebb58244dddab7fd9a348d70090c3871004c320f38d",
    url: "https://github.com/leejet/stable-diffusion.cpp/releases/download/master-964-1d0a58a/cudart-sd-bin-win-cu12-x64.zip"
  },
  {
    name: "diffusion.gguf",
    folder: "runtime/models/qwen-image-2.1-turbo",
    size: 4199565120,
    sha256: "8940e8b522af886e0c0f5afddf720e82dd223cb9a43580b5f61c4d740452ac20",
    url: "https://huggingface.co/unsloth/Qwen-Image-2.1-Turbo-GGUF/resolve/5d1f9f759ea877ae556cda88dbec958b62ad3809/qwen-image-2.1-turbo-Q4_K_M.gguf"
  },
  {
    name: "text-encoder.gguf",
    folder: "runtime/models/qwen-image-2.1-turbo",
    size: 5027784800,
    sha256: "67d1659bfe71b89d50b45a4ad1a9e5b997e5bb16ce5da66a6a6167abd569e9e2",
    url: "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/f982a07559d4a2f6c8744d840bf6fccab30eea96/Qwen3VL-8B-Instruct-Q4_K_M.gguf"
  },
  {
    name: "vae.safetensors",
    folder: "runtime/models/qwen-image-2.1-turbo",
    size: 675509688,
    sha256: "bb21f7473051e1ac368515dd3f2e15cd44d7a11748ee8823e1ddca3e4876b7c9",
    url: "https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/a8342359c61979b06a8dafb1a47991fe1f30e994/vae/qwen_image_2.1_vae_bf16.safetensors"
  }
];

// plugin/audio-runtime.json
var audio_runtime_default = {
  sourceRevision: "cf124a67cc55d8f65a9a15eec69edbff0fb212c8",
  sha256: "1980dd4b63d0fd9ddc40de036c6bb240381422866bcda3f29287af72ff7d4fae",
  bytes: 2959360,
  originalSha256: "ed4254f7752ccccb0e0b33dc4470f4a1b31a14195fc9789d3278994f309c7989"
};

// src/installer.ts
var python = { name: "python-3.11.9-embed-amd64.zip", folder: "downloads", size: 11249023, sha256: "009d6bf7e3b2ddca3d784fa09f90fe54336d5b60f0e0f305c37f400bf83cfd3b", url: "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip" };
var progress = { active: false, model: "", phase: "idle", completed: 0, total: 0 };
var controller;
var installation = () => ({ ...progress });
function cancelInstallation() {
  controller?.abort();
  return installation();
}
async function modelHome() {
  if (process.platform !== "win32" || process.arch !== "x64") throw Error("This tested runtime profile currently supports Windows x64 with an NVIDIA GPU.");
  try {
    await access("D:/");
    return "D:/Genex-Local-Models";
  } catch {
    return path2.join(os.homedir(), "Genex-Local-Models");
  }
}
function child(root, relative) {
  const result = path2.resolve(root, relative), rel = path2.relative(path2.resolve(root), result);
  if (!rel || rel.startsWith("..") || path2.isAbsolute(rel)) throw Error("Path leaves the managed model directory.");
  return result;
}
async function directory(root, relative) {
  await mkdir2(root, { recursive: true });
  if ((await lstat(root)).isSymbolicLink()) throw Error("Managed root cannot be a link.");
  let current = path2.resolve(root);
  for (const part of path2.relative(current, child(root, relative)).split(path2.sep)) {
    current = path2.join(current, part);
    await mkdir2(current).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) throw Error("Managed directory contains a link or non-directory.");
  }
}
async function sha(file, signal) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file)) {
    signal.throwIfAborted();
    hash.update(bytes);
  }
  return hash.digest("hex");
}
async function downloadAsset(root, asset, signal, onProgress = () => {
}, get = fetch) {
  await directory(root, asset.folder);
  const target = child(root, path2.join(asset.folder, asset.name)), partial = target + ".part";
  for (const file of [target, partial]) try {
    if (!(await lstat(file)).isFile()) throw Error("Download destination is not a regular file.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    const stat = await lstat(target);
    if (stat.size !== asset.size || await sha(target, signal) !== asset.sha256) throw Error(`Existing different file preserved: ${asset.name}`);
    onProgress(asset.size);
    return target;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let offset = 0;
  try {
    offset = (await lstat(partial)).size;
  } catch {
  }
  if (offset > asset.size) throw Error("Download partial exceeds pinned size.");
  const disk = await statfs(root), reserve = path2.parse(path2.resolve(root)).root.toLowerCase() === "c:\\" ? 15 * 1024 ** 3 : 2 * 1024 ** 3;
  if (disk.bavail * disk.bsize < asset.size - offset + reserve) throw Error("Not enough disk space while preserving the free-space reserve.");
  onProgress(offset);
  while (offset < asset.size) {
    signal.throwIfAborted();
    const end = Math.min(offset + 64 * 1024 ** 2, asset.size) - 1;
    const response = await get(asset.url, { headers: { Range: `bytes=${offset}-${end}` }, signal: AbortSignal.any([signal, AbortSignal.timeout(6e4)]), redirect: "follow" });
    if (!response.ok || !response.body) throw Error(`Download returned HTTP ${response.status}. Retry to resume.`);
    if (offset && response.status !== 206) throw Error("Server ignored resume range; partial preserved.");
    if (response.status === 206 && !response.headers.get("content-range")?.startsWith(`bytes ${offset}-`)) throw Error("Server returned the wrong download range.");
    const out = await open2(partial, offset ? "a" : "w", 384), before = offset;
    try {
      for await (const bytes of response.body) {
        signal.throwIfAborted();
        if (offset + bytes.length > asset.size) throw Error("Download exceeds pinned size.");
        await out.writeFile(bytes);
        offset += bytes.length;
        onProgress(offset);
      }
    } finally {
      await out.close();
    }
    if (offset === before) throw Error("Download stopped without progress. Retry to resume.");
  }
  if (await sha(partial, signal) !== asset.sha256) throw Error("SHA-256 mismatch; partial preserved and model not activated.");
  await rename(partial, target);
  return target;
}
async function extractZip(archive, target, signal) {
  await mkdir2(target, { recursive: true });
  await new Promise((resolve, reject) => {
    import_yauzl.default.open(archive, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? Error("Invalid archive"));
      let count = 0, total = 0;
      const fail = (error2) => {
        zip.close();
        reject(error2);
      };
      zip.on("error", fail);
      zip.on("end", resolve);
      zip.on("entry", (entry) => {
        void (async () => {
          signal.throwIfAborted();
          if (++count > 2e4 || (total += entry.uncompressedSize) > 4 * 1024 ** 3 || (entry.externalFileAttributes >>> 16 & 61440) === 40960 || /[:\\]/.test(entry.fileName)) throw Error("Unsafe or oversized archive.");
          const file = child(target, entry.fileName);
          if (entry.fileName.endsWith("/")) await directory(target, entry.fileName);
          else {
            const dir = path2.dirname(entry.fileName);
            if (dir !== ".") await directory(target, dir);
            const stream = await new Promise((resolve2, reject2) => zip.openReadStream(entry, (error2, stream2) => error2 || !stream2 ? reject2(error2) : resolve2(stream2)));
            await pipeline(stream, createWriteStream(file, { flags: "wx" }), { signal });
          }
          zip.readEntry();
        })().catch(fail);
      });
      zip.readEntry();
    });
  });
}
function assetsFor(model) {
  if (model === "qwen-image-2.1-turbo") return qwen_assets_default;
  if (model === "hunyuan3d-2-turbo") throw Error("Hunyuan3D uses the separately provisioned Windows Portable runtime. Complete its verified CUDA texture setup before assigning it; generation never installs dependencies.");
  if (model === "stable-audio-3-small-music" || model === "stable-audio-3-small-sfx") return audio_assets_default.filter((a) => a.folder === "downloads" || a.folder.endsWith(model));
  throw Error("Unknown reviewed model.");
}
function startInstallation(model) {
  const assets = assetsFor(model);
  if (progress.active) throw Error("A model installation is already running.");
  controller = new AbortController();
  progress = { active: true, model, phase: "preparing", completed: 0, total: assets.reduce((n, a) => n + a.size, python.size) };
  void install(model, assets, controller.signal).catch((error) => {
    progress.phase = controller?.signal.aborted ? "cancelled" : "failed";
    progress.error = String(error);
  }).finally(() => {
    progress.active = false;
    controller = void 0;
  });
  return installation();
}
async function install(model, assets, signal) {
  const base = await modelHome();
  await mkdir2(base, { recursive: true });
  const lock = path2.join(base, "setup.lock"), lease = await open2(lock, "wx", 384).catch(() => {
    throw Error("Another setup owns setup.lock. Wait for it to finish before retrying.");
  });
  try {
    await lease.writeFile(JSON.stringify({ pid: process.pid, model, at: (/* @__PURE__ */ new Date()).toISOString() }));
    let complete = 0;
    const files = /* @__PURE__ */ new Map();
    for (const asset of [python, ...assets]) {
      progress.phase = "downloading and verifying";
      progress.file = asset.name;
      files.set(asset.name, await downloadAsset(base, asset, signal, (bytes) => {
        progress.completed = complete + bytes;
      }));
      complete += asset.size;
    }
    const family = model === "qwen-image-2.1-turbo" ? "qwen" : "audio";
    const root = path2.join(os.homedir(), "Genex-Local-Models", family);
    await mkdir2(root, { recursive: true });
    const stage = path2.join(base, "setup-" + randomUUID());
    await mkdir2(stage);
    progress.phase = "extracting runtime";
    await extractZip(files.get(python.name), path2.join(stage, "python"), signal);
    const copies = [];
    try {
      await access(path2.join(root, "python.exe"));
    } catch {
      for (const file of await readdir(path2.join(stage, "python"))) copies.push({ source: path2.join(stage, "python", file), destination: path2.join(root, file) });
    }
    for (const asset of assets.filter((asset2) => asset2.folder === "downloads")) {
      const unpack = path2.join(stage, asset.name);
      await extractZip(files.get(asset.name), unpack, signal);
      const destination = path2.join(root, family === "qwen" ? "sd-cpp" : "bin");
      await mkdir2(destination, { recursive: true });
      const executable = family === "qwen" ? "sd-cli.exe" : "audiocpp_cli.exe";
      for (const file of await readdir(unpack)) if (file.toLowerCase().endsWith(".dll") || file === executable && family !== "audio" || /^licen[cs]e/i.test(file)) copies.push({ source: path2.join(unpack, file), destination: path2.join(destination, file) });
    }
    if (family === "audio") {
      const packageRoot = import.meta.filename.endsWith(".ts") ? path2.resolve(import.meta.dirname, "../plugin") : import.meta.dirname;
      const source = path2.join(packageRoot, "native/win32-x64/audiocpp_cli.exe");
      if (await sha(source, signal) !== audio_runtime_default.sha256) throw Error("Bundled audio runtime digest differs.");
      copies.push({ source, destination: path2.join(root, "bin/audiocpp_cli.exe") });
    }
    for (const asset of assets.filter((asset2) => asset2.folder !== "downloads")) copies.push({ source: files.get(asset.name), destination: path2.join(root, "models", model, asset.name) });
    let needed = 0;
    for (const file of copies) {
      try {
        const info = await lstat(file.destination);
        if (!info.isFile() || info.size !== (await lstat(file.source)).size) throw Error("Existing runtime differs; preserved for inspection.");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        needed += (await lstat(file.source)).size;
      }
    }
    const disk = await statfs(root), reserve = path2.parse(root).root.toLowerCase() === "c:\\" ? 15 * 1024 ** 3 : 2 * 1024 ** 3;
    if (disk.bavail * disk.bsize < needed + reserve) throw Error("Runtime setup would consume the free-space reserve. Downloads remain available for retry.");
    progress.phase = "installing verified files";
    for (const file of copies) {
      signal.throwIfAborted();
      try {
        await access(file.destination);
        continue;
      } catch {
      }
      await mkdir2(path2.dirname(file.destination), { recursive: true });
      const partial = file.destination + ".copying";
      await cp(file.source, partial);
      await rename(partial, file.destination);
    }
    for (const asset of assets.filter((asset2) => asset2.folder !== "downloads")) {
      const destination = path2.join(root, "models", model, asset.name);
      if (await sha(destination, signal) !== asset.sha256) throw Error("Installed model digest differs; not activated.");
    }
    if (family === "qwen") {
      await writeFile(path2.join(root, "runtime.json"), JSON.stringify({ sd_cli: "sd-cpp/sd-cli.exe", download_digests_verified: true }));
    }
    if (family === "audio") await writeFile(path2.join(root, "audio-lpac.json"), JSON.stringify(audio_runtime_default));
    progress.phase = "ready";
    progress.file = void 0;
    await writeFile(path2.join(root, model + ".ready.json"), JSON.stringify({ model, verified: true, at: (/* @__PURE__ */ new Date()).toISOString(), assets }));
    const staged = path2.resolve(stage), owned = path2.resolve(base) + path2.sep;
    if (staged.startsWith(owned) && path2.basename(staged).startsWith("setup-") && !(await lstat(staged)).isSymbolicLink()) await rm(staged, { recursive: true });
  } finally {
    await lease.close();
    await unlink2(lock);
  }
}

// src/assets.ts
var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assetEntries(files) {
  return files.map((file) => ({ file, url: file.startsWith("Assets/") ? null : "/" + file.replace(/^public\//, "").split("/").map(encodeURIComponent).join("/") }));
}
async function savedRecord(ctx, id) {
  try {
    const record = await ctx.host("jobs.read", { id });
    return record && typeof record === "object" && !Array.isArray(record) && "jobId" in record && record.jobId === id ? record : {};
  } catch (error) {
    if (error.code === "ENOENT" || /ENOENT/.test(String(error))) return {};
    throw error;
  }
}
async function nativeResult(ctx, id) {
  if (typeof id !== "string" || !uuid.test(id)) throw Error("Use the exact job UUID returned earlier.");
  if (!ctx.project) throw Error("Open a game before reading or restoring its Local Models assets.");
  const native = await ctx.host("native.result", { id });
  if (!native || native.project !== ctx.project) throw Error("This job is unavailable in this project. No files were copied.");
  return native;
}
var nativeSummary = (native) => ({ id: native.id, state: native.state, recipe: native.recipe, files: native.files, createdAt: native.createdAt, finishedAt: native.finishedAt, reason: native.reason });
async function retrieve(ctx, id) {
  const native = await nativeResult(ctx, id), previous = await savedRecord(ctx, native.id);
  if (native.state !== "completed") return { record: previous, native: nativeSummary(native), restored: false };
  const files = await ctx.host("assets.deliver", { output: native.output, jobId: native.id });
  const record = { ...previous, jobId: native.id, files, assets: assetEntries(files), use: previous.use?.workspace === ctx.directory ? previous.use : { stage: "unconfirmed" } };
  await ctx.host("jobs.write", { id: native.id, value: record });
  return { record, native: nativeSummary(native), restored: true, integration: "Use exact assets[].url in this workspace. Never retype a UUID. Delivery registers files in Genex Assets; it does not verify their use in the game." };
}
async function retainedAssets(ctx) {
  if (!ctx.project) throw Error("Open a game to list its Local Models assets.");
  const jobs = (await ctx.host("native.jobs")).filter((job) => job.project === ctx.project && job.state === "completed");
  jobs.sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  const assets = await Promise.all(jobs.slice(0, 100).map(async (job) => {
    const record = await savedRecord(ctx, job.id);
    return { jobId: job.id, name: record.name ?? job.recipe, task: record.task ?? job.recipe, model: record.model ?? null, at: job.finishedAt, files: record.files ?? [], use: record.use?.workspace === ctx.directory ? record.use : { stage: "unconfirmed" }, availability: "retained; retrieve to deliver into the current workspace" };
  }));
  return { project: ctx.project, assets, truncated: jobs.length > 100, next: "Use theastraydev-local-models__retrieve with an exact jobId to restore files into this game or build. No generation or download is needed." };
}
async function restoreAssets(ctx) {
  const listing = await retainedAssets(ctx), restored = [], failed = [];
  for (const asset of listing.assets) {
    ctx.signal.throwIfAborted();
    try {
      restored.push((await retrieve(ctx, asset.jobId)).record);
    } catch (error) {
      failed.push({ jobId: asset.jobId, error: String(error) });
    }
  }
  return { restored, failed, truncated: listing.truncated };
}

// src/integration.ts
import { randomUUID as randomUUID2 } from "node:crypto";
function integrationFor(jobId, files) {
  const model = files.find((file) => file.endsWith(".glb"));
  const url = model ? "/" + model.replace(/^public\//, "").split("/").map(encodeURIComponent).join("/") : null;
  return {
    state: "integration-required",
    instruction: "Integrate these exact delivered files into the game now, before another generation. Delivery alone does not replace a placeholder. Never leave carModel:null or a loader returning car:null when the requested model is ready. Preserve other game behavior.",
    ...url ? { threeJs: { import: 'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";', load: `const gltf = await new GLTFLoader().loadAsync(${JSON.stringify(url)});`, attach: "Pass gltf.scene to the real gameplay entity (for example carModel: generated.car). Inspect its forward/up axes, rotate it to match gameplay, center it, fit its bounds and ground it before replacing the placeholder. A loaded model can still face sideways. The template loadAsset(name) only accepts short root slugs; do not pass a delivered nested URL to it." } } : {},
    inspect: { tool: "theastraydev-local-models__inspect-use", arguments: { id: jobId } },
    acceptance: "Inspect runtime loading and the returned frame. Only a successful current inspection can be verified; code references or file existence are insufficient."
  };
}
async function inspectUse(ctx, id) {
  if (typeof ctx.project !== "string" || typeof ctx.directory !== "string") throw Error("Open a game before inspecting asset use.");
  const restored = await retrieve(ctx, id);
  if (!restored.restored) throw Error("Inspect requires a completed, retained asset.");
  const record = restored.record, files = record.files;
  const observed = await ctx.host("observe", { project: ctx.project, root: ctx.directory, files });
  ctx.signal.throwIfAborted();
  const loadedFiles = files.filter((file) => Array.isArray(observed.loadedFiles) && observed.loadedFiles.includes(file));
  const audioFiles = files.filter((file) => /\.(wav|mp3|ogg|flac|m4a)$/i.test(file));
  const audio = audioFiles.length === files.length && files.length > 0;
  const audible = audio && audioFiles.every((file) => observed.audio?.some((a) => a.file === file && a.state === "playing" && Number.isFinite(a.rms) && a.rms > 1e-4 && a.advancedSeconds > 0));
  const allLoaded = files.length > 0 && loadedFiles.length === files.length;
  const use = { stage: audible ? "verified" : allLoaded && !audio ? "integrated" : "unconfirmed", workspace: ctx.directory, inspectionId: randomUUID2(), observedAt: (/* @__PURE__ */ new Date()).toISOString(), loadedFiles, verification: audible ? "runtime-audio-playback" : allLoaded && !audio ? "pending-visual" : "not-established", audio: observed.audio };
  await ctx.host("jobs.write", { id: record.jobId, value: { ...record, use } });
  const image = observed.image ? Buffer.from(observed.image) : null;
  return {
    ok: audible || allLoaded && !audio,
    jobId: record.jobId,
    use,
    missingFiles: files.filter((file) => !loadedFiles.includes(file)),
    ...image ? { images: [{ mimeType: "image/jpeg", data: image.toString("base64"), label: "Asset use in the running game" }] } : {},
    guidance: audible ? "Audible playback established." : allLoaded && !audio ? "The game loaded this asset. Inspect the attached frame, then call verify-use with this inspectionId and describe its visible use." : "Asset integration is incomplete. Wire the delivered file into the actual game entity or audio event and inspect again. Do not report the asset requirement as complete."
  };
}
async function verifyUse(ctx, args) {
  const native = await nativeResult(ctx, args.id), record = await savedRecord(ctx, native.id);
  if (record.use?.stage !== "integrated" || record.use.workspace !== ctx.directory || record.use.verification !== "pending-visual" || args.inspectionId !== record.use.inspectionId) throw Error("A matching current runtime-loaded visual inspection is required.");
  if (typeof args.note !== "string" || args.note.trim().length < 12 || args.note.length > 2e3) throw Error("Describe the asset visible in the inspection frame (12 to 2000 characters).");
  const use = { ...record.use, stage: "verified", verification: "agent-visual-observation", note: args.note.trim() };
  await ctx.host("jobs.write", { id: native.id, value: { ...record, use } });
  return { ok: true, jobId: native.id, use };
}

// src/backend.ts
var queue = new ModelQueue();
var activeModel = null;
var runtimeId = "qwen";
var MODEL_RESULT = "GENEX_LOCAL_RESULT ";
async function storage(ctx) {
  return ctx.host("storage.root");
}
async function assignments(root) {
  try {
    return validateAssignments(JSON.parse(await readFile2(path3.join(root, "assignments.json"), "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return { ...defaults };
    throw error;
  }
}
async function regular(root, file) {
  const target = path3.join(root, file);
  try {
    const actual = await realpath(target), base = await realpath(root), relative = path3.relative(base, actual);
    return relative !== "" && !relative.startsWith("..") && !path3.isAbsolute(relative) && (await lstat2(target)).isFile();
  } catch {
    return false;
  }
}
async function state(ctx) {
  const root = await storage(ctx), runtime = await ctx.host("runtime.detect", { runtime: runtimeId });
  const qwen = await ctx.host("runtime.detect", { runtime: "qwen" });
  const audio = await ctx.host("runtime.detect", { runtime: "audio" });
  const hunyuan = await ctx.host("runtime.detect", { runtime: "hunyuan" });
  const runtimeRoot = runtime.path ? path3.dirname(runtime.path) : null;
  const models = await Promise.all(catalog.map(async (model) => {
    const selected = model.id === "qwen-image-2.1-turbo" ? qwen : model.id === "hunyuan3d-2-turbo" ? hunyuan : audio;
    const modelRoot = selected.path ? path3.dirname(selected.path) : null;
    const available = modelRoot ? await Promise.all(model.files.map((file) => regular(modelRoot, file))) : [];
    const ready = selected.state === "ready" && available.length > 0 && available.every(Boolean);
    return {
      ...model,
      ready,
      state: model.id === activeModel ? "working" : ready ? "sleeping" : model.gate ? "access-required" : "not-installed",
      reason: model.id === activeModel ? "One model worker is active. Other models stay asleep." : ready ? "Loads only when assigned work starts." : model.id === "hunyuan3d-2-turbo" ? "The Hunyuan3D Windows Portable runtime needs its verified local texture setup." : "Use Install to download and verify the public weights and runtime. No account or token is needed."
    };
  }));
  let recent = [];
  try {
    recent = JSON.parse(await readFile2(path3.join(root, "recent.json"), "utf8"));
  } catch {
  }
  return {
    project: ctx.project ?? null,
    runtime,
    qwen,
    root: runtimeRoot,
    models,
    installation: installation(),
    assignments: await assignments(root),
    execution: { policy: "one-model-at-a-time", sleep: "terminate-process", active: queue.active, model: activeModel, pending: queue.pending },
    recent
  };
}
async function discover() {
  const roots = [path3.join(os2.homedir(), ".cache/huggingface/hub"), path3.join(os2.homedir(), ".lmstudio/models"), path3.join(os2.homedir(), ".cache/lm-studio/models"), path3.join(os2.homedir(), ".ollama/models/manifests"), "D:/hf-cache/hub", "D:/models"];
  const found = [];
  for (const root of roots) {
    try {
      const entries = await readdir2(root, { withFileTypes: true });
      for (const entry of entries.slice(0, 100)) {
        if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
        found.push({ id: entry.name.replace(/^models--/, "").replace("--", "/"), source: root, supported: false });
      }
    } catch (error) {
      if (!["ENOENT", "EACCES"].includes(error.code ?? "")) throw error;
    }
  }
  return { found, note: "Existing models are listed without loading weights. Only verified task adapters can be assigned; a chat model cannot automatically generate meshes or audio." };
}
function requestFor(name, args) {
  const allowed = name === "generate-image" ? ["name", "prompt", "task", "purpose", "size", "seed"] : name === "generate-audio" ? ["name", "prompt", "task", "duration", "seed"] : name === "generate-model" ? ["name", "image", "seed", "quality"] : [];
  if (!allowed.length || Object.keys(args).some((key) => !allowed.includes(key))) throw Error("Unknown generation argument.");
  if (typeof args.name !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(args.name)) throw Error("Choose a lowercase asset name, up to 40 characters.");
  const seed = args.seed ?? 42;
  if (!Number.isInteger(seed) || Number(seed) < 0 || Number(seed) > 2147483647) throw Error("Seed must be an integer from 0 to 2147483647.");
  let route;
  if (name === "generate-model") {
    const quality = args.quality ?? "balanced";
    if (quality !== "balanced" && quality !== "high") throw Error("Choose model quality high or balanced.");
    if (typeof args.image !== "string" || !args.image || path3.isAbsolute(args.image) || /^[a-z]:/i.test(args.image) || args.image.includes("\\") || args.image.split("/").some((p) => !p || p.startsWith(".")) || !/^(public\/|assets\/).*\.(png|jpe?g|webp)$/i.test(args.image)) throw Error("Use an existing project-relative PNG, JPEG or WebP under public/ or assets/.");
    route = "model";
    return { route, request: { seed: Number(seed), quality }, inputs: { image: args.image } };
  }
  if (typeof args.prompt !== "string" || !args.prompt.trim() || args.prompt.length > 2e3 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(args.prompt)) throw Error("Describe the asset in 1 to 2000 characters.");
  if (name === "generate-image") {
    route = args.task ?? "image";
    if (!["image", "texture"].includes(route)) throw Error("Choose image or texture.");
    const size = args.size ?? 512;
    if (![512, 768].includes(Number(size)) || typeof size !== "number") throw Error("Choose size 512 or 768 for the 12 GB profile.");
    if (args.purpose !== void 0 && (!["asset", "icon", "model-reference", "scene"].includes(String(args.purpose)) || route === "texture")) throw Error("Choose an image purpose: asset, icon, model-reference or scene. Textures use task:texture without purpose.");
    const purpose = route === "texture" ? "texture" : args.purpose ?? "asset";
    return { route, request: { prompt: args.prompt, seed: Number(seed), size: Number(size), purpose }, inputs: {} };
  }
  route = args.task ?? "sfx";
  if (!["sfx", "music"].includes(route)) throw Error("Choose sfx or music.");
  const duration = args.duration ?? (route === "music" ? 30 : 5);
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 1 || duration > 120) throw Error("Duration must be 1 to 120 seconds.");
  return { route, request: { prompt: args.prompt, seed: Number(seed), duration }, inputs: {} };
}
async function generate(name, args, ctx) {
  const request = requestFor(name, args), root = await storage(ctx);
  const selection = await assignments(root), selected = selection[request.route];
  if (!selected) throw Error(`No local model is assigned to ${request.route}. Choose one in Plugins \u2192 Local Models.`);
  const snapshot = await state(ctx), model = snapshot.models.find((model2) => model2.id === selected);
  if (!model?.ready) throw Error(`${model?.name ?? selected}: ${model?.reason ?? "not installed"}`);
  return queue.run(root, ctx.signal, async () => {
    activeModel = selected;
    try {
      const started = Date.now();
      const encoded = Buffer.from(JSON.stringify({ ...request.request, model: selected })).toString("base64");
      if (encoded.length > 12288) throw Error("Encoded generation request exceeds the native API limit.");
      const values = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`r${index}`, encoded.slice(index * 1024, (index + 1) * 1024) || "."]));
      const job = await ctx.host("native.run", { job: request.route === "model" ? "model" : request.route === "music" || request.route === "sfx" ? "audio" : "image", inputs: request.inputs, values });
      if (job.state !== "completed") throw Error(`Local generation ${job.state}: ${job.reason ?? ""} ${job.stdout?.slice(-1800) ?? ""} ${job.stderr?.slice(-1200) ?? ""}. The worker has stopped; no paid fallback was used.`);
      const line = job.stdout?.split("\n").findLast((line2) => line2.startsWith(MODEL_RESULT));
      if (!line) throw Error(`Job ${job.id} produced no verified worker receipt. Inspect this job before retrying.`);
      const receipt = JSON.parse(line.slice(MODEL_RESULT.length));
      const files = await ctx.host("assets.deliver", { output: job.output, jobId: job.id });
      const result = { jobId: job.id, name: args.name, model: selected, task: request.route, files, assets: assetEntries(files), seconds: (Date.now() - started) / 1e3, worker: receipt, sleep: "process exited; model weights released", use: { stage: "unconfirmed" }, integration: integrationFor(job.id, files) };
      await ctx.host("jobs.write", { id: job.id, value: result });
      let recent = [];
      try {
        recent = JSON.parse(await readFile2(path3.join(root, "recent.json"), "utf8"));
      } catch {
      }
      recent.unshift({ ...result, at: (/* @__PURE__ */ new Date()).toISOString() });
      const temp = path3.join(root, `recent-${randomUUID3()}.tmp`);
      await writeFile2(temp, JSON.stringify(recent.slice(0, 20)));
      await rename2(temp, path3.join(root, "recent.json"));
      return result;
    } finally {
      activeModel = null;
    }
  });
}
async function generateModel(args, ctx) {
  const allowed = ["name", "image", "imageJobId", "prompt", "seed", "quality"];
  if (Object.keys(args).some((key) => !allowed.includes(key))) throw Error("Unknown generation argument.");
  const choices = ["image", "imageJobId", "prompt"].filter((key) => args[key] !== void 0);
  if (choices.length !== 1) throw Error("Choose exactly one of image, imageJobId or prompt.");
  if (choices[0] === "image") return generate("generate-model", args, ctx);
  const selection = await state(ctx), selected = selection.assignments.model;
  if (!selected || !selection.models.some((model) => model.id === selected && model.ready)) throw Error("No ready local model is assigned to model. Choose Hunyuan3D in Plugins \u2192 Local Models.");
  const profile = requestFor("generate-model", { name: args.name, image: "assets/reference.png", seed: args.seed, quality: args.quality }).request.quality;
  let referenceJobId = args.imageJobId;
  if (choices[0] === "prompt") {
    const image2 = await generate("generate-image", { name: args.name, prompt: args.prompt, task: "image", purpose: "model-reference", size: profile === "high" ? 768 : 512, seed: args.seed }, ctx);
    return {
      state: "reference-ready",
      completed: false,
      referenceJobId: image2.jobId,
      referenceAssets: image2.assets,
      nextCall: { tool: "theastraydev-local-models__generate-model", arguments: { name: args.name, imageJobId: image2.jobId, seed: args.seed ?? 42, quality: profile } },
      instruction: "The 3D model is not generated yet. Immediately make nextCall to finish the authorized request. Do not regenerate this reference or ask the user to copy files. Separate calls preserve Genex's native time limit."
    };
  }
  const reference = await nativeResult(ctx, referenceJobId);
  if (reference.state !== "completed" || reference.recipe !== "image") throw Error("Use a completed image job from this project as the 3D reference.");
  const delivered = await retrieve(ctx, reference.id), image = delivered.record.files.find((file) => /\.(png|jpe?g|webp)$/i.test(file));
  if (!image) throw Error(`Reference job ${reference.id} has no delivered image. Retrieve it before retrying; do not regenerate it.`);
  try {
    const result = { ...await generate("generate-model", { name: args.name, image, seed: args.seed, quality: profile }, ctx), referenceJobId: reference.id };
    await ctx.host("jobs.write", { id: result.jobId, value: result });
    return result;
  } catch (error) {
    throw Error(`3D generation did not complete. Reference job ${reference.id} is retained. Retry with imageJobId=${reference.id} and quality=${profile} to reuse it. ${String(error)}`);
  }
}
var activate = () => ({
  async action(name, args, ctx) {
    if (name === "status") return state(ctx);
    if (name === "discover") return discover();
    if (name === "restore-assets") return restoreAssets(ctx);
    if (name === "install") {
      if (Object.keys(args).length !== 1 || typeof args.model !== "string") throw Error("Choose a reviewed model.");
      return startInstallation(args.model);
    }
    if (name === "cancel-install") return cancelInstallation();
    if (name === "assign") {
      const value = validateAssignments(args), root = await storage(ctx);
      await mkdir3(root, { recursive: true });
      const temp = path3.join(root, `assignments-${randomUUID3()}.tmp`);
      await writeFile2(temp, JSON.stringify(value));
      await rename2(temp, path3.join(root, "assignments.json"));
      return value;
    }
    throw Error("Unknown Local Models action.");
  },
  async tool(name, args, ctx) {
    if (name === "status") return state(ctx);
    if (name === "assets") return retainedAssets(ctx);
    if (name === "inspect-use") {
      if (Object.keys(args).some((key) => key !== "id")) throw Error("Unknown inspection argument.");
      return inspectUse(ctx, args.id);
    }
    if (name === "verify-use") {
      if (Object.keys(args).some((key) => !["id", "inspectionId", "note"].includes(key))) throw Error("Unknown verification argument.");
      return verifyUse(ctx, args);
    }
    if (name === "retrieve") {
      if (Object.keys(args).some((key) => key !== "id")) throw Error("Unknown retrieval argument.");
      return retrieve(ctx, args.id);
    }
    if (name === "generate-model") return generateModel(args, ctx);
    return generate(name, args, ctx);
  }
});
export {
  activate,
  requestFor
};
