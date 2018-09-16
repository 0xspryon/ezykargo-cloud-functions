"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const path = require('path');
const os = require('os');
const fs = require('fs');
class File {
}
File.moveFileFromTo = (from, to) => __awaiter(this, void 0, void 0, function* () {
    console.log(from, to);
    // Download file from bucket.
    const fileName = from.split("/").pop();
    const bucket = admin.storage().bucket();
    const tempFilePath = path.join(os.tmpdir(), ((new Date).getTime()) + "-" + fileName);
    const file = bucket.file(from);
    return file.download({
        destination: tempFilePath,
    }).then(() => {
        console.log('Image download to: ', tempFilePath);
        return bucket.upload(tempFilePath, {
            destination: to,
            metadata: {
                'contentType': file.metadata.contentType
            },
        });
    }).then(() => {
        fs.unlinkSync(tempFilePath);
        return file.delete();
    });
});
exports.File = File;
//# sourceMappingURL=File.js.map