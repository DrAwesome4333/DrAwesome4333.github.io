//@ts-check
import { CUBE_DATA_TYPE, CUBIE_TYPE, CUBIE_STYLE, CUBE_FACE } from "./cubeconsts.js";
import { BinaryData } from "./binarydata.js";
import { CubeData } from "./cubedata.js"

var shouldLogErrors = true;

/*
    class AlgorithmStorage  This class will store several Algorithms of the same size and length in a compact format
    ------------------
    - data:BinaryData
    - algLength:int
    - algCount:int
    - cubeSize:int
    - maxAlgs:int
    ------------------
    AlgorithmStorage(cubeSize:int, algLength:int, maxAlgs:int):AlgorithmStorage
    getMoves(algId:int):array			This will return the moves as [direction * layerCount + layer,   ]
    getMovesInPairs(algId:int):array[int]    This will return the moves as [layer, direction, layer, direction]
    getAlgCount():int
    getFilter(algId:int, cubeStorageFormat:int):Filter
    selfIndex():Promise
    addAlgorithm(alg:[int]):bool
*/

/**
         * @param {number} cubeSize
         */

function AlgorithmStorage(cubeSize, algLength=1, maxAlgs=1000000) {

    this.getMoves = function (algId=0) {
        // returns moves for a certain alg in number format
        var alg = [];

        if(algCount == 0 || algLength == 0){
            return alg;
        }

        if (usesAlgSaver) {
            if (algId >= algCount * 3 || algId < 0) {
                throw "Invalid algorithm requested"
            }
            var indexInData = algId % algCount;
            var direction = Math.floor(algId / algCount);
            alg = data.getArray(indexInData * algLength, (indexInData + 1) * algLength - 1);
            alg[algLength - 1] += direction * layerCount;
        } else {
            if (algId >= algCount || algId < 0) {
                throw "Invalid algorithm requested"
            }
            alg = data.getArray(algId * algLength, (algId + 1) * algLength - 1);
        }

        return alg;
    }

    this.getMovesInPairs = function (algId=0) {
        // retunrs moves for a certain alg in pair format
        var alg = this.getMoves(algId);
        var result = [];
        const len = alg.length;
        for (var i = 0; i < len; i++) {
            result.push(alg[i] % layerCount, Math.floor(alg[i] / layerCount))
        }

        return result;
    }

    this.getMovesAsText = function (algId=0) {
        if(algLength == 0 || algCount == 0){
            return "(no algorithm)";
        }
        var moves = this.getMoves(algId);
        var key = [];
        var base = ['L', 'R', 'D', 'U', 'B', 'F', '', "'", '2', ", "];
        var result = "";
        var layerCount = AlgorithmStorage.getLayerCount(cubeSize);
        var isEven = (cubeSize % 2 == 0);
        var layersPerFace = layerCount / 6;

        // First we will create a map with the text for each move:

        for (var i = 0; i < layerCount * 3; i++) {

            var face = Math.floor(i % layerCount / layersPerFace);

            var number = i % layerCount % layersPerFace + 1;

            var direction = Math.floor(i / layerCount);
            // Since in HTM it is clock wise from the point of view of the face
            // and in our terms it is from the LDB side, we need to 
            // view a side as in reverse at times
            var shouldReverse = false;

            if (face == CUBE_FACE.Down || face == CUBE_FACE.Front || face == CUBE_FACE.Right)
                shouldReverse = true;

            if (shouldReverse)
                number = layersPerFace - i % layerCount % layersPerFace;

            var total = "";

            // In cases where we have more than one layer on each side
            if (number > 1) {
                total += number;
            }

            total += base[face];

            if ((shouldReverse && direction == 0) || (!shouldReverse && direction == 2)) {
                // Add the inverse character
                total += base[7];
            } else if (direction == 1) {
                // add the 180 character (in this case a 2)
                total += base[8];

            } else {
                // Add the clockwise character, in this case nothing
                total += base[6];
            }

            key.push(total);


        }

        for (var i = 0; i < algLength; i++) {
            // Use the map key created to build the move text.
            var move = 0;
            move = moves[i];
            result += key[move];

            if (!(i + 1 >= algLength)) {
                // Add the separator, in this case ", "
                result += base[9]
            }

        }
        return result;
    }

    this.getAlgCount = function () {
        if (usesAlgSaver)
            return algCount * 3;
        return algCount;
    }

    this.getAlgLength = function () {
        return algLength;
    }

    this.getFilter = function (algId=0, cubeStorageFormat=CUBE_DATA_TYPE.Surface) {
        if ((algId > algCount * 3 && usesAlgSaver) || (algId > algCount && !usesAlgSaver)) {
            if (shouldLogErrors) {
                console.info("Could not get correct filter, invalid algId");
            }
            return new Filter(cubeSize, cubeStorageFormat);
        }
        return new Filter(cubeSize, cubeStorageFormat, this, algId);
    }

    this.addAlgorithm = function (alg=[0]) {
        // Adds an algorithm to the set

        // Check if we still accept new algs
        if (!acceptsNewAlgs) {
            console.info("This storage no longer accepts algorithms because it was indexed");
            return false;
        }
        // Check if we recieved moves in single or pair form
        if (alg.length == algLength * 2) {
            // we recieved it in pair form so convert it to singular
            var newAlg = [];
            for (var i = 0; i < algLength; i++) {
                newAlg.push(alg[i * 2] + (alg[i * 2 + 1] * layerCount));
            }

            alg = newAlg;

        } else if (alg.length != algLength) {
            // If the alg given is not either double the alg length or the alg length, then it is an invalid value
            console.info("Invalid algorithm given");
            return false;
        }

        // If we are over the max, we need to create a new data storage
        if (algCount < maxAlgs) {
            algCount++;
            return data.setArray(algLength * (algCount - 1), alg);
        } else {
            // Increase maxAlgs by 10%
            var newData = new BinaryData(maxAcceptedValue, data.getArray(), Math.ceil(maxAlgs * 1.1));
            data = newData;
            maxAlgs = Math.ceil(maxAlgs * 1.1);
            algCount++;
            return data.setArray(algLength * (algCount - 1), alg);
        }

    }

    this.asyncSelfIndex = async function () {
        // Exactly the same as Self index, except this will take advantage of a web worker
        // TODO make this async (⓿_⓿)
        // Verify we can still index on this storage, only new empty storages are accepted
        if (algCount != 0) {
            console.info("You cannot index on pre filed algorithm storage");
            return false;
        }
        // We can use the algSaver now
        usesAlgSaver = true;

        if (true) {
            var moves = [0];
            var startingAlgorithm = [];

            function isSame(a = [], b = []) {
                // sees if two algorithms are the same
                if (a.length == b.length) {
                    const len = a.length;
                    for (var i = 0; i < len; i++) {
                        if (a[i] != b[i]) {
                            return false;
                        }
                    }
                    return true;
                }
            }

            function findNextSequence() {
                // Finds the next valid sequence returns true if we found the next one, false if there are no more
                var backIndex = 0;
                // Get the previous moves - the one we are on
                var previousMoves = moves.slice(0, moves.length - 1);
                // Get the current end move value, and increment it by 1
                var proposedMove = moves[moves.length - 1] + 1;


                function goBack() {
                    backIndex++;
                    // Have we reached the max we can go back? if so return false
                    if (backIndex > moves.length - 1) {
                        backIndex--;
                        return false;
                    }
                    var previousMoves = moves.slice(0, moves.length - (1 + backIndex));
                    var proposedMove = moves[moves.length - (1 + backIndex)] + 1;

                    while (true) {
                        // Did we over flow our with our move, if so , set our current move to 0,
                        // and go back
                        // Note that previous moves do incorporate direction into the algorithm
                        if (proposedMove >= layerCount * 3) {
                            proposedMove = 0;
                            moves[moves.length - (1 + backIndex)] = 0;
                            // Go back if we can, if we cannot, then we are done
                            var canGoOn = goBack();

                            if (!canGoOn) {
                                return false;
                            } else {
                                // update previous moves now.
                                previousMoves = moves.slice(0, moves.length - 1);
                            }
                        }
                        // Do we have a valid move?
                        if (AlgorithmStorage.checkNextMove(cubeSize, previousMoves, proposedMove)) {
                            moves[moves.length - (1 + backIndex)] = proposedMove;
                            backIndex--;
                            return true;
                            break;
                        } else {
                            // Keep on looking
                            proposedMove++;
                        }
                    }
                }

                while (true) {
                    // Did we over flow our with our move, if so , set our current move to 0,
                    // and go back
                    if (proposedMove >= layerCount) {
                        proposedMove = 0;
                        moves[moves.length - 1] = 0;
                        // Go back if we can, if we cannot, then we are done
                        var canGoOn = goBack();

                        if (!canGoOn) {
                            return false;
                            break;
                        } else {
                            previousMoves = moves.slice(0, moves.length - 1);
                            // update previous moves now
                        }
                    }
                    // Do we have a valid move?
                    if (AlgorithmStorage.checkNextMove(cubeSize, previousMoves, proposedMove)) {
                        moves[moves.length - 1] = proposedMove;
                        return true;
                        break;
                    } else {
                        // Increment the move
                        proposedMove++;
                    }
                }
            }
            // Generate the first valid sequence of moves
            while (moves.length < algLength) {
                // find the first valid move
                for (var i = 0; i < layerCount; i++) {
                    if (AlgorithmStorage.checkNextMove(cubeSize, moves, i)) {
                        moves.push(i);
                        break;
                    }

                }
            }

            startingAlgorithm = moves.slice(0); // Save this for comparing later

            while (true) {
                // Save Current Sequence
                this.addAlgorithm(moves);

                var isThereNextSequence = findNextSequence();
                if (!isThereNextSequence) {
                    // we are done
                    return true;
                    break;
                }

            }


        }

    }

    this.selfIndex = function () {
        // This will fill the Storage with algorithms that "try" to avoid repeating resulting cubes, there are no repeating cubes with in 3 moves cube.
        // Verify we can still index on this storage, only new empty storages are accepted
        if (algCount != 0) {
            console.info("You cannot index on pre filed algorithm storage");
            return false;
        }
        // We can use the algSaver now
        usesAlgSaver = true;

        var moves = [0];

        function findNextSequence() {
            // Finds the next valid sequence returns true if we found the next one, false if there are no more
            var backIndex = 0;
            // Get the previous moves - the one we are on
            var previousMoves = moves.slice(0, moves.length - 1);
            // Get the current end move value, and increment it by 1
            var proposedMove = moves[moves.length - 1] + 1;


            function goBack() {
                backIndex++;
                // Have we reached the max we can go back? if so return false
                if (backIndex > moves.length - 1) {
                    backIndex--;
                    return false;
                }
                var previousMoves = moves.slice(0, moves.length - (1 + backIndex));
                var proposedMove = moves[moves.length - (1 + backIndex)] + 1;

                while (true) {
                    // Did we overflow our with our move, if so , set our current move to 0,
                    // and go back
                    // Note that previous moves do incorporate direction into the algorithm
                    if (proposedMove >= layerCount * 3) {
                        proposedMove = 0;
                        moves[moves.length - (1 + backIndex)] = 0;
                        // Go back if we can, if we cannot, then we are done
                        var canGoOn = goBack();

                        if (!canGoOn) {
                            return false;
                        } else {
                            // update previous moves now.
                            previousMoves = moves.slice(0, moves.length - (1 + backIndex));
                        }
                    }
                    // Do we have a valid move?
                    if (AlgorithmStorage.checkNextMove(cubeSize, previousMoves, proposedMove)) {
                        moves[moves.length - (1 + backIndex)] = proposedMove;
                        backIndex--;
                        return true;
                        break;
                    } else {
                        // Keep on looking
                        proposedMove++;
                    }
                }
            }

            while (true) {
                // Did we over flow our with our move, if so , set our current move to 0,
                // and go back
                if (proposedMove >= layerCount) {
                    proposedMove = 0;
                    moves[moves.length - 1] = 0;
                    // Go back if we can, if we cannot, then we are done
                    var canGoOn = goBack();

                    if (!canGoOn) {
                        return false;
                        break;
                    } else {
                        previousMoves = moves.slice(0, moves.length - 1);
                        // update previous moves now
                    }
                }
                // Do we have a valid move?
                if (AlgorithmStorage.checkNextMove(cubeSize, previousMoves, proposedMove)) {
                    moves[moves.length - 1] = proposedMove;
                    return true;
                    break;
                } else {
                    // Increment the move
                    proposedMove++;
                }
            }
        }
        // Generate the first valid sequence of moves
        while (moves.length < algLength) {
            // find the first valid move
            // at this level we ignore the final move's direction as all would be valid
            for (var i = 0; i < layerCount; i++) {
                if (AlgorithmStorage.checkNextMove(cubeSize, moves, i)) {
                    moves.push(i);
                    break;
                }

            }
        }

        while (true) {
            // Save Current Sequence
            this.addAlgorithm(moves);


            var isThereNextSequence = findNextSequence();
            if (!isThereNextSequence) {
                // we are done
                acceptsNewAlgs = false;
                return true;
                break;
            }

        }

    }

    var algCount = 0;
    const layerCount = AlgorithmStorage.getLayerCount(cubeSize);
    var maxAcceptedValue = layerCount * 3;
    var data = new BinaryData(maxAcceptedValue, [], maxAlgs * algLength);
    // Alg saver saves memory with selfIndexed storage by removing the final move's direction, reducing the the total memory
    // consumption to 1/3 of if we saved all the algs. The final move's direction is then retrieved by looking at the algId
    // the alg can be accessed by first getting the 'base' (the alg - the final move direction) with algId % compressedAlgCount
    // and the final direction can be accessed direction = Math.floor(algId / compressedAlgCount)
    // This does not apply algorithms added one by one as, this just does not work as nicely
    var usesAlgSaver = false;
    var acceptsNewAlgs = true;
}

/**
 * @param {number} cubeSize 
 */
AlgorithmStorage.getLayerCount = function (cubeSize) {
    // Returns the number of MOVEABLE layers on the cube. For odd numbered cubes, this means
    // You can only turn the size - 1 layers as you can't turn the middle layer in this format
    return cubeSize % 2 == 0 ? cubeSize * 3 : (cubeSize - 1) * 3;
}

/**
 * @param {number} cubeSize
 * @param {number[]} previousMoves
 * @param {number} proposedNextMove
 */
AlgorithmStorage.checkNextMove = function (cubeSize, previousMoves, proposedNextMove) {
    // Checks the move sequence to see if the proposed next move does not violoate any rules.
    // Previous moves is saved as [moveId, moveId, movdId] not as [layer, direction, layer, direction]
    const layerCount = AlgorithmStorage.getLayerCount(cubeSize);
    // We do not care about move directions here, just the layer
    const proposedMoveLayer = proposedNextMove % layerCount;
    // Calculate the Plane the move operates on should result in 0(z, y), 1(x, z), or 2(x, y)
    const plane = Math.floor(proposedMoveLayer / (layerCount / 3));

    const moveLength = previousMoves.length;

    var isValid = true;

    // Check if the proposedMove is in a valid range
    if (proposedMoveLayer < 0) {
        return false;
    }

    for (var i = moveLength - 1; i >= 0; i++) {
        var pMoveLayer = previousMoves[i] % layerCount;
        var pMovePlane = Math.floor(pMoveLayer / (layerCount / 3));
        // Rule 1, the move cannot be done on the same layer as the previous one (EX, you cant do R2 just to do R' next, that cube will exist in a different branch)
        if (pMoveLayer == proposedMoveLayer) {
            isValid = false;
            break;
        } else if (pMovePlane === plane) {
            // If layers are parallel, we need to do more checking, if not, the move is valid
            // Rule 2, if two moves are parallel, we cannot go from high to low layer moves, only low to high
            // so if this move is less than the last parallel move, then we can stop it right here
            // EX: RL is the same as LR so we only keep 1 of the 2
            if (proposedMoveLayer < pMoveLayer) {
                isValid = false;
                break;
            }
            // If both of these tests passed, we continue on to the next previous move to see if this move is valid with that
            // as we need to find the first no parallel move that the move intersects to consider it unique
            continue;
        } else {
            break;
        }
    }

    return isValid;
}

/*
    class Filter
    ---------------
    - filterData:[int]
    - storageFormat:int
    - cubeSize:int
    - algId:int
    - algStorage: AlgorithmStorage
    * filterCahce:[[Filter]] Filters of the same cube size and storage format are grouped together. All are depth 1 (single moves) to construct other Filters
    ----------------
    Filter(cubeSize:int, storageFormat:int, algStorage:AlgorithmStorage, algId:int):Filter
    getFilterData():[int]
    getCubeSize():int
    getMoves():[int]
    getAlgId():int
    getStorageFormat():int
    applyFilter(cubeData:CubeData, startCube:int, endCube:int):bool
    */

/**
 * @param {number} cubeSize 
 */
function Filter(cubeSize, storageFormat=CUBE_DATA_TYPE.Surface, algStorage=new AlgorithmStorage(cubeSize, 1, 1), algId=0, fromScratch=false) {

    var filterData = Filter.createNewFilterData(cubeSize, storageFormat);

    this.getFilterData = function () {
        return filterData.slice(0);
    };

    this.getCubeSize = function () {
        return cubeSize;
    };

    this.getMoves = function () {
        return algStorage.getMoves(algId);
    };

    this.getMovesInPairs = function () {
        return algStorage.getMovesInPairs(algId);
    };

    this.getAlgId = function () {
        return algId;
    };

    this.getStorageFormat = function () {
        return storageFormat;
    };

    this.applyFilter = function (cubeData = new CubeData(), startCube = 0, endCube = startCube) {
        // Applies a filter to the specified cube data
        // Check for mis matched formating, if so, create a new filter object with the appropirate
        // type and print a warning to the console.
        if (cubeData.getStorageFormat() != storageFormat) {
            if (shouldLogErrors) {
                console.info("Warning: Mismatched cube data format and filter format, created a new filter with the correct format.\n\
						Please revise the code to avoid this slowdown. Cube format: " + cubeData.getStorageFormat() + " Filter format: " + storageFormat)
            }

            var newFilter = new Filter(cubeSize, cubeData.getStorageFormat(), algStorage, algId);
            return newFilter.applyFilter(cubeData, startCube, endCube);
        }

        switch (storageFormat) {
            case CUBE_DATA_TYPE.Surface: {
                // This format is strait forward, use the index in filterData[i] to set the destination sticker[i] with the originalData[filterData[i]]
                var originalData = cubeData.getCubeData(startCube, endCube);
                const FaceSize = (cubeSize ** 2)
                var dataCount = FaceSize * 6;

                for (var i = 0; i < dataCount; i++) {
                    var face = Math.floor(i / FaceSize);
                    var y = Math.floor((i % FaceSize) / cubeSize);
                    var x = (i % FaceSize) % cubeSize;
                    for (var cCube = startCube; cCube <= endCube; cCube++) {
                        cubeData.setSticker(face, x, y, originalData.getData((cCube - startCube) * dataCount + filterData[i]), cCube);
                    }
                }
                return true;
                break;
            }
            case CUBE_DATA_TYPE.Piece: {
                // This format takes a bit more thinking but works out in the end.
                // Similar to the last format, we will go though each index, but we will also check for cubie rotations
                // when needed. Cubie rotations are coded into the filter by adding rotations * cubieCount + sourceIndex
                const CubieCount = (cubeSize ** 3) - (cubeSize - 2) ** 3;
                var originalData = cubeData.getCubeData(startCube, endCube);
                originalData.setDataFlag(storageFormat);
                var originalCubeData = new CubeData(cubeSize, (startCube - endCube) + 1, storageFormat, originalData)
                //console.log(this.getMoves(), filterData);
                for (var i = 0; i < CubieCount; i++) {
                    var sourceIndex = filterData[i] % CubieCount;
                    var rotation = Math.floor(filterData[i] / CubieCount);
                    var sourcePos = CubeData.getCubieCoordinates(sourceIndex, cubeSize);
                    var destinationPos = CubeData.getCubieCoordinates(i, cubeSize);
                    for (var cCube = startCube; cCube <= endCube; cCube++) {
                        var sourceCubie = originalCubeData.getCubie(sourcePos.x, sourcePos.y, sourcePos.z, cCube - startCube);
                        //console.log("Destination: ", destinationPos, "Source: ", sourcePos, "Rotation: ", rotation)
                        sourceCubie.rotate(rotation);
                        cubeData.setCubie(destinationPos.x, destinationPos.y, destinationPos.z, sourceCubie, cCube);

                    }
                }
                return true;
                break;
            }
            default: {
                if (shouldLogErrors) {
                    console.info("Invalid filter type, no changes were made.");
                }
                return false;
                break;
            }
        }
    };

    // Build the filter from other filters, if from scratch is true, then we must build our own filters
    // The fromScratch is used by the buildBaseFilters function as we do not have any filters to build from
    // so we must build from scratch.
    if (fromScratch) {
        var layerCount = AlgorithmStorage.getLayerCount(cubeSize);
        const isOdd = cubeSize % 2 === 1;
        var sourceData = Filter.createNewFilterData(cubeSize, storageFormat);
        var destinationData = Filter.createNewFilterData(cubeSize, storageFormat);

        function copyDestinationToSource() {
            sourceData = destinationData.slice(0);
        }

        switch (storageFormat) {
            case (CUBE_DATA_TYPE.Surface): {
                const FaceSize = cubeSize ** 2;
                const Layer = algId % layerCount;
                const Direction = Math.floor(algId / layerCount);
                const Plane = isOdd ? Math.floor(Layer / (cubeSize - 1)) : Math.floor(Layer / cubeSize);
                var slice = isOdd ? Layer % (cubeSize - 1) : Layer % cubeSize;

                if (isOdd && slice + 1 > cubeSize / 2) {
                    slice += 1;
                }

                for (var l = 0; l <= Direction; l++) {
                    switch (Plane) {
                        case 0: {
                            // z, y plane
                            for (var i = 0; i < cubeSize; i++) {
                                // Increment in the y+ in face space for each face, Up and Back need to be reversed to corespond to the correct sticker on the other faces
                                // Up to Front
                                destinationData[CUBE_FACE.Front * FaceSize + i * cubeSize + slice] = sourceData[CUBE_FACE.Up * FaceSize + (cubeSize - 1 - i) * cubeSize + slice];
                                // Front to Down
                                destinationData[CUBE_FACE.Down * FaceSize + i * cubeSize + slice] = sourceData[CUBE_FACE.Front * FaceSize + i * cubeSize + slice];
                                // Down to Back
                                destinationData[CUBE_FACE.Back * FaceSize + (cubeSize - 1 - i) * cubeSize + slice] = sourceData[CUBE_FACE.Down * FaceSize + i * cubeSize + slice];
                                // Back to Up
                                destinationData[CUBE_FACE.Up * FaceSize + (cubeSize - 1 - i) * cubeSize + slice] = sourceData[CUBE_FACE.Back * FaceSize + (cubeSize - 1 - i) * cubeSize + slice];

                                if (slice == 0) {
                                    // We also need to rotate the Left side
                                    for (var j = 0; j < cubeSize; j++) {
                                        // ith column to cubeSize - 1 - ith row
                                        destinationData[CUBE_FACE.Left * FaceSize + (cubeSize - 1 - i) * cubeSize + j] = sourceData[CUBE_FACE.Left * FaceSize + j * cubeSize + i];
                                    }
                                }

                                if (slice == cubeSize - 1) {
                                    // We also need to rotate the Right side
                                    for (var j = 0; j < cubeSize; j++) {
                                        // ith column to cubeSize - 1 - ith row
                                        destinationData[CUBE_FACE.Right * FaceSize + (cubeSize - 1 - i) * cubeSize + j] = sourceData[CUBE_FACE.Right * FaceSize + j * cubeSize + i];
                                    }
                                }
                            }

                            break;
                        }

                        case 1: {
                            // x, z plane
                            for (var i = 0; i < cubeSize; i++) {
                                // Increment in the x+ in face space for each face, Back and Right need to be reversed to corespond to the correct sticker on the other faces
                                // Left to Front
                                destinationData[CUBE_FACE.Front * FaceSize + slice * cubeSize + i] = sourceData[CUBE_FACE.Left * FaceSize + slice * cubeSize + i];
                                // Front to Right
                                destinationData[CUBE_FACE.Right * FaceSize + slice * cubeSize + (cubeSize - 1 - i)] = sourceData[CUBE_FACE.Front * FaceSize + slice * cubeSize + i];
                                // Right to Back
                                destinationData[CUBE_FACE.Back * FaceSize + slice * cubeSize + (cubeSize - 1 - i)] = sourceData[CUBE_FACE.Right * FaceSize + slice * cubeSize + (cubeSize - 1 - i)];
                                // Back to Left
                                destinationData[CUBE_FACE.Left * FaceSize + slice * cubeSize + i] = sourceData[CUBE_FACE.Back * FaceSize + slice * cubeSize + (cubeSize - 1 - i)];

                                if (slice == 0) {
                                    // We also need to rotate the Down side
                                    for (var j = 0; j < cubeSize; j++) {
                                        // ith column to cubeSize - 1 - ith row
                                        destinationData[CUBE_FACE.Down * FaceSize + (cubeSize - 1 - i) * cubeSize + j] = sourceData[CUBE_FACE.Down * FaceSize + j * cubeSize + i];
                                    }
                                }

                                if (slice == cubeSize - 1) {
                                    // We also need to rotate the Up side
                                    for (var j = 0; j < cubeSize; j++) {
                                        // ith column to cubeSize - 1 - ith row
                                        destinationData[CUBE_FACE.Up * FaceSize + (cubeSize - 1 - i) * cubeSize + j] = sourceData[CUBE_FACE.Up * FaceSize + j * cubeSize + i];
                                    }
                                }
                            }

                            break;
                        }

                        case 2: {
                            // x, y plane
                            for (var i = 0; i < cubeSize; i++) {
                                // Increment in y- for Left, x- for Up, y+ for Right, x+ for Down
                                // Up to Left
                                destinationData[CUBE_FACE.Left * FaceSize + (cubeSize - 1 - i) * cubeSize + slice] = sourceData[CUBE_FACE.Up * FaceSize + slice * cubeSize + (cubeSize - 1 - i)];
                                // Left to Down
                                destinationData[CUBE_FACE.Down * FaceSize + slice * cubeSize + i] = sourceData[CUBE_FACE.Left * FaceSize + (cubeSize - 1 - i) * cubeSize + slice];
                                // Down to Right
                                destinationData[CUBE_FACE.Right * FaceSize + i * cubeSize + slice] = sourceData[CUBE_FACE.Down * FaceSize + slice * cubeSize + i];
                                // Right to Up
                                destinationData[CUBE_FACE.Up * FaceSize + slice * cubeSize + (cubeSize - 1 - i)] = sourceData[CUBE_FACE.Right * FaceSize + i * cubeSize + slice];

                                if (slice == 0) {
                                    // We also need to rotate the Back side
                                    for (var j = 0; j < cubeSize; j++) {

                                        destinationData[CUBE_FACE.Back * FaceSize + j * cubeSize + i] = sourceData[CUBE_FACE.Back * FaceSize + (cubeSize - 1 - i) * cubeSize + j];
                                    }
                                }

                                if (slice == cubeSize - 1) {
                                    // We also need to rotate the Front side
                                    for (var j = 0; j < cubeSize; j++) {
                                        // cubeSize - 1 - ith column to ith row
                                        destinationData[CUBE_FACE.Front * FaceSize + j * cubeSize + i] = sourceData[CUBE_FACE.Front * FaceSize + (cubeSize - 1 - i) * cubeSize + j];
                                    }
                                }
                            }

                            break;
                        }
                    }
                    copyDestinationToSource();
                }


                break;
            }
            case (CUBE_DATA_TYPE.Piece): {
                const totalCubieCount = cubeSize ** 3 - (cubeSize - 2) ** 3;
                const Layer = algId % layerCount;
                const Direction = Math.floor(algId / layerCount);
                const Plane = isOdd ? Math.floor(Layer / (cubeSize - 1)) : Math.floor(Layer / cubeSize);
                var slice = isOdd ? Layer % (cubeSize - 1) : Layer % cubeSize;

                if (isOdd && slice >= (cubeSize - 1) / 2) {
                    slice += 1;
                }
                //console.log(Plane, slice)
                // For this mode we are going to go through each index, find out it's x, y, z Coordinate using the CubeData methods
                // See if it is affected by the move, and calculate to which index it should go.
                function sameCoords(a, b) {
                    return (a.x == b.x && a.y == b.y && a.z == b.z);
                }

                function findDestinationIndex(a) {
                    for (var i = 0; i < totalCubieCount; i++) {
                        if (sameCoords(a, indexTo3d[i])) {
                            return i;
                        }
                    }
                    return -1;
                }

                // Calculate the 3D position of each Cubie Index
                var indexTo3d = [];
                for (var i = 0; i < totalCubieCount; i++) {
                    indexTo3d.push(CubeData.getCubieCoordinates(i, cubeSize));
                }
                for (var l = 0; l <= Direction; l++) {
                    switch (Plane) {
                        case (0): {
                            // z, y Plane
                            // We will loop through each index to find ones with an X Coordinate that matches slice
                            // we will then caculate their destination Coordinates, find the destination index
                            // then determine if the transfer has a change in home value. 
                            for (var i = 0; i < totalCubieCount; i++) {
                                if (indexTo3d[i].x != slice) {
                                    continue;
                                }
                                var destinationCoords = { x: slice, y: (cubeSize - 1 - indexTo3d[i].z), z: indexTo3d[i].y };
                                var destinationIndex = findDestinationIndex(destinationCoords);
                                var homeRotation = 0;

                                // Calculate home face rotation 0: none, 1 Clockwise, 2 Counterclock wise;
                                // There is no home rotation when slice = 0 as it is the LDB face, always

                                var sourceFaces = CubeData.getTouchingFaces(indexTo3d[i].x, indexTo3d[i].y, indexTo3d[i].z, cubeSize);
                                var destinationFaces = CubeData.getTouchingFaces(destinationCoords.x, destinationCoords.y, destinationCoords.z, cubeSize);

                                if (slice > 0 && slice < cubeSize - 1 && destinationFaces.length > 1) {
                                    // We are on one of the middle layers
                                    // If the new LDB face is facing down, or to the front, the Home value has changed
                                    if ((destinationFaces[0] == CUBE_FACE.Down && sourceFaces[0] == CUBE_FACE.Down) || destinationFaces[0] == CUBE_FACE.Front) {
                                        homeRotation = 1;
                                    }
                                } else if (slice == cubeSize - 1 && destinationFaces.length > 2) {
                                    // Only Corners are affected here on the right layer by home changes
                                    // If the new LDB face is facing down, or to the front, the Home value has changed
                                    if (destinationFaces[0] == CUBE_FACE.Down && sourceFaces[0] == CUBE_FACE.Down) {
                                        homeRotation = 2;
                                    } else if (destinationFaces[0] == CUBE_FACE.Front) {
                                        homeRotation = 1;
                                    }
                                }
                                // from previous rotations
                                var previousRotation = Math.floor(sourceData[i] / totalCubieCount);
                                var totalRotaion = (previousRotation + homeRotation);
                                if (destinationFaces.length == 2) {
                                    totalRotaion %= 2;
                                } else if (destinationFaces.length == 3) {
                                    totalRotaion %= 3;
                                }

                                destinationData[destinationIndex] = (sourceData[i] % totalCubieCount) + totalRotaion * totalCubieCount;

                            }
                            break;
                        }

                        case (1): {
                            // x, z Plane
                            // We will loop through each index to find ones with a Y Coordinate that matches slice
                            // we will then caculate their destination Coordinates, find the destination index
                            // then determine if the transfer has a change in home value. 
                            for (var i = 0; i < totalCubieCount; i++) {
                                if (indexTo3d[i].y != slice) {
                                    continue;
                                }
                                var destinationCoords = { x: indexTo3d[i].z, y: slice, z: (cubeSize - 1 - indexTo3d[i].x) };
                                var destinationIndex = findDestinationIndex(destinationCoords);
                                var homeRotation = 0;

                                // Calculate home face rotation 0: none, 1 Clockwise, 2 Counterclock wise;
                                var sourceFaces = CubeData.getTouchingFaces(indexTo3d[i].x, indexTo3d[i].y, indexTo3d[i].z, cubeSize);
                                var destinationFaces = CubeData.getTouchingFaces(destinationCoords.x, destinationCoords.y, destinationCoords.z, cubeSize);
                                if (slice == 0 && destinationFaces.length > 1) {
                                    if (sourceFaces[0] == CUBE_FACE.Left || destinationFaces[0] == CUBE_FACE.Left) {
                                        // Same conditions apply for both corners and edges here
                                        homeRotation = 1;
                                    }
                                } else if (slice > 0 && slice < cubeSize - 1 && destinationFaces.length > 1) {
                                    // We are on one of the middle layers
                                    // If the new LDB face is facing left, or to the Back, the Home value has changed
                                    if ((destinationFaces[0] == CUBE_FACE.Left && sourceFaces[0] == CUBE_FACE.Left) || destinationFaces[0] == CUBE_FACE.Back) {
                                        homeRotation = 1;
                                    }
                                } else if (slice == cubeSize - 1 && destinationFaces.length > 1) {
                                    // If the new LDB face is facing up, or to the back, the Home value has changed for edges
                                    if (destinationFaces.length == 2 && (destinationFaces[0] == CUBE_FACE.Up || destinationFaces[0] == CUBE_FACE.Back)) {
                                        homeRotation = 1;
                                    } else if (destinationFaces.length == 3 && (destinationFaces[0] == CUBE_FACE.Back)) {
                                        // If the new LDB face is facing the Back, the Home value has changed by 1
                                        homeRotation = 1;
                                    } else if (destinationFaces.length == 3 && (destinationFaces[0] == CUBE_FACE.Left && sourceFaces[0] == CUBE_FACE.Left)) {
                                        // If the new LDB face is facing the Front with a source from the left, the Home value has changed by 2
                                        homeRotation = 2;
                                    }
                                }
                                // from previous rotations
                                var previousRotation = Math.floor(sourceData[i] / totalCubieCount);
                                var totalRotaion = (previousRotation + homeRotation) % 3;

                                destinationData[destinationIndex] = (sourceData[i] % totalCubieCount) + totalRotaion * totalCubieCount;

                            }
                            break;
                        }

                        case (2): {
                            // x, y Plane
                            // We will loop through each index to find ones with a Z Coordinate that matches slice
                            // we will then caculate their destination Coordinates, find the destination index
                            // then determine if the transfer has a change in home value. 
                            for (var i = 0; i < totalCubieCount; i++) {
                                if (indexTo3d[i].z != slice) {
                                    continue;
                                }
                                var destinationCoords = { x: (cubeSize - 1 - indexTo3d[i].y), y: indexTo3d[i].x, z: slice };
                                var destinationIndex = findDestinationIndex(destinationCoords);
                                var homeRotation = 0;

                                // Calculate home face rotation 0: none, 1 Clockwise, 2 Counterclock wise;
                                var sourceFaces = CubeData.getTouchingFaces(indexTo3d[i].x, indexTo3d[i].y, indexTo3d[i].z, cubeSize);
                                var destinationFaces = CubeData.getTouchingFaces(destinationCoords.x, destinationCoords.y, destinationCoords.z, cubeSize);

                                if (slice == 0 && destinationFaces.length > 1) {
                                    if (destinationFaces.length == 2 && (sourceFaces[0] == CUBE_FACE.Down || destinationFaces[0] == CUBE_FACE.Left)) {
                                        // If the edge ends up with source LDB on bottom or Destination on Left, it changes
                                        homeRotation = 1;
                                    } else if (destinationFaces.length == 3 && !(destinationFaces[0] == CUBE_FACE.Down)) {
                                        // All corners except for the down to right piece, have this rotation
                                        homeRotation = 1;
                                    }
                                } else if (slice > 0 && slice < cubeSize - 1 && destinationFaces.length > 1) {
                                    // We are on one of the middle layers
                                    // If the new LDB face is facing left with a source from left, or if the destination is up, we have a homeChange
                                    if ((destinationFaces[0] == CUBE_FACE.Left && sourceFaces[0] == CUBE_FACE.Left) || destinationFaces[0] == CUBE_FACE.Up) {
                                        homeRotation = 1;
                                    }
                                } else if (slice == cubeSize - 1 && destinationFaces.length > 1) {
                                    // If we have source down, or destination left, we have a home change in an edge
                                    if (destinationFaces.length == 2 && (destinationFaces[0] == CUBE_FACE.Left || sourceFaces[0] == CUBE_FACE.Down)) {
                                        homeRotation = 1;
                                    } else if (destinationFaces.length == 3 && !(destinationFaces[0] == CUBE_FACE.Down)) {
                                        // If the new LDB face is facing Down, there is no change, else we have a CCW change
                                        homeRotation = 2;
                                    }
                                }
                                // from previous rotations
                                var previousRotation = Math.floor(sourceData[i] / totalCubieCount);
                                var totalRotaion = (previousRotation + homeRotation) % 3;

                                destinationData[destinationIndex] = (sourceData[i] % totalCubieCount) + totalRotaion * totalCubieCount;

                            }
                            break;
                        }
                    }
                    copyDestinationToSource();
                }
                break;
            }
        }
        filterData = sourceData.slice(0);
    } else {

        var filterBase = Filter.buildBaseFilters(cubeSize, storageFormat);
        var moveSequence = this.getMoves();
        var sourceData = Filter.createNewFilterData(cubeSize, storageFormat);
        var destinationData = Filter.createNewFilterData(cubeSize, storageFormat);
        const len = moveSequence.length;
        const TotalCubieCount = cubeSize ** 3 - (cubeSize - 2) ** 3;
        function copyDestinationToSource() {
            sourceData = destinationData.slice(0);
        }
        for (var i = 0; i < len; i++) {
            var moveId = moveSequence[i];
            var currentFilter = Filter.filterCache[filterBase][moveId].getFilterData();
            const FLen = currentFilter.length;
            for (var j = 0; j < FLen; j++) {
                switch (storageFormat) {
                    case CUBE_DATA_TYPE.Fast:
                    // Fall thorugh
                    case CUBE_DATA_TYPE.Surface: {
                        destinationData[j] = sourceData[currentFilter[j]];
                        break;
                    }
                    case CUBE_DATA_TYPE.Piece: {
                        var rotation = Math.floor(currentFilter[j] / TotalCubieCount);
                        var sourceIndex = currentFilter[j] % TotalCubieCount;
                        var currentRotation = Math.floor(sourceData[sourceIndex] / TotalCubieCount);
                        var totalRotaion = rotation + currentRotation;
                        var cubeCoords = CubeData.getCubieCoordinates(j, cubeSize);
                        var faceCount = CubeData.getTouchingFaces(cubeCoords.x, cubeCoords.y, cubeCoords.z, cubeSize).length;
                        totalRotaion %= faceCount;
                        destinationData[j] = (sourceData[sourceIndex] % TotalCubieCount) + totalRotaion * TotalCubieCount;
                        break;
                    }
                }
            }
            copyDestinationToSource();
        }

        filterData = sourceData.slice(0);
    }

}

/**
 * @param {number} cubeSize 
 */
Filter.createNewFilterData = function (cubeSize, storageFormat = CUBE_DATA_TYPE.Surface) {
    // Returns an array that a filter can use to apply rotations or moves to cubes
    // Filters use the array to tell what index to pull from the starting cube to fill in the current index or
    // more simply, cubeArray[i] = cubeArray[filterArray[i]]. Variations on this are used for the different storage formats
    var result = [];
    switch (storageFormat) {
        case CUBE_DATA_TYPE.Surface: {
            // All the indecies in these format literaly are just in order, so return an array with all
            // the indexes in order
            var totalCount = (cubeSize ** 2) * 6;
            for (var i = 0; i < totalCount; i++) {
                result.push(i);
            }
            break;
        }
        case CUBE_DATA_TYPE.Piece: {
            // All the indecies in these format literaly are just in order, so return an array with all
            // the indexes in order
            var totalCount = (cubeSize ** 3) - ((cubeSize - 2) ** 3);
            for (var i = 0; i < totalCount; i++) {
                result.push(i);
            }
            break;
        }
        default: {
            if (shouldLogErrors) {
                console.info("Error: Could not create filter data, unknown storage format!");
            }
        }
    }
    return result;
}

/**
 * @param {number} cubeSize 
 */
Filter.buildBaseFilters = function (cubeSize, storageFormat = CUBE_DATA_TYPE.Surface) {
    // Builds the basic filters that are used to create larger ones. This will build all the single move filters and save them in the cache
    // Retuns the index of the filter
    //	Check if filters for this size are already made
    var foundMatchingFilter = false;
    var cacheLength = Filter.filterCache.length;
    for (var i = 0; i < cacheLength; i++) {
        var cFilter = Filter.filterCache[i][0]
        if (cFilter.getCubeSize() === cubeSize && cFilter.getStorageFormat() === storageFormat) {
            foundMatchingFilter = true;
            break;
        }
    }

    if (foundMatchingFilter) {
        // If we found a filter set that already has our data we don't need to make a new one
        return i;
    }

    // To accomplish our goal we will perform all depth one moves and create filters for them.
    var layerCount = AlgorithmStorage.getLayerCount(cubeSize);
    var isOdd = cubeSize % 2 === 1;
    var algStorage = new AlgorithmStorage(cubeSize, 1, layerCount * 3);
    var success = algStorage.selfIndex();
    if (!success) {
        console.info("Error creating base filters, algorithm storage failed to self index.");
        return -1;
    }
    var filterList = [];
    for (var i = 0; i < layerCount * 3; i++) {
        filterList.push(new Filter(cubeSize, storageFormat, algStorage, i, true));
    }
    Filter.filterCache.push(filterList);
    return Filter.filterCache.length - 1;

}

/**
 * @type {Filter[][]} 
 */
Filter.filterCache = [];

export { AlgorithmStorage, Filter }