"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const File_1 = require("../utils/File");
const FieldValue = require('firebase-admin').firestore.FieldValue;
/*
* responses are given here following the http response codes as per the following link.
* https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
*
*/
class Auth {
}
Auth.onSignUpComplete = functions.database.ref('/intents/sign_up/{auuid}/finished')
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    if (!snapshot.val())
        return false;
    const auuid = context.params.auuid;
    const userDataSnapshot = yield admin.database().ref(`/intents/sign_up/${auuid}`).once('value');
    //move images to correct bucket
    const promises = [];
    const nic_front_path = userDataSnapshot.val().NIC_FRONT_JPG.path;
    const nic_back_path = userDataSnapshot.val().NIC_BACK_JPG.path;
    const profile_path = userDataSnapshot.val().PROFILE_JPG.path;
    const NIC_FRONT_PATH = `/users/nic/${auuid}/${nic_front_path.split("/").pop()}`;
    const NIC_BACK_JPG_PATH = `/users/nic/${auuid}/${nic_back_path.split("/").pop()}`;
    const PROFILE_JPG_PATH = `/users/avatar/${auuid}/${profile_path.split("/").pop()}`;
    promises.push(File_1.File.moveFileFromTo(nic_front_path, NIC_FRONT_PATH));
    promises.push(File_1.File.moveFileFromTo(nic_back_path, NIC_BACK_JPG_PATH));
    promises.push(File_1.File.moveFileFromTo(profile_path, PROFILE_JPG_PATH));
    //create new user doc to store into firestore
    const phonenumber = userDataSnapshot.val().user_info.phonenumber;
    const momo_provider = userDataSnapshot.val().user_info.momo_provider;
    const userDoc = {
        fullName: userDataSnapshot.val().user_info.firstname + " " + userDataSnapshot.val().user_info.other_name,
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
    };
    console.log(userDoc);
    promises.push(new Promise((resolve, reject) => {
        const userListDocument = admin.firestore().doc("/bucket/usersList");
        userListDocument.collection('users').add(userDoc)
            .then((userRef) => {
            const doc = userRef.collection('momo_providers').doc();
            promises.push(doc.set({ momo_provider, phonenumber, refPath: doc.path, authUid: auuid }));
            promises.push(admin.database().ref(`/users/${auuid}`).set(userRef.path));
            promises.push(admin.firestore().runTransaction(t => {
                return t.get(userListDocument)
                    .then((usersListSnaphsot) => {
                    if (usersListSnaphsot.exists) {
                        const data = usersListSnaphsot.data();
                        const count = data.userCount + 1;
                        t.update(userListDocument, { userCount: count });
                    }
                    reject('UsersListSnapshot exists not');
                });
            }));
            resolve("success");
        })
            .catch(err => reject(err));
    }));
    promises.push(admin.database().ref(`/intents/sign_up/${auuid}`).remove());
    return Promise.all(promises);
}));
Auth.markPhoneNumberAsUsed = (phoneNumber) => __awaiter(this, void 0, void 0, function* () {
    return admin.firestore().collection("/used_phone_numbers").add({
        phoneNumber: phoneNumber
    });
});
Auth.onAssociateMomoNumberIntent = functions.database.ref('intents/associate_phonenumber/{timestamp_midnight_today}/{newRef}')
    .onCreate((snapshot) => {
    const db = admin.database();
    const promises = [];
    const intent = snapshot.val();
    if (intent.new_uid === intent.current_uid)
        return snapshot.ref.child("response").set({ code: 201 });
    return Auth.verifyUserDoesNotExistInDb(intent.new_uid)
        .then(result => {
        return db.ref(`users/${intent.current_uid}`)
            .once('value', data => {
            const firestoreRefPathString = data.val();
            const doc = admin.firestore().doc(`${firestoreRefPathString}`).collection(`/momo_providers`).doc();
            promises.push(doc.set({ momo_provider: intent.momo_provider, phonenumber: intent.new_uid_phonenumber, refPath: doc.path, authUid: intent.new_uid }));
            promises.push(db.ref(`users/${intent.new_uid}`).set(firestoreRefPathString)
                .then(val => {
                snapshot.ref.child("response")
                    .set({ code: 201 });
            })
                .catch(err => { console.log(`Error writting ressource at "users/${intent.new_uid}"`); }));
            return Promise.all(promises);
        });
    })
        .catch(err => {
        snapshot.ref.child("response")
            .set({ code: 409 });
    });
});
Auth.verifyUserDoesNotExistInDb = (uuid) => {
    const db = admin.database();
    const ref = db.ref(`users/${uuid}`);
    return new Promise((resolve, reject) => {
        ref.once("value", function (snapshot) {
            if (snapshot.exists()) {
                reject(false);
                ;
            }
            else {
                resolve(true);
            }
        });
    });
};
Auth.onDeleteMomoProviderIntent = functions.database.ref('intents/delete_momo_provider/{timestamp_midnight_today}/{newRef}')
    .onCreate((snapshot) => {
    const intent = snapshot.val();
    //@Fixme: checkout later on how to delete a user account created through firebase auth via code( js/nodejs)
    const doc = admin.firestore().doc(intent.ref_path);
    const firebaseDbRef = admin.database().ref(`users/${intent.auth_uid}`);
    const promises = [doc.delete(), firebaseDbRef.remove(), snapshot.ref.remove()];
    return Promise.all(promises);
});
exports.Auth = Auth;
//# sourceMappingURL=Auth.js.map