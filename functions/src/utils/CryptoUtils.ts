import * as crypto from 'crypto'

/*
* code gotten from :
* website: http://vancelucas.com/blog/stronger-encryption-and-decryption-in-node-js/
* gist: https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb 
*/
export class CryptoUtils {

    static encrypt = (toEncrypt, key) => new Promise((resolve, reject) => resolve(toEncrypt))

    ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 256 bytes (32 characters)
    IV_LENGTH = 16; // For AES, this is always 16

    encrypt = (text) => {
        const iv = crypto.randomBytes(this.IV_LENGTH);
        const cipher = crypto.createCipheriv('aes-256-cbc', new Buffer(this.ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);

        encrypted = Buffer.concat([encrypted, cipher.final()]);

        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    decrypt = (text) => {
        const textParts = text.split(':');
        const iv = new Buffer(textParts.shift(), 'hex');
        const encryptedText = new Buffer(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', new Buffer(this.ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    }

}