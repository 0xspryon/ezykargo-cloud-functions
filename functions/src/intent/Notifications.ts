import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Constants } from '../utils/Constants';
// const FieldValue = require('firebase-admin').firestore.FieldValue;

export class Notifications {

    static onDeposit = functions.database.ref('/intents/notification/deposit/{ref}')
        .onCreate(async (snapshot, context) => {
            // const firestore = admin.firestore()
            const rtdb = admin.database()
            const messaging = admin.messaging()

            const {
                // type,
                // channel,
                statusSuccess,
                amount,
                userRefKey,
                currency,
                operatorApplication
            } = snapshot.val()

            const callBackFunctionPromise = new Promise((resolve, reject) => {
                rtdb.ref(`/fcm/${operatorApplication}/${userRefKey}`)
                    .once('value', fcmTokenSnapshot => {
                        if (fcmTokenSnapshot.exists) {
                            const token = fcmTokenSnapshot.val()

                            //all values must be a string
                            const message = {
                                data: {
                                    type: `${Constants.TYPE_DEPOSIT}`,
                                    amount: `${amount}`,
                                    currency: `${currency}`,
                                    statusSuccess: statusSuccess ? 'success' : 'failed',
                                },
                                token,
                                notification: {
                                    title: 'ignore',
                                    body: 'ignore',
                                }
                            };
                            messaging.send(message)
                                .then(ignore => {
                                    snapshot.ref.remove()
                                        .then(messageidIgnored => resolve())
                                })
                                .catch(ignore3 => reject('an unexpected error occured during a notification'))
                        } else {
                            reject(`user with refkey: ${userRefKey} seem not to have an fcm token saved on rtdb`)
                        }
                    })
            })
            return callBackFunctionPromise

        });

    static onNotification = functions.database.ref('/intents/notification/generic/{ref}')
        .onCreate(async (snapshot, context) => {
            // const firestore = admin.firestore()
            const rtdb = admin.database()
            const messaging = admin.messaging()

            const {
                title_en,
                title_fr,
                message_en,
                message_fr,
                data,
                userRefKey,
                operatorApplication
            } = snapshot.val()

            const callBackFunctionPromise = new Promise((resolve, reject) => {
                rtdb.ref(`/fcm/${operatorApplication}/${userRefKey}`)
                    .once('value', fcmTokenSnapshot => {
                        if (fcmTokenSnapshot.exists) {
                            const token = fcmTokenSnapshot.val()

                            //all values must be a string
                            const message = {
                                data: {
                                    title_en,
                                    title_fr,
                                    message_en,
                                    message_fr,
                                    ...data,
                                },
                                token,
                                notification: {
                                    title: 'use either title_en or title_fr in the data',
                                    body: 'use either message_en or message_fr in the data',
                                }
                            };
                            messaging.send(message)
                                .then(ignore => {
                                    snapshot.ref.remove()
                                        .then(messageidIgnored => resolve())
                                })
                                .catch(ignore3 => reject('an unexpected error occured during a notification'))
                        } else {
                            reject(`user with refkey: ${userRefKey} seem not to have an fcm token saved on rtdb`)
                        }
                    })
            })
            return callBackFunctionPromise
        });

    static createGenericNotification = async (title_en, title_fr, message_en, message_fr, data, userRefKey) => {
        return admin.database().ref('/intents/notification/generic')
            .push({
                title_en,
                title_fr,
                message_en,
                message_fr,
                data,
                userRefKey,
            })
            .then(ignored => Promise.resolve('ok'))
        // return 'ok'
    }
}