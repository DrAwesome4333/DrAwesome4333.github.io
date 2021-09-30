// @ts-check
import {BinaryData} from "./binarydata.js"
import {AlgorithmStorage, Filter} from "./algorithmstorage.js"
import {CUBE_DATA_TYPE, CUBIE_TYPE,CUBIE_STYLE, CUBE_FACE} from "./cubeconsts.js"
import {CubeData, CubeError, Cubie} from "./cubedata.js"



	
		/**
		 * @param {CubeNode} startNode 
		 */
         function logChain(startNode, title){
			console.log("List " + title)
			var lastVal = 0;
			var count = 0;
			var cNode = startNode;
			while(cNode != null){
				count++
				console.log(count, cNode.cubeId, "("+cNode.totalPoints+")")
				
				cNode = cNode.next;
			}
			
		}

		function chainLen(startNode){
			var count = 0;
			var cNode = startNode;
			while(cNode != null){
				count++	
				cNode = cNode.next;
			}
			return count;
		}



function CubeNode(data=new CubeData(), cubeId=-1, algorithmStorage=data==null?null:new AlgorithmStorage(data.getCubeSize(), 0), algIds=[-1], cubeScore=-1, totalPoints=Infinity){
    this.data = data;
    this.cubeId = cubeId;
    this.algorithmStorage = algorithmStorage;
    this.algIds = algIds;// This stores the id's of the algorithms applied to the cube in order
    this.cubeScore = cubeScore;
    this.totalPoints = totalPoints;
    this.active = true;
    /** @type {CubeNode} **/
    this.next = null;
    /** @type {CubeNode} **/
    this.last = null;
}

/**
 * @param {CubeNode}nodeInList 
 * @param {CubeNode}newNode
 * */
CubeNode.insertAfter = function(nodeInList, newNode){
    // Inserts a node after a specified node. 
    // Returns true if it was successful or
    // returns false if either the node in the list or the node 
    // we are inserting after it are null
    if(nodeInList == null || newNode == null){
        // There was nothing to insert or there was nothing to insert into
        return false;
    }
    var tmpSave = nodeInList.next;
    nodeInList.next = newNode;
    newNode.last = nodeInList;
    newNode.next = tmpSave;

    if(tmpSave != null){
        tmpSave.last = newNode;
    }
    return true;
}

/**
 * @param {CubeNode}nodeInList 
 * @param {CubeNode}newNode
 * */
CubeNode.insertBefore = function(nodeInList, newNode){
    // Inserts a node before a specified node. 
    // Returns true if it was successful or
    // returns false if either the node in the list or the node 
    // we are inserting before it are null
    
    if(nodeInList == null || newNode == null){
        // There was nothing to insert or there was nothing to insert into
        return false;
    }
    var tmpSave = nodeInList.last;
    nodeInList.last = newNode;
    newNode.next = nodeInList;
    newNode.last = tmpSave;

    if(tmpSave != null){
        tmpSave.next = newNode;
    }

    return true;
}

/**
 * @param {CubeNode}node
 * */
CubeNode.removeNode = function(node){
    // removes the node from the list
    // and updates the previous and next
    // node's accordinglly
    if(node == null){
        debugger;
    //	return;
    }

    var before = node.last;
    var after = node.next;

    node.next = null;
    node.last = null;

    if(before != null){
        before.next = after;
    }
    if(after != null){
        after.last = before;
    }
}

/**
* @param {AlgorithmStorage} algorithm 
*/
 function basicSuccesCallBack(algorithm, algId=0, time=0, cycles=0){
    console.log(`Cube was solved in ${Math.round(time)} seconds and ${cycles} cycles. The algorithm is ${algorithm.getMovesAsText(algId)}`);
}

/**
 * @param {CubeError[]} errors 
 */
function basicFailureCallBack(errors){
    console.log("Failed to solve cube for the follwing reasons: ", errors)
}

/**
 * @param {Function} cancelCallBack 
 */
function basicStartCallBack(cancelCallBack){
    console.log("Verification passed, begining to solve...");

}

/**
 * @param {string} text 
 */
function basicUpdateCallBack(text){

}


/**
 * @param {CubeData} cubeData
 */
function solveCube(cubeData, cubeNumber=0, startCallBack=basicStartCallBack, successCallBack=basicSuccesCallBack, failureCallBack=basicFailureCallBack, updateCallBack=basicUpdateCallBack, cyclesPerFrame=100){
    // Functions we are going to use:
    /** @returns {CubeNode} **/
    function getNewNode(canRetireLastNode=false){
        // Returns a cube node to use if possible
        if(endNode.last == null){
            debugger;
        }
        if(inactiveNode == null){
            // Check if there are no inactive nodes to try to create a new one
            if(totalCubeCount < MAX_CUBE_COUNT){
                // Make sure we are not going over our limit on cubes
                // If so, create a new node
                totalCubeCount ++;
                activeCubeCount ++;
                return new CubeNode(cubeStorage, totalCubeCount - 1);			
                
            }else{
                // If we have reached our limit on cubes and there are no inactive nodes
                // we need to retire the last node and use it
                if(canRetireLastNode){
                    retireLastNode();
                    
                    if(inactiveNode == null){
                        debugger;
                    }
                    return getNewNode();
                }
                // If retiring is not allowed, we have nothing to return.
                return null;
            }	
        }else{
            // Reuse a used node since there is an inacitve one available
            // Yay recycling!
            var theNode = inactiveNode;
            inactiveNode = theNode.next;
            activeCubeCount ++;
            // Remove it from the inactive list
            CubeNode.removeNode(theNode);
            return theNode;
        }
    }

    /**
     * @param {CubeNode} node
     */
    function removeNode(node){
        // Removes a node from the active list and
        // moves it to the inactive list

        if(node == null){
            // We need to debug if we got here
            debugger;
        }

        if(firstNode.next == null){
            // We need to debug if we got here as well
            debugger;
        }

        if(node == firstNode){
            // If this is the first node we are removing, we need to
            // reassign wich node is the first node
            if(firstNode.next == null){
                debugger;
            }
            firstNode = node.next;
        }

        CubeNode.removeNode(node);
        if(endNode.last == null){
            debugger;
        }
        var isFirstInactiveNode = !CubeNode.insertAfter(inactiveNode, node);

        if(isFirstInactiveNode){
            // If this is the first inactive node, we need to 
            // assign it as the first inactive node.
            inactiveNode = node;
        }
        
        
        activeCubeCount --;

    }



    function retireLastNode(){
        removeNode(endNode.last);
    }

    /** @param {CubeNode}cubeNode */
    function insertCubeNodeInOrder(cubeNode=null){
        // Cubes will be (for now) sorted by their totalPoints, points are bad, we want cubes with fewer points
        if(cubeNode == null){
            return false;
        }
        var log = [];
        var nextNode = cubeNode.next;


        var currentNode = endNode.last;
        // This is out of the loop as it is a special
        // case where we need to update firstNode's reference
        if(cubeNode.totalPoints <= firstNode.totalPoints){
            while(cubeNode != null){
                nextNode = cubeNode.next;
                CubeNode.removeNode(cubeNode);
                CubeNode.insertBefore(firstNode, cubeNode);
                log.push(`Inserted cube:${cubeNode.cubeId} before ${firstNode.cubeId} which was firstNode`)
                firstNode = cubeNode;
                cubeNode = nextNode;
            }
        }
        if(cubeNode == null)
                return true;
        // check if we are at the end of the list already
        // as if we are, then no need to look through the rest of the list
        while(cubeNode.totalPoints > endNode.last.totalPoints){
                nextNode = cubeNode.next;
                CubeNode.removeNode(cubeNode);
                CubeNode.insertBefore(endNode, cubeNode);
                log.push(`Inserted cube:${cubeNode.cubeId} before ${endNode.cubeId} which was endNode`)
                cubeNode = nextNode;
            
            if(cubeNode == null)
                return true;

            currentNode = endNode.last;
        }

        // Skip to the half node to save on loop iterations
        if (halfNode != null && (halfNode.next != null || halfNode.next != endNode.last) && cubeNode.totalPoints < halfNode.totalPoints){
            currentNode = halfNode;
        }

        // Find the first node were whe have a lower or equal points than it and insert
        // this node before it.
        // Also make sure we don't go past the end node.
        var i = activeCubeCount;
        while(currentNode != null && cubeNode != null){
            if(i == Math.floor(activeCubeCount * 0.5)){
                halfNode = currentNode;
            }
            
            i--;

            while(cubeNode != null && cubeNode.totalPoints > currentNode.totalPoints && cubeNode.totalPoints <= currentNode.next.totalPoints ){

                nextNode = cubeNode.next;
                CubeNode.removeNode(cubeNode);
                CubeNode.insertAfter(currentNode, cubeNode);
                log.push(`Inserted cube:${cubeNode.cubeId} after ${currentNode.cubeId} next node is ${nextNode==null?null:nextNode.cubeId}`)
                cubeNode = nextNode;
            }

            
            if(cubeNode != null && cubeNode.totalPoints <= firstNode.totalPoints){
                while(cubeNode != null){
                    nextNode = cubeNode.next;
                    CubeNode.removeNode(cubeNode);
                    CubeNode.insertBefore(firstNode, cubeNode);
                    log.push(`Inserted cube:${cubeNode.cubeId} before ${firstNode.cubeId} which was firstNode (end version)`)
                    firstNode = cubeNode;
                    cubeNode = nextNode;
                }
            }
            currentNode = currentNode.last;
            
        }
        var act = chainLen(firstNode);
        var inact = chainLen(inactiveNode);
        if(act + inact - 1 != totalCubeCount){
            console.log("MISSING NODE, printing log");
            logChain(firstNode, "Active")
            logChain(inactiveNode, "Inactive")
            for(var i = 0; i < log.length; i++){
                console.log(log[i])
            }
            debugger;
        }
        return true;

    }

    /** @param {CubeNode}cubeNode */
    function scoreCube(cubeNode){
        if(cubeNode == null || cubeNode.data == null){
            cubeNode.cubeScore = -1;
            return -1;
        }

        var cubeScore = 0;
        const FaceSize = cubeSize ** 2;
        // To score the cubes, we are going to count the 
        // Number of sqaures that are touching of the same color 
        // (2 squares touching results in 2 points in this case)
        // TODO improve this metric later
        for(var i = 0; i < FaceSize; i ++){
            var x = i % cubeSize;
            var y = Math.floor(i / cubeSize);

            // Go through each sticker on each side and see how many colors of its own it touches
            // Note that if x or y is out of range, getSticker will return -1
            //debugger;

            for(var side = 0; side < 6; side++){
                var stickerColor = cubeNode.data.getSticker(side, x, y, cubeNode.cubeId);
                
                if(stickerColor == cubeNode.data.getSticker(side, x + 1, y, cubeNode.cubeId)){
                    cubeScore ++;
                }

                if(stickerColor == cubeNode.data.getSticker(side, x - 1, y, cubeNode.cubeId)){
                    cubeScore ++;
                }

                if(stickerColor == cubeNode.data.getSticker(side, x, y + 1, cubeNode.cubeId)){
                    cubeScore ++;
                }

                if(stickerColor == cubeNode.data.getSticker(side, x, y - 1, cubeNode.cubeId)){
                    cubeScore ++;
                }

            }

        }
        cubeNode.cubeScore = cubeScore;
        cubeNode.totalPoints = (solvedCubeScore - cubeScore) + MOVE_WEIGHT * (cubeNode.algIds.length * cubeNode.algorithmStorage.getAlgLength());
        if (cubeNode.algIds[0] == -1){
            cubeNode.totalPoints = Infinity;
        }
        return cubeScore;

    }

    /** @param {CubeNode[]}cubeNodes **/
    function scoreCubes(cubeNodes){
        var results = [];
        var cubeCount = cubeNodes.length;
        for(var i = 0; i < cubeCount; i ++){
            results.push(scoreCube(cubeNodes[i]));
        }
        return results;
    }

    /** 
     * @param {CubeNode}cubeNode 
     * @return {number[]}
     * **/
    function getAlgorithmFromNode(cubeNode){
        if(cubeNode == null || cubeNode.algorithmStorage == null || cubeNode.algIds.includes(-1)){
            return [];
        }
        var alg = [];
        var algCount = cubeNode.algIds.length;
        for(var i = 0; i < algCount; i++){
            alg = alg.concat(cubeNode.algorithmStorage.getMoves(cubeNode.algIds[i]));
        }
        return alg;
    }

    /** 
     * @param {CubeNode}cubeNode 
     * **/
    function getAlgorithmFromNodeAsText(cubeNode){
        if(cubeNode == null || cubeNode.algorithmStorage == null || cubeNode.algIds.includes(-1)){
            return "No algorithm";
        }
        var alg = "";
        var algCount = cubeNode.algIds.length;
        for(var i = 0; i < algCount; i++){
            alg += (i==0 ? "": ", ") + cubeNode.algorithmStorage.getMovesAsText(cubeNode.algIds[i]);
        }
        return alg;
    }
    
    /**
     * @param {number[]}list
     * @param {number[]}indexList
     */
    function sortList(list, indexList=[]){
        // the list is sorted in place, the return value is a map to return the list to the original order
        if(indexList.length != list.length){
            indexList = [];
            for(var i = 0; i < list.length; i++){
                indexList.push(i);
            }
        }

        // bubble sort the list
        var hasSwapped = true;
        var sortedPortion = list.length - 1;

        while(hasSwapped){
            hasSwapped = false;
            
            for(var i = 0; i < sortedPortion; i ++){
                if(list[i] < list[i + 1]){
                    hasSwapped = true;
                    var tmp = list[i];
                    list[i] = list[i + 1];
                    list[i + 1] = tmp;

                    tmp = indexList[i];
                    indexList[i] = indexList[i + 1];
                    indexList[i + 1] = tmp;

                }
            }
            sortedPortion --;
        }

        return indexList;
    }
    
    // Verification:
    var verificationResults = CubeData.verifyCube(cubeData, cubeNumber);

    if(!verificationResults.passed){// The cube failed the test
        failureCallBack(verificationResults.errors);
        return;
    }

    var cancel = false;

    function cancelSolve(){
        cancel = true;
    }

    startCallBack(cancelSolve);

    // This is where if we had a web worker, we would send work over there
    
    console.log(cubeData.getCubeData(0).getArray())
    // fun statistics we are going to watch
    var startTime = performance.now();
    var cycles = 0;
    var frameCycles = 0;
    var cubesChecked = 0;
    const CYCLES_PER_FRAME = cyclesPerFrame;

    // We will start by setting up the data structures we are going to need
    var cubeSize = cubeData.getCubeSize();
    var all3MoveAlgs = new AlgorithmStorage(cubeSize, 3);
    var all1MoveAlgs = new AlgorithmStorage(cubeSize, 1);
    var all3MoveFilters = [];
    var all1MoveFilters = [];
    all3MoveAlgs.selfIndex();
    all1MoveAlgs.selfIndex();


    var agCount = all3MoveAlgs.getAlgCount();
    for(var i = 0; i < agCount; i ++){
        all3MoveFilters.push(all3MoveAlgs.getFilter(i, CUBE_DATA_TYPE.Surface));
    }

    agCount = all1MoveAlgs.getAlgCount();
    for(var i = 0; i < agCount; i ++){
        all1MoveFilters.push(all1MoveAlgs.getFilter(i, CUBE_DATA_TYPE.Surface));
    }

    // Set up our mass storage object
    const MAX_CUBE_COUNT = 50000;
    const MOVE_WEIGHT = 2;
    var totalCubeCount = 1;
    var activeCubeCount = 1;
    var cubeStorage = new CubeData(cubeSize, MAX_CUBE_COUNT, CUBE_DATA_TYPE.Surface);

    // Calculate the max score a cube can have without being solved
    var tmpCube = new CubeData(cubeSize, 1, CUBE_DATA_TYPE.Surface);
    all1MoveFilters[0].applyFilter(tmpCube);
    var maximumUnsolvedScore = scoreCube(new CubeNode(tmpCube, 0, all1MoveAlgs, [0]));
    
    cubeStorage.setCube(cubeData.getCubeData(cubeNumber), 0);
    /** @type {CubeNode} **/
    var inactiveNode = null;
    var firstNode = new CubeNode(cubeStorage, 0);
    var halfNode = null;
    scoreCube(firstNode);
    // This is a dummy node, it is there to keep track of where the last node is
    var endNode = new CubeNode(null);
    // Link the two nodes together
    CubeNode.insertBefore(endNode, firstNode);

    var solvedCubeScore = scoreCube(new CubeNode(new CubeData(cubeSize, 1), 0));
    console.log("Solved Cube Score:", solvedCubeScore);
    console.log("Starting score:", firstNode.cubeScore);


    function solveCycle(){
        // We did something wrong
        if(firstNode == null || firstNode == endNode){
            updateCallBack("An error occured");
            console.log("An error occured, no more nodes to run");
            return true;
        }

        
    

        // Now lets get to solving:

        frameCycles ++;
        cycles ++;

        // Step one, see if we are solved
        var currentScore = firstNode.cubeScore;
        if(currentScore == solvedCubeScore){
            // We have solved the cube
            return true;
        }

        // If we made it here, we are not solved.
        // Save the current firstNode as it may change as we insert new nodes
        var cNode = firstNode;
        var currentAlg = getAlgorithmFromNode(cNode);
        var prospectiveNodes = [];
        // We are going to loop through possible next algorithms, validate them
        // Then create new nodes with them
        var layerCount = AlgorithmStorage.getLayerCount(cubeSize);
        for(var i = 0; i < layerCount; i ++){
            var isValid = AlgorithmStorage.checkNextMove(cubeSize, currentAlg, i);
            if(isValid){
                var newNodes = [getNewNode(true), getNewNode(true), getNewNode(true)];
                var newAlgs = [currentAlg.concat([i]), currentAlg.concat([i + layerCount]), currentAlg.concat([i + layerCount * 2])];
                
                // Update each of the nodes with their new cube data
                for(var j = 0; j < 3; j++){
                    newNodes[j].data.setCube(cNode.data.getCubeData(cNode.cubeId), newNodes[j].cubeId);
                    all1MoveFilters[i + layerCount * j].applyFilter(newNodes[j].data, newNodes[j].cubeId);
                    newNodes[j].algorithmStorage = all1MoveAlgs;
                    newNodes[j].algIds = newAlgs[j];
                    prospectiveNodes.push(newNodes[j]);
                }
            }
        }

        // Score all these nodes and save them
        // TODO we will do something with the scores in the future

        var nodeScores = scoreCubes(prospectiveNodes);
        var nCount = prospectiveNodes.length;

        var sortedScoreIndexes = sortList(nodeScores);
        var nodeChain = null;
        var fNode = null;
        var listOfNodes = [];
        //console.log("NEW")
        for(var i = 0; i < nCount; i ++){
            if(sortedScoreIndexes[i] <= maximumUnsolvedScore && i < 12 ){
                //insertCubeNodeInOrder(prospectiveNodes[sortedScoreIndexes[i]]);
                listOfNodes.unshift(prospectiveNodes[sortedScoreIndexes[i]])
                //console.log(prospectiveNodes[sortedScoreIndexes[i]].cubeScore)
                
            }else{
                removeNode(prospectiveNodes[sortedScoreIndexes[i]]);
            }
        }

        
        
        for(var i = 0; i < listOfNodes.length; i++){
            //insertCubeNodeInOrder(listOfNodes[i])
            if(nodeChain == null){
                nodeChain = listOfNodes[i];
            }else{
                CubeNode.insertAfter(fNode, listOfNodes[i])
            }
            
            //console.log(listOfNodes[i].totalPoints);
            fNode = listOfNodes[i];
        }

        insertCubeNodeInOrder(nodeChain);
        // Remove our used node
        removeNode(cNode);

        

        // Start next cycle;
        return false;
    }

    function runSolveCycles(){
        
        if(cancel){
            updateCallBack("The solve was canceled by user")
            return;
        }

        var isComplete = false;

        for(var i = 0; i < CYCLES_PER_FRAME; i ++){

            if(solveCycle()){
                isComplete = true;
                break;
            }
        }

        if(!isComplete){
            // We are not done yet, so come back in a moment
            frameCycles = 0;
            setTimeout(runSolveCycles, 1);
            var algStr = firstNode.cubeScore + "<br>" + firstNode.totalPoints + "<br>Top Alg: " + getAlgorithmFromNodeAsText(firstNode);
            // /**@type {CubeData} */
            // var td = testCube.getCubeData();
            // td.setCube(cubeStorage.getCubeData(firstNode.cubeId), 0);
            // testCube.updateColors();
            updateCallBack(algStr);

        }else{
            // We have solved the Cube or encountered an error
            if(firstNode == null){
                // It was an error so don't do anything
                debugger;
            }else{
                var totalTime = performance.now() - startTime;
                var alg = getAlgorithmFromNode(firstNode);
                var algSt = new AlgorithmStorage(cubeSize, alg.length, 1);
                algSt.addAlgorithm(alg);
                
                updateCallBack(getAlgorithmFromNodeAsText(firstNode));
                successCallBack(algSt, 0, totalTime / 1000 , cycles);
            }
        }
    }

    runSolveCycles();
    
}

export {solveCube, CubeNode}