import { normalize, string } from "zod";



export function validarCantidad(cantidad){
    let normalized = "";
    if (typeof cantidad === 'string'){
        for (const str of cantidad) {
            if (str !== "" || str !== " "){
                normalized+=str
            } 
        }
    }
    return parseInt(normalized.trim());
}
