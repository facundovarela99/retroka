import dotenv from 'dotenv';
dotenv.config({path: '.env'});


export function base_path(path){
    return process.env.APP_URL + '/' + path.toLowerCase().trim();
}