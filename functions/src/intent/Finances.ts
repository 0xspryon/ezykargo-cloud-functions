import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
const rp = require('request-promise');
import * as express from 'express';
import * as bodyParser from "body-parser";
/*
* responses are given here following the http response codes as per the following link.
* https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
*
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
        console.log({ requestBody: JSON.parse(req.body) })

        if (req.method === 'OPTIONS') {
            // Send response to OPTIONS requests
            res.set('Access-Control-Allow-Methods', 'GET');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
        } else {
            // Set CORS headers for the main request
            //main code goes in here like below instruction
            res.status(200).json({ status: 200 });
        }
    });


    static onPayment = functions.database.ref('/intents/pay/{today_midnight}/{ref}')
        .onCreate((snapshot, context) => {
            /* Wecashup accepts request with content type set to url-encoded */
            const data = snapshot.val()
            let myShareInSplitted = +data.amount;
            let transactionInvitees;
            let splitPaymentPartners = data.splitPaymentPartners

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
            let formData = {
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

                const db = admin.database()
                const data = change.after.val()


                console.log({ data })
                let formData = {
                    merchant_public_key: functions.config().wecashup.merchant_public_key,
                    merchant_secret: functions.config().wecashup.merchant_secret_key,
                    transaction_token: data.transaction_token,
                    transaction_uid: data.transaction_uid,
                    transaction_confirmation_code: data.transaction_provider_code,
                    transaction_provider_name: data.transaction_provider_name,
                    _method: 'PATCH'

                }

                console.log({ formData })

                /* Wecashup accepts request with content type set to url-encoded
                 * setting the property form below in the optionss of request promise
                 * automatically sets the request type to url-form-encoded
                 */
                var options = {
                    method: 'POST',
                    uri: `https://www.wecashup.com/api/v2.0/merchants/${functions.config().wecashup.merchant_uid}/transactions/${data.transaction_uid}?merchant_secret=${functions.config().wecashup.merchant_secret_key}&merchant_public_key=${functions.config().wecashup.merchant_public_key}`,
                    form: { ...formData },
                };

                return rp(options)
                    .then(function (body) {
                        const bodyData = JSON.parse(body)
                        console.log({ bodyData })
                        return change.after.ref.child('api_response').set(bodyData);
                    })
                    .catch(err => {
                        console.log({ err })
                        return change.after.ref.child('response')
                            .set({ code: 500 })
                    });
            }
        })

}
