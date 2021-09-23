//@ts-check

onmessage = function(e){
    var reqId = e.data[0];
    var viewOfData = new Uint8Array(e.data[1]);
    var title = "";
    var imgSrc = "";
    var artist = "";

    // Check for meta Data
    if(hasMetaData(viewOfData)){
        
        // Major version is stored in the 4th byte
        let version = viewOfData[3];
        // Stored in the most significant bit of byte 5
        let usesUnSync = (viewOfData[5] & 0b10000000) == 0b10000000;
        // Stored in bit 6 of byte 5
        let extendedHeader = (viewOfData[5] & 0b01000000) == 0b01000000;

        let headerSize = getTagSize(viewOfData);
        // We are currently decoding for id3v2.3.0 see https://id3.org/d3v2.3.0
        title = version + " ";
        if(version == 3){
            // TODO adjust for extended header size (though my sample of MP3's contains no extended headers)
            let frameStart = 10;
            var info = getAllFrameHeaders(viewOfData, frameStart, frameStart + headerSize, usesUnSync);
            if(info["TIT2"]){
                title = "Retrieved Title: " + info["TIT2"].data;
            }else if(info["TOFN"]){
                title = "Retrieved Title(og file name): " + info["TOFN"].data;
            }
            postMessage(JSON.stringify(info))
        }
        
    }
    
    postMessage([reqId, title, imgSrc, artist]);
}

/**
 * @param {Uint8Array} data 
 */
function hasMetaData(data){
    // Check that the file actually has the data before checking
    if(data.length > 10){
        // Look for "ID3" file header present
        if(data[0] == 0x49 && data[1] == 0x44 && data[2] == 0x33){
            return true;
        }
    }  

    return false;
}

/**
 * @param {Uint8Array} data
 */
function getTagSize(data){
    // This data starts with byte 6 and goes for 4 bytes, each only containing 7 bits of the full size
    var size = 0;
    for(var i = 6; i < 10; i++){
        size << 7;
        size += data[i];
    }
    return size;
}

/**
 * @param {Uint8Array} data
 * @param {number} frameStart
 */
function getFrameID(data, frameStart){
    var result = String.fromCharCode(data[frameStart], data[frameStart+1], data[frameStart+2], data[frameStart+3]);
    return result;
}

/**
 * @param {Uint8Array} data
 * @param {number} frameStart
 * @param {boolean} usesUnSync
 */
function getFrameSize(data, frameStart, usesUnSync){
    var size = 0;
    for(var i = frameStart + 4; i < frameStart + 8; i++){
        size << 8;
        size += data[i];
    }
    return size;
}

/**
 * @param {Uint8Array} data
 * @param {number} start
 * @param {number} length
 * @param {boolean} usesUnSync
 */
function getDataAsString(data, start, length, usesUnSync){
    var result = "";
    for(var i = 0; i < length; i++){
        result += String.fromCharCode(data[i + start]);
    }
    return result;
}

/**
 * @param {Uint8Array} data
 * @param {number} start
 * @param {number} length
 */
function getDataBytesAsString(data, start, length){
    var result = "";
    for(var i = 0; i < length; i++){
        result += data[i + start].toString(16) + " ";
    }
    return result;
}



/**
 * @param {Uint8Array} data
 * @param {number} frameStart
 * @param {number} headerEnd
 * @param {boolean} usesUnSync
 */
function getAllFrameHeaders(data, frameStart, headerEnd, usesUnSync){
    var offset = frameStart;
    var headers = {};
    while(offset < data.length && offset < headerEnd){
        var frameID = getFrameID(data, offset);
        var frameSize = getFrameSize(data, offset, usesUnSync);
        headers[frameID] = {start:offset, size:frameSize, data:getDataAsString(data, offset + 10, frameSize, usesUnSync)};
        offset += frameSize + 10;
    }
    return headers;

}
