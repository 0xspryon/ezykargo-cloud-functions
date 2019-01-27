import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
const rp = require('request-promise');
import { Constants } from './../utils/Constants'

/*
* responses are given here following the http response codes as per the following link.
* https://en.wikipedia.org/wiki/List_of_HTTP_status_code
*/
export class Finances {
    static FORBIDDEN = 403;
    static CONFLICT = 409;
    static UNPROCESSABLE_ENTITY = 422;

    static onPaymentCallBack = functions.https.onRequest((req, res) => {
        res.set('Access-Control-Allow-Origin', '*');
        console.log({ req })
        // console.log({ requestBody: req.body, method: 'callback' })
        return res.status(200).json({ status: 'created' })
    });

    static onPaymentWebhook = functions.https.onRequest((req, res) => {
        res.set('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Methods', 'GET');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
        }
        else {
            const rtdb = admin.database()
            const firestoreDb = admin.firestore()
            console.log({ requestBody: req.body })
            const {
                transaction_amount,
                transaction_details,
                transaction_uid,
                transaction_token,
                transaction_receiver_currency,
                transaction_type,
                transaction_sender_phone_number,
                merchant_secret,
                transaction_status,
                product_uid
            } = req.body

            //verify merchant secrets match to ascertain it's a genuine api call.
            const merchantSecret = functions.config().wecashup.merchant_secret_key
            if (`${merchantSecret}` !== `${merchant_secret}`) {
                res.status(401).json({ status: 401 });
            }
            rtdb.ref(`temp/transactions/${transaction_uid}`)
                .once('value', transactionSnapshot => {
                    if (transactionSnapshot.exists) {
                        let transaction = transactionSnapshot.val().transaction
                        transaction = {
                            ...transaction,
                            transaction_amount,
                            transaction_details,
                            transaction_uid,
                            transaction_token,
                            transaction_receiver_currency,
                            transaction_type,
                            transaction_sender_phone_number,
                            transaction_status,
                        }

                        if (transaction_status.toLowerCase() === 'paid') {
                            const moneyAccountDoc = firestoreDb.doc(`/bucket/moneyAccount/moneyAccounts/${transaction.transaction_sender_reference}`)
                            moneyAccountDoc.get()
                                .then(moneyAccountSnapshot => {
                                    const moneyAccountData = moneyAccountSnapshot.data()
                                    switch (`${transaction_type}`.toLowerCase()) {
                                        case 'payment':
                                            moneyAccountDoc.collection('transactions').add(transaction)
                                                .then(ignored => {
                                                    transactionSnapshot.ref.remove()
                                                    const { balance } = moneyAccountData
                                                    const flooredValue = +transaction_amount + balance
                                                    const depositCount = +moneyAccountData.depositCount + 1

                                                    moneyAccountDoc.set({
                                                        ...moneyAccountData,
                                                        depositCount,
                                                        balance: +flooredValue
                                                    })
                                                    rtdb.ref('intents/notification/deposit')
                                                        .push({
                                                            // channel: Constants.CHANNEL_INDIVIDUAL,
                                                            currency: transaction_receiver_currency,
                                                            userRefKey: transaction.transaction_sender_reference,
                                                            amount: transaction_amount,
                                                            // type: Constants.TYPE_PAYMENT,
                                                            statusSuccess: true,
                                                        })
                                                        .then(ignored2 => res.status(200).end())
                                                    console.log({ flooredValue, fixed: flooredValue.toFixed(0)})
                                                })
                                            break;
                                    }
                                })
                        } else {
                            transactionSnapshot.ref.remove()
                            rtdb.ref('intents/notification/deposit')
                                .push({
                                    // channel: Constants.CHANNEL_INDIVIDUAL,
                                    currency: transaction_receiver_currency,
                                    userRefKey: transaction.transaction_sender_reference,
                                    amount: transaction_amount,
                                    // type: Constants.TYPE_PAYMENT,
                                    statusSuccess: false,
                                })
                                .then(ignored2 => res.status(200).end())
                        }

                    } else {
                        res.status(404).json({ status: 404 });
                    }

                })
        }
        // return Promise.resolve('ok')
    })

    static onPayment = functions.database.ref('/intents/pay/{today_midnight}/{ref}')
        .onCreate((snapshot, context) => {
            /* Wecashup accepts request with content type set to url-encoded */
            const data = snapshot.val()
            let myShareInSplitted = +data.amount;
            const transactionInvitees = {};
            const splitPaymentPartners = data.splitPaymentPartners

            if (data.splitPaymentPartners) {
                splitPaymentPartners.map((partner, index) => {
                    myShareInSplitted -= +partner.partnerAmountToPay
                    transactionInvitees[`user${index}`] = {
                        transaction_sender_phone_number: partner.partnerPhonenumber,
                        transaction_receiver_total_amount: +data.amount,
                        transaction_sender_preferred_method: 'sms',
                        transaction_receiver_currency: 'XAF',
                    }
                })
            }
            console.log({ data })
            const formData = {
                /* @Warning : you should change this in case you start accepting credit card
                *   as the conversion rate won't be same for someone in a different country say
                *   nigeria with a different money conversion.
                */
                transaction_conversion_rate: 1.0,
                merchant_public_key: functions.config().wecashup.merchant_public_key,
                transaction_type: 'payment',
                transaction_method: 'pull',
                transaction_provider_mode: data.provider.providerMode,
                transaction_receiver_currency: 'XAF',
                transaction_receiver_total_amount: +data.amount,
                transaction_sender_splitted_amount: myShareInSplitted,
                transaction_sender_total_amount: +data.amount,
                transaction_receiver_reference: 'EzyKargo',
                transaction_sender_currency: 'XAF',
                transaction_sender_phone_number: data.phonenumber,
                transaction_sender_firstname: data.firstname,
                transaction_sender_lastname: data.lastname,
                transaction_sender_country_code_iso2: data.country_iso_code,
                transaction_sender_reference: data.userKey,
                transaction_sender_lang: data.locale,
                'transaction_sender-shipping_country_code_iso2': data.country_iso_code,
                'transaction_sender-shipping_town': 'Douala',
                transaction_product_data: {
                    product_1: {
                        name: 'BILLET - YND - BRZ',
                        quantity: 1,
                        'unit-price': 594426,
                        reference: 'YND - BRZ001',
                        category: 'Billettreie',
                        description: 'Voyager en toute sécurité',
                    }
                },
            }

            if (transactionInvitees) {
                formData['transaction_invites'] = transactionInvitees
            }
            console.log({ formData })
            var options = {
                method: 'POST',
                uri: `https://www.wecashup.com/api/v2.0/merchants/${functions.config().wecashup.merchant_uid}/transactions`,
                form: { ...formData },
            };

            return rp(options)
                .then(function (body) {
                    const bodyData = JSON.parse(body)
                    console.log(bodyData)
                    const { transaction_token, transaction_uid } = bodyData.response_content
                    snapshot.ref.child('api_generated_details').set({ transaction_token, transaction_uid });

                    return snapshot.ref.child('response')
                        .set({
                            code: 200,
                            providerList: bodyData.response_content.providers_list,
                        })
                })
                .catch(function (err) {
                    console.log({ err })
                    return snapshot.ref.child('response')
                        .set({ code: 500 })
                });
        })

    static onTransactionCode = functions.database.ref('/intents/pay/{today_midnight}/{ref}/api_generated_details')
        .onUpdate((change, context) => {

            // Exit when the data is deleted or updated at this location.
            //very important for when we delete the data at the parent intent level.
            //function will just start and exit but only after a previous execution will it just simply exit after starting.
            if (change.before.val().transaction_provider_code) {
                console.log('second execution of function and should exit by now')
                return null;
            } else {

                // const providerName = data.transaction_provider_name.charAt(0).toUpperCase() + data.transaction_provider_name.substr(1)
                const data = change.after.val()
                console.log({ data })
                const formData = {
                    merchant_public_key: functions.config().wecashup.merchant_public_key,
                    merchant_secret: functions.config().wecashup.merchant_secret_key,
                    transaction_token: data.transaction_token,
                    transaction_uid: data.transaction_uid,
                    transaction_confirmation_code: data.transaction_provider_code,
                    transaction_provider_name: data.transaction_provider_name,
                    _method: 'PATCH'
                }

                /* Wecashup accepts request with content type set to url-encoded
                 * setting the property form below in the optionss of request promise
                 * automatically sets the request type to url-form-encoded
                 */
                const options = {
                    method: 'POST',
                    uri: `https://www.wecashup.com/api/v2.0/merchants/${functions.config().wecashup.merchant_uid}/transactions/${data.transaction_uid}?merchant_secret=${functions.config().wecashup.merchant_secret_key}&merchant_public_key=${functions.config().wecashup.merchant_public_key}`,
                    form: { ...formData },
                };

                return rp(options)
                    .then(function (body) {
                        const bodyData = JSON.parse(body)
                        change.after.ref.parent.remove();
                        if (parseInt(bodyData.response_code) === 201) {
                            return admin.database().ref(`temp/transactions/${data.transaction_uid}`).set(bodyData.response_content)
                        }
                        return Promise.resolve();
                    })
                    .catch(err => {
                        console.log({ err })
                        const { amount, reference } = data

                        return admin.database().ref('intents/notification/deposit')
                            .push({
                                // channel: Constants.CHANNEL_INDIVIDUAL,
                                currency: 'XAF',
                                userRefKey: reference,
                                amount,
                                // type: Constants.TYPE_PAYMENT,
                                statusSuccess: false,
                            })
                            .then(ignored => {
                                change.after.ref.child('response')
                                    .set({ code: 500 })
                            })
                    });
            }
        })

}
