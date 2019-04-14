import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
const rp = require('request-promise');

const FieldValue = require('firebase-admin').firestore.FieldValue;
const easySendUser = functions.config().easy_send.user
const easySendPassword = functions.config().easy_send.password
const EZYKARGO_SENDER_NAME = 'EZYKARGO'


const messageTemplates = {
    freightPayment: {
        en: (data) => `Payment for ${data.name} success. Balance: ${data.balance} XAF`,
        fr: (data) => `Paiement de ${data.name} success. Solde: ${data.balance} XAF`,
    }
}


export class Messaging {

    /**
     * sends message to the number given it.
     * @param to: expects number to send to without a '+' infront of the country code.
     * 
     */
    static listenNewMessage = functions.database.ref('/intents/message/{timestamp}/{ref}')
        .onCreate(async (snapshot, context) => {
            const { to, type, data, local = 'en' } = snapshot.val()
            const message = messageTemplates[type][local](data)

            const options = {
                method: 'GET',
                uri: `https://www.easysendsms.com/sms/bulksms-api/bulksms-api?username=${easySendUser}&password=${easySendPassword}&from=${EZYKARGO_SENDER_NAME}&to=${to}&text=${message}&type=0`,
            };

            return rp(options)
                .then(function (body) {
                    console.log({ messageBody: body }); // Print the HTML for the Google homepage.
                    return snapshot.ref.remove()
                })

        });
}