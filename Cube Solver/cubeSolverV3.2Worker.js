//@ts-check
import {solveCube, CubeNode} from "./modules/solver.js"
import {BinaryData} from "./modules/binarydata.js"
import {AlgorithmStorage, Filter} from "./modules/algorithmstorage.js"
import {CUBE_DATA_TYPE, CUBIE_TYPE,CUBIE_STYLE, CUBE_FACE} from "./modules/cubeconsts.js"
import {CubeData, CubeError, Cubie} from "./modules/cubedata.js"

onmessage = function(e){
    if(typeof e.data == "object"){
        if(e.data.type == "cancel"){
            queHistory[e.data.data].cancel();
            return;
        }
    }
    var cubeData = CubeData.parseCubeString(e.data);
    var queItem = {
        cancel:undefined
    };
    /**
     * 
     * @param {AlgorithmStorage} alg 
     * @param {Number} algNum 
     * @param {Number} time 
     * @param {Number} cycles 
     */
    function success(alg, algNum, time, cycles){
        var resp = {
            type:"sucs",
            alg:alg.getMoves(algNum),
            time:time,
            cycles:cycles,
            cubeSize: cubeData.getCubeSize()
        };
        postMessage(resp);
    }   
    
    function start(cancelCallBack){
        queItem.cancel = cancelCallBack;
        var resp = {
            type:"strt"
        }
        postMessage(resp);
    }

    function update(text) {
        var resp = {
            type:"upda",
            text:text
        }
        postMessage(resp);
    }

    function fail(errors){
        var resp = {
            type:"fail",
            errors:errors
        }
        postMessage(resp);
    }

    queHistory[e.data] = queItem;

    solveCube(cubeData, 0, start, success, fail, update, 1000)
}

var queHistory = [];