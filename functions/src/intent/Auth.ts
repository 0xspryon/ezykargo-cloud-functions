import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { File } from '../utils/File';
import { Transactions } from '../models/transactions';
import MomoProviders from './../models/MomoProviders'
import { PhonenumberUtils } from '../utils/PhonenumberUtils';
import { MobileMoneyProviders } from '../models/MobileMoneyProviders';
import { ChangePrincipalPhonenumber } from '../models/intents/ChangePrincipalPhonenumber';
import { DeleteAccount } from '../models/intents/DeleteAccount';
import { CryptoUtils } from '../utils/CryptoUtils';
import { UpdateProfileImage } from '../models/intents/UpdateProfileImage';
import { UpdateTransactionCode } from '../models/intents/UpdateTransactionCode';
const FieldValue = require('firebase-admin').firestore.FieldValue;

/*
* responses are given here following the http response codes as per the following link.
* https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
*
*/
export class Auth {
    static FORBIDDEN = 403;
    static CONFLICT = 409;
    static UNPROCESSABLE_ENTITY = 422;
    static DEFAULT_COMMISSION_PRICE = 500; //fcfa

    static onSignUpComplete = functions.database.ref('/intents/sign_up/{auuid}/finished')
        .onCreate((snapshot, context) => {
            const db = admin.database()
            const firestoreDb = admin.firestore()
            if (!snapshot.exists())
                return false

            const auuid = context.params.auuid
            return new Promise((outerPromiseResolve, outerPromiseReject) => {
                // db.ref(`/intents/sign_up/${auuid}`)
                snapshot.ref.parent.once('value', userDataSnapshot => {
                    const userData = userDataSnapshot.val();
                    //move images to correct bucket
                    const promises = []
                    const nic_front_path = userData.NIC_FRONT_JPG.path
                    const nic_back_path = userData.NIC_BACK_JPG.path
                    const profile_path = userData.PROFILE_JPG.path
                    const NIC_FRONT_PATH = `/users/nic/${auuid}/${nic_front_path.split("/").pop()}`
                    const NIC_BACK_JPG_PATH = `/users/nic/${auuid}/${nic_back_path.split("/").pop()}`
                    const PROFILE_JPG_PATH = `/users/avatar/${auuid}/${profile_path.split("/").pop()}`
                    promises.push(File.moveFileFromTo(nic_front_path, NIC_FRONT_PATH))
                    promises.push(File.moveFileFromTo(nic_back_path, NIC_BACK_JPG_PATH))
                    promises.push(File.moveFileFromTo(profile_path, PROFILE_JPG_PATH))
                    //create new user doc to store into firestore
                    const phonenumber = userData.user_info.phonenumber;

                    //@TODO: remember to infer the momo provider from the phonenumber.
                    let momo_provider = userData.user_info.momo_provider;
                    switch (momo_provider) {
                        case 'eum':
                            momo_provider = MomoProviders.EUM;
                            break;
                        default:
                            momo_provider = PhonenumberUtils.getMomoProviderFromNumber(userData.user_info.phonenumber)

                            break;
                    }

                    const userDoc = {
                        fullName: userData.user_info.firstname + " " + userData.user_info.other_name,
                        firstName: userData.user_info.firstname,
                        other_names: userData.user_info.other_name,
                        nicNumber: userData.user_info.nic_number,
                        transaction_pin_code: userData.user_info.transaction_code,
                        nicFrontUrl: NIC_FRONT_PATH,
                        nicBackUrl: NIC_BACK_JPG_PATH,
                        avatarUrl: PROFILE_JPG_PATH,
                        public: true,
                        timestamp: FieldValue.serverTimestamp(),
                        average_rating: 0,
                        rating_count: 0,
                        phonenumber,
                        momoProviders: [
                            { phonenumber, momo_provider },
                            // { momo_provider, phonenumber}
                        ]
                    }
                    console.log(userDoc)
                    const userListDocument = firestoreDb.doc("/bucket/usersList")
                    promises.push(
                        userListDocument.collection('users').add(userDoc)
                            .then((userRef) => {
                                const innerPromise = []
                                innerPromise.push(
                                    firestoreDb.runTransaction(t => {
                                        return t.get(userListDocument)
                                            .then((usersListSnaphsot) => {
                                                if (usersListSnaphsot.exists) {
                                                    const data = usersListSnaphsot.data();
                                                    const count = data.userCount + 1
                                                    t.update(userListDocument, { userCount: count })
                                                } else {
                                                    const count = 1
                                                    t.set(userListDocument, { userCount: count })
                                                }
                                            })
                                    })
                                )
                                const referrerRef = userData.user_info.referrerRef
                                let referralCommissionPrice = 0
                                if (referrerRef)
                                    innerPromise.push(
                                        firestoreDb.collection(`${referrerRef}/referred_ones`)
                                            .add({ fullName: userDoc.fullName, userRef: userRef.path })
                                            .then((ref) => {
                                                console.log({ ref: ref.path })
                                                return firestoreDb.doc(`${Transactions.getRefMoneyAccount(firestoreDb.doc(referrerRef).id)}`).get()
                                                    .then(async referrerMoneyAccountDataSnapshot => {

                                                        let referredOnes = 1;
                                                        if (referrerMoneyAccountDataSnapshot.exists) {
                                                            referredOnes = +referrerMoneyAccountDataSnapshot.get('referred_ones_count')
                                                            referredOnes++
                                                        }

                                                        if (referrerMoneyAccountDataSnapshot.exists) {
                                                            await new Promise((resolve, reject) => {
                                                                admin.database().ref('/params/referral_commission_rate')
                                                                    .orderByChild('max_quantity').startAt(referredOnes)
                                                                    .limitToFirst(1).once('value', querySnapshot => {
                                                                        querySnapshot.forEach(referralSnapshot => {
                                                                            const data = referralSnapshot.val()
                                                                            console.log({ data })
                                                                            referralCommissionPrice = data.price
                                                                            resolve()
                                                                            return true
                                                                        })
                                                                    })
                                                            })
                                                        }


                                                        return referrerMoneyAccountDataSnapshot.ref.set({ referred_ones_count: referredOnes }, { merge: true })
                                                    })
                                            }
                                            )
                                            .catch(errOnCollectionAdd => { console.log({ errOnCollectionAdd }) })
                                    )
                                innerPromise.push(
                                    firestoreDb.doc(Transactions.getRefMoneyAccount(userRef.id))
                                        .set({
                                            balance: 0,
                                            escrowTotal: 0,
                                            withdrawCount: 0,
                                            withdrawTotal: 0,
                                            depositCount: 0,
                                            referred_ones_count: 0,
                                            referralCommissionCount: 0,
                                            referralCommissionPrice,
                                            referrerRef: referrerRef ? referrerRef : 'EZYKARGO',
                                        })
                                        .then(() => {
                                            return firestoreDb.doc(Transactions.moneyAccount).get()
                                                .then(docSnapshot => {
                                                    let count = 1
                                                    if (docSnapshot.exists) {
                                                        count = +docSnapshot.get('count')
                                                        count++
                                                        return docSnapshot.ref.update({ count })
                                                    }
                                                    return docSnapshot.ref.set({ count })
                                                })
                                        })
                                        .catch(err => Promise.reject(err))
                                )
                                innerPromise.push(
                                    db.ref(`/users/${auuid}`).set(userRef.path)
                                )
                                innerPromise.push(
                                    db.ref(`/user_phonenumbers/${phonenumber}`).set(true)
                                )
                                return Promise.all(innerPromise)
                            })
                            .catch(err => Promise.reject(err))
                    )

                    Promise.all(promises)
                        .then(() => {
                            db.ref(`/intents/sign_up/${auuid}/response/code`).set(201)
                                .then(() => {
                                    outerPromiseResolve()
                                })
                        })
                        .catch(err => {
                            console.log(err)
                            outerPromiseReject(err)
                        })

                })
            })
        })

    static markPhoneNumberAsUsed = async (phoneNumber) => {
        return admin.firestore().collection("/used_phone_numbers").add({
            phoneNumber: phoneNumber
        });
    }

    static addWithdrawalPhonenumber = functions.database.ref('intents/add_withdrawal_phonenumber/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const firestoreDb = admin.firestore();
            const intent = snapshot.val() as AddwithdrawalPhonenumber

            return firestoreDb.doc(intent.userRef).get()
                .then(userdoc => {
                    const { momoProviders } = userdoc.data();
                    if (momoProviders.lenght > 3) {
                        return snapshot.ref.child('response')
                            .set({ code: +Auth.FORBIDDEN })
                    }
                    if (intent.phonenumber.length < 9) {
                        return snapshot.ref.child('response')
                            .set({ code: +Auth.UNPROCESSABLE_ENTITY })
                    }
                    const phonenumber = `+237${intent.phonenumber}`

                    if (momoProviders.some(momoProvider => momoProvider.phonenumber === phonenumber)) {
                        return snapshot.ref.child('response').set({ code: Auth.CONFLICT })
                    }

                    const momo_provider = intent.momo_provider === MobileMoneyProviders.EUM ? intent.momo_provider : PhonenumberUtils.getMomoProviderFromNumber(phonenumber)
                    console.log({ momo_provider, phonenumber })
                    if (!momo_provider) return snapshot.ref.child('response').set({ code: 404 })

                    momoProviders.push({
                        momo_provider,
                        phonenumber,
                        // rather using the time given by the client here because
                        // arrays can't have as direct children arrays on firestore
                        // and the firebase.firestore.fieldValue.serverTimeStamp seem to be an array.
                        createdAt: +intent.createdAtDateTimeMillis
                    })

                    return userdoc.ref.set({ ...userdoc.data(), momoProviders })
                        .then(() => snapshot.ref.child('response').set({ code: 201 }))
                        .catch(() => snapshot.ref.child('response').set({ code: 500 }))

                })
        })

    static deleteWithdrawalPhonenumber = functions.database.ref('intents/delete_withdrawal_phonenumber/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const firestoreDb = admin.firestore();
            const intent = snapshot.val() as AddwithdrawalPhonenumber

            return firestoreDb.doc(intent.userRef).get()
                .then(userdoc => {
                    const { momoProviders } = userdoc.data();
                    if (momoProviders.lenght === 1) {
                        return snapshot.ref.child('response')
                            .set({ code: +Auth.FORBIDDEN })
                    }

                    const index = momoProviders.findIndex(momoProvider => momoProvider.phonenumber === intent.phonenumber)
                    momoProviders.splice(index, 1)

                    return userdoc.ref.set({ ...userdoc.data(), momoProviders })
                        .then(() => snapshot.ref.child('response').set({ code: 200 }))
                        .catch(() => snapshot.ref.child('response').set({ code: 500 }))

                })
        })

    static changePrincipalPhonenumber = functions.database.ref('intents/change_principal_phonenumber_intent/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const db = admin.database();
            const firestoreDb = admin.firestore();
            const intent = snapshot.val() as ChangePrincipalPhonenumber

            if (intent.newUuid === intent.previousUuid) return snapshot.ref.child("response").set({ code: 201 })

            return firestoreDb.doc(intent.userRef).get()
                .then(userDoc => new Promise((resolve, reject) => {
                    const { phonenumber } = userDoc.data();
                    if (phonenumber === intent.previousPhonenumber) {
                        const promisses = [];
                        const promise1 = userDoc.ref.set({ phonenumber: intent.newPhonenumber }, { merge: true })
                        const promise2 = db.ref(intent.previousUuid).remove()
                        const promise3 = db.ref(`users/${intent.newUuid}`).set(userDoc.ref.path)

                        promisses.push(promise1, promise2, promise3)
                        return Promise.all(promisses)
                            .then(() => {
                                snapshot.ref.child('response').set({ code: 200 })
                                    .then(() => resolve())
                            })
                            .catch(() => {
                                snapshot.ref.child('response').set({ code: 500 })
                                    .then(() => reject())
                            })

                    } else {
                        return snapshot.ref.child('response').set({ code: +Auth.FORBIDDEN })
                    }
                }))
        })

    static updateProfileImage = functions.database.ref('intents/change_profile_image/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const db = admin.database().ref();
            const firestoreDb = admin.firestore();
            const intent = snapshot.val() as UpdateProfileImage

            return firestoreDb.doc(intent.userRef).get()
                .then(userDoc => new Promise((resolve, reject) => {
                    const userData = userDoc.data()
                    const { avatarUrl } = userData;
                    const splits = avatarUrl.split('/')
                    splits.splice(splits.length - 1, 1)
                    splits.push(`${intent.imageStorageRef.split('/').pop()}`)
                    const newImagePath = `${splits.join('/')}`
                    const promise1 = File.moveFileFromTo(intent.imageStorageRef, newImagePath)
                    const promise2 = userDoc.ref.set({ avatarUrl: newImagePath }, { merge: true })
                    const deletedProfileImageRef = db.child("trash/deleted_profile_images").push()
                    const promise3 = deletedProfileImageRef.set({
                        userRef: intent.userRef,
                        avatarUrl,
                        //made a mistake here of saving FieldValue.TIMESTAMP() which is a
                        //firestore method meanwhile I was trying to save rather to the 
                        //realtime database. so don't confuse and save a realtime database
                        //value in firestore or the other way round( this above case)
                        deletedAt: admin.database.ServerValue.TIMESTAMP,
                    })
                    Promise.all([promise1, promise2, promise3])
                        .then(() => {
                            snapshot.ref.child('response').set({ code: 200 })
                            resolve()
                        })
                        .catch(() => {
                            snapshot.ref.child('response').set({ code: 500 })
                            reject()
                        })

                }))
        })

    static verifyUserDoesNotExistInDb = (uuid: string) => {
        const db = admin.database();
        const ref = db.ref(`users/${uuid}`);
        return new Promise((resolve, reject) => {
            ref.once("value", function (snapshot) {
                if (snapshot.exists()) {
                    reject(false);
                    ;
                } else {
                    resolve(true);
                }
            })
        });
    }

    static deletewithdrawalPhonenumber = functions.database.ref('intents/delete_account/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const intent = snapshot.val() as DeleteMomoProvider

            //@Fixme: checkout later on how to delete a user account created through firebase auth via code( js/nodejs)
            const doc = admin.firestore().doc(intent.ref_path);
            const firebaseDbRef = admin.database().ref(`users/${intent.auth_uid}`);
            const promises: Promise<any>[] = [doc.delete(), firebaseDbRef.remove(), snapshot.ref.remove()];
            return Promise.all(promises);
        });

    static onDeleteAccount = functions.database.ref('intents/delete_account/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const intent = snapshot.val() as DeleteAccount
            const firestoreDb = admin.firestore()
            const db = admin.database().ref()

            return firestoreDb.doc(intent.userRef).get()
                .then(async userSnapshot => {
                    const userData = userSnapshot.data()
                    const encryptedTransactionCode = await CryptoUtils.encrypt(intent.transactionCode, 'secret_key_here')

                    console.log({ encryptedTransactionCode, givenCode: userData.transaction_pin_code })
                    if (encryptedTransactionCode === userData.transaction_pin_code) {
                        const promisses = [];
                        const promise1 = userSnapshot.ref.set(
                            {
                                isDeleted: true,
                                deletedAt: FieldValue.serverTimestamp()
                            },
                            { merge: true }
                        )
                        const promise2 = db.child(`users/${intent.auuid}`).remove()
                        promisses.push(promise1, promise2)
                        return new Promise((resolve, reject) => {
                            Promise.all(promisses)
                                .then(() => {
                                    snapshot.ref.child('response').set({ code: 200 })
                                        .then(() => resolve())
                                    resolve()
                                })
                                .catch(() => {
                                    snapshot.ref.child('response').set({ code: 500 })
                                        .then(() => reject())
                                })

                        })
                    }
                    return snapshot.ref.child('response').set({ code: 401 })
                    // })
                })
        });
    static onUpdateTransactionCode = functions.database.ref('intents/update_transaction_code/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const intent = snapshot.val() as UpdateTransactionCode
            const firestoreDb = admin.firestore()

            return firestoreDb.runTransaction(t => {
                return t.get(firestoreDb.doc(intent.userRef))
                    .then(async userSnapshot => {
                        const userData = userSnapshot.data()
                        const encryptedTransactionCode = await CryptoUtils.encrypt(intent.currentTransactionCode, 'secret_key_here')

                        console.log({ encryptedTransactionCode, givenCode: userData.transaction_pin_code })
                        if (encryptedTransactionCode === userData.transaction_pin_code) {

                            const newEncryptedTransactionCode = await CryptoUtils.encrypt(intent.newTransactionCode, 'secret_key_here')
                            return userSnapshot.ref.set(
                                { transaction_pin_code: newEncryptedTransactionCode },
                                { merge: true }
                            )
                                .then(() => snapshot.ref.child('response').set({ code: 200 }))
                                .catch(() => snapshot.ref.child('response').set({ code: 500 }))
                        }
                        return snapshot.ref.child('response').set({ code: 401 })
                    });
            })

        });
}

