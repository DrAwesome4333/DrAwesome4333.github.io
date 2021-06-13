/*
    class BinaryData
    ---------------------
    - dataArray:Uint8Array
    - elementBitLength:int
    - elementCount:int
    - dataFlag:int          // not utilized by the object but useful for tagging data types
    ----------------------
    BinaryData(maxElementSize:int, data:array, elementCount:int):BinaryData
    getData(element:int):int
    setData(element:int, info:int):bool
    getMaxElementSize():int
    getArray(startElement:int, endElement:int):array[int]
    setArray(startElement:int, data:array[int]:bool
    getBitLength():int
    getElementCount():int
    getDataFlag():int
    setDataFlag(flag:int):bool
	
*/

export function BinaryData(maxElementSize = 1, data = [0], elementCount = 1, dataFlag = -1) {
    // Returns an obect used for storing binary data
    // This only can store unsigned integers inside.

    this.setData = function (elementIndex = 0, info = 0) {
        // Sets an element in the array, returns true for success, false for failure

        // Check if info is in an invalid range
        if (info > maxElementSize || info % 1 != 0 || typeof (info) != "number") {
            throw "Error: Could not set binary data, info too large or invalid. Data recived: " + info;
        }

        // Check if elementIndex is in range
        if (elementIndex >= elementCount) {
            throw "Error: Could not set binary data, Element index out of range or invalid. Data recived: " + info;
        }

        // Loop through all the bits in the info array set the coresponding bit in the data array
        for (var i = 0; i < elementBitLength; i++) {
            var byte = Math.floor((elementIndex * elementBitLength + i) / 8);
            var bit = (elementIndex * elementBitLength + i) % 8;
            var relativeByte = byte % MAX_BYTES_PER_ARRAY;
            var dataArray = dataArrays[Math.floor(byte / MAX_BYTES_PER_ARRAY)];
            dataArray[relativeByte] = changeBit(dataArray[relativeByte], bit, getBit(info, i));
        }
        return true;
    }

    this.getData = function (elementIndex = 0) {
        if (elementIndex >= elementCount || elementIndex < 0) {
            throw "Error, cannot access elements outside of array. Expected Range: 0 - " + (elementCount - 1) + " Value requested: " + elementCount;
        }
        var result = 0;
        for (var i = elementBitLength - 1; i >= 0; i--) {
            var byte = Math.floor((elementIndex * elementBitLength + i) / 8);
            var bit = (elementIndex * elementBitLength + i) % 8;
            var relativeByte = byte % MAX_BYTES_PER_ARRAY;
            var dataArray = dataArrays[Math.floor(byte / MAX_BYTES_PER_ARRAY)];
            result = result << 1;
            result += getBit(dataArray[relativeByte], bit);
        }
        return result;
    }

    this.getMaxElementSize = function () {
        return maxElementSize;
    }

    this.getBitLength = function () {
        return elementBitLength;
    }

    this.getElementCount = function () {
        return elementCount;
    }

    this.getArray = function (startElementIndex = 0, endElementIndex = elementCount - 1) {
        // Gets a list of items out of the data, can be reversed
        // Defaults to whole array
        var result = [];
        // Check if we are in bounds of the array
        if (startElementIndex < 0 || endElementIndex < 0 || startElementIndex >= elementCount || endElementIndex >= elementCount) {
            throw "Error, cannot access elements outside of array Expected Range: 0 - " + (elementCount - 1) + " Values requested: " + startElementIndex + " - " + endElementIndex;
        }
        // Check if it is reversed
        if (endElementIndex < startElementIndex) {
            for (var i = endElementIndex; i <= startElementIndex; i++) {
                result.push(this.getData(i));
            }
        } else {
            for (var i = startElementIndex; i <= endElementIndex; i++) {
                result.push(this.getData(i));
            }
        }

        return result;

    }

    this.setArray = function (startElementIndex = 0, info = [0]) {
        //Sets an array of data starting with startElement
        if (startElementIndex < 0 || startElementIndex + info.length > elementCount) {
            throw "Error, cannot set elements outside of array Expected Range: 0 - " + (elementCount - 1) + " Values sent: " + startElementIndex + " - " + (startElementIndex + info.length);
        }
        var passed = true;
        for (var i = 0; i < info.length; i++) {
            passed = this.setData(startElementIndex + i, info[i]);
            if (!passed) {
                break;
            }
        }
        return passed;

    }

    function getBit(value = 0, bit = 0) {
        // Gets a binary bit out of a number
        // We right shift value by bit places to get the bit we want in the first bit location, then we AND by 1 to leave only the first bit
        return value >>> bit & 1;
    }

    function changeBit(value = 0, bit = 0, set = 0) {
        // changes a bit in value to either set (1) or reset(0) and returns it
        // Check if no change is needed, in this case return the orignal value
        if (set === getBit(value, bit))
            return value;
        // else toggle the bit
        // We do this by getting 1, left shifting it bit times and then XOR ing it with value
        return value ^ (1 << bit);
    }

    this.getDataFlag = function () {
        return dataFlag;
    }

    this.setDataFlag = function (flag = -1) {
        dataFlag = flag;
        return true;
    }

    this.getBinaryData = function () {
        // Returns the binary data stored within the function
        // Use for debugging purposes
        return dataArrays.slice(0);
    }

    // Calculate the minimum bit length to store a number of maxElementSize
    var elementBitLength = 1;
    var valueOfPOT = 2;
    /**@type {Uint8Array[]} */
    var dataArrays = [];
    const MAX_BYTES_PER_ARRAY = 1024;
    while (valueOfPOT < maxElementSize) {
        elementBitLength++;
        valueOfPOT *= 2;
    }

    // Calculate the actual maxElement size based on the bit length we calculated recieved
    maxElementSize = valueOfPOT - 1;

    // Verify the number of elements given in elementCount is enough to hold the data, if not, take up more more data
    if (data.length > elementCount) {
        elementCount = data.length;
    }

    // Calculate the number of bytes needed to store the number of elements given
    var byteCount = Math.ceil(elementBitLength * elementCount / 8);

    // If the byteCount came out to be 1 (due to empty array and elementCount being set to 0), set it to 1
    if (byteCount == 0) {
        byteCount = 1;
    }

    // create our data array based on the byte count calcualated
    for (var i = 0; i < byteCount; i += MAX_BYTES_PER_ARRAY) {
        // Create an array of arrays to keep the data, that way it does not have to be one continous block.
        dataArrays.push(new Uint8Array(Math.min(MAX_BYTES_PER_ARRAY, byteCount - i)))
    }
    //dataArray = new Uint8Array(byteCount);

    // fill the array with data
    for (var i = 0; i < data.length; i++) {
        this.setData(i, data[i]);
    }



}