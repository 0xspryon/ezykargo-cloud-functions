import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {File} from '../utils/File';
const FieldValue = require('firebase-admin').firestore.FieldValue;


 /*
 * responses are given here following the http response codes as per the following link.
 * https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
 *
 */
export class Auth {

    static onSignUpComplete = functions.database.ref('/intents/sign_up/{auuid}/finished')
        .onCreate(async (snapshot,context)=>{
            if(!snapshot.val())
                return false
            const auuid = context.params.auuid
            const userDataSnapshot = await admin.database().ref(`/intents/sign_up/${auuid}`).once('value')
            //move images to correct bucket
            const promises = []
            const nic_front_path = userDataSnapshot.val().NIC_FRONT_JPG.path
            const nic_back_path = userDataSnapshot.val().NIC_BACK_JPG.path
            const profile_path = userDataSnapshot.val().PROFILE_JPG.path
            const NIC_FRONT_PATH = `/users/nic/${auuid}/${nic_front_path.split("/").pop()}`
            const NIC_BACK_JPG_PATH = `/users/nic/${auuid}/${nic_back_path.split("/").pop()}`
            const PROFILE_JPG_PATH = `/users/avatar/${auuid}/${profile_path.split("/").pop()}`
            promises.push(File.moveFileFromTo(nic_front_path,NIC_FRONT_PATH))
            promises.push(File.moveFileFromTo(nic_back_path,NIC_BACK_JPG_PATH))
            promises.push(File.moveFileFromTo(profile_path,PROFILE_JPG_PATH))
            //create new user doc to store into firestore
            const phonenumber= userDataSnapshot.val().user_info.phonenumber;
            const momo_provider= userDataSnapshot.val().user_info.momo_provider;

            const userDoc = {
                fullName: userDataSnapshot.val().user_info.firstname + " " + userDataSnapshot.val().user_info.other_name ,
                firstName: userDataSnapshot.val().user_info.firstname,
                nicNumber: userDataSnapshot.val().user_info.nic_number,
                transaction_pin_code: userDataSnapshot.val().user_info.transaction_code,
                nicFrontUrl: NIC_FRONT_PATH,
                nicBackUrl: NIC_BACK_JPG_PATH,
                avatarUrl: PROFILE_JPG_PATH,
                public: true,
                timestamp: FieldValue.serverTimestamp(),
                average_rating: 0,
                rating_count: 0,
            }
            console.log(userDoc)
            promises.push(
                new Promise( (resolve , reject ) => {
                    const userListDocument = admin.firestore().doc("/bucket/usersList")
                    userListDocument.collection('users').add(userDoc)
                        .then((userRef)=>{
                            const doc = userRef.collection('momo_providers').doc();
                            promises.push(
                                doc.set({momo_provider , phonenumber, refPath: doc.path, authUid: auuid})
                            )
                            promises.push(
                                admin.database().ref(`/users/${auuid}`).set(userRef.path)
                            )
                            promises.push(
                                admin.firestore().runTransaction(t=>{
                                    return t.get(userListDocument)
                                        .then((usersListSnaphsot)=>{
                                            if(usersListSnaphsot.exists){
                                                const data = usersListSnaphsot.data();
                                                const count = data.userCount + 1
                                                t.update(userListDocument,{userCount: count})
                                            }
                                            reject('UsersListSnapshot exists not')
                                        })
                                    })
                            )
                            resolve("success")
                        })
                        .catch( err => reject(err))

                })
            )
            
            promises.push(admin.database().ref(`/intents/sign_up/${auuid}`).remove())
            return Promise.all(promises)
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

        if(intent.new_uid === intent.current_uid) return snapshot.ref.child("response").set({code: 201})
        
        return Auth.verifyUserDoesNotExistInDb(intent.new_uid)
                .then( result => {
                        return db.ref(`users/${intent.current_uid}`)
                                .once('value', data => {
                                    const firestoreRefPathString: string = data.val();
                                    const doc = admin.firestore().doc(`${firestoreRefPathString}`).collection(`/momo_providers`).doc();
                                    promises.push( 
                                        doc.set({momo_provider: intent.momo_provider , phonenumber: intent.new_uid_phonenumber, refPath: doc.path, authUid: intent.new_uid})
                                    )

                                    promises.push(
                                        db.ref(`users/${intent.new_uid}`).set( firestoreRefPathString )
                                            .then(val => {
                                                snapshot.ref.child("response")
                                                .set({code: 201})
                                            })
                                            .catch(err  => { console.log(`Error writting ressource at "users/${intent.new_uid}"`) })
                                    )
                                    return Promise.all(promises);
                                })
                })
                .catch( err => {
                    snapshot.ref.child("response")
                    .set({code: 409})
                })

    })

   static verifyUserDoesNotExistInDb = (uuid: string) => {
        const db = admin.database();
        const ref = db.ref(`users/${uuid}`);
        return new Promise((resolve, reject) => {
            ref.once("value", function(snapshot) {
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