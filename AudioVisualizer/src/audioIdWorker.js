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
        //title = version + " ";
        if(version == 2 || version == 3){
            // TODO adjust for extended header size (though my sample of MP3's contains no extended headers)
            let frameStart = 10;
            var info = getAllFrameHeaders(viewOfData, frameStart, frameStart + headerSize, version, usesUnSync);
            if(info["TIT2"]){
                title = info["TIT2"].data;
            }else if(info["TT2"]){
                title = info["TT2"].data;
            }else if(info["TOFN"]){
                title = info["TOFN"].data;
            }else if(info["TOF"]){
                title = info["TOF"].data;
            }
            //postMessage(JSON.stringify(info))
            
            //postMessage(bytesToHexString(viewOfData, 0, headerSize + frameStart));
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
        size = size << 7;
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
 * @param {number} frameVersion
 * @param {boolean} usesUnSync
 */
function getFrameSize(data, frameStart, frameVersion, usesUnSync){
    var size = 0;
    if(frameVersion == 3){
        
        for(var i = frameStart + 4; i < frameStart + 8; i++){
            size = size << 8;
            size += data[i];
        }
    }else if (frameVersion == 2){
        for(var i = frameStart + 3; i < frameStart + 6; i++){
            size = size << 8;
            size += data[i];
        }
    }
    return size;
}

/**
 * @param {Uint8Array} data
 * @param {number} start
 * @param {number} length
 * @param {boolean} usesUnSync
 */
function decodeTextFrameData(data, start, length, usesUnSync){
    var result = "";
    var _16Bit = 0x01 == data[start];
    if(!_16Bit){
        for(var i = 1; i < length; i++){
            if(data[i + start] == 0x00){
                // Break on Null character
                break;
            }
            result += String.fromCharCode(data[i + start]);
        }
    }else{
        var byteOrder = (data[start + 2] << 8) + data[start + 1]
        if(byteOrder == 0xFEFF){
            for(var i = 3; i + 1 < length; i += 2){
                if ((data[start + 1 + i] << 8) + data[start + i] == 0x0000){
                    // Break on Null character
                    break;
                }
                result += String.fromCharCode((data[start + 1 + i] << 8) + data[start + i]);
            }
        }else if (byteOrder == 0xFFFE){
            for(var i = 3; i + 1 < length; i += 2){
                if ((data[start + 1 + i] << 8) + data[start + i] == 0x0000){
                    // Break on Null character
                    break;
                }
                result += (data[start + i] << 8) + data[start + i + 1];
            }
        }
    }
    return result;
}

function getByteAsHex(value) {
    var str = "";

    var num = value.toString(16);

    while(num.length < 2){
        num = "0" + num;
    }

    str += num;
    
    return str;
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


const DESIRED_FRAMES = [
    "TAL","TCM","TOA","TOF","TOL","TP1","PIC","TT2","TT3","TOF",
    "APIC","TCOM","TIT2","TIT3","TOAL","TOFN","TOLY","TOPE","TOFN"]
/**
 * @param {Uint8Array} data
 * @param {number} frameStart
 * @param {number} headerEnd
 * @param {boolean} usesUnSync
 */
function getAllFrameHeaders(data, frameStart, headerEnd, tagVersion, usesUnSync){
    var offset = frameStart;
    var headers = {};
    while(offset < data.length && offset < headerEnd){
        var frameID = getFrameID(data, offset);
        var frameVersion = detectFrameVersion(frameID);
        if(frameVersion == 2){
            frameID = frameID.substring(0, 3);
        }
        var frameTagSize = 10;

        if(tagVersion == 2){
            frameTagSize = 6;
        }
        var frameSize = getFrameSize(data, offset, tagVersion, usesUnSync);
        // Only Decode Text frames as text
        if (DESIRED_FRAMES.includes(frameID) && frameID[0] == "T"){
            headers[frameID] = {start:offset, size:frameSize, data:decodeTextFrameData(data, offset + frameTagSize, frameSize, usesUnSync)};
        }
        offset += frameSize + frameTagSize;
    }
    return headers;

}

/**
 * 
 * @param {Uint8Array} data 
 * @param {*} start 
 * @param {*} length 
 */
function bytesToHexString(data, start, length){
    var str = "";
    for(var i = start; i < start + length; i ++){
        var num = data[i].toString(16);

        while(num.length < 2){
            num = "0" + num;
        }

        str += num + " '" + String.fromCharCode(data[i]) + "' ";
    }
    return str;
}

function detectFrameVersion(frameTitle){
    // Because versions have been smashed together some how, we need a way to detect the frame's version
    if (frameTitle[3] == "\u0000"){
        return 2;
    }else{
        return 3;
    }
}
