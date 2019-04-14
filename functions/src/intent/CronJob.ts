import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
// import { File } from '../utils/File';
// import { Transactions } from '../models/transactions';
// import MomoProviders from './../models/MomoProviders'
// import { PhonenumberUtils } from '../utils/PhonenumberUtils';
// import { MobileMoneyProviders } from '../models/MobileMoneyProviders';
// import { ChangePrincipalPhonenumber } from '../models/intents/ChangePrincipalPhonenumber';
// import { DeleteAccount } from '../models/intents/DeleteAccount';
// import { CryptoUtils } from '../utils/CryptoUtils';
// import { UpdateProfileImage } from '../models/intents/UpdateProfileImage';
// import { UpdateTransactionCode } from '../models/intents/UpdateTransactionCode';
import { Constants } from '../utils/Constants';
const FieldValue = require('firebase-admin').firestore.FieldValue;
import { Finances } from '.'
/*
* responses are given here following the http response codes as per the following link.
* https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
*
*/
export class CronJob {
    static cronJob = functions.https.onRequest((req, res) => {
    const promises = []
    promises.push(
            Finances.cronFinance()
        )
        Promise.all(promises)
            .then(ignored => res.status(200).json({ status: 'ok' }))
            .catch(err => res.status(500).json({ error: 'unknown error on server' }))
    })




}