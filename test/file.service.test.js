import assert from 'node:assert/strict';
import test from 'node:test';
import { FileService, getFileStorageDriver } from '../app/Services/File.service.js';

test('selecciona almacenamiento local solo en desarrollo', () => {
    assert.equal(getFileStorageDriver('development'), 'local');
    assert.equal(getFileStorageDriver('testing'), 'cloudinary');
    assert.equal(getFileStorageDriver('test'), 'cloudinary');
    assert.equal(getFileStorageDriver('production'), 'cloudinary');
});

test('Cloudinary devuelve la URL y conserva el public_id para eliminar la imagen', async () => {
    const uploadedOptions = [];
    const destroyedAssets = [];
    const cloudinaryClient = {
        config:() => {},
        uploader:{
            upload_stream:(options, callback) => {
                uploadedOptions.push(options);

                return {
                    end:(buffer) => callback(null, {
                        secure_url:`https://res.cloudinary.com/test/image/upload/v1/${options.folder}/${options.public_id}.jpg`,
                        public_id:`${options.folder}/${options.public_id}`,
                        bytes:buffer.length
                    })
                };
            },
            destroy:async (publicId, options) => {
                destroyedAssets.push({ publicId, options });
                return { result:'ok' };
            }
        }
    };
    const service = new FileService({
        environment:'production',
        fileModel:{},
        cloudinaryClient,
        cloudinaryConfig:{
            cloud_name:'test',
            api_key:'key',
            api_secret:'secret'
        }
    });
    const files = [{
        originalname:'frente.jpg',
        mimetype:'image/jpeg',
        size:4,
        buffer:Buffer.from('test')
    }];

    const storedFiles = await service.storeVariantImages(files, 43, 8);

    assert.equal(storedFiles.length, 1);
    assert.equal(storedFiles[0].nombre_original, 'frente.jpg');
    assert.equal(storedFiles[0].mime_type, 'image/jpeg');
    assert.match(storedFiles[0].url, /^https:\/\/res\.cloudinary\.com\/test\/image\/upload\//);
    assert.match(storedFiles[0].nombre, /^retroka\/products\/43\/variants\/8\//);
    assert.equal(uploadedOptions[0].folder, 'retroka/products/43/variants/8');

    await service.removeStoredVariantFiles(storedFiles, 43, 8);

    assert.deepEqual(destroyedAssets, [{
        publicId:storedFiles[0].nombre,
        options:{ resource_type:'image', invalidate:true }
    }]);
});
