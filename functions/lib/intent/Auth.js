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
    .onUpdate((change, context) => __awaiter(this, void 0, void 0, function* () {
    const snapshot = change.after;
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
    const userDoc = {
        fullName: userDataSnapshot.val().user_info.fullName,
        firstName: userDataSnapshot.val().user_info.firstName,
        nicNumber: userDataSnapshot.val().user_info.nic_number,
        phoneNumber: userDataSnapshot.val().user_info.phoneNumber,
        nicFrontUrl: NIC_FRONT_PATH,
        nicBackUrl: NIC_BACK_JPG_PATH,
        avatarUrl: PROFILE_JPG_PATH,
        public: true,
        timestamp: FieldValue.serverTimestamp()
    };
    console.log(userDoc);
    promises.push(admin.firestore().collection("/bucket/usersList/users").add(userDoc).then((userRef) => {
        return admin.database().ref(`/users/${auuid}`).set(userRef);
    }));
    /*promises.push(admin.firestore().doc("/bucket/usersList").get().then((usersListSnaphsot)=>{
        let count = 0
        if(usersListSnaphsot.data().usersCount !==undefined && usersListSnaphsot.data().usersCount !==null)
            count = usersListSnaphsot.data().usersCount + 1
        return usersListSnaphsot.ref.set({usersCount: count},{merge: true})
    }))*/
    promises.push(admin.firestore().runTransaction(t => {
        const ref = admin.firestore().doc("/bucket/usersList");
        return t.get(ref).then((usersListSnaphsot) => {
            const count = usersListSnaphsot.data().usersCount + 1;
            return t.update(ref, { usersCount: count });
        });
    }));
    //promises.push(Auth.markPhoneNumberAsUsed(userDataSnapshot.val().user_info.phoneNumber))
    promises.push(admin.database().ref(`/intents/sign_up/${auuid}`).remove());
    return Promise.all(promises);
}));
Auth.markPhoneNumberAsUsed = (phoneNumber) => __awaiter(this, void 0, void 0, function* () {
    return admin.firestore().collection("/used_phone_numbers").add({
        phoneNumber: phoneNumber
    });
});
Auth.onAssociateMomoNumberIntent = functions.database.ref('intents/associate_phonenumber/{timestamp_midnight_today}/{newRef}')
    .onCreate((snapshot, context) => {
    const db = admin.database();
    const intent = snapshot.val();
    if (intent.new_uid === intent.current_uid)
        return snapshot.ref.child("response").set({ code: 201 });
    return Auth.verifyUserDoesNotExistInDb(intent.new_uid)
        .then(result => {
        if (result) {
            db.ref(`users/${intent.current_uid}`)
                .once('value', data => {
                //  const { userRef } = data.val();
                console.log(intent.new_uid);
                db.ref(`users/${intent.new_uid}`).set(data.val())
                    .then(val => {
                    snapshot.ref.child("response")
                        .set({ code: 201 });
                })
                    .catch(err => { console.log(`Error writting ressource at "users/${intent.new_uid}"`); });
            });
        }
        return null;
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
exports.Auth = Auth;
//# sourceMappingURL=Auth.js.map