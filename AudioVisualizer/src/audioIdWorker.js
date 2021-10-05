//@ts-check

onmessage = function(e){
    var reqId = e.data[0];
    var viewOfData = new Uint8Array(e.data[1]);
    //postMessage(getBasicText(viewOfData, 0, viewOfData.length, false))
    var title = "";
    var imgSrc = "";
    var artist = "";

    // Check for meta Data
    if(hasMetaData(viewOfData)){
        
        // Major version is stored in the 4th byte
        let majorVersion = viewOfData[3];
        // Stored in the most significant bit of byte 5
        let usesUnSync = getFlag(viewOfData[5], 7);
        let extendedHeader = false;
        let isCompressed = false;
        if(majorVersion == 2){
            isCompressed = getFlag(viewOfData[5], 6);
        }else if(majorVersion == 3 || majorVersion == 4){
            extendedHeader = getFlag(viewOfData[5], 6);
        }

        let totalID3HeaderSize = getTagSize(viewOfData);
        let startOfFrames = 10;


        // We are currently decoding for id3v2.3.0 see https://id3.org/d3v2.3.0
        //title = version + " ";
        if(majorVersion == 2 || majorVersion == 3 || majorVersion == 4){
            // TODO adjust for extended header size (though my sample of MP3's contains no extended headers)
            
            var info = getAllFrameHeaders(viewOfData, startOfFrames, startOfFrames + totalID3HeaderSize, majorVersion, usesUnSync);
            
            //postMessage(JSON.stringify(info))
            if(info["TIT2"]){
                title = info["TIT2"].data;
            }else if(info["TT2"]){
                title = info["TT2"].data;
            }else if(info["TOFN"]){
                title = info["TOFN"].data;
            }else if(info["TOF"]){
                title = info["TOF"].data;
            }
           
            if(info["PIC"] != null){
                //
                var selPic = 0;
                if(info["PIC"].length > 1){
                    for(var i = 0; i < info["PIC"].length; i++){
                        // Select a picture that is the album cover if possible
                        if(info["PIC"][i].type == 0x03){
                            selPic = i;
                            break;
                        }
                    }
                }
                imgSrc = info["PIC"][selPic].src;
            //title += `(${majorVersion},${info["PIC"][selPic].hv},${info["PIC"][selPic].type})`//Used for debugging images
            }
            
            
        }
        //postMessage(btoa(getBasicText(viewOfData, 0, headerSize + frameStart, false)));
    }
    
    postMessage([reqId, title, imgSrc, artist]);
}

/**
 * Detects if an ID3 tag is present
 * @param {Uint8Array} data 
 * @returns {boolean} True if an ID3 tag header is present
 */
function hasMetaData(data){
    // Check that the file actually has data before checking
    if(data.length > 10){
        // Look for "ID3" file header present
        if(data[0] == 0x49 && data[1] == 0x44 && data[2] == 0x33){
            return true;
        }
    }  
    return false;
}

/**
 * Retrieves the entire size of the ID3 tag
 * @param {Uint8Array} data The data stream
 * @returns {number} The number of bytes the ID3 tags occupies
 */
function getTagSize(data){
    // This data starts with byte 6 and goes for 4 bytes, each only containing 7 bits of the full size of the tag
    // This is ID3 version independent
    var size = 0;
    for(var i = 6; i < 10; i++){
        size = size << 7;
        size += data[i];
    }
    return size;
}

/**
 * Obtains the tag or id of a frame at the given start position
 * @param {Uint8Array} data The Data stream
 * @param {number} frameStart The starting byte of the frame
 * @param {number} tagVersion The Major version of the ID3 tag
 * @returns {String} The frame's tag
 */
function getFrameID(data, frameStart, tagVersion){
    var result = "";
    if(tagVersion == 3 || tagVersion == 4){
        // Version 3 and 4 tags are 4 bytes long (even legacy 3 byte tags get a null character tacked onto the end)
        result = String.fromCharCode(data[frameStart], data[frameStart+1], data[frameStart+2], data[frameStart+3]);
    }else if(tagVersion == 2){
        // Version 2 only has 3 bytes
        result = String.fromCharCode(data[frameStart], data[frameStart+1], data[frameStart+2]);
    }
    return result;
}

/**
 * Retrieves the size of the frame at the given start position in the data stream
 * @param {Uint8Array} data The Data stream
 * @param {number} frameStart The starting byte of the frame
 * @param {number} tagVersion The Major version of the ID3 tag
 * @param {boolean} usesUnSync True if a desync schem was used
 * @returns {number} The size in bytes of the frame not including the header
 */
function getFrameSize(data, frameStart, tagVersion, usesUnSync=false){
    var size = 0;
    if(tagVersion == 3){
        // Version 3 stores this data on bytes 4, 5, 6, and 7 from the frame's start (with the first 4 being from the frame's tag)
        for(var i = frameStart + 4; i < frameStart + 8; i++){
            size = size << 8;
            size += data[i];
        }
    }else if(tagVersion == 4){
        // Version 4 stores this data on bytes 4, 5, 6, and 7 similary to version 3 but only on bits 6-0 of each byte
        for(var i = frameStart + 4; i < frameStart + 8; i++){
            size = size << 7;
            size += data[i];
        }
    }else if (tagVersion == 2){
        // Version 2 stores this data on bytes 3, 4, and 5 since the frame's tag is only 3 bytes long.
        for(var i = frameStart + 3; i < frameStart + 6; i++){
            size = size << 8;
            size += data[i];
        }
    }
    return size;
}

/**
 * Retrieves text data from a frame starting with the text encoding
 * @param {Uint8Array} data The Data Stream
 * @param {number} start The byte of data the text begins with
 * @param {number} length The maximum length of bytes to scan
 * @param {boolean} usesUnSync True if the desync format is used.
 * @returns {String} The string of data that was recoverd
 */
function decodeTextFrameData(data, start, length, usesUnSync){
    // var strRet = getBasicText(data, start, length, false);
        
    // postMessage(strRet);
    // var hexResp = ""
    // for(var i = start; i < start + length; i ++){
    //     hexResp += getByteAsHex(data[i]) + " ";
    // }
    // postMessage(hexResp);
    var result = "";
    var _16Bit = 0x01 == data[start] || 0x02 == data[start];
    var utf8 = 0x03 == data[start];
    if(!_16Bit && !utf8){
        for(var i = 1; i < length; i++){
            if(data[i + start] == 0x00){
                // Break on Null character
                break;
            }
            result += String.fromCharCode(data[i + start]);
        }
    } else if(utf8){
        for(var i = 1; i < length; i++){
            if(data[i + start] == 0x00){
                // Break on Null character
                break;
            }
            
            var codePoint = 0;
            if(data[i + start] >= 0b11110000){
                //4 byte character
                codePoint = data[i + start] & 0b00000111;
                codePoint = codePoint << 6;
                codePoint += data[i + start + 1] & 0b00111111;
                codePoint = codePoint << 6;
                codePoint += data[i + start + 2] & 0b00111111;
                codePoint = codePoint << 6;
                codePoint += data[i + start + 3] & 0b00111111;
                i += 3;
            }else if(data[i + start] >= 0b11100000){
                //3 byte character
                codePoint = data[i + start] & 0b00001111;
                codePoint = codePoint << 6;
                codePoint += data[i + start + 1] & 0b00111111;
                codePoint = codePoint << 6;
                codePoint += data[i + start + 2] & 0b00111111;
                i += 2;
            }else if(data[i + start] >= 0b11000000){
                //2 byte character
                codePoint = data[i + start] & 0b00011111;
                codePoint = codePoint << 6;
                codePoint += data[i + start + 1] & 0b00111111;
                i += 1;
            }else{
                // singlye byte character
                codePoint = data[i + start];
            }
            result += String.fromCharCode(codePoint);
        }
    }else{
        var byteOrder = (data[start + 2] << 8) + data[start + 1];
        var offset = 2;
        if(0x02 == data[start]){
            byteOrder = 0xFFFE;
            offset = 0;
        }
        if(byteOrder == 0xFEFF){
            for(var i = offset + 1; i + 1 < length; i += 2){
                if ((data[start + 1 + i] << 8) + data[start + i] == 0x0000){
                    // Break on Null character
                    break;
                }
                result += String.fromCharCode((data[start + 1 + i] << 8) + data[start + i]);
            }
        }else if (byteOrder == 0xFFFE){
            for(var i = offset + 1; i + 1 < length; i += 2){
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

/**
 * Converts each byte in the data stream into a unicode character reguardless of if it is a valid character or not
 * @param {Uint8Array} data The data stream
 * @param {number} start The starting byte to read from
 * @param {number} length The maximum number of bytes of the stream to scan
 * @param {boolean} nullTerminate If the string shoud terminate on a null character this is set to true (default is true)
 * @returns {String} The bytes converted into a string
 */
function getDataStreamAsString(data, start, length, nullTerminate=true){
    var str = "";
    for(var i = start; i < start + length; i++){
        if(data[i] == 0x00 && nullTerminate){
            break;
        }
        str += String.fromCharCode(data[i]);
    }
    return str;
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

/**
 * Gets a flag of a certain position of a byte, note most significant bit is at position 7
 * @param {number} byte 
 * @param {number} flagNumber 
 * @returns {boolean} The requested flag
 */
function getFlag(byte, flagNumber){
    return (byte >> flagNumber & 0b1) == 1;
}

/**
 * Converts a numerical value to its 2 character Hexidecimal equivelent. Used for debugging only!
 * @param {number} value 
 * @returns {String} 2 character hexidecimal string of the value given (255 would retrun "FF")
 */
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
 * Determines if the frame's id is from version 2 or version 3 specification.
 * @param {String} frameTitle 
 * @returns {number} Returns 2 or 3 based on the determined version
 */
 function detectFrameVersion(frameTitle){
    // Because versions have been smashed together some how, we need a way to detect the frame's version
    if (frameTitle.length == 3 || frameTitle[3] == "\u0000"){
        return 2;
    }else{
        return 3;
    }
}

/**
 * Extracts image information from an image frame of a given version
 * @param {Uint8Array} data The data Stream
 * @param {Number} frameStart The starting byte of the frame (starting from the begining of the frame header)
 * @param {Number} frameLength The length of the frame data
 * @param {Number} tagVersion The ID3 rag major version
 * @param {Number} frameVersion The version the frame is from
 * @returns {{type:Number, src:String, hv:number}} Returns the reported type (not format) of image, a source string (hyperlink if external, base64 image string if local), and the version of frame (for debugging)
 */
function decodePictureFrameData(data, frameStart, frameLength, tagVersion, frameVersion){
    // Returns image url as well as type
    // var frameCompressed = (data[frameStart + 9] & 0b00001000) == 0b00001000; 
    // if(frameCompressed){
    //     postMessage("Image Compressed")
    // }
    var frameHeaderSize = 10;
    if(tagVersion == 2){
        // Frame headers are only 6 bytes with tag version 2
        frameHeaderSize = 6;
    }
    if(frameVersion == 2 && tagVersion == 2){
        // Everything is in the old format, how we like it
        // Image format is either -->, PNG, or JPG for version 2
        var imageFormat = String.fromCharCode(data[frameStart + frameHeaderSize + 1], data[frameStart + frameHeaderSize + 2], data[frameStart + frameHeaderSize +3]);
        var textEncoding = data[frameStart + frameHeaderSize];
        var pictureType = data[frameStart + frameHeaderSize + 4];
        var imageDataStart = frameStart + frameHeaderSize + 5;//Note this starts out pointing to Description, we will pass these bytes to get the true image data start

        // Advance past the null terminated image discription to get to the good stuff
        if(textEncoding == 0x00){
            // Single byte encoding
            while(data[imageDataStart] != 0x00 && imageDataStart < frameStart + frameLength){
                imageDataStart ++;
            }
            // Jump over the null terminating byte
            imageDataStart ++;
        }else{
            // Double byte encoding
            while(!(data[imageDataStart] == 0x00 && data[imageDataStart + 1] == 0x00) && imageDataStart + 1 < frameStart + frameLength){
                imageDataStart += 2;
            }
            // Jump over the null terminating bytes
            imageDataStart += 2;
        }

        if(imageFormat == "-->"){
            // Image is external link so just return it
            return {type:pictureType, src:getDataStreamAsString(data, imageDataStart, frameLength - (imageDataStart - frameStart), false), hv:frameVersion};
        }
        else if (imageFormat == "PNG"){
            // Image is a PNG file
            var base64Header = "data:image/png;base64,";
            var rawData = getDataStreamAsString(data, imageDataStart, frameLength - (imageDataStart - frameStart), false);
            // btoa converts the raw data stream into a base 64 stream, combine this with our header and we have a source to use for an image element
            var encodedData = base64Header + btoa(rawData);
            return {type:pictureType, src:encodedData, hv:frameVersion};
        }
        else if (imageFormat == "JPG"){
             // Image is a JPG file
            var base64Header = "data:image/jpeg;base64,";
            var rawData = getDataStreamAsString(data, imageDataStart, frameLength - (imageDataStart - frameStart), false);
            // btoa converts the raw data stream into a base 64 stream, combine this with our header and we have a source to use for an image element
            var encodedData = base64Header + btoa(rawData);
            return {type:pictureType, src:encodedData, hv:frameVersion};
        }
        // Return an empty src if the image type was not valid
        return {type:pictureType, src:"", hv:frameVersion};
    } else if((tagVersion == 3 || tagVersion == 4) && frameVersion == 2){
        // Legacy frame in version 3 and 4
        // Not everything is in the old format, and some have an odd difference with how they terminate the empty descriptor
        // Image format is either -->, PNG, or JPG for version 2
        var imageFormat = String.fromCharCode(data[frameStart + frameHeaderSize + 1], data[frameStart + frameHeaderSize + 2], data[frameStart + frameHeaderSize +3]);
        var textEncoding = data[frameStart + frameHeaderSize];
        var pictureType = data[frameStart + frameHeaderSize + 4];
        var imageDataStart = frameStart + frameHeaderSize + 5;//Note this starts out pointing to Description, we will pass these bytes to get the true image data start

        // Advance past the null terminated image discription to get to the good stuff
        if(textEncoding == 0x00){
            // Single byte encoding
            while(data[imageDataStart] != 0x00 && imageDataStart < frameStart + frameLength){
                imageDataStart ++;
            }
            // Jump over the null terminating byte
            imageDataStart ++;
        }else{
            // Double byte encoding
            while(!(data[imageDataStart] == 0x00 && data[imageDataStart + 1] == 0x00) && imageDataStart + 1 < frameStart + frameLength){
                imageDataStart += 2;
            }
            // Jump over the null terminating bytes
            imageDataStart += 2;
        }

        // Check for a possible extra null byte on some of these updated image tags. 
        if(data[imageDataStart] == 0x00){
            imageDataStart ++;
        }

        //var strRet = getDataStreamAsString(data, frameStart, imageDataStart - frameStart + 3, false);
    
        //  postMessage(strRet);
        //   var hexResp = ""
        //   for(var i = frameStart; i < imageDataStart + 3; i ++){
        //       hexResp += getByteAsHex(data[i]) + " ";
        //   }
        //   postMessage(hexResp);

        if(imageFormat == "-->"){
            // Image is external link so just return it
            return {type:pictureType, src:getDataStreamAsString(data, imageDataStart, frameLength - (imageDataStart - frameStart), false), hv:frameVersion};
        }
        else if (imageFormat == "PNG"){
            // Image is a PNG file
            var base64Header = "data:image/png;base64,";
            var rawData = getDataStreamAsString(data, imageDataStart, frameLength - (imageDataStart - frameStart), false);
            // btoa converts the raw data stream into a base 64 stream, combine this with our header and we have a source to use for an image element
            var encodedData = base64Header + btoa(rawData);
            return {type:pictureType, src:encodedData, hv:frameVersion};
        }
        else if (imageFormat == "JPG"){
             // Image is a JPG file
            var base64Header = "data:image/jpeg;base64,";
            var rawData = getDataStreamAsString(data, imageDataStart, frameLength - (imageDataStart - frameStart), false);
            // btoa converts the raw data stream into a base 64 stream, combine this with our header and we have a source to use for an image element
            var encodedData = base64Header + btoa(rawData);
            return {type:pictureType, src:encodedData, hv:frameVersion};
        }
        // Return an empty src if the image type was not valid
        return {type:pictureType, src:"", hv:frameVersion};
    }
    else if((tagVersion == 4 || tagVersion == 3) && frameVersion == 3){
        
        // Despite only having a frame version 2 name, these tags are actually version 3 so yeah...
        var textEncoding = data[frameStart + frameHeaderSize];
        var imageFormat = getDataStreamAsString(data, frameStart + frameHeaderSize + 1, frameLength - (frameHeaderSize + 1));
        var pictureType = data[frameStart + frameHeaderSize + 2 + imageFormat.length];
        var imageDataStart = frameStart + frameHeaderSize + 3 + imageFormat.length;//Note this starts out pointing to Description, we will pass these bytes to get the true image data start
       
        // Forward through the description looking for the null terminated character. 
        if(textEncoding == 0x00  || textEncoding == 0x03){
            // Text encodings 0 and 3 are single byte
            while(data[imageDataStart] != 0x00 && imageDataStart < frameStart + frameLength){
                imageDataStart ++;
            }
            imageDataStart ++;
        }else{
            // Text encodings 1 and 2 are double byte
            while(!(data[imageDataStart] == 0x00 && data[imageDataStart + 1] == 0x00) && imageDataStart + 1 < frameStart + frameLength){
                imageDataStart += 2;
            }
            imageDataStart += 2;
        }

        //var strRet = getDataStreamAsString(data, frameStart, imageDataStart - frameStart + 3, false);
        
        // postMessage(strRet);
        //  var hexResp = ""
        //  for(var i = frameStart; i < imageDataStart + 3; i ++){
        //      hexResp += getByteAsHex(data[i]) + " ";
        //  }
        //  postMessage(hexResp);

        if(imageFormat == "-->"){
            // Image is external link
            return {type:pictureType, src:getDataStreamAsString(data, imageDataStart, frameLength - (imageDataStart - frameStart), false), hv:frameVersion};
        }else{
            // format should be the MIME type
            var base64Header = `data:${imageFormat};base64,`
            var rawData = getDataStreamAsString(data, imageDataStart, frameLength - (imageDataStart - frameStart), false);
            var encodedData = base64Header + btoa(rawData);
            return {type:pictureType, src:encodedData, hv:frameVersion};
        }
    }

    return {type:pictureType, src:"", hv:frameVersion};

}

const DESIRED_FRAMES = [
    "TAL","TCM","TOA","TOF","TOL","TP1","PIC","TT2","TT3","TOF",
    "APIC","TCOM","TIT2","TIT3","TOAL","TOFN","TOLY","TOPE","TOFN"]
/**
 * Gathers desired frames from ID3 tag and returns them in a single object using the frame tag as an id
 * @param {Uint8Array} data The stream of data
 * @param {number} startOfFrames The start byte of the first frame
 * @param {number} endOfFrames The last byte of the last frame
 * @param {number} tagVersion The ID3 major version
 * @param {boolean} usesUnSync Set to true if a desync format is used
 * @returns {{}} Returns an object where each sub object is found based on the desired frame name. EX obj["TAL"] would return an object relating to the TAL frame
 */
function getAllFrameHeaders(data, startOfFrames, endOfFrames, tagVersion, usesUnSync){
    // Looks for desired frames (stored in DESIRED_FRAMES) and stores them for later use by name.
    var currentFrameOffset = startOfFrames;
    var headers = {};

    while(currentFrameOffset < data.length && currentFrameOffset < endOfFrames){
        // Loop untill we have hit either the end of the frames, or end of the file (which should not happen but just in case...)
        var frameID = getFrameID(data, currentFrameOffset, tagVersion);
        var frameVersion = detectFrameVersion(frameID);

        if(frameVersion == 2){
            frameID = frameID.substring(0, 3);
        }

        var frameHeaderSize = 10;

        if(tagVersion == 2){
            // Frame Headers in version 2 were only 6 bytes.
            frameHeaderSize = 6;
        }

        var frameSize = getFrameSize(data, currentFrameOffset, tagVersion, usesUnSync);
        // Only Decode Text frames as text
        if ((DESIRED_FRAMES.includes(frameID) && frameID[0] == "T")){
            headers[frameID] = {start:currentFrameOffset, size:frameSize, data:decodeTextFrameData(data, currentFrameOffset + frameHeaderSize, frameSize, usesUnSync)};
        }else if(frameID == "APIC" || frameID == "PIC"){
            if(!headers["PIC"]){
               headers["PIC"] = [];
            }
           headers["PIC"].push(decodePictureFrameData(data, currentFrameOffset, frameSize + frameHeaderSize, tagVersion, frameVersion));
           //postMessage("PICTURE")
        }
        currentFrameOffset += frameSize + frameHeaderSize;
    }
    return headers;

}

