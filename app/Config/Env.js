import dotenv from 'dotenv';
dotenv.config({path: '.env'});


export function base_path(){
    return process.env.APP_URL;
}

export function url(path){
    return (process.env.APP_URL+path).trim();
}