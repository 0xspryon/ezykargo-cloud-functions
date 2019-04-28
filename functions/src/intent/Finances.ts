import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Referrals } from './Referrals';
import { Constants } from '../utils/Constants';
import { PhonenumberUtils } from '../utils/PhonenumberUtils';
import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
const FieldValue = require('firebase-admin').firestore.FieldValue;
const rp = require('request-promise');

/*
* responses are given here following the http response codes as per the following link.
* https://en.wikipedia.org/wiki/List_of_HTTP_status_code
*/
export class Finances {
  static FORBIDDEN = 403;
  // static EZYKARGO_REFERRER = 'EZYKARGO';
  static CONFLICT = 409;
  static UNPROCESSABLE_ENTITY = 422;
  static ezyowner = 'ezyowner';
  static ezybiz = 'ezybiz';
  static ezytrucker = 'ezytrucker';
  static TON_TO_KILO_DIVISOR = 1000;

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

                          rtdb.ref('z-platform/statistics/finances')
                            .once('value', globalAccountSnapshot => {
                              if (globalAccountSnapshot.exists) {
                                const { platform_balance } = globalAccountSnapshot.val()
                                globalAccountSnapshot.ref.set({ platform_balance: +transaction_amount + platform_balance })
                              } else {
                                globalAccountSnapshot.ref.set({ platform_balance: +transaction_amount })
                              }
                            })

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
                              operatorApplication: Finances.ezybiz
                            })
                            .then(ignored2 => res.status(200).end())
                          console.log({ flooredValue, fixed: flooredValue.toFixed(0) })
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
                  operatorApplication: Finances.ezybiz
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

  static onWithdrawWebhook = functions.https.onRequest((req, res) => {
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
                              operatorApplication: Finances.ezybiz
                            })
                            .then(ignored2 => res.status(200).end())
                          console.log({ flooredValue, fixed: flooredValue.toFixed(0) })
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
                  operatorApplication: Finances.ezybiz
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
        transaction_receiver_webhook_url: functions.config().wecashup.payment_webhook,
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
      const options = {
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

  static onWithdraw = functions.database.ref('/intents/withdraw/{today_midnight}/{ref}')
    .onCreate((snapshot, context) => {
      /* Wecashup accepts request with content type set to url-encoded */
      const data = snapshot.val()
      console.log({ data })
      const formData = {
        /* @Warning : you should change this in case you start accepting credit card
        *   as the conversion rate won't be same for someone in a different country say
        *   nigeria with a different money conversion.
        */
        // transaction_conversion_rate: 1.0,
        merchant_public_key: functions.config().wecashup.merchant_public_key,
        merchant_secret: functions.config().wecashup.merchant_secret_key,
        transaction_receiver_webhook_url: functions.config().wecashup.withdraw_webhook,
        transaction_method: 'push',
        transaction_provider_mode: data.providerMode,
        transaction_provider_name: data.providerName,
        transaction_receiver_reference: data.userKey,
        transaction_receiver_total_amount: +data.amount,
        transaction_receiver_currency: 'XAF',
        transaction_receiver_phone_number: data.phonenumber,
        transaction_receiver_firstname: data.firstname,
        transaction_receiver_lastname: data.lastname,
        transaction_receiver_country_code_iso2: data.country_iso_code,
        transaction_receiver_lang: data.locale,
        transaction_receiver_shipping_country_code_iso2: data.country_iso_code,
        transaction_receiver_shipping_town: 'Douala',
        transaction_receiver_billing_country_code_iso2: 'CM',
        transaction_receiver_billing_town: 'Douala',
        transaction_product_data: {
          product_1: {
            name: 'withdrawal of money',
            quantity: 1,
            'unit-price': +data.amount,
            reference: 'withdrawal',
            category: 'withdrawal',
            description: 'withdrawal of money from ezykargo account to a mobile money account',
          }
        },

      }

      console.log({ formData })
      const options = {
        method: 'POST',
        uri: `https://www.wecashup.com/api/v2.0/merchants/${functions.config().wecashup.merchant_uid}/transactions`,
        form: { ...formData },
      };

      return rp(options)
        .then(function (body) {
          const bodyData = JSON.parse(body)
          console.log(bodyData)
          admin.database().ref(`temp/transactions/${bodyData.response_content.transaction.transaction_uid}`)
            .set({ ...bodyData.response_content.transaction, timestamp: FieldValue.serverTimestamp() })

          return snapshot.ref.child('response')
            .set({
              code: 200,
            })
        })
        .catch(function (err) {
          console.log({ err })
          return snapshot.ref.child('response')
            .set({ code: 500 })
        });
    })

  // static onTransactionCode = functions.database.ref('/intents/pay/{today_midnight}/{ref}/api_generated_details')
  //   .onUpdate((change, context) => {

  //     /**
  //      * Exit when the data is deleted or updated at this location.
  //      * very important for when we delete the data at the parent intent level.
  //      * functimport { Constants } from '../utils/Constants';
  //      * function will just start and exit but only after a previous execution will it just simply exit after starting.
  //     */
  //     if (change.before.val().transaction_provider_code) {
  //       console.log('second execution of function and should exit by now')
  //       return null;
  //     } else {

  //       // const providerName = data.transaction_provider_name.charAt(0).toUpperCase() + data.transaction_provider_name.substr(1)
  //       const data = change.after.val()
  //       console.log({ data })
  //       const formData = {
  //         merchant_public_key: functions.config().wecashup.merchant_public_key,
  //         merchant_secret: functions.config().wecashup.merchant_secret_key,
  //         transaction_token: data.transaction_token,
  //         transaction_uid: data.transaction_uid,
  //         transaction_confirmation_code: data.transaction_provider_code,
  //         transaction_provider_name: data.transaction_provider_name,
  //         _method: 'PATCH'
  //       }

  //       /* Wecashup accepts request with content type set to url-encoded
  //        * setting the property form below in the optionss of request promise
  //        * automatically sets the request type to url-form-encoded
  //        */
  //       const options = {
  //         method: 'POST',
  //         uri: `https://www.wecashup.com/api/v2.0/merchants/${functions.config().wecashup.merchant_uid}/transactions/${data.transaction_uid}?merchant_secret=${functions.config().wecashup.merchant_secret_key}&merchant_public_key=${functions.config().wecashup.merchant_public_key}`,
  //         form: { ...formData },
  //       };

  //       return rp(options)
  //         .then(function (body) {
  //           const bodyData = JSON.parse(body)
  //           change.after.ref.parent.remove();
  //           if (parseInt(bodyData.response_code) === 201) {
  //             return admin.database().ref(`temp/transactions/${data.transaction_uid}`).set({ ...bodyData.response_content, timestamp: FieldValue.serverTimestamp() })
  //           }
  //           return Promise.resolve();
  //         })
  //         .catch(err => {
  //           console.log({ err })
  //           const { amount, reference } = data

  //           return admin.database().ref('intents/notification/deposit')
  //             .push({
  //               // channel: Constants.CHANNEL_INDIVIDUAL,
  //               currency: 'XAF',
  //               userRefKey: reference,
  //               amount,
  //               // type: Constants.TYPE_PAYMENT,
  //               statusSuccess: false,
  //               operatorApplication: Finances.ezybiz
  //             })
  //             .then(ignored => {
  //               change.after.ref.child('response')
  //                 .set({ code: 500 })
  //             })
  //         });
  //     }
  //   })

  static putMoneyInEscrow = async (amountToBePutInEscrow, referenceString, userRefString) => {
    const firestore = admin.firestore()
    const batch = firestore.batch()
    const userRef = firestore.doc(userRefString)
    const productRef = firestore.doc(referenceString)
    const accountSnapshot = await firestore.doc(`/bucket/moneyAccount/moneyAccounts/${userRef.id}`).get()
    if (accountSnapshot.exists) {
      const data = accountSnapshot.data()
      const { balance, escrowTotal } = data
      if (balance >= escrowTotal + amountToBePutInEscrow && amountToBePutInEscrow > 0) {
        const escrowRef = firestore.doc(
          `/bucket/moneyAccount/moneyAccounts/${userRef.id}/escrow/${productRef.id}`
        )
        batch.set(
          escrowRef,
          {
            account_balance: balance,
            amount_in_escrow: amountToBePutInEscrow,
            referenceString,
            timestamp: FieldValue.serverTimestamp(),
          }
        )
        batch.update(
          accountSnapshot.ref,
          {
            escrowTotal: escrowTotal + amountToBePutInEscrow
          }
        )

        return batch.commit()
          .then(ignored => {
            return {
              message: 'ok',
              successStatus: true,
            }
          });

      }
      return {
        amountBefore: balance,
        amountInEscrow: amountToBePutInEscrow,
        referenceString,
        userRefString,
        successStatus: false,
        message: "balance inssufficient",
      }
    }

    return {
      amountInEscrow: amountToBePutInEscrow,
      referenceString,
      userRefString,
      successStatus: false,
      message: "account doesn't exist",
    }
  }

  static removeMoneyFromEscrow = async (referenceString, userRefString) => {
    const firestore = admin.firestore()
    const db = admin.database()
    const userRef = firestore.doc(userRefString)
    const productRef = firestore.doc(referenceString)
    const accountSnapshot = await firestore.doc(`/bucket/moneyAccount/moneyAccounts/${userRef.id}`).get()
    if (accountSnapshot.exists) {
      const { escrowTotal } = accountSnapshot.data()
      // / bucket / moneyAccount / moneyAccounts / 3gYdziYlvRJTPokN8Eg5
      return firestore.doc(`/bucket/moneyAccount/moneyAccounts/${userRef.id}/escrow/${productRef.id}`).get()
        .then(escrowSnapshot => {
          console.log({ escrow: escrowSnapshot.data(), escrowRef: escrowSnapshot.ref.path })
          const { amount_in_escrow } = escrowSnapshot.data()
          return accountSnapshot.ref.set({
            escrowTotal: escrowTotal - amount_in_escrow
          }, { merge: true }).then(ignored => {
            return escrowSnapshot.ref.delete()
              .then(ignored2 => { return { successStatus: true, message: 'ok' } })
          })
        })
    }

    return {
      referenceString,
      userRefString,
      successStatus: false,
      message: "account doesn't exist",
    }

  }

  static payMoneyInEscrow = functions.database.ref('/intents/freightage_complete/{timestamp}/{push_id}')
    .onCreate(async (snapshot, context) => {
      const escrowRefString = snapshot.val()
      const firestore = admin.firestore()
      const database = admin.database()
      const escrowRef = firestore.doc(escrowRefString)
      const escrowSnapshot = await escrowRef.get()

      if (!escrowSnapshot.exists) {
        return Promise.reject("The escrow in question doesn't exist. Seems like he overpressed a button")
      }

      const { amount_in_escrow, referenceString } = escrowSnapshot.data()
      /* once the data gotten, delete the escrow in question to avoid concurrent executions
      *  of this function on the same escrow which can bring in race conditions 
      */
      // escrowSnapshot.ref.delete()

      const freightageSnapshot = await firestore.doc(referenceString).get()
      const { amount: frieghtageRequestPrice, bizAmount, drivers, title, weight: weight_in_kg } = freightageSnapshot.data()
      const bizTotalAmountToPay = bizAmount * weight_in_kg / Finances.TON_TO_KILO_DIVISOR

      let ezykargoAmount = bizTotalAmountToPay
      const trucker_owner_amount = frieghtageRequestPrice - (frieghtageRequestPrice * 12 / 100)
      const driverData = drivers.map(driverDatum => {
        const totalWeight = driverDatum.items.reduce(
          (acc, curItem) => {
            const { carrying_quantity, weight } = curItem
            return acc + (carrying_quantity * weight)
          },
          0
        )

        const priceToBePaid = (totalWeight * trucker_owner_amount) / Finances.TON_TO_KILO_DIVISOR
        ezykargoAmount = ezykargoAmount - priceToBePaid
        return ({
          priceToBePaid,
          driverRefString: driverDatum.driverRef,
          // truckRef: driverData.truckRef,
        })
      })

      console.log({ driverData })

      return new Promise(async (resolve, reject) => {
        const ezyBizMoneyAccountSnapshot = await escrowSnapshot.ref.parent.parent.get()
        const {
          balance,
          escrowTotal,
          is_active,
          referralCommissionCount: ezyBizReferralCommissionCount,
          referrerRef: ezyBizReferrerRefString,
        } = ezyBizMoneyAccountSnapshot.data()

        const newBalance = balance - bizTotalAmountToPay;
        const newEscrowTotal = escrowTotal - bizTotalAmountToPay;

        /**
         * Update the active_refferer_count of the referrer of this ezybiz
         */
        if (!is_active && ezyBizReferrerRefString !== Constants.EZYKARGO_REFERRER) {
          await firestore.doc(ezyBizReferrerRefString).get()
            .then(async referrerMoneyAccountSnapshot => {
              if (referrerMoneyAccountSnapshot.exists) {
                const { active_referred_ones_count } = referrerMoneyAccountSnapshot.data()
                return referrerMoneyAccountSnapshot.ref.set({
                  active_referred_ones_count: 1 + active_referred_ones_count,
                  // is_active: true,
                }, { merge: true })
              }
              return false
            })
        }

        //send commission of ezybiz referrer
        const promises = []
        if (ezyBizReferrerRefString !== Constants.EZYKARGO_REFERRER && ezyBizReferralCommissionCount < Constants.MAX_REFERRAL_COMMISSIONS) {
          promises.push(
            Referrals.cutReferralCommission(
              `/bucket/usersList/users/${ezyBizMoneyAccountSnapshot.ref.id}`
            )
          )
        }

        //pay drivers, owners and their respective referrers
        driverData.forEach(async driverDatum => {
          let driverName; //represents the drivername used by owner to identify driver during message of payment.
          const driverRef = firestore.doc(driverDatum.driverRefString)
          const driverMoneyAccountRef = firestore.doc(`/bucket/moneyAccount/moneyAccounts/${driverRef.id}`)
          const driverAndMoneysnapshot: DocumentSnapshot[] = await Promise.all([
            driverRef.get(),
            driverMoneyAccountRef.get()
          ])

          const driver_data: any = driverAndMoneysnapshot.reduce((acc, tempSnapshot) => ({ ...acc, ...tempSnapshot.data() }), {})

          const subPromises = []
          console.log({ driver_data })
          const {
            referrerRef: driverRefererRefString,
            truck,
            is_active: isDriverActive,
            referralCommissionCount: driverReferralComissionCount,
          } = driver_data

          /**
           * Update the active_refferer_count of the referrer
           */
          if (Boolean(driverRefererRefString) && driverRefererRefString !== Constants.EZYKARGO_REFERRER && !isDriverActive) {
            firestore.doc(driverRefererRefString).get()
              .then(async referrerMoneyAccountSnapshot => {
                if (referrerMoneyAccountSnapshot.exists) {
                  const { active_referred_ones_count } = referrerMoneyAccountSnapshot.data()
                  return referrerMoneyAccountSnapshot.ref.set({
                    active_referred_ones_count: 1 + active_referred_ones_count,
                  }, { merge: true })
                }
                return false
              })
          }
          if (driverRefererRefString !== Constants.EZYKARGO_REFERRER && driverReferralComissionCount < Constants.MAX_REFERRAL_COMMISSIONS) {
            subPromises.push(
              Referrals.cutReferralCommission(`/bucket/usersList/users/${driverRef.id}`)
            )
          }

          const driverPriceToBePaidShare = (driverDatum.priceToBePaid * truck.percentage) / 100
          subPromises.push(
            firestore.runTransaction(t => {
              return t.get(driverMoneyAccountRef)
                .then(driverMoneyAccountSnapshot => {
                  const { balance: driverMoneyAccountBalance } = driverMoneyAccountSnapshot.data()
                  const driverNewBalance = driverMoneyAccountBalance + driverPriceToBePaidShare
                  t.update(
                    driverMoneyAccountRef,
                    { balance: driverNewBalance, is_active: true, }
                  )
                  return {
                    driverNewBalance,
                    amountPaid: driverPriceToBePaidShare,
                    previousBalance: driverMoneyAccountBalance
                  }
                })
            })
              .then(({ driverNewBalance, amountPaid, previousBalance }) => {
                const prom1 = driverMoneyAccountRef.collection('transactions').add({
                  type: 'pay_in',
                  amount: amountPaid,
                  newAmount: driverNewBalance,
                  finished: true,
                  prevAmount: previousBalance,
                  timestamp: FieldValue.serverTimestamp(),
                  channel: 'internal',
                })
                const prom2 = firestore.doc(`bucket/usersList/users/${driverMoneyAccountRef.id}`).get()
                  .then(async driverSnapshot => {
                    const { phonenumber: truckerPhonenumber, fullName: truckerFullName, truck:truckerTruck, avatarUrl } = driverSnapshot.data()
                    driverName = truckerFullName;

                    /**
                     * Add trucker transaction into the transaction collection of the truck
                     */
                    await firestore.collection(`${truckerTruck.truckRef}/transactions`)
                      .add({
                        type: 'pay_in',
                        amount: amountPaid,
                        timestamp: FieldValue.serverTimestamp(),
                        truckerRef: driverSnapshot.ref,
                        truckerName: truckerFullName,
                        finished: true,
                        avatarUrl, 
                      })

                    const driverMessagePaymentIntent = {
                      type: Constants.MESSAGE_TYPE_FRIEGHT_PAYMENT,
                      to: PhonenumberUtils.parsePhonenumberForMessaging(truckerPhonenumber),
                      data: {
                        name: title,
                        amount: amountPaid,
                        balance: driverNewBalance,
                      }
                    }

                    console.log({ ezyBizMessagePaymentIntent: driverMessagePaymentIntent })
                    return database.ref(`/intents/message/${context.params.timestamp}`)
                      .push(driverMessagePaymentIntent)




                  })
                return Promise.all([prom1, prom2])
                // .then(ignored => true)
              })
          )

          const ownerRef = firestore.doc(truck.userRef)
          const ownerMoneyAccountRef = firestore.doc(`/bucket/moneyAccount/moneyAccounts/${ownerRef.id}`)
          const ownerPriceToBePaidShare = driverDatum.priceToBePaid * ((100 - truck.percentage) / 100)
          subPromises.push(
            firestore.runTransaction(t => {
              return t.get(ownerMoneyAccountRef)
                .then(async ownerMoneyAccountSnapshot => {
                  const {
                    balance: ownerMoneyAccountBalance,
                    referrerRef: ezyownerReferrerRefString,
                    is_active: isOwnerActive,
                    referralCommissionCount: ezyownerReferralCommissionCount,
                  } = ownerMoneyAccountSnapshot.data()

                  /**
                  * Update the active_refferer_count of the referrer
                  */
                  if (!isOwnerActive && driverRefererRefString !== Constants.EZYKARGO_REFERRER) {
                    firestore.doc(ezyownerReferrerRefString).get()
                      .then(async referrerMoneyAccountSnapshot => {
                        if (referrerMoneyAccountSnapshot.exists) {
                          const { active_referred_ones_count } = referrerMoneyAccountSnapshot.data()
                          return referrerMoneyAccountSnapshot.ref.set({
                            active_referred_ones_count: 1 + active_referred_ones_count,
                          }, { merge: true })
                        }
                        return true
                      })
                  }

                  t.update(
                    ownerMoneyAccountSnapshot.ref,
                    {
                      is_active: true,
                      balance: ownerMoneyAccountBalance + ownerPriceToBePaidShare,
                    }
                  )
                  return {
                    ezyownerReferrerRefString,
                    newBalance: ownerMoneyAccountBalance + ownerPriceToBePaidShare,
                    amount: ownerPriceToBePaidShare,
                    previousBalance: ownerMoneyAccountBalance,
                    ezyownerReferralCommissionCount,
                  }
                })
            })
              .then(({ previousBalance, ezyownerReferrerRefString, ezyownerReferralCommissionCount, newBalance: ownerNewBalance, amount }) => {
                if (ezyownerReferrerRefString !== Constants.EZYKARGO_REFERRER && ezyownerReferralCommissionCount < Constants.MAX_REFERRAL_COMMISSIONS_EZYOWNER) {
                  return Referrals.cutReferralCommission(ezyownerReferrerRefString)
                }
                const prom1 = ownerMoneyAccountRef.collection('transactions').add({
                  type: 'pay_in',
                  amount: ownerPriceToBePaidShare,
                  prevAmount: previousBalance,
                  newAmount: ownerNewBalance,
                  finished: true,
                  channel: 'internal',
                  timestamp: FieldValue.serverTimestamp(),
                })
                const prom2 = firestore.doc(`bucket/usersList/users/${ownerRef.id}`).get()
                  .then(ownerSnapshot => {
                    const { phonenumber: ownerPhonenumber } = ownerSnapshot.data()
                    const ownerMessagePaymentIntent = {
                      type: Constants.MESSAGE_TYPE_FRIEGHT_PAYMENT_TO_OWNER,
                      to: PhonenumberUtils.parsePhonenumberForMessaging(ownerPhonenumber),
                      data: {
                        name: title,
                        amount: ownerPriceToBePaidShare,
                        balance: ownerNewBalance,
                        driverName: driverName,
                      }
                    }
                    console.log({ ezyBizMessagePaymentIntent: ownerMessagePaymentIntent })
                    return database.ref(`/intents/message/${context.params.timestamp}`)
                      .push(ownerMessagePaymentIntent)
                  })

                return Promise.all([prom1, prom2])
                // .then(ignored => true)
              })
          )

          return Promise.all(subPromises)
            .then(ignored => escrowRef.delete())
        })



        /**
         * Update the is_active state of ezybiz, balance and escrowTotal ac all of his transactions
         * deduce account of ezybiz.
         * No need to verify state of being active before updating.
         */
        promises.push(
          ezyBizMoneyAccountSnapshot.ref.set(
            {
              is_active: true,
              balance: newBalance,
              escrowTotal: newEscrowTotal,
            },
            { merge: true }
          )
        )

        //add transaction on ezybiz
        promises.push(
          ezyBizMoneyAccountSnapshot.ref.collection('transactions').add({
            type: 'pay_out',
            amount: bizTotalAmountToPay,
            prevAmount: balance,
            finished: true,
            timestamp: FieldValue.serverTimestamp(),
            channel: 'internal',
            newAmount: newBalance,
          })
        )

        /**
         * Send message to ezybiz to notify him of the payment.
         */
        firestore.doc(`bucket/usersList/users/${ezyBizMoneyAccountSnapshot.id}`).get()
          .then(ezybizSnapshot => {
            const { phonenumber: ezybizPhonenumber } = ezybizSnapshot.data()
            const ezyBizMessagePaymentIntent = {
              type: Constants.MESSAGE_TYPE_FRIEGHT_PAYMENT_OUT,
              to: PhonenumberUtils.parsePhonenumberForMessaging(ezybizPhonenumber),
              data: {
                amount: bizTotalAmountToPay,
                name: title,
                balance: newBalance,
              }
            }
            return database.ref(`/intents/message/${context.params.timestamp}`)
              .push(ezyBizMessagePaymentIntent)
          })
          .catch(err => {
            //do nothing
          })

        //setting ezykargoPlatformEzybizReferralCommission
        const ezyKargoPlatformEzybizCommission = ezykargoAmount
        promises.push(
          Finances.addEzyKargoPlatformTransaction(ezyKargoPlatformEzybizCommission, `firestoreRef : ${freightageSnapshot.ref.path}`)
        )
        Promise.all(promises)
          .then(() => resolve())
          .catch(err => reject(err))
      })
      // }
      // else 
    })

  /*
  * @params:
  * -amount: greater than zero value
  * -decriment: whether the amount should be decrimented from the platform if true and otherwise if false
  * @return
  * -Promise<{}>
  */
  public static addEzyKargoPlatformTransaction = async (amount, reason, decrement = false) => {
    let actualAmount = amount
    if (decrement) actualAmount = -actualAmount
    const accountRef = admin.database().ref('z-platform/statistics/finances')
    accountRef.child('pending_transactions').push({
      amount,
      shouldIncrement: !decrement,
      reason,
    })
  }

  public static cronFinance = () => {
    return new Promise(async (resolve, reject) => {
      const rtdb = admin.database()
      const firestoreDb = admin.firestore()
      const promises = []

      const accountRef = rtdb.ref('z-platform/statistics/finances')
      accountRef.child('pending_transactions')
        .once('value', pendingTransactionsListSnapshot => {
          let TotalAmountToSave = 0;
          const transactionsToBeLogged = []
          let platformBalanceBefore;
          let platformBalanceAfter;

          pendingTransactionsListSnapshot.forEach(transactionSnapshot => {
            const { amount, shouldIncrement, reason } = transactionSnapshot.val()
            let actualAmount = amount
            if (!shouldIncrement) actualAmount = -amount
            TotalAmountToSave += actualAmount

            transactionsToBeLogged.push({
              amount,
              shouldIncrement,
              reason,
            })

            transactionSnapshot.ref.remove()
            return true;
          })

          promises.push(accountRef.child('balance').transaction(financesAccount => {
            if (financesAccount) {
              const { ezykargo_balance } = financesAccount
              platformBalanceBefore = ezykargo_balance
              platformBalanceAfter = TotalAmountToSave + ezykargo_balance
              return { ...financesAccount, ezykargo_balance: platformBalanceAfter }
            } else {
              platformBalanceAfter = TotalAmountToSave
              return { ...financesAccount, ezykargo_balance: platformBalanceAfter }
            }
          }))

          const docRef = firestoreDb.collection('bucket/finances/savedTransactions/').doc()
          promises.push(docRef.set({
            timeStamp: admin.firestore.FieldValue.serverTimestamp(),
            balanceBefore: platformBalanceBefore,
            balanceAfter: platformBalanceAfter,
            TotalAmountToSave,
            transactionsToBeLogged,
            path: docRef.path,
          }))

          Promise.all(promises)
            .then(() => resolve())
            .catch(err => {
              console.log({ err, path: docRef.path })
              rtdb.ref('z-platform/statistics/errors')
                .push({
                  message: 'error at saving platform balance.',
                  balanceBefore: platformBalanceBefore,
                  balanceAfter: platformBalanceAfter,
                  TotalAmountToSave,
                  transactionsToBeLogged,
                  path: docRef.path,
                })
                .then(ignored => reject())
            })
        })
    })
    return Promise.resolve()
  }

}
