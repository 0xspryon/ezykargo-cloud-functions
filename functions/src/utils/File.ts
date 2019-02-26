import * as admin from 'firebase-admin';
const path = require('path')
const os = require('os');
const fs = require('fs');

export class File {

    static moveFileFromTo = async (from, to) => {
        console.log(from, to)
        // Download file from bucket.
        const fileName = from.split("/").pop()
        const bucket = admin.storage().bucket();
        const tempFilePath = path.join(os.tmpdir(), ((new Date).getTime()) + "-" + fileName);
        const file = bucket.file(from)
        return file.download({
            destination: tempFilePath,
        }).then(() => {
            console.log('Image download to: ', tempFilePath);
            return bucket.upload(tempFilePath, {
                destination: to,
                metadata: {
                    'contentType': file.metadata.contentType
                },
                resumable: false,
            });
        }).then(() => {
            fs.unlinkSync(tempFilePath)
            return file.delete()
        });
    }

}