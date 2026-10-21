'use strict';

const DictionaryLoader = require('kuromoji/src/loader/DictionaryLoader');

/**
 * Browser dictionary loader that tolerates both raw .gz bytes and
 * already-decompressed responses (servers that set Content-Encoding: gzip).
 */
function BrowserDictionaryLoader(dicPath) {
  DictionaryLoader.apply(this, [dicPath]);
}

BrowserDictionaryLoader.prototype = Object.create(DictionaryLoader.prototype);
BrowserDictionaryLoader.prototype.constructor = BrowserDictionaryLoader;

BrowserDictionaryLoader.prototype.loadArrayBuffer = function loadArrayBuffer(url, callback) {
  fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error('Dictionary request failed (' + response.status + '): ' + url);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
      if (!isGzip) {
        callback(null, buffer);
        return;
      }
      const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
      callback(null, await new Response(stream).arrayBuffer());
    })
    .catch((error) => callback(error, null));
};

module.exports = BrowserDictionaryLoader;
