import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { File } from '../utils/File';
import { Transactions } from '../models/transactions';
const FieldValue = require('firebase-admin').firestore.FieldValue;


/*
* responses are given here following the http response codes as per the following link.
* https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
*
*/
export class Auth {

    static onSignUpComplete = functions.database.ref('/intents/sign_up/{auuid}/finished')
        .onCreate( (snapshot, context) => {
            const db = admin.database()
            const firestore = admin.firestore()
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
                    const momo_provider = userData.user_info.momo_provider;

                    const userDoc = {
                        fullName: userData.user_info.firstname + " " + userData.user_info.other_name,
                        firstName: userData.user_info.firstname,
                        other_name: userData.user_info.other_name,
                        nicNumber: userData.user_info.nic_number,
                        transaction_pin_code: userData.user_info.transaction_code,
                        nicFrontUrl: NIC_FRONT_PATH,
                        nicBackUrl: NIC_BACK_JPG_PATH,
                        avatarUrl: PROFILE_JPG_PATH,
                        public: true,
                        timestamp: FieldValue.serverTimestamp(),
                        average_rating: 0,
                        rating_count: 0,
                        // account_balance: 0o0,
                        phonenumber,
                        momoProviders: [
                            { phonenumber, momo_provider },
                            // { momo_provider, phonenumber}
                        ]
                    }
                    console.log(userDoc)
                    // new Promise((resolve, reject) => {
                    const userListDocument = firestore.doc("/bucket/usersList")
                    promises.push(
                        userListDocument.collection('users').add(userDoc)
                            .then((userRef) => {
                                const innerPromise = []
                                innerPromise.push(
                                    firestore.runTransaction(t => {
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
                                innerPromise.push(() => {
                                    const userId = userRef.path.split("/").pop()
                                    userRef.id
                                    return firestore.doc(Transactions.getRefMoneyAccount(userId))
                                        .set({
                                            balance: 0,
                                            withdrawCount: 0,
                                            depositCount: 0,
                                            referalCommissionCount: 0,
                                        })
                                })
                                innerPromise.push(
                                    db.ref(`/users/${auuid}`).set(userRef.path)
                                )
                                innerPromise.push(
                                    db.ref(`/user_phonenumbers/${phonenumber}`).set(true)
                                )
                                return Promise.all(innerPromise)
                            })
                            .catch(err => Promise.reject(err))
                        // })
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
    static onAssociateMomoNumberIntent = functions.database.ref('intents/associate_phonenumber/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const db = admin.database();
            const promises: Promise<any>[] = [];
            const intent = snapshot.val() as AssociatePhonenumber

            if (intent.new_uid === intent.current_uid) return snapshot.ref.child("response").set({ code: 201 })

            return Auth.verifyUserDoesNotExistInDb(intent.new_uid)
                .then(result => {
                    return db.ref(`users/${intent.current_uid}`)
                        .once('value', data => {
                            const firestoreRefPathString: string = data.val();
                            const doc = admin.firestore().doc(`${firestoreRefPathString}`).collection(`/momo_providers`).doc();
                            promises.push(
                                doc.set({ momo_provider: intent.momo_provider, phonenumber: intent.new_uid_phonenumber, refPath: doc.path, authUid: intent.new_uid })
                            )

                            promises.push(
                                db.ref(`users/${intent.new_uid}`).set(firestoreRefPathString)
                                    .then(val => {
                                        snapshot.ref.child("response")
                                            .set({ code: 201 })
                                    })
                                    .catch(err => { console.log(`Error writting ressource at "users/${intent.new_uid}"`) })
                            )
                            return Promise.all(promises);
                        })
                })
                .catch(err => {
                    snapshot.ref.child("response")
                        .set({ code: 409 })
                })

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

    static onDeleteMomoProviderIntent = functions.database.ref('intents/delete_momo_provider/{timestamp_midnight_today}/{newRef}')
        .onCreate((snapshot) => {
            const intent = snapshot.val() as DeleteMomoProvider

            //@Fixme: checkout later on how to delete a user account created through firebase auth via code( js/nodejs)
            const doc = admin.firestore().doc(intent.ref_path);
            const firebaseDbRef = admin.database().ref(`users/${intent.auth_uid}`);
            const promises: Promise<any>[] = [doc.delete(), firebaseDbRef.remove(), snapshot.ref.remove()];
            return Promise.all(promises);
        });


}