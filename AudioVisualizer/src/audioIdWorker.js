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
        let frameStart = 10;
        // We are currently decoding for id3v2.3.0 see https://id3.org/d3v2.3.0
        //title = version + " ";
        if(version == 2 || version == 3 || version == 4){
            // TODO adjust for extended header size (though my sample of MP3's contains no extended headers)
            
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
           
            if(info["PIC"]){
                //
                var selPic = 0;
                if(info["PIC"].length > 1){
                    for(var i = 0; i < info["PIC"].length; i++){
                        // Select a picture that matches its version, they vary less often when updated
                        if(info["PIC"][i].hv == version){
                            selPic = i;
                        }
                    }
                }
                imgSrc = info["PIC"][selPic].src;
            //postMessage(JSON.stringify(info["PIC"][0]))
            //title += `(${version},${info["PIC"][selPic].hv})`
            }
            
            
        }
        postMessage(btoa(bytesToHexString(viewOfData, 0, headerSize + frameStart)));
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

function getBasicText(data, start, length, nullTerminate=true){
    var str = "";
    for(var i = start; i < start + length; i++){
        if(data[i] == 0x00 && nullTerminate){
            break;
        }
        str += String.fromCharCode(data[i]);
    }
    return str;
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
 * 
 * @param {Uint8Array} data 
 * @param {Number} frameStart 
 * @param {Number} frameLength 
 * @param {Number} tagVersion
 * @param {Number} frameVersion 
 */
function decodePictureFrameData(data, frameStart, frameLength, tagVersion, frameVersion){
    // Returns image url as well as type
    var frameHeaderSize = 10;
    if(tagVersion == 2){
        frameHeaderSize = 6;
    }
    if(frameVersion == 2 && tagVersion == 2){
        var format = String.fromCharCode(data[frameStart + frameHeaderSize + 1], data[frameStart + frameHeaderSize + 2], data[frameStart + frameHeaderSize +3]);
        var textEncoding = data[frameStart + frameHeaderSize];
        var pictureType = data[frameStart + frameHeaderSize + 4];
        var imageDataStart = frameStart + frameHeaderSize + 5;//Note this starts out pointing to Description, we will pass these bytes to get the true image data start

        if(textEncoding == 0x00){
            while(data[imageDataStart] != 0x00 && imageDataStart < frameStart + frameLength){
                imageDataStart ++;
            }
            imageDataStart ++;
        }else{
            while(!(data[imageDataStart] == 0x00 && data[imageDataStart + 1] == 0x00) && imageDataStart + 1 < frameStart + frameLength){
                imageDataStart += 2;
            }
            imageDataStart += 2;
        }

        if(format == "-->"){
            // Image is external link
            return {type:pictureType, src:getBasicText(data, imageDataStart, frameLength - (imageDataStart - frameStart), false)};
        }else if (format == "PNG"){
            var base64Header = "data:image/png;base64,"
            var rawData = getBasicText(data, imageDataStart, frameLength - (imageDataStart - frameStart), false);
            var encodedData = base64Header + btoa(rawData);
            return {type:pictureType, src:encodedData, hv:frameVersion};
        } else if (format == "JPG"){
            var base64Header = "data:image/jpeg;base64,"
            var rawData = getBasicText(data, imageDataStart, frameLength - (imageDataStart - frameStart), false);
            var encodedData = base64Header + btoa(rawData);
            return {type:pictureType, src:encodedData, hv:frameVersion};
        }
        return {type:pictureType, src:"", hv:frameVersion};
    } 
    else if(frameVersion == 4 || frameVersion == 3 || frameVersion == 2){
        
        // Despite only having a frame version 2 name, these tags are actually version 3 so yeah...
        var textEncoding = data[frameStart + frameHeaderSize];
        var format = getBasicText(data, frameStart + frameHeaderSize + 1, frameLength - (frameHeaderSize + 1));
        var pictureType = data[frameStart + frameHeaderSize + 2 + format.length];
        var imageDataStart = frameStart + frameHeaderSize + 3 + format.length;//Note this starts out pointing to Description, we will pass these bytes to get the true image data start
       

        if(textEncoding == 0x00){
            while(data[imageDataStart] != 0x00 && imageDataStart < frameStart + frameLength){
                imageDataStart ++;
            }
            imageDataStart ++;
        }else{
            while(!(data[imageDataStart] == 0x00 && data[imageDataStart + 1] == 0x00) && imageDataStart + 1 < frameStart + frameLength){
                imageDataStart += 2;
            }
            imageDataStart += 2;
        }

       // var strRet = getBasicText(data, frameStart, imageDataStart - frameStart + 3, false);
        
        //postMessage(strRet);
        // var hexResp = ""
        // for(var i = frameStart; i < imageDataStart + 3; i ++){
        //     hexResp += getByteAsHex(data[i]) + " ";
        // }
        // postMessage(hexResp);

        if(format == "-->"){
            // Image is external link
            return {type:pictureType, src:getBasicText(data, imageDataStart, frameLength - (imageDataStart - frameStart), false), hv:frameVersion};
        }else{
            var base64Header = `data:${format};base64,`
            var rawData = getBasicText(data, imageDataStart, frameLength - (imageDataStart - frameStart), false);
            var encodedData = base64Header + btoa(rawData);
            return {type:pictureType, src:encodedData, hv:frameVersion};
        }
    }

}

/**
 * @param {Uint8Array} data
 * @param {number} start
 * @param {number} length
 */
function getDataBytesInString(data, start, length){
    // Used to get image data to a string
    var result = "";
    for(var i = 0; i < length; i++){
        result += String.fromCharCode(data[i + start]);
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
        var frameHeaderSize = 10;

        if(tagVersion == 2){
            frameHeaderSize = 6;
        }

        var frameSize = getFrameSize(data, offset, tagVersion, usesUnSync);
        // Only Decode Text frames as text
        if (DESIRED_FRAMES.includes(frameID) && frameID[0] == "T"){
            headers[frameID] = {start:offset, size:frameSize, data:decodeTextFrameData(data, offset + frameHeaderSize, frameSize, usesUnSync)};
        }else if(frameID == "APIC" || frameID == "PIC"){
            if(!headers["PIC"]){
                headers["PIC"] = [];
            }
            headers["PIC"].push(decodePictureFrameData(data, offset, frameSize + frameHeaderSize, tagVersion, frameVersion));
        }
        offset += frameSize + frameHeaderSize;
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
