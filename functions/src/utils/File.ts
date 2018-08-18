import * as admin from 'firebase-admin';
const path = require('path')
const os = require('os');
const fs = require('fs');

export class File {

    static moveFileFromTo = async (from,to) => {
        // Download file from bucket.
        const fileName = from.split("/").pop()
        const bucket = admin.storage().bucket();
        const tempFilePath = path.join(os.tmpdir(), fileName);
        const file = bucket.file(from)
        return file.download({
            destination: tempFilePath,
        }).then(() => {
            console.log('Image download to: ', tempFilePath);
            return bucket.upload(tempFilePath, {
                destination: to,
                metadata: {
                    'contentType' :file.metadata.contentType
                },
            });
        }).then(() => {
            fs.unlinkSync(tempFilePath)
            return file.delete()
        });
    }

}