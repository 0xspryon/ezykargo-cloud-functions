import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
const rp = require('request-promise');

const FieldValue = require('firebase-admin').firestore.FieldValue;
const easySendUser = functions.config().easy_send.user
const easySendPassword = functions.config().easy_send.password
const EZYKARGO_SENDER_NAME = 'EZYKARGO'


const messageTemplates = {
    freightPayment: {
        en: (data) => `Account credited of ${data.amount}FCFA for ${data.name}, balance: ${data.balance}FCFA. Best Regards EzyKargo`,
        fr: (data) => `Compte crédité de ${data.amount}FCFA pour ${data.name}, solde: ${data.balance}FCFA. Cordialement EzyKargo`,
    },

    freightPaymentOut: {
        en: (data) => `Account debited of ${data.amount}FCFA for ${data.name}, balance: ${data.balance}FCFA. Best Regards EzyKargo`,
        fr: (data) => `Compte débité: ${data.amount}FCFA pour ${data.name}, solde: ${data.balance}FCFA. Cordialement EzyKargo`,
    },

    freightPaymentOwner: {
        en: (data) => `Account credited of ${data.amount}FCFA by ${data.driverName}, balance: ${data.balance}FCFA. Best Regards EzyKargo`,
        fr: (data) => `Compte crédité de ${data.amount}FCFA par ${data.driverName}, solde: ${data.balance}FCFA. Cordialement EzyKargo`,
    },

}


export class Messaging {

    /**
     * sends message to the number given it.
     * @param to: expects number to send to without a '+' infront of the country code.
     * 
     */
    static listenNewMessage = functions.database.ref('/intents/message/{timestamp}/{ref}')
        .onCreate(async (snapshot, context) => {
            const { to, type, data } = snapshot.val()
            // const message = messageTemplates[type][local](data)
            const proms = [messageTemplates[type]['en'](data), messageTemplates[type]['fr'](data)].map(message => {
                const options = {
                    method: 'GET',
                    uri: `https://www.easysendsms.com/sms/bulksms-api/bulksms-api?username=${easySendUser}&password=${easySendPassword}&from=${EZYKARGO_SENDER_NAME}&to=${to}&text=${message}&type=2`,
                };

                return rp(options)
                    .then(function (body) {
                        console.log({ messageBody: body }); // Print the HTML for the Google homepage.
                        return snapshot.ref.remove()
                    })
            })
            return Promise.all(proms)
        });
}